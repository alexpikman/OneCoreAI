import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Server } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { AI_RESOURCE_STYLES as styles } from '../../utils/uiStyle';
import { AIResourcePageLayout } from '../layout/AIResourcePageLayout';
import { PageContent } from '../layout/PageContent';
import { PageHeader } from '../layout/PageHeader';

interface LlamaSlot {
  id: number;
  isProcessing: boolean;
  state: string | null;
  nCtx: number | null;
  nPast: number | null;
  nTokens: number | null;
}

interface RuntimeUsage {
  activeSlots: number;
  totalSlots: number;
  usedContextTokens: number;
  totalContextTokens: number;
}

interface Telemetry {
  baseUrl: string;
  slots: LlamaSlot[];
  sampledAt: string;
}

interface LlamaRequest {
  id: string;
  startedAt: string;
  finishedAt: string;
  providerId: string;
  requestedModel: string;
  usedModel: string;
  stream: boolean;
  status: 'success' | 'error' | 'cancelled';
  durationMs: number;
  ttftMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  tokensPerSecond: number | null;
  runtimeUsageAtStart: RuntimeUsage | null;
  runtimeUsageAtEnd: RuntimeUsage | null;
  error?: string;
}

function formatTokens(value: number | null): string {
  return value === null ? '—' : value.toLocaleString();
}

function formatDuration(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} с` : `${Math.round(value)} мс`;
}

function buildPolyline(values: number[]): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = 24 + (index / (values.length - 1)) * 592;
    const y = 142 - ((value - min) / range) * 118;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export const LlamaServerTelemetryView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [history, setHistory] = useState<LlamaRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/models/llama-cpp/telemetry');
      const data = await response.json() as { ok?: boolean; error?: string; baseUrl?: string; slots?: LlamaSlot[]; sampledAt?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setTelemetry({ baseUrl: data.baseUrl ?? '', slots: data.slots ?? [], sampledAt: data.sampledAt ?? '' });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось получить telemetry.');
      setTelemetry(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await apiFetch('/api/models/llama-cpp/requests?limit=100');
      const data = await response.json() as { ok?: boolean; error?: string; history?: LlamaRequest[] };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setHistory(data.history ?? []);
      setHistoryError(null);
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'Не удалось получить историю запросов.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshHistory();
    const telemetryTimer = window.setInterval(() => void refresh(), 3000);
    const historyTimer = window.setInterval(() => void refreshHistory(), 15000);
    return () => {
      window.clearInterval(telemetryTimer);
      window.clearInterval(historyTimer);
    };
  }, [refresh, refreshHistory]);

  const activeSlots = telemetry?.slots.filter((slot) => slot.isProcessing).length ?? 0;
  const totalContext = telemetry?.slots.reduce((sum, slot) => sum + (slot.nCtx ?? 0), 0) ?? 0;
  const hasContextUsage = telemetry?.slots.some((slot) => slot.nPast !== null) ?? false;
  const usedContext = telemetry?.slots.reduce((sum, slot) => sum + (slot.nPast ?? 0), 0) ?? 0;

  const successfulRequests = useMemo(
    () => history.filter((request) => request.status === 'success').slice(0, 30).reverse(),
    [history],
  );
  const latencyPoints = useMemo(
    () => buildPolyline(successfulRequests.map((request) => request.durationMs)),
    [successfulRequests],
  );
  const throughputPoints = useMemo(
    () => buildPolyline(successfulRequests.flatMap((request) => request.tokensPerSecond === null ? [] : [request.tokensPerSecond])),
    [successfulRequests],
  );
  const contextLoadPoints = useMemo(
    () => buildPolyline(successfulRequests.flatMap((request) => {
      const sample = request.runtimeUsageAtStart ?? request.runtimeUsageAtEnd;
      if (!sample || sample.totalContextTokens <= 0) return [];
      return [Number((sample.usedContextTokens * 100 / sample.totalContextTokens).toFixed(1))];
    })),
    [successfulRequests],
  );
  const activeSlotLoadPoints = useMemo(
    () => buildPolyline(successfulRequests.flatMap((request) => {
      const sample = request.runtimeUsageAtStart ?? request.runtimeUsageAtEnd;
      if (!sample || sample.totalSlots <= 0) return [];
      return [Number((sample.activeSlots * 100 / sample.totalSlots).toFixed(1))];
    })),
    [successfulRequests],
  );
  const totalPromptTokens = history.reduce((sum, request) => sum + (request.promptTokens ?? 0), 0);
  const totalCompletionTokens = history.reduce((sum, request) => sum + (request.completionTokens ?? 0), 0);
  const measuredRequests = history.filter((request) => request.status === 'success').length;

  const body = (
    <div className={cn('space-y-4', !embedded && 'py-5')}>
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            PagedAttention · нагрузка и история
          </div>
          <button
            type="button"
            onClick={() => {
              void refresh();
              void refreshHistory();
            }}
            disabled={loading || historyLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (loading || historyLoading) && 'animate-spin')} />
            Обновить
          </button>
        </div>
      )}
      <div className="rounded-xl border border-blue-300/60 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200">
        Этот runtime — llama.cpp, не vLLM. История содержит реальные данные usage и /slots. Логические PagedAttention-блоки LLMS, VRAM, GPU utilization и CPU utilization не выдаются за измерения llama.cpp.
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      {historyError && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{historyError}</div>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cn(styles.panel, 'p-4')}>
              <div className={styles.description}>Активные слоты</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{activeSlots} / {telemetry?.slots.length ?? '—'}</div>
            </div>
            <div className={cn(styles.panel, 'p-4')}>
              <div className={styles.description}>Использованный контекст сейчас</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{telemetry && hasContextUsage ? `${usedContext.toLocaleString()} / ${totalContext.toLocaleString()}` : '—'}</div>
            </div>
            <div className={cn(styles.panel, 'p-4')}>
              <div className={styles.description}>Успешные запросы в истории</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{measuredRequests}</div>
            </div>
            <div className={cn(styles.panel, 'p-4')}>
              <div className={styles.description}>Токены по сохранённой истории</div>
              <div className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{(totalPromptTokens + totalCompletionTokens).toLocaleString()}</div>
              <div className={styles.description}>Вход: {totalPromptTokens.toLocaleString()} · Выход: {totalCompletionTokens.toLocaleString()}</div>
            </div>
          </div>

          {telemetry && (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>Слоты llama-server (/slots)</div>
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="break-all text-zinc-700 dark:text-zinc-300">{telemetry.baseUrl}</span>
                  <span className={styles.description}>Опрос: 3 с · {new Date(telemetry.sampledAt).toLocaleTimeString()}</span>
                </div>
                {telemetry.slots.length ? telemetry.slots.map((slot) => (
                  <div key={slot.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100"><Server className="h-3.5 w-3.5 text-zinc-500" />Slot {slot.id}</div>
                      <span className={cn('rounded-full px-2 py-1 text-[10px] font-medium', slot.isProcessing ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300')}>{slot.isProcessing ? 'Обрабатывает запрос' : slot.state || 'Свободен'}</span>
                    </div>
                    {slot.nPast !== null && slot.nCtx !== null && <progress value={slot.nPast} max={slot.nCtx || 1} className="mt-3 h-2 w-full accent-blue-500" />}
                    <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400"><span>Контекст: {formatTokens(slot.nPast)} / {formatTokens(slot.nCtx)}</span><span>Токенов: {formatTokens(slot.nTokens)}</span></div>
                  </div>
                )) : <p className={styles.description}>llama-server не сообщил слоты.</p>}
              </div>
            </section>
          )}

          <section className={styles.panel}>
            <div className={styles.panelHeader}>Графики нагрузки по завершённым запросам</div>
            <div className="grid gap-4 p-4 xl:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2"><h2 className={styles.title}>Длительность запроса</h2><span className={styles.description}>мс</span></div>
                {latencyPoints ? (
                  <svg viewBox="0 0 640 160" role="img" aria-label="График длительности последних запросов" className="h-40 w-full overflow-visible text-blue-500">
                    <line x1="24" y1="24" x2="616" y2="24" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="83" x2="616" y2="83" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="142" x2="616" y2="142" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <polyline points={latencyPoints} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : <p className={styles.description}>Недостаточно завершённых запросов для графика.</p>}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2"><h2 className={styles.title}>Скорость генерации</h2><span className={styles.description}>tokens/sec</span></div>
                {throughputPoints ? (
                  <svg viewBox="0 0 640 160" role="img" aria-label="График скорости генерации последних запросов" className="h-40 w-full overflow-visible text-emerald-500">
                    <line x1="24" y1="24" x2="616" y2="24" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="83" x2="616" y2="83" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="142" x2="616" y2="142" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <polyline points={throughputPoints} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : <p className={styles.description}>Runtime не предоставил token usage для построения графика.</p>}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2"><h2 className={styles.title}>Загрузка контекста</h2><span className={styles.description}>% от доступного контекста</span></div>
                {contextLoadPoints ? (
                  <svg viewBox="0 0 640 160" role="img" aria-label="График использования контекста" className="h-40 w-full overflow-visible text-violet-500">
                    <line x1="24" y1="24" x2="616" y2="24" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="83" x2="616" y2="83" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="142" x2="616" y2="142" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <polyline points={contextLoadPoints} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : <p className={styles.description}>Runtime не сообщил занятость контекста в /slots.</p>}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2"><h2 className={styles.title}>Загрузка слотов</h2><span className={styles.description}>% занятых слотов</span></div>
                {activeSlotLoadPoints ? (
                  <svg viewBox="0 0 640 160" role="img" aria-label="График занятости слотов" className="h-40 w-full overflow-visible text-amber-500">
                    <line x1="24" y1="24" x2="616" y2="24" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="83" x2="616" y2="83" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <line x1="24" y1="142" x2="616" y2="142" className="stroke-zinc-200 dark:stroke-zinc-800" />
                    <polyline points={activeSlotLoadPoints} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : <p className={styles.description}>Runtime не сообщил количество слотов.</p>}
              </div>
            </div>
            <div className="border-t border-zinc-100 px-4 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">Графики используют последние 30 успешных запросов. Снимки /slots снимаются перед запросом и после завершения; при параллельности это общая нагрузка runtime, а не эксклюзивное потребление одного запроса. При отсутствии usage данные не оцениваются по длине текста.</div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>История запросов LlamaServer</div>
            {history.length ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {history.slice(0, 100).map((request) => (
                  <article key={request.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{request.usedModel || request.requestedModel}</div>
                        <div className={styles.description}>{new Date(request.startedAt).toLocaleString()} · {request.stream ? 'Streaming' : 'Non-streaming'}</div>
                      </div>
                      <span className={cn('rounded-full px-2 py-1 text-[10px] font-medium', request.status === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : request.status === 'cancelled' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300')}>{request.status === 'success' ? 'Успешно' : request.status === 'cancelled' ? 'Отменён' : 'Ошибка'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 xl:grid-cols-6">
                      <div><div className={styles.description}>Длительность</div><div className="font-mono text-zinc-800 dark:text-zinc-200">{formatDuration(request.durationMs)}</div></div>
                      <div><div className={styles.description}>TTFT</div><div className="font-mono text-zinc-800 dark:text-zinc-200">{request.ttftMs === null ? '—' : formatDuration(request.ttftMs)}</div></div>
                      <div><div className={styles.description}>Входные токены</div><div className="font-mono text-zinc-800 dark:text-zinc-200">{formatTokens(request.promptTokens)}</div></div>
                      <div><div className={styles.description}>Выходные токены</div><div className="font-mono text-zinc-800 dark:text-zinc-200">{formatTokens(request.completionTokens)}</div></div>
                      <div><div className={styles.description}>Скорость</div><div className="font-mono text-zinc-800 dark:text-zinc-200">{request.tokensPerSecond === null ? '—' : `${request.tokensPerSecond} tok/s`}</div></div>
                      <div><div className={styles.description}>Слоты / контекст</div><div className="font-mono text-zinc-800 dark:text-zinc-200">{request.runtimeUsageAtStart || request.runtimeUsageAtEnd ? (() => { const start = request.runtimeUsageAtStart; const end = request.runtimeUsageAtEnd; const startContext = start ? `${start.usedContextTokens.toLocaleString()}/${start.totalContextTokens.toLocaleString()}` : '—'; const endContext = end ? `${end.usedContextTokens.toLocaleString()}/${end.totalContextTokens.toLocaleString()}` : '—'; return `${start?.activeSlots ?? '—'}→${end?.activeSlots ?? '—'} слотов · ${startContext}→${endContext} ctx`; })() : 'Нет снимка'}</div></div>
                    </div>
                    {request.error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{request.error}</p>}
                  </article>
                ))}
              </div>
            ) : <p className="p-4 text-xs text-zinc-500 dark:text-zinc-400">{historyLoading ? 'Загрузка истории…' : 'История пока пуста. Новые запросы к управляемому LlamaServer будут сохраняться автоматически.'}</p>}
            <div className="border-t border-zinc-100 px-4 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Локальный GGUF runtime не тарифицируется по API. Стоимость в валюте не рассчитывается. Доступные ресурсные показатели: токены, время, скорость, активные слоты и занятый контекст. VRAM/GPU/CPU usage по /slots недоступны.
            </div>
          </section>
    </div>
  );

  if (embedded) return body;

  return (
    <AIResourcePageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'refresh-llama-telemetry',
            label: 'Обновить',
            icon: <RefreshCw className={cn('h-3.5 w-3.5', (loading || historyLoading) && 'animate-spin')} />,
            onClick: () => {
              void refresh();
              void refreshHistory();
            },
            disabled: loading || historyLoading,
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">PagedAttention · нагрузка и история</h1>
        </div>
      </PageHeader>
      <PageContent>{body}</PageContent>
    </AIResourcePageLayout>
  );
};

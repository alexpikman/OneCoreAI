import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Play, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { PageContent } from '../layout/PageContent';
import { PageHeader } from '../layout/PageHeader';
import { AIResourcePageLayout as PageLayout } from '../layout/AIResourcePageLayout';

interface BenchmarkResult { index: number; prompt: string; latencyMs: number; completionTokens: number | null; tokensPerSecond: number | null; error?: string; }
interface BenchmarkRun { id: string; createdAt: string; model: string; requestCount: number; successful: number; failed: number; totalTokens: number | null; totalDurationMs: number; aggregateTokensPerSecond: number | null; results: BenchmarkResult[]; }

export const LlamaServerBenchmarkView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { freeProviders } = useOneCoreStore();
  const llamaProvider = freeProviders.find((provider) => provider.kind === 'llama-cpp');
  const providerId = llamaProvider?.id ?? '';
  const [count, setCount] = useState(4);
  const [model, setModel] = useState(llamaProvider?.selectedModel ?? 'local-model');
  const [history, setHistory] = useState<BenchmarkRun[]>([]);
  const [run, setRun] = useState<BenchmarkRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshHistory = useCallback(async () => {
    try {
      const response = await apiFetch('/api/models/llama-cpp/benchmark/history');
      const data = await response.json() as { ok?: boolean; history?: BenchmarkRun[] };
      if (response.ok && data.ok) setHistory(data.history ?? []);
    } catch { /* Keep the last loaded history. */ }
  }, []);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);
  const execute = async () => {
    if (!providerId) { setError('Провайдер LlamaServer не настроен.'); return; }
    setBusy(true); setError(null); setRun(null);
    try {
      const prompts = [
        'Назови три ключевых принципа масштабирования веб-сервисов и кратко поясни каждый.',
        'Объясни разницу между задержкой до первого токена и скоростью генерации.',
        'Напиши компактную функцию бинарного поиска на TypeScript с проверкой границ.',
        'Сравни HTTP/1.1, HTTP/2 и SSE для потоковой передачи текста.',
        'Составь чеклист проверки готовности REST API к production.',
        'Объясни назначение KV-cache в autoregressive inference.',
      ];
      const results: BenchmarkResult[] = [];
      const startedAt = performance.now();
      for (let index = 0; index < count; index += 1) {
        const prompt = prompts[index];
        const requestStartedAt = performance.now();
        try {
          const response = await apiFetch('/api/providers/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId, model, temperature: 0.2, stream: false, messages: [{ role: 'user', content: prompt }] }),
          });
          const data = await response.json() as { ok?: boolean; completionTokens?: number; error?: string };
          if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
          const latencyMs = Math.round(performance.now() - requestStartedAt);
          const completionTokens = typeof data.completionTokens === 'number' && Number.isFinite(data.completionTokens) ? data.completionTokens : null;
          results.push({ index: index + 1, prompt, latencyMs, completionTokens, tokensPerSecond: completionTokens !== null && latencyMs > 0 ? Number((completionTokens * 1000 / latencyMs).toFixed(2)) : null });
        } catch (cause) {
          results.push({ index: index + 1, prompt, latencyMs: Math.round(performance.now() - requestStartedAt), completionTokens: null, tokensPerSecond: null, error: cause instanceof Error ? cause.message : 'Запрос завершился ошибкой.' });
        }
      }
      const successful = results.filter((item) => !item.error);
      const allUsageReported = successful.length > 0 && successful.every((item) => item.completionTokens !== null);
      const totalTokens = allUsageReported ? successful.reduce((sum, item) => sum + (item.completionTokens ?? 0), 0) : null;
      const totalDurationMs = Math.round(performance.now() - startedAt);
      const nextRun: BenchmarkRun = {
        id: crypto.randomUUID(), createdAt: new Date().toISOString(), model, requestCount: count,
        successful: successful.length, failed: count - successful.length, totalTokens, totalDurationMs,
        aggregateTokensPerSecond: totalTokens !== null && totalDurationMs > 0 ? Number((totalTokens * 1000 / totalDurationMs).toFixed(2)) : null,
        results,
      };
      const saveResponse = await apiFetch('/api/models/llama-cpp/benchmark/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run: nextRun }),
      });
      const saved = await saveResponse.json() as { ok?: boolean; history?: BenchmarkRun[]; error?: string };
      if (!saveResponse.ok || !saved.ok) throw new Error(saved.error || `HTTP ${saveResponse.status}`);
      setRun(nextRun); setHistory(saved.history ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось выполнить benchmark.'); }
    finally { setBusy(false); }
  };
  const body = (
    <div className={embedded ? 'space-y-4' : 'space-y-4 py-5'}>
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Бенчмарк llama-server
          </div>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Обновить историю
          </button>
        </div>
      )}
      {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40"><label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">Количество запросов<select value={count} onChange={(event) => setCount(Number(event.target.value))} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">{[1,2,3,4,5,6].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="min-w-48 flex-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">Model ID<input value={model} onChange={(event) => setModel(event.target.value)} maxLength={200} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" /></label><button type="button" onClick={() => void execute()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"><Play className="h-3.5 w-3.5" />{busy ? 'Тестирование…' : 'Запустить benchmark'}</button></div>
      {run && <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40"><div className="grid gap-3 sm:grid-cols-4"><div><div className="text-[10px] text-zinc-500">Успешно</div><div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{run.successful} / {run.requestCount}</div></div><div><div className="text-[10px] text-zinc-500">Ошибок</div><div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{run.failed}</div></div><div><div className="text-[10px] text-zinc-500">Общее время</div><div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{(run.totalDurationMs / 1000).toFixed(1)} с</div></div><div><div className="text-[10px] text-zinc-500">Скорость batch</div><div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{run.aggregateTokensPerSecond === null ? '—' : `${run.aggregateTokensPerSecond.toFixed(2)} tok/s`}</div></div></div><div className="space-y-2">{run.results.map((item) => <div key={item.index} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"><div className="flex flex-wrap justify-between gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200"><span>Запрос {item.index}</span><span>{item.error ? 'Ошибка' : `${item.latencyMs} мс · ${item.tokensPerSecond === null ? 'скорость не предоставлена' : `${item.tokensPerSecond} tok/s`} · ${item.completionTokens ?? '—'} tokens`}</span></div><p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{item.error || item.prompt}</p></div>)}</div></section>}
      <section className="space-y-2"><h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">История последних запусков</h2>{history.length ? history.slice().reverse().map((item) => <button key={item.id} type="button" onClick={() => setRun(item)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs dark:border-zinc-800 dark:bg-zinc-950/40"><span className="text-zinc-800 dark:text-zinc-200">{new Date(item.createdAt).toLocaleString()} · {item.model}</span><span className="text-zinc-500">{item.successful}/{item.requestCount} · {item.aggregateTokensPerSecond === null ? 'нет token usage' : `${item.aggregateTokensPerSecond} tok/s`}</span></button>) : <p className="text-xs text-zinc-500 dark:text-zinc-400">История пока пуста.</p>}</section>
    </div>
  );

  if (embedded) return body;

  return <PageLayout>
    <PageHeader
      showSave={false}
      actions={[
        {
          id: 'refresh-benchmark-history',
          label: 'История',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          onClick: () => void refreshHistory(),
          variant: 'secondary',
        },
      ]}
    >
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
        <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-semibold">Бенчмарк llama-server</h1>
      </div>
    </PageHeader>
    <PageContent>{body}</PageContent>
  </PageLayout>;
};

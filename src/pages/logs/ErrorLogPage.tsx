import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentJournalEvent } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

interface OperationRecord {
  id: string;
  kind: string;
  label: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

interface LlamaRequestRecord {
  id: string;
  startedAt: string;
  finishedAt: string;
  providerId: string;
  usedModel: string;
  status: 'success' | 'error' | 'cancelled';
  durationMs: number;
  error?: string;
}

interface UnifiedErrorRecord {
  id: string;
  source: 'journal' | 'operations' | 'llama';
  timestamp: string;
  severity: 'error' | 'warn' | 'cancelled';
  title: string;
  message: string;
  details: string;
}

export const ErrorLogPage: React.FC = () => {
  const { uiStyle } = useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);

  const [records, setRecords] = useState<UnifiedErrorRecord[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'journal' | 'operations' | 'llama'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [journalRes, opsRes, reqRes] = await Promise.all([
        apiFetch('/api/agent-journal'),
        apiFetch('/api/operations'),
        apiFetch('/api/models/llama-cpp/requests?limit=200'),
      ]);

      const next: UnifiedErrorRecord[] = [];

      if (journalRes.ok) {
        const jData = (await journalRes.json()) as { ok?: boolean; events?: AgentJournalEvent[] };
        for (const ev of jData.events ?? []) {
          if (ev.status === 'failed' || ev.status === 'cancelled' || ev.level === 'error' || ev.level === 'warning') {
            next.push({
              id: `journal:${ev.id}`,
              source: 'journal',
              timestamp: ev.timestamp,
              severity: ev.status === 'cancelled' ? 'cancelled' : ev.level === 'warning' ? 'warn' : 'error',
              title: ev.title,
              message: ev.summary,
              details: `${ev.source} · ${ev.category} · op=${ev.operationId}`,
            });
          }
        }
      }

      if (opsRes.ok) {
        const oData = (await opsRes.json()) as { ok?: boolean; operations?: OperationRecord[] };
        for (const op of oData.operations ?? []) {
          if (op.status === 'failed' || op.status === 'cancelled' || op.error) {
            next.push({
              id: `op:${op.id}`,
              source: 'operations',
              timestamp: op.finishedAt || op.startedAt,
              severity: op.status === 'cancelled' ? 'cancelled' : 'error',
              title: `${op.kind}: ${op.label}`,
              message: op.error || `Операция завершилась со статусом ${op.status}`,
              details: `op=${op.id}`,
            });
          }
        }
      }

      if (reqRes.ok) {
        const rData = (await reqRes.json()) as { ok?: boolean; history?: LlamaRequestRecord[] };
        for (const req of rData.history ?? []) {
          if (req.status === 'error' || req.status === 'cancelled' || req.error) {
            next.push({
              id: `llama:${req.id}`,
              source: 'llama',
              timestamp: req.finishedAt || req.startedAt,
              severity: req.status === 'cancelled' ? 'cancelled' : 'error',
              title: `LLM запрос · ${req.providerId} / ${req.usedModel}`,
              message: req.error || `Запрос завершился со статусом ${req.status}`,
              details: `duration=${req.durationMs} мс`,
            });
          }
        }
      }

      next.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setRecords(next);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Не удалось загрузить журнал ошибок.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadErrors();
  }, [loadErrors]);

  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((rec) => {
      if (sourceFilter !== 'all' && rec.source !== sourceFilter) return false;
      if (!q) return true;
      return `${rec.title} ${rec.message} ${rec.details}`.toLowerCase().includes(q);
    });
  }, [records, sourceFilter, query]);

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'refresh-error-log',
            label: 'Обновить',
            icon: <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />,
            onClick: () => void loadErrors(),
            disabled: loading,
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <h1 className="text-xl font-semibold">Журнал ошибок</h1>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по тексту ошибки или операции…"
              className={cn(
                'w-full h-9 pl-8 pr-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs',
                tokens.inputRadius,
              )}
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
            className={cn(
              'h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs',
              tokens.inputRadius,
            )}
          >
            <option value="all">Все источники ({records.length})</option>
            <option value="journal">Журнал агента</option>
            <option value="operations">Реестр операций</option>
            <option value="llama">Запросы моделей</option>
          </select>
        </div>

        {loadError && (
          <p role="alert" className="text-xs text-rose-500">
            {loadError}
          </p>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500">Загрузка ошибок…</div>
        ) : visibleRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-xs text-zinc-500 dark:border-zinc-700">
            Ошибок и отказов не зарегистрировано.
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleRecords.map((rec) => (
              <article
                key={rec.id}
                className={cn(
                  'p-4 border space-y-1.5',
                  tokens.cardRadius,
                  rec.severity === 'error'
                    ? 'border-rose-300 bg-rose-50/40 dark:border-rose-900/70 dark:bg-rose-950/20'
                    : rec.severity === 'warn'
                      ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900/70 dark:bg-amber-950/20'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{rec.title}</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {rec.source} · {new Date(rec.timestamp).toLocaleString('ru-RU')}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">{rec.message}</p>
                <div className="font-mono text-[10px] text-zinc-400 break-all">{rec.details}</div>
              </article>
            ))}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
};

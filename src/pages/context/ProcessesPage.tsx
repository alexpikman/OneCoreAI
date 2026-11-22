import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, CircleDot, Radio, RefreshCw, Search, Workflow, XCircle } from 'lucide-react';
import type { AgentJournalEvent, AgentJournalStatus } from '../../types/onecore';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';

interface ProcessesPageProps {
  projectFilterId: string;
  onProjectFilterChange: (projectId: string) => void;
  onProjectCountChange: (count: number) => void;
}

interface OperationSummary {
  id: string;
  parentOperationId?: string;
  method: string;
  path: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

const STATUS_LABELS: Record<AgentJournalStatus, string> = {
  running: 'В процессе',
  completed: 'Завершено',
  failed: 'Ошибка',
  cancelled: 'Отменено',
  info: 'Событие',
};

const OPERATION_STATUS_LABELS: Record<OperationSummary['status'], string> = {
  running: 'Выполняется',
  completed: 'Завершена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
};

const COVERAGE_STATUS_LABELS: Record<string, string> = {
  instrumented: 'инструментирован',
  implemented: 'реализован',
  'runtime-enforced': 'проверяется в runtime',
  partial: 'частично',
  'not-instrumented': 'не инструментирован',
  'not-implemented': 'не реализован',
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}

function mergeEvent(current: AgentJournalEvent[], event: AgentJournalEvent): AgentJournalEvent[] {
  const next = current.filter((item) => item.id !== event.id);
  next.push(event);
  return next.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 1000);
}

export const ProcessesPage: React.FC<ProcessesPageProps> = ({
  projectFilterId,
  onProjectFilterChange,
  onProjectCountChange,
}) => {
  const { projects } = useOneCoreStore();
  const [events, setEvents] = useState<AgentJournalEvent[]>([]);
  const [operations, setOperations] = useState<OperationSummary[]>([]);
  const [coverage, setCoverage] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentJournalStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'map' | 'journal'>('map');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/system-map');
      const data = (await response.json()) as {
        ok?: boolean;
        events?: AgentJournalEvent[];
        operations?: OperationSummary[];
        coverage?: Record<string, string>;
        error?: string;
      };
      if (!response.ok || !data.ok || !Array.isArray(data.events)) {
        throw new Error(data.error || 'Не удалось загрузить карту процессов');
      }
      setEvents((current) => {
        const merged = new Map<string, AgentJournalEvent>();
        data.events!.forEach((event) => merged.set(event.id, event));
        current.forEach((event) => merged.set(event.id, event));
        return [...merged.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 1000);
      });
      setOperations(Array.isArray(data.operations) ? data.operations : []);
      setCoverage(data.coverage ?? {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить карту процессов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshEvents();
    const controller = new AbortController();
    let active = true;

    void apiFetch('/api/agent-journal/stream', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        if (active) setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            const line = block.split(/\r?\n/).find((entry) => entry.startsWith('data:'));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(5).trim()) as AgentJournalEvent;
              setEvents((current) => mergeEvent(current, event));
            } catch {
              // Ignore malformed events without interrupting the stream.
            }
          }
        }
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setConnected(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshEvents]);

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      if (projectFilterId && event.projectId !== projectFilterId) return false;
      if (statusFilter !== 'all' && event.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const trace = event.trace;
      return [
        event.title,
        event.summary,
        event.source,
        event.projectId ?? '',
        trace?.stageLabel ?? '',
        trace?.actorId ?? '',
        trace?.modelId ?? '',
        trace?.toolName ?? '',
        trace?.instructionId ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [events, projectFilterId, statusFilter, query]);

  const operationGroups = useMemo(() => {
    const groups = new Map<string, AgentJournalEvent[]>();
    for (const event of visibleEvents) {
      const current = groups.get(event.operationId) ?? [];
      current.push(event);
      groups.set(event.operationId, current);
    }
    return [...groups.entries()]
      .map(([operationId, items]) => ({
        operationId,
        events: items.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
        operation: operations.find((item) => item.id === operationId),
      }))
      .sort((a, b) =>
        (b.events[b.events.length - 1]?.timestamp ?? '').localeCompare(
          a.events[a.events.length - 1]?.timestamp ?? '',
        ),
      );
  }, [visibleEvents, operations]);

  useEffect(() => {
    onProjectCountChange(
      new Set(visibleEvents.map((event) => event.projectId).filter((id): id is string => Boolean(id))).size,
    );
  }, [visibleEvents, onProjectCountChange]);

  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId);

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'refresh-processes',
            label: 'Обновить',
            icon: <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />,
            onClick: () => void refreshEvents(),
            disabled: loading,
            title: 'Обновить процессы',
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Workflow className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Процессы</h1>
          <span
            className={
              connected
                ? 'ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'ml-1 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
            }
          >
            <Radio className="h-3 w-3" /> {connected ? 'Live' : 'Нет соединения'}
          </span>
        </div>
      </PageHeader>

      <PageContent>
        <div className="flex flex-col gap-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                aria-pressed={viewMode === 'map'}
                className={
                  viewMode === 'map'
                    ? 'rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-300'
                    : 'rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }
              >
                Живая карта
              </button>
              <button
                type="button"
                onClick={() => setViewMode('journal')}
                aria-pressed={viewMode === 'journal'}
                className={
                  viewMode === 'journal'
                    ? 'rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-300'
                    : 'rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }
              >
                Журнал событий
              </button>
            </div>
            <span className="text-[11px] tabular-nums text-zinc-500">
              {visibleEvents.length} событий · {operationGroups.length} операций
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по процессам…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-zinc-800 outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <select
              aria-label="Фильтр по проекту"
              value={projectFilterId}
              onChange={(event) => onProjectFilterChange(event.target.value)}
              className="h-9 min-w-[170px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="">Все проекты</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Фильтр по статусу"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AgentJournalStatus | 'all')}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="all">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-[11px] leading-relaxed text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200">
            <span className="font-semibold">Покрытие трассировки и контрактов:</span>
            <span>
              Project Agent — {COVERAGE_STATUS_LABELS[coverage.projectAgent] ?? coverage.projectAgent ?? 'неизвестно'}
            </span>
            <span>
              · Provider Chat — {COVERAGE_STATUS_LABELS[coverage.providerChat] ?? coverage.providerChat ?? 'неизвестно'}
            </span>
            <span>
              · Manager / Dispatcher — {COVERAGE_STATUS_LABELS[coverage.managerDispatcher] ?? coverage.managerDispatcher ?? 'неизвестно'}
            </span>
            <span>
              · Инструкции — {COVERAGE_STATUS_LABELS[coverage.instructionBinding] ?? coverage.instructionBinding ?? 'неизвестно'}
            </span>
          </div>

          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
          {loading && events.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">Загрузка карты процессов…</div>
          ) : visibleEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-xs text-zinc-500 dark:border-zinc-700">
              Событий пока нет
            </div>
          ) : viewMode === 'map' ? (
            <div className="space-y-4">
              {operationGroups.map((group) => (
                <section
                  key={group.operationId}
                  className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <div className="min-w-0">
                      <h2 className="break-all text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {group.operation?.method ?? 'EVENT'} {group.operation?.path ?? 'Операция журнала'}
                      </h2>
                      <p className="mt-1 break-all font-mono text-[10px] text-zinc-400">{group.operationId}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {group.events.length} этапов/событий · {group.events[0] ? formatDate(group.events[0].timestamp) : ''}
                      </p>
                      {group.operation?.parentOperationId && (
                        <p className="mt-1 break-all text-[10px] text-zinc-400">
                          Родительская операция: {group.operation.parentOperationId}
                        </p>
                      )}
                    </div>
                    {group.operation && (
                      <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {OPERATION_STATUS_LABELS[group.operation.status]}
                      </span>
                    )}
                  </div>
                  <ol className="mt-4 space-y-0">
                    {group.events.map((event, index) => {
                      const trace = event.trace;
                      const selected = selectedEvent?.id === event.id;
                      const StageIcon =
                        event.status === 'failed'
                          ? XCircle
                          : event.status === 'completed'
                            ? CheckCircle2
                            : CircleDot;
                      return (
                        <li key={event.id} className="relative pl-8">
                          {index < group.events.length - 1 && (
                            <span className="absolute bottom-0 left-[9px] top-5 w-px bg-zinc-200 dark:bg-zinc-700" />
                          )}
                          <span
                            className={
                              event.status === 'failed'
                                ? 'absolute left-0 top-1 text-rose-500'
                                : event.status === 'running'
                                  ? 'absolute left-0 top-1 text-blue-500'
                                  : 'absolute left-0 top-1 text-emerald-500'
                            }
                          >
                            <StageIcon className="h-[18px] w-[18px]" />
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedEventId(selected ? null : event.id)}
                            aria-expanded={selected}
                            className="mb-3 w-full rounded-lg border border-transparent p-2 text-left transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/60"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {trace?.stageLabel ?? event.title}
                              </span>
                              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {STATUS_LABELS[event.status]}
                              </span>
                              {!trace && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                  Подробная трассировка не записана
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                              {event.summary}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                              <span>{formatDate(event.timestamp)}</span>
                              <span>{trace?.actorId ?? event.source}</span>
                              {trace?.modelId && <span>Модель: {trace.modelId}</span>}
                              {trace?.toolName && <span>Инструмент: {trace.toolName}</span>}
                            </div>
                          </button>
                          {selected && (
                            <div className="mb-4 ml-2 space-y-2 rounded-lg bg-zinc-50 p-3 text-[11px] dark:bg-zinc-900/70">
                              <p>
                                <span className="text-zinc-500">Исполнитель:</span>{' '}
                                {trace?.actorType ? `${trace.actorType} / ${trace.actorId ?? 'не записан'}` : 'не записан'}
                              </p>
                              <p>
                                <span className="text-zinc-500">Инструкция:</span>{' '}
                                {trace?.instructionId
                                  ? `${trace.instructionId} · версия ${trace.instructionVersion ?? 'не записана'}`
                                  : 'не записана'}
                              </p>
                              <p><span className="text-zinc-500">Вход:</span> {trace?.inputSummary ?? 'не записан'}</p>
                              <p><span className="text-zinc-500">Выход:</span> {trace?.outputSummary ?? 'не записан'}</p>
                              <p>
                                <span className="text-zinc-500">Передача:</span> {trace?.handoffTarget ?? 'не записана'}
                                {trace?.handoffReason ? ` · ${trace.handoffReason}` : ''}
                              </p>
                              <p><span className="text-zinc-500">Источник события:</span> {event.source}</p>
                              {event.projectId && (
                                <p>
                                  <span className="text-zinc-500">Проект:</span>{' '}
                                  {projectNames.get(event.projectId) ?? event.projectId}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleEvents.map((event) => (
                <article
                  key={event.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <span
                    className={
                      event.status === 'failed'
                        ? 'mt-0.5 text-rose-500'
                        : event.status === 'running'
                          ? 'mt-0.5 text-blue-500'
                          : 'mt-0.5 text-emerald-500'
                    }
                  >
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{event.title}</h2>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {STATUS_LABELS[event.status]}
                      </span>
                      <span className="text-[10px] text-zinc-400">{event.category}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{event.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                      <span>{formatDate(event.timestamp)}</span>
                      <span>
                        {event.projectId ? projectNames.get(event.projectId) ?? event.projectId : 'Без проекта'}
                      </span>
                      <span>{event.source}</span>
                      {typeof event.durationMs === 'number' && (
                        <span>
                          {event.durationMs < 1000 ? `${event.durationMs} мс` : `${(event.durationMs / 1000).toFixed(2)} с`}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
};

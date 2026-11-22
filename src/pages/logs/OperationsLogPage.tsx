import { Fragment, useEffect, useMemo, useRef, useState, type FC } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  Pause,
  Play,
  Radio,
  Search,
  Square,
} from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentJournalCategory, AgentJournalEvent, AgentJournalStatus } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

const CATEGORY_LABELS: Record<AgentJournalCategory, string> = {
  agent: 'Агент',
  model: 'Модели',
  tool: 'Инструменты',
  project: 'Проекты и файлы',
  terminal: 'Терминал',
  git: 'Git',
  subagent: 'Субагенты',
  api: 'API и сервер',
  system: 'Система',
};

const STATUS_LABELS: Record<AgentJournalStatus, string> = {
  running: 'В процессе',
  completed: 'Завершено',
  failed: 'Ошибка',
  cancelled: 'Отменено',
  info: 'Событие',
};

const CATEGORIES: AgentJournalCategory[] = [
  'agent',
  'model',
  'tool',
  'project',
  'terminal',
  'git',
  'subagent',
  'api',
  'system',
];

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
}

function formatDuration(value?: number): string | null {
  if (typeof value !== 'number') return null;
  return value < 1000 ? `${value} мс` : `${(value / 1000).toFixed(2)} с`;
}

export const OperationsLogPage: FC = () => {
  const { uiStyle } = useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);
  const [events, setEvents] = useState<AgentJournalEvent[]>([]);
  const [category, setCategory] = useState<AgentJournalCategory | 'all'>('all');
  const [status, setStatus] = useState<AgentJournalStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const mergeEvent = (event: AgentJournalEvent) => {
      setEvents((current) => {
        const next = current.filter((item) => item.id !== event.id);
        next.unshift(event);
        return next.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      });
    };

    void apiFetch('/api/agent-journal')
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ ok?: boolean; events?: AgentJournalEvent[] }>;
      })
      .then((data) => {
        if (active && data.ok && Array.isArray(data.events)) {
          setEvents((current) => {
            const merged = new Map<string, AgentJournalEvent>();
            data.events!.forEach((event) => merged.set(event.id, event));
            current.forEach((event) => merged.set(event.id, event));
            return [...merged.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          });
        }
      })
      .catch(() => {
        if (active) setConnected(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const streamController = new AbortController();
    void apiFetch('/api/agent-journal/stream', { signal: streamController.signal })
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
            const data = block.split(/\r?\n/).find((line) => line.startsWith('data:'));
            if (!data) continue;
            try {
              mergeEvent(JSON.parse(data.slice(5).trim()) as AgentJournalEvent);
            } catch {
              // Ignore malformed journal events and keep stream alive.
            }
          }
        }
      })
      .catch(() => {
        if (active && !streamController.signal.aborted) setConnected(false);
      });

    return () => {
      active = false;
      streamController.abort();
    };
  }, []);

  useEffect(() => {
    if (!paused && listRef.current) listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, [events, paused]);

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      if (category !== 'all' && event.category !== category) return false;
      if (status !== 'all' && event.status !== status) return false;
      if (!normalizedQuery) return true;
      return [
        event.title,
        event.summary,
        event.source,
        event.projectId || '',
        JSON.stringify(event.details || {}),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [events, category, status, query]);

  const runningCount = events.filter((event) => event.status === 'running').length;
  const failedCount = events.filter((event) => event.status === 'failed').length;

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const copyEvent = async (event: AgentJournalEvent) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
      setCopiedId(event.id);
      setCopyErrorId(null);
    } catch {
      setCopiedId(null);
      setCopyErrorId(event.id);
    }
  };

  return (
    <PageLayout>
      <PageHeader showSave={false}>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Activity className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-semibold">Журнал операций</h1>
        </div>
      </PageHeader>

      <PageContent scrollRef={listRef} contentClassName="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-zinc-400')} />
            {connected ? 'Поток подключён' : 'Нет соединения'}
          </span>
          <span>{events.length} событий</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по журналу..."
              className={cn(
                'w-full h-8 pl-8 pr-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200',
                tokens.inputRadius,
              )}
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as AgentJournalCategory | 'all')}
            aria-label="Категория событий"
            className={cn(
              'h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-700 dark:text-zinc-300',
              tokens.inputRadius,
            )}
          >
            <option value="all">Все категории</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AgentJournalStatus | 'all')}
            aria-label="Статус события"
            className={cn(
              'h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-700 dark:text-zinc-300',
              tokens.inputRadius,
            )}
          >
            <option value="all">Все статусы</option>
            <option value="running">В процессе</option>
            <option value="completed">Завершено</option>
            <option value="failed">Ошибка</option>
            <option value="info">Событие</option>
          </select>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
            className={cn(
              'h-8 px-2.5 inline-flex items-center gap-1.5 border text-xs transition-colors whitespace-nowrap',
              tokens.inputRadius,
              paused
                ? tokens.activeHighlight
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
            )}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? 'Продолжить прокрутку' : 'Пауза прокрутки'}
          </button>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-blue-500" /> {runningCount} в процессе
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" /> {failedCount} ошибок
          </span>
        </div>
        <details className="text-[11px] text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200">
            Правила регистрации событий
          </summary>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li>
              Фиксируются только фактически начатые и завершённые операции; предложенные действия не считаются
              выполненными.
            </li>
            <li>Начало и результат операции связываются единым ID, ошибки и отказы сохраняются.</li>
            <li>Записываются статусы, категории, длительность и безопасные технические метаданные.</li>
            <li>Секреты, ключи, пароли, приватное содержимое и внутренние рассуждения модели не записываются.</li>
          </ul>
        </details>
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500">Загрузка журнала...</div>
        ) : visibleEvents.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2 text-center text-zinc-500">
            <CircleDot className="w-5 h-5 opacity-50" />
            <span className="text-xs">
              {events.length === 0 ? 'Событий пока нет' : 'По заданным фильтрам ничего не найдено'}
            </span>
          </div>
        ) : (
          <div className="space-y-2 py-4">
            {visibleEvents.map((event) => {
              const expanded = expandedIds.includes(event.id);
              const duration = formatDuration(event.durationMs);
              const failed = event.status === 'failed';
              const running = event.status === 'running';
              const cancelled = event.status === 'cancelled';
              return (
                <article
                  key={event.id}
                  className={cn(
                    'border bg-white dark:bg-zinc-950',
                    tokens.cardRadius,
                    failed ? 'border-red-300 dark:border-red-900/70' : 'border-zinc-200 dark:border-zinc-800',
                  )}
                >
                  <div className="flex items-start gap-3 p-3">
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          'mt-0.5',
                          failed
                            ? 'text-red-500'
                            : running
                              ? 'text-blue-500'
                              : cancelled
                                ? 'text-zinc-500'
                                : 'text-emerald-500',
                        )}
                      >
                        {failed ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : running ? (
                          <Radio className="w-4 h-4 animate-pulse" />
                        ) : cancelled ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyEvent(event)}
                        aria-label={copiedId === event.id ? 'Операция скопирована' : 'Скопировать операцию'}
                        title={
                          copyErrorId === event.id
                            ? 'Не удалось скопировать'
                            : copiedId === event.id
                              ? 'Скопировано'
                              : 'Скопировать операцию'
                        }
                        className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {copiedId === event.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(event.id)}
                      aria-expanded={expanded}
                      className="min-w-0 flex-1 flex items-start gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {event.title}
                          </span>
                          <span className="text-[10px] text-zinc-400">{CATEGORY_LABELS[event.category]}</span>
                          <span
                            className={cn(
                              'text-[10px] font-medium',
                              failed
                                ? 'text-red-500'
                                : running
                                  ? 'text-blue-500'
                                  : 'text-zinc-500',
                            )}
                          >
                            {STATUS_LABELS[event.status]}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-300 break-words">
                          {event.summary}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                          <span>{formatTimestamp(event.timestamp)}</span>
                          <span>{event.source}</span>
                          {event.projectId && <span>Проект: {event.projectId}</span>}
                          {duration && <span>{duration}</span>}
                        </span>
                      </span>
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 mt-0.5 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-zinc-400" />
                      )}
                    </button>
                  </div>
                  {expanded && (
                    <div className="px-3 pb-3 pt-2 ml-7 border-t border-zinc-100 dark:border-zinc-900">
                      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
                        <span className="text-zinc-400">ID операции</span>
                        <code className="text-zinc-600 dark:text-zinc-300 break-all">{event.operationId}</code>
                        {event.parentOperationId && (
                          <>
                            <span className="text-zinc-400">Родительская операция</span>
                            <code className="text-zinc-600 dark:text-zinc-300 break-all">
                              {event.parentOperationId}
                            </code>
                          </>
                        )}
                        {event.messageId && (
                          <>
                            <span className="text-zinc-400">Сообщение чата</span>
                            <code className="text-zinc-600 dark:text-zinc-300 break-all">{event.messageId}</code>
                          </>
                        )}
                        <span className="text-zinc-400">Уровень</span>
                        <span className="text-zinc-600 dark:text-zinc-300">{event.level}</span>
                        {Object.entries(event.details || {}).map(([key, value]) => (
                          <Fragment key={key}>
                            <span className="text-zinc-400">{key}</span>
                            <code className="text-zinc-600 dark:text-zinc-300 break-all">{String(value ?? '—')}</code>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
};

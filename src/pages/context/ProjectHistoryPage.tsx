import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, History, RefreshCw, Search } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';

type HistoryKind = 'file_write' | 'command' | 'git' | 'undo' | 'task' | 'plan';

interface ProjectHistoryEntry {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  kind: HistoryKind;
  summary: string;
  filePath?: string;
  command?: string;
  exitCode?: number;
}

interface ProjectHistoryPageProps {
  projectFilterId: string;
  onProjectFilterChange: (projectId: string) => void;
  onProjectCountChange: (count: number) => void;
}

const KIND_LABELS: Record<HistoryKind, string> = {
  file_write: 'Файлы',
  command: 'Команды',
  git: 'Git',
  undo: 'Откаты',
  task: 'Задачи',
  plan: 'План',
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}

function toLocalDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const ProjectHistoryPage: React.FC<ProjectHistoryPageProps> = ({
  projectFilterId,
  onProjectFilterChange,
  onProjectCountChange,
}) => {
  const { projects } = useOneCoreStore();
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<HistoryKind | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/project-history');
      const data = (await response.json()) as {
        ok?: boolean;
        entries?: ProjectHistoryEntry[];
        error?: string;
      };
      if (!response.ok || !data.ok || !Array.isArray(data.entries)) {
        throw new Error(data.error || 'Не удалось загрузить историю проектов');
      }
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить историю проектов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (projectFilterId && entry.projectId !== projectFilterId) return false;
      if (kindFilter !== 'all' && entry.kind !== kindFilter) return false;
      const entryDate = toLocalDate(entry.timestamp);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (!normalizedQuery) return true;
      return [entry.summary, entry.projectName, entry.filePath ?? '', entry.command ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [entries, projectFilterId, kindFilter, dateFrom, dateTo, query]);

  useEffect(() => {
    onProjectCountChange(new Set(visibleEntries.map((entry) => entry.projectId)).size);
  }, [visibleEntries, onProjectCountChange]);

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'refresh-project-history',
            label: 'Обновить',
            icon: <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />,
            onClick: () => void refreshHistory(),
            disabled: loading,
            title: 'Обновить историю',
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">История проекта</h1>
        </div>
      </PageHeader>

      <PageContent>
        <div className="flex flex-col gap-4 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по истории…"
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
              aria-label="Фильтр по типу операции"
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value as HistoryKind | 'all')}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="all">Все операции</option>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
              <input
                aria-label="Дата с"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-[112px] bg-transparent text-[10px] text-zinc-700 outline-none dark:text-zinc-300"
              />
            </label>
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
              <input
                aria-label="Дата по"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-[112px] bg-transparent text-[10px] text-zinc-700 outline-none dark:text-zinc-300"
              />
            </label>
          </div>

          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
          <div className="flex items-center justify-between text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>{visibleEntries.length} из {entries.length} операций</span>
            {loading && <span>Обновление…</span>}
          </div>
          {loading && entries.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">Загрузка истории…</div>
          ) : visibleEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-xs text-zinc-500 dark:border-zinc-700">
              {entries.length === 0 ? 'История операций пока пуста' : 'По выбранным фильтрам операции не найдены'}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <span className="mt-0.5 text-blue-600 dark:text-blue-400">
                    <History className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{entry.summary}</h2>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {KIND_LABELS[entry.kind]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                      <span>{formatDate(entry.timestamp)}</span>
                      <span>{entry.projectName}</span>
                      {entry.filePath && <span className="font-mono">{entry.filePath}</span>}
                      {entry.command && <span className="font-mono">{entry.command}</span>}
                      {typeof entry.exitCode === 'number' && <span>Код завершения: {entry.exitCode}</span>}
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

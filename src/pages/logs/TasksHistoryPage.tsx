import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, RefreshCw, Search } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

interface CompletedTaskItem {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  projectId: string;
  projectName: string;
  updatedAt?: string;
  createdAt?: string;
}

interface ProjectHistoryEntry {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  kind: string;
  summary: string;
  exitCode?: number;
}

export const TasksHistoryPage: React.FC = () => {
  const { uiStyle, projects } = useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);

  const [tasks, setTasks] = useState<CompletedTaskItem[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ProjectHistoryEntry[]>([]);
  const [projectFilterId, setProjectFilterId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, historyRes] = await Promise.all([
        apiFetch('/api/tasks'),
        apiFetch('/api/project-history'),
      ]);
      const tasksData = (await tasksRes.json()) as { ok?: boolean; tasks?: CompletedTaskItem[]; error?: string };
      if (!tasksRes.ok || !tasksData.ok) throw new Error(tasksData.error || 'Не удалось загрузить задачи.');

      const historyData = (await historyRes.json()) as {
        ok?: boolean;
        entries?: ProjectHistoryEntry[];
      };

      setTasks((tasksData.tasks ?? []).filter((task) => task.status === 'done'));
      setHistoryEntries(historyData.entries ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить историю задач.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (projectFilterId && task.projectId !== projectFilterId) return false;
      if (!q) return true;
      return `${task.title} ${task.description} ${task.projectName}`.toLowerCase().includes(q);
    });
  }, [tasks, projectFilterId, query]);

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return historyEntries
      .filter((entry) => {
        if (projectFilterId && entry.projectId !== projectFilterId) return false;
        if (!q) return true;
        return `${entry.summary} ${entry.projectName} ${entry.kind}`.toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [historyEntries, projectFilterId, query]);

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'refresh-tasks-history',
            label: 'Обновить',
            icon: <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />,
            onClick: () => void refresh(),
            disabled: loading,
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-xl font-semibold">История выполненных задач</h1>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по выполненным задачам и действиям…"
              className={cn(
                'w-full h-9 pl-8 pr-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs',
                tokens.inputRadius,
              )}
            />
          </div>
          <select
            value={projectFilterId}
            onChange={(e) => setProjectFilterId(e.target.value)}
            className={cn(
              'h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs',
              tokens.inputRadius,
            )}
          >
            <option value="">Все проекты</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-500">
            {error}
          </p>
        )}

        <section className={cn('p-5 border space-y-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Завершённые задачи проектов ({filteredTasks.length})
            </h2>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-zinc-500">Загрузка…</div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
              Завершённых задач пока нет.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{task.title}</span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {task.projectName} · {task.updatedAt ? new Date(task.updatedAt).toLocaleString('ru-RU') : 'done'}
                    </span>
                  </div>
                  {task.description && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{task.description}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={cn('p-5 border space-y-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Журнал выполненных действий ({filteredHistory.length})
          </h2>
          {filteredHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
              Записей пока нет.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/60 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-zinc-400 mr-2">[{entry.kind}]</span>
                    <span className="text-zinc-800 dark:text-zinc-200">{entry.summary}</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                    {entry.projectName} · {new Date(entry.timestamp).toLocaleString('ru-RU')}
                    {typeof entry.exitCode === 'number' ? ` · exit ${entry.exitCode}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </PageContent>
    </PageLayout>
  );
};

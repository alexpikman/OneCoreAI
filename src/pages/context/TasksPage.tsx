import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ListTodo, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ProjectTask, ProjectTaskStatus } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';

interface TaskWithProject extends ProjectTask {
  projectId: string;
  projectName: string;
}

interface TasksPageProps {
  projectFilterId: string;
  onProjectFilterChange: (projectId: string) => void;
  onProjectCountChange: (count: number) => void;
}

const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  todo: 'К выполнению',
  'in-progress': 'В работе',
  done: 'Готово',
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}

export const TasksPage: React.FC<TasksPageProps> = ({
  projectFilterId,
  onProjectFilterChange,
  onProjectCountChange,
}) => {
  const { projects, activeProjectId, projectsLoading } = useOneCoreStore();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectTaskStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<ProjectTaskStatus>('todo');
  const [formProjectId, setFormProjectId] = useState('');

  const refreshTasks = useCallback(async () => {
    if (projectsLoading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/tasks');
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = (await response.json()) as { ok?: boolean; tasks?: TaskWithProject[]; error?: string };
        if (!response.ok || !data.ok || !Array.isArray(data.tasks)) {
          throw new Error(data.error || `Не удалось загрузить задачи (HTTP ${response.status})`);
        }
        setTasks(data.tasks);
        return;
      }

      const workspaceResults = await Promise.all(
        projects.map(async (project) => {
          const workspaceResponse = await apiFetch(
            `/api/projects/${encodeURIComponent(project.id)}/workspace`,
          );
          const workspaceContentType = workspaceResponse.headers.get('content-type') || '';
          if (!workspaceContentType.includes('application/json')) {
            throw new Error(
              `API проекта «${project.name}» вернул HTML вместо JSON (HTTP ${workspaceResponse.status})`,
            );
          }
          const workspaceData = (await workspaceResponse.json()) as {
            ok?: boolean;
            workspace?: { tasks?: ProjectTask[] };
            error?: string;
          };
          if (!workspaceResponse.ok || !workspaceData.ok || !Array.isArray(workspaceData.workspace?.tasks)) {
            throw new Error(workspaceData.error || `Не удалось загрузить задачи проекта «${project.name}»`);
          }
          return workspaceData.workspace.tasks.map((task) => ({
            ...task,
            projectId: project.id,
            projectName: project.name,
          }));
        }),
      );
      setTasks(workspaceResults.flat());
    } catch (err) {
      setTasks([]);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, [projects, projectsLoading]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (projectFilterId && task.projectId !== projectFilterId) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [task.title, task.description, task.projectName].join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [tasks, projectFilterId, statusFilter, query]);

  useEffect(() => {
    onProjectCountChange(new Set(visibleTasks.map((task) => task.projectId)).size);
  }, [visibleTasks, onProjectCountChange]);

  const openNewTask = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setTaskStatus('todo');
    setFormProjectId(projectFilterId || activeProjectId || projects[0]?.id || '');
    setFormOpen(true);
  };

  const openEditTask = (task: TaskWithProject) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setTaskStatus(task.status);
    setFormProjectId(task.projectId);
    setFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetProjectId = editingTask?.projectId ?? formProjectId;
    if (!targetProjectId || !title.trim()) return;
    setError(null);
    try {
      const url = editingTask
        ? `/api/projects/${encodeURIComponent(targetProjectId)}/tasks/${encodeURIComponent(editingTask.id)}`
        : `/api/projects/${encodeURIComponent(targetProjectId)}/tasks`;
      const response = await apiFetch(url, {
        method: editingTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, status: taskStatus }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось сохранить задачу');
      setFormOpen(false);
      setEditingTask(null);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить задачу');
    }
  };

  const handleDelete = async (task: TaskWithProject) => {
    const confirmed = await requestDeleteWarning({
      variant: 'simple',
      title: 'Удалить задачу?',
      description: 'Задача будет удалена без возможности восстановления.',
      itemName: task.title,
    });
    if (!confirmed) return;
    try {
      const response = await apiFetch(
        `/api/projects/${encodeURIComponent(task.projectId)}/tasks/${encodeURIComponent(task.id)}`,
        { method: 'DELETE' },
      );
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось удалить задачу');
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить задачу');
    }
  };

  const handleStatusChange = async (task: TaskWithProject, status: ProjectTaskStatus) => {
    try {
      const response = await apiFetch(
        `/api/projects/${encodeURIComponent(task.projectId)}/tasks/${encodeURIComponent(task.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: task.title, description: task.description, status }),
        },
      );
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось обновить статус');
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    }
  };

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'new-task',
            label: 'Новая задача',
            icon: <Plus className="h-3.5 w-3.5" />,
            onClick: openNewTask,
            disabled: projects.length === 0,
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Задачи</h1>
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
                placeholder="Поиск задач…"
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
              onChange={(event) => setStatusFilter(event.target.value as ProjectTaskStatus | 'all')}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="all">Все статусы</option>
              <option value="todo">К выполнению</option>
              <option value="in-progress">В работе</option>
              <option value="done">Готово</option>
            </select>
          </div>

          {formOpen && (
            <form
              onSubmit={handleSubmit}
              className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {editingTask ? 'Изменить задачу' : 'Новая задача'}
                </h2>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label="Закрыть форму"
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={160}
                placeholder="Название задачи"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Описание и критерии выполнения"
                className="w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {!editingTask && (
                    <select
                      aria-label="Проект задачи"
                      value={formProjectId}
                      onChange={(event) => setFormProjectId(event.target.value)}
                      required
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <option value="">Выберите проект</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    aria-label="Статус задачи"
                    value={taskStatus}
                    onChange={(event) => setTaskStatus(event.target.value as ProjectTaskStatus)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!title.trim() || (!editingTask && !formProjectId)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Сохранить
                </button>
              </div>
            </form>
          )}

          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
          <div className="flex items-center justify-between text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>{visibleTasks.length} из {tasks.length} задач</span>
            {loading && <span>Обновление…</span>}
          </div>
          {loading && tasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">Загрузка задач…</div>
          ) : visibleTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-xs text-zinc-500 dark:border-zinc-700">
              {tasks.length === 0 ? 'Задач пока нет' : 'По выбранным фильтрам задачи не найдены'}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleTasks.map((task) => (
                <article
                  key={task.id}
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      task.status === 'done'
                        ? 'bg-emerald-500'
                        : task.status === 'in-progress'
                          ? 'bg-blue-500'
                          : 'bg-slate-400',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{task.title}</h2>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {task.projectName}
                      </span>
                    </div>
                    {task.description && (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {task.description}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-zinc-400">Обновлено: {formatDate(task.updatedAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <select
                      aria-label={`Статус задачи ${task.title}`}
                      value={task.status}
                      onChange={(event) => void handleStatusChange(task, event.target.value as ProjectTaskStatus)}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openEditTask(task)}
                      title="Изменить задачу"
                      className="rounded-lg p-2 text-zinc-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(task)}
                      title="Удалить задачу"
                      className="rounded-lg p-2 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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

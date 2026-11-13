import React, { useEffect, useState } from 'react';
import {
  Activity,
  Clock3,
  FileText,
  FolderKanban,
  ListTodo,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ProjectActionLogEntry, ProjectRecord, ProjectTask, ProjectTaskStatus } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { ProjectModal } from '../workstation/ProjectModal';

type ProjectSection = 'overview' | 'tasks' | 'plan' | 'memory';

const SECTIONS: { id: ProjectSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Обзор', icon: FolderKanban },
  { id: 'tasks', label: 'Задачи', icon: ListTodo },
  { id: 'plan', label: 'План и прогресс', icon: FileText },
  { id: 'memory', label: 'Память и действия', icon: Activity },
];

const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  todo: 'К выполнению',
  'in-progress': 'В работе',
  done: 'Готово',
};

const ACTION_LABELS: Record<ProjectActionLogEntry['kind'], string> = {
  file_write: 'Файл',
  command: 'Команда',
  git: 'Git',
  undo: 'Откат',
  task: 'Проект',
};

export const ProjectsView: React.FC = () => {
  const {
    projects,
    activeProjectId,
    selectProject,
    projectLogs,
    projectWorkspace,
    projectsLoading,
    projectsWorkspaceLoading,
    projectWorkspaceError,
    saveProjectTask,
    deleteProjectTask,
    saveProjectPlan,
    uiStyle,
  } = useOneCoreStore();
  const tokens = getUiTokens(uiStyle);
  const [section, setSection] = useState<ProjectSection>('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<ProjectTaskStatus>('todo');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [planContent, setPlanContent] = useState('');
  const [planProgress, setPlanProgress] = useState(0);
  const [planError, setPlanError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  useEffect(() => {
    setPlanContent(projectWorkspace.plan?.content ?? '');
    setPlanProgress(projectWorkspace.plan?.progress ?? 0);
  }, [activeProjectId, projectWorkspace.plan?.content, projectWorkspace.plan?.progress]);

  const openProjectModal = (project: ProjectRecord | null) => {
    setEditingProject(project);
    setModalOpen(true);
  };

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskStatus('todo');
    setEditingTaskId(null);
    setTaskError(null);
  };

  const editTask = (task: ProjectTask) => {
    setTaskTitle(task.title);
    setTaskDescription(task.description);
    setTaskStatus(task.status);
    setEditingTaskId(task.id);
    setTaskError(null);
  };

  const handleSaveTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setTaskError(null);
    const result = await saveProjectTask({
      id: editingTaskId ?? undefined,
      title: taskTitle,
      description: taskDescription,
      status: taskStatus,
    });
    if (!result.ok) {
      setTaskError(result.error ?? 'Не удалось сохранить задачу');
      return;
    }
    resetTaskForm();
  };

  const handleDeleteTask = async (task: ProjectTask) => {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    const result = await deleteProjectTask(task.id);
    if (!result.ok) {
      setTaskError(result.error ?? 'Не удалось удалить задачу');
      return;
    }
    if (editingTaskId === task.id) resetTaskForm();
  };

  const handleSavePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPlan(true);
    setPlanError(null);
    const result = await saveProjectPlan({ content: planContent, progress: planProgress });
    setSavingPlan(false);
    if (!result.ok) setPlanError(result.error ?? 'Не удалось сохранить план');
  };

  const handleDeletePlan = async () => {
    if (!window.confirm('Удалить план этого проекта?')) return;
    setPlanError(null);
    const result = await saveProjectPlan(null);
    if (!result.ok) setPlanError(result.error ?? 'Не удалось удалить план');
  };

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden bg-zinc-50 dark:bg-[#09090B]">
      <aside className={cn('w-72 shrink-0 border-r p-4 flex flex-col gap-3', tokens.sidebarBg, tokens.cardBorder)}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">Проекты</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">Рабочие пространства и история</p>
          </div>
          <button
            type="button"
            onClick={() => openProjectModal(null)}
            className={cn('h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium', tokens.inputRadius, tokens.accentButton)}
          >
            <Plus className="w-3.5 h-3.5" />
            Новый
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          {projectsLoading ? (
            <div className="py-4 text-xs text-zinc-500">Загрузка проектов…</div>
          ) : projects.length === 0 ? (
            <div className="py-5 text-xs text-zinc-500">Пока нет проектов. Создайте проект, чтобы добавить задачи и план.</div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  if (project.id !== activeProjectId) void selectProject(project.id);
                }}
                className={cn(
                  'w-full p-3 border text-left transition-colors',
                  tokens.cardRadius,
                  project.id === activeProjectId
                    ? tokens.activeHighlight
                    : 'border-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60',
                )}
              >
                <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {project.name}
                </span>
                <span className="block mt-1 text-[10px] font-mono text-zinc-500 truncate">
                  {project.folderPath || project.folderSource}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {!activeProject ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <FolderKanban className="w-10 h-10 text-zinc-400 mb-3" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {projects.length ? 'Выберите проект' : 'Создайте первый проект'}
            </h2>
            <p className="max-w-md mt-1.5 text-sm text-zinc-500">
              У каждого проекта будут собственные задачи, план выполнения и память действий.
            </p>
            {!projects.length && (
              <button
                type="button"
                onClick={() => openProjectModal(null)}
                className={cn('mt-4 h-9 px-3 inline-flex items-center gap-2 text-xs font-medium', tokens.inputRadius, tokens.accentButton)}
              >
                <Plus className="w-3.5 h-3.5" />
                Создать проект
              </button>
            )}
          </div>
        ) : (
          <>
            <header className="px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">ПРОЕКТ</p>
                  <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">{activeProject.name}</h2>
                  <p className="mt-1 text-xs text-zinc-500 truncate" title={activeProject.folderPath}>
                    {activeProject.description || activeProject.folderPath}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openProjectModal(activeProject)}
                  className={cn('h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800', tokens.inputRadius)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Управление
                </button>
              </div>

              <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Разделы проекта">
                {SECTIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={cn(
                        'px-3 py-2 inline-flex items-center gap-1.5 text-xs font-medium border transition-colors',
                        tokens.inputRadius,
                        section === item.id
                          ? tokens.activeHighlight
                          : 'border-transparent text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800',
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                      {item.id === 'tasks' && (
                        <span className="font-mono text-[10px] opacity-70">{projectWorkspace.tasks.length}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {projectWorkspaceError && (
                <p className="mb-4 text-xs text-rose-500">{projectWorkspaceError}</p>
              )}
              {projectsWorkspaceLoading ? (
                <div className="text-sm text-zinc-500">Загрузка данных проекта…</div>
              ) : section === 'overview' ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSection('tasks')}
                    className={cn('p-5 border text-left', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}
                  >
                    <ListTodo className="w-5 h-5 text-blue-500" />
                    <div className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {projectWorkspace.tasks.length} задач
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">Добавляйте задачи и отслеживайте их статус.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('plan')}
                    className={cn('p-5 border text-left', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}
                  >
                    <FileText className="w-5 h-5 text-violet-500" />
                    <div className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {projectWorkspace.plan ? `${projectWorkspace.plan.progress}% выполнения` : 'План не задан'}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">Храните план проекта и обновляйте прогресс.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('memory')}
                    className={cn('p-5 border text-left xl:col-span-2', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}
                  >
                    <Activity className="w-5 h-5 text-emerald-500" />
                    <div className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {projectLogs.length} действий в памяти
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Здесь автоматически сохраняются операции с файлами, командами, Git, задачами и планом.
                    </div>
                  </button>
                </div>
              ) : section === 'tasks' ? (
                <div className="max-w-4xl space-y-4">
                  <form onSubmit={handleSaveTask} className={cn('p-4 border space-y-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {editingTaskId ? 'Изменить задачу' : 'Новая задача'}
                      </h3>
                      {editingTaskId && (
                        <button type="button" onClick={resetTaskForm} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                          Отмена
                        </button>
                      )}
                    </div>
                    <input
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      required
                      maxLength={160}
                      placeholder="Название задачи"
                      className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm', tokens.inputRadius)}
                    />
                    <textarea
                      value={taskDescription}
                      onChange={(event) => setTaskDescription(event.target.value)}
                      rows={3}
                      placeholder="Описание и критерии выполнения"
                      className={cn('w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm resize-y', tokens.inputRadius)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value={taskStatus}
                        onChange={(event) => setTaskStatus(event.target.value as ProjectTaskStatus)}
                        className={cn('h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs', tokens.inputRadius)}
                      >
                        {(Object.keys(STATUS_LABELS) as ProjectTaskStatus[]).map((status) => (
                          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!taskTitle.trim()}
                        className={cn('h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50', tokens.inputRadius, tokens.accentButton)}
                      >
                        <Save className="w-3.5 h-3.5" />
                        Сохранить задачу
                      </button>
                    </div>
                    {taskError && <p className="text-xs text-rose-500">{taskError}</p>}
                  </form>

                  <div className="space-y-2">
                    {projectWorkspace.tasks.length === 0 ? (
                      <div className="py-8 text-center text-sm text-zinc-500">Задач пока нет.</div>
                    ) : projectWorkspace.tasks.map((task) => (
                      <article key={task.id} className={cn('p-4 border flex items-start gap-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                        <span className={cn(
                          'mt-0.5 w-2 h-2 rounded-full shrink-0',
                          task.status === 'done' ? 'bg-emerald-500' : task.status === 'in-progress' ? 'bg-blue-500' : 'bg-zinc-400',
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.title}</h4>
                            <span className="text-[10px] text-zinc-500">{STATUS_LABELS[task.status]}</span>
                          </div>
                          {task.description && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{task.description}</p>}
                          <p className="mt-2 text-[10px] font-mono text-zinc-400">Обновлено: {new Date(task.updatedAt).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" title="Изменить задачу" onClick={() => editTask(task)} className="p-1.5 text-zinc-500 hover:text-blue-500">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title="Удалить задачу" onClick={() => void handleDeleteTask(task)} className="p-1.5 text-zinc-500 hover:text-rose-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : section === 'plan' ? (
                <form onSubmit={handleSavePlan} className={cn('max-w-4xl p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">План проекта</h3>
                    <p className="mt-1 text-xs text-zinc-500">Опишите этапы, результат и актуальный ход выполнения.</p>
                  </div>
                  <textarea
                    value={planContent}
                    onChange={(event) => setPlanContent(event.target.value)}
                    rows={12}
                    maxLength={30000}
                    placeholder="Этапы, цели и ожидаемые результаты…"
                    className={cn('w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm leading-relaxed resize-y', tokens.inputRadius)}
                  />
                  <label className="block">
                    <span className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Выполнение</span>
                      <span className="font-mono">{planProgress}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={planProgress}
                      onChange={(event) => setPlanProgress(Number(event.target.value))}
                      className="mt-2 w-full accent-blue-600"
                    />
                  </label>
                  {projectWorkspace.plan && (
                    <p className="text-[11px] text-zinc-500">
                      Обновлено {new Date(projectWorkspace.plan.updatedAt).toLocaleString()}
                    </p>
                  )}
                  {planError && <p className="text-xs text-rose-500">{planError}</p>}
                  <div className="flex justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDeletePlan()}
                      disabled={!projectWorkspace.plan}
                      className="h-9 px-3 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 hover:text-rose-500 disabled:opacity-40 inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить план
                    </button>
                    <button
                      type="submit"
                      disabled={savingPlan || !planContent.trim()}
                      className={cn('h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50', tokens.inputRadius, tokens.accentButton)}
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingPlan ? 'Сохранение…' : 'Сохранить план'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="max-w-4xl">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Память действий</h3>
                    <p className="mt-1 text-xs text-zinc-500">История операций сохраняется вместе с проектом и пополняется при работе с файлами, командами, задачами и планом.</p>
                  </div>
                  <div className="relative space-y-0">
                    {projectLogs.length === 0 ? (
                      <div className="py-8 text-center text-sm text-zinc-500">Действий пока нет.</div>
                    ) : projectLogs.map((entry) => (
                      <article key={entry.id} className="relative pl-7 pb-5 border-l border-zinc-200 dark:border-zinc-800 last:border-l-transparent">
                        <span className="absolute -left-1.5 top-1 w-3 h-3 rounded-full border-2 border-white dark:border-[#09090B] bg-blue-500" />
                        <div className={cn('p-3 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">{ACTION_LABELS[entry.kind]}</span>
                            <span className="text-[10px] text-zinc-400 inline-flex items-center gap-1">
                              <Clock3 className="w-3 h-3" />
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-800 dark:text-zinc-200">{entry.summary}</p>
                          {(entry.filePath || entry.command) && (
                            <code className="block mt-1 text-[10px] text-zinc-500 break-all">{entry.filePath || entry.command}</code>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <ProjectModal
        open={modalOpen}
        editingProject={editingProject}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
        }}
      />
    </div>
  );
};

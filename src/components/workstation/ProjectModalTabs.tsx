import React, { useEffect, useState } from 'react';
import { FileText, FolderOpen, History, ListTodo, Plus, Trash2 } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import type { ProjectRecord, ProjectTaskStatus } from '../../types/onecore';

type Tab = 'project' | 'files' | 'tasks' | 'actions';
const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'project', label: 'Проект', icon: FileText },
  { id: 'files', label: 'Файлы', icon: FolderOpen },
  { id: 'tasks', label: 'Задачи', icon: ListTodo },
  { id: 'actions', label: 'Действия', icon: History },
];

export const ProjectModalTabs: React.FC<{
  project: ProjectRecord | null;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: React.ReactNode;
}> = ({ project, activeTab, onTabChange, children }) => {
  const { activeProjectId, projectWorkspace, projectLogs, files, saveProjectPlan, saveProjectTask, deleteProjectTask } = useOneCoreStore();
  const [content, setContent] = useState('');
  const [progress, setProgress] = useState(0);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<ProjectTaskStatus>('todo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(projectWorkspace.plan?.content ?? '');
    setProgress(projectWorkspace.plan?.progress ?? 0);
    setError(null);
  }, [project?.id, projectWorkspace.plan?.content, projectWorkspace.plan?.progress]);

  if (!project) return <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>;

  const taskCount = projectWorkspace.tasks.length;
  const actionCount = projectLogs.length;
  const addTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (activeProjectId !== project.id || !taskTitle.trim()) {
      setError('Проверьте активный проект и название задачи.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProjectTask({ title: taskTitle.trim(), description: taskDescription.trim(), status: taskStatus });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || 'Не удалось сохранить задачу');
      return;
    }
    setTaskTitle('');
    setTaskDescription('');
    setTaskStatus('todo');
  };

  const updateTask = async (taskId: string, title: string, description: string, status: ProjectTaskStatus) => {
    if (activeProjectId !== project.id) {
      setError('Активный проект изменился. Закройте окно и выберите проект повторно.');
      return;
    }
    const result = await saveProjectTask({ id: taskId, title, description, status });
    if (!result.ok) setError(result.error || 'Не удалось обновить задачу');
  };

  const removeTask = async (taskId: string, taskTitle: string) => {
    if (activeProjectId !== project.id) {
      setError('Активный проект изменился. Закройте окно и выберите проект повторно.');
      return;
    }
    const confirmed = await requestDeleteWarning({ variant: 'simple', title: 'Удалить задачу?', description: 'Задача будет удалена из проекта.', itemName: taskTitle });
    if (!confirmed) return;
    const result = await deleteProjectTask(taskId);
    if (!result.ok) setError(result.error || 'Не удалось удалить задачу');
  };

  const savePlan = async () => {
    if (activeProjectId !== project.id) {
      setError('Активный проект изменился. Закройте окно и выберите проект повторно.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProjectPlan({ content, progress });
    setSaving(false);
    if (!result.ok) setError(result.error || 'Не удалось сохранить план');
  };

  return <div className="flex min-h-0 flex-1 flex-col">
    <nav aria-label="Разделы проекта" className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 px-4 dark:border-zinc-800">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { onTabChange(id); setError(null); }} className={activeTab === id ? 'inline-flex h-12 shrink-0 items-center gap-2 border-b-2 border-blue-600 px-3 text-xs font-semibold text-blue-700 dark:text-blue-400' : 'inline-flex h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}><Icon className="h-4 w-4" />{label}</button>)}
    </nav>
    <section className="min-h-0 flex-1 overflow-y-auto">
      {activeTab === 'project' && <div className="grid grid-cols-3 gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Дата создания</p><p className="mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">{new Date(project.createdAt).toLocaleDateString('ru-RU')}</p></div>
        <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Задач</p><p className="mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">{taskCount}</p></div>
        <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Действий</p><p className="mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">{actionCount}</p></div>
      </div>}
      {(activeTab === 'project' || activeTab === 'files') && children}
      {activeTab === 'project' && <div className="space-y-4 border-t border-zinc-200 p-5 dark:border-zinc-800">
        <div>
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">План</h3>
          <textarea value={content} onChange={event => setContent(event.target.value)} rows={8} maxLength={30000} placeholder="Этапы, цели, результаты и критерии завершения…" className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-zinc-800 outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
          <div className="mt-3 flex items-center gap-3"><input aria-label="Прогресс плана" type="range" min={0} max={100} value={progress} onChange={event => setProgress(Number(event.target.value))} className="min-w-0 flex-1 accent-blue-600" /><span className="w-10 text-right text-xs tabular-nums text-zinc-500">{progress}%</span></div>
          <div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-zinc-400">{projectWorkspace.plan ? 'План сохранён' : 'План ещё не создан'}</span><button type="button" onClick={() => void savePlan()} disabled={saving || !content.trim()} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Сохранение…' : 'Сохранить план'}</button></div>
        </div>
      </div>}
      {activeTab === 'files' && <div className="space-y-3 border-t border-zinc-200 p-5 dark:border-zinc-800">
        <div>
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Файлы проекта</h3>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{files.length} файлов в подключённом проекте</p>
        </div>
        {files.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500 dark:border-zinc-700">Файлы не найдены или источник пока не загружен</p>
        ) : (
          <div className="space-y-1">
            {[...files].sort((left, right) => left.path.localeCompare(right.path)).map((file) => (
              <div key={file.path} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-800 dark:text-zinc-200">{file.folder && file.folder !== '.' ? file.folder + '/' : ''}{file.name}</span>
                <span className="shrink-0 text-[10px] text-zinc-400">{(file.sizeBytes ?? 0).toLocaleString('ru-RU')} Б</span>
              </div>
            ))}
          </div>
        )}
      </div>}
      {activeTab === 'tasks' && <div className="space-y-3 p-5"><div><h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Задачи проекта</h3><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{taskCount} задач</p></div><form onSubmit={event => void addTask(event)} className="space-y-2 rounded-xl border border-blue-200 bg-transparent p-3 dark:border-blue-900/60 dark:bg-transparent"><input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} required maxLength={160} placeholder="Название задачи" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" /><textarea value={taskDescription} onChange={event => setTaskDescription(event.target.value)} rows={2} placeholder="Описание и критерии выполнения" className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" /><div className="flex items-center justify-between"><select value={taskStatus} onChange={event => setTaskStatus(event.target.value as ProjectTaskStatus)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"><option value="todo">К выполнению</option><option value="in-progress">В работе</option><option value="done">Готово</option></select><button type="submit" disabled={saving || !taskTitle.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Добавить</button></div></form>{projectWorkspace.tasks.length === 0 ? <p className="py-6 text-center text-xs text-zinc-500">Задач пока нет</p> : projectWorkspace.tasks.map(task => <article key={task.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-zinc-800"><div className="min-w-0 flex-1"><h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{task.title}</h4>{task.description && <p className="mt-1 text-[11px] text-zinc-500">{task.description}</p>}</div><select aria-label={'Статус задачи ' + task.title} value={task.status} onChange={event => void updateTask(task.id, task.title, task.description, event.target.value as ProjectTaskStatus)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"><option value="todo">К выполнению</option><option value="in-progress">В работе</option><option value="done">Готово</option></select><button type="button" title="Удалить задачу" onClick={() => void removeTask(task.id, task.title)} className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" /></button></article>)}</div>}
      {activeTab === 'actions' && <div className="space-y-3 p-5"><div><h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Действия проекта</h3><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{actionCount} записей журнала</p></div>{projectLogs.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-zinc-500 dark:border-zinc-700">Действий пока нет</p> : [...projectLogs].reverse().map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 p-3 dark:border-zinc-800"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-zinc-800 dark:text-zinc-100">{entry.summary}</span><span className="text-[10px] text-zinc-400">{new Date(entry.timestamp).toLocaleString('ru-RU')}</span></div>{entry.filePath && <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">{entry.filePath}</p>}{entry.command && <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">{entry.command}</p>}</article>)}</div>}
    </section>
    {error && <p role="alert" className="shrink-0 border-t border-rose-200 bg-rose-50 px-5 py-2 text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">{error}</p>}
  </div>;
};

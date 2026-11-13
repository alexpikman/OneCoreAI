import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Container,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FolderCog,
  FolderOpen,
  GitBranch,
  History,
  Laptop,
  ListTodo,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Search,
  Server,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ExecutionEnvKind, ProjectRecord } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { ProjectFilesModal } from './ProjectFilesModal';
import { ProjectModal } from './ProjectModal';

const ENV_META: { id: ExecutionEnvKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'local', label: 'Локально', icon: Laptop },
  { id: 'ssh', label: 'SSH', icon: Server },
  { id: 'docker', label: 'Docker', icon: Container },
];

export const LeftSidebar: React.FC = () => {
  const {
    projects,
    activeProjectId,
    projectLogs,
    projectWorkspace,
    selectProject,
    createOrWriteProjectFile,
    runProjectGitAction,
    undoLastProjectAction,
    files,
    selectedFilePath,
    selectFile,
    sessions,
    activeSessionId,
    setActiveSession,
    createNewSession,
    executionEnv,
    setActiveExecutionEnv,
    chatVisibility,
    uiStyle,
  } = useOneCoreStore();

  const tokens = getUiTokens(uiStyle);
  const [sessionQuery, setSessionQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [treeActionFeedback, setTreeActionFeedback] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(true);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;



  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (sess) =>
        sess.title.toLowerCase().includes(q) ||
        sess.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [sessions, sessionQuery]);

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    setTreeActionFeedback(null);
    const res = await createOrWriteProjectFile(
      newFilePath.trim(),
      newFileContent,
      `Создание файла ${newFilePath.trim()}`,
    );
    if (res.ok) {
      setNewFileOpen(false);
      setNewFilePath('');
      setNewFileContent('');
      setTreeActionFeedback('Файл записан на диск');
    } else {
      setTreeActionFeedback(res.error || 'Ошибка записи');
    }
  };

  const handleQuickGitStatus = async () => {
    setTreeActionFeedback(null);
    const res = await runProjectGitAction('status');
    const summary = (res.stdout || res.stderr || `exit ${res.exitCode}`).split('\n')[0];
    setTreeActionFeedback(`git status: ${summary}`);
  };

  const handleQuickUndo = async () => {
    const res = await undoLastProjectAction();
    setTreeActionFeedback(res.message);
  };

  return (
    <div className={cn('flex-1 min-h-0 flex flex-col overflow-hidden', tokens.sidebarBg)}>
      <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Project selector and workspace controls */}
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  Проект
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {activeProject && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProject(activeProject);
                        setModalOpen(true);
                      }}
                      title="Настроить или удалить проект"
                      className="p-1 rounded hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <FolderCog className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject(null);
                      setModalOpen(true);
                    }}
                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Новый</span>
                  </button>
                </div>
              </div>

              <select
                value={activeProjectId}
                onChange={(event) => void selectProject(event.target.value)}
                aria-label="Выбор проекта"
                className={cn(
                  'w-full h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-900 dark:text-zinc-100',
                  tokens.inputRadius,
                )}
              >
                <option value="">Без проекта</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.folderSource})
                  </option>
                ))}
              </select>

              {activeProject && (
                <>
                  {chatVisibility.showExecutionEnvBar && (
                    <div className="grid grid-cols-3 gap-1 pt-1" aria-label="Среда выполнения">
                      {ENV_META.map((env) => {
                        const Icon = env.icon;
                        const active = executionEnv.activeEnv === env.id;
                        return (
                          <button
                            key={env.id}
                            type="button"
                            onClick={() => setActiveExecutionEnv(env.id)}
                            title={env.label}
                            aria-pressed={active}
                            className={cn(
                              'min-w-0 h-7 px-1 inline-flex items-center justify-center gap-1 border text-[10px] font-medium transition-colors',
                              tokens.inputRadius,
                              active
                                ? tokens.activeHighlight
                                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                            )}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{env.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-1 pt-1">
                    {chatVisibility.showProjectTree && (
                      <button
                        type="button"
                        onClick={() => setFilesModalOpen(true)}
                        className="w-full min-w-0 h-7 px-2 rounded border border-zinc-200 dark:border-zinc-800 text-[10.5px] text-zinc-600 dark:text-zinc-300 hover:border-blue-500 inline-flex items-center gap-1.5"
                      >
                        <FolderOpen className="w-3 h-3 shrink-0" />
                        <span className="truncate">Файлы проекта</span>
                        <span className="ml-auto font-mono tabular-nums text-zinc-400">{files.length}</span>
                      </button>
                    )}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setNewFileOpen((v) => !v)}
                        title="Создать новый файл в папке проекта"
                        aria-label="Создать новый файл"
                        className="w-7 h-7 shrink-0 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-blue-500 inline-flex items-center justify-center"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickGitStatus}
                        title="Выполнить git status"
                        aria-label="Проверить статус Git"
                        className="w-7 h-7 shrink-0 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-blue-500 inline-flex items-center justify-center"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickUndo}
                        title="Откатить последнее изменение (/undo)"
                        aria-label="Откатить последнее изменение"
                        className="w-7 h-7 shrink-0 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-amber-500 inline-flex items-center justify-center"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {newFileOpen && (
                    <form onSubmit={handleCreateFile} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1.5">
                      <input
                        type="text"
                        value={newFilePath}
                        onChange={(e) => setNewFilePath(e.target.value)}
                        placeholder="например: hello.py"
                        className="w-full h-7 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-[11px]"
                      />
                      <textarea
                        rows={2}
                        value={newFileContent}
                        onChange={(e) => setNewFileContent(e.target.value)}
                        placeholder="Содержимое файла..."
                        className="w-full p-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-[11px] resize-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNewFileOpen(false)}
                          className="px-2 py-0.5 text-[11px] text-zinc-500"
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          disabled={!newFilePath.trim()}
                          className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-[11px] font-medium disabled:opacity-45"
                        >
                          Записать
                        </button>
                      </div>
                    </form>
                  )}

                  {treeActionFeedback && (
                    <div className="text-[10.5px] font-mono text-blue-600 dark:text-blue-400 truncate" title={treeActionFeedback}>
                      {treeActionFeedback}
                    </div>
                  )}

                  {projectWorkspace.tasks.length > 0 && (
                    <div className="pt-1 border-t border-zinc-200/70 dark:border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => setTasksExpanded((expanded) => !expanded)}
                        aria-expanded={tasksExpanded}
                        className="w-full flex items-center justify-between gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        <span className="inline-flex items-center gap-1">
                          <ListTodo className="w-3.5 h-3.5" />
                          <span>Задачи</span>
                          <span className="font-mono">({projectWorkspace.tasks.length})</span>
                        </span>
                        {tasksExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                      {tasksExpanded && (
                        <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto">
                          {projectWorkspace.tasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-1.5 text-[10.5px] text-zinc-600 dark:text-zinc-400">
                              <span className={cn(
                                'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                                task.status === 'done'
                                  ? 'bg-emerald-500'
                                  : task.status === 'in-progress'
                                    ? 'bg-blue-500'
                                    : 'bg-zinc-400',
                              )} />
                              <span className="min-w-0 flex-1 break-words">{task.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible Action Log */}
                  <div className="pt-1 border-t border-zinc-200/70 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setLogsExpanded((v) => !v)}
                      className="w-full flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>Журнал действий ({projectLogs.length})</span>
                      </span>
                      {logsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    {logsExpanded && (
                      <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto">
                        {projectLogs.length === 0 ? (
                          <div className="text-[10.5px] text-zinc-500">Записей пока нет</div>
                        ) : (
                          projectLogs.slice(0, 10).map((log) => (
                            <div key={log.id} className="text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center justify-between gap-1.5">
                              <span className={cn('truncate', log.undone && 'line-through opacity-60')}>
                                [{log.kind}] {log.summary}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

          {/* Session history */}
          {chatVisibility.showSessionHistory && (
            <div className="p-3.5 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                  История сессий
                </span>
                <button
                  type="button"
                  onClick={createNewSession}
                  title="Новая сессия"
                  className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Новый чат</span>
                </button>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sessionQuery}
                  onChange={(e) => setSessionQuery(e.target.value)}
                  placeholder="Поиск по сессиям..."
                  className={cn(
                    'w-full h-7 pl-7 pr-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500',
                    tokens.inputRadius,
                  )}
                />
              </div>

              <div className="space-y-1 overflow-y-auto pr-1 flex-1">
                {filteredSessions.map((sess) => {
                  const active = sess.id === activeSessionId;
                  return (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => setActiveSession(sess.id)}
                      className={cn(
                        'w-full text-left px-2.5 py-2 transition-colors border',
                        tokens.cardRadius,
                        active
                          ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                          : 'border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50',
                      )}
                    >
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {sess.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span>{sess.updatedAt}</span>
                        <span>·</span>
                        <span className="tabular-nums">{sess.messages.length} сообщ.</span>
                      </div>
                    </button>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <div className="text-[11px] text-zinc-500 py-3 text-center">
                    Совпадений в истории не найдено
                  </div>
                )}
              </div>
            </div>
          )}
      </div>

      <ProjectModal
        open={modalOpen}
        editingProject={editingProject}
        onClose={() => setModalOpen(false)}
      />
      <ProjectFilesModal
        open={filesModalOpen}
        files={files}
        selectedFilePath={selectedFilePath}
        onClose={() => setFilesModalOpen(false)}
        onSelectFile={(filePath) => void selectFile(filePath, true)}
      />
    </div>
  );
};

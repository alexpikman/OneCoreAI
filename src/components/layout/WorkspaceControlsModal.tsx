import React, { useEffect, useState } from 'react';
import {
  Activity,
  Container,
  FilePlus2,
  FolderCog,
  FolderOpen,
  GitBranch,
  Laptop,
  ListTodo,
  Plus,
  RotateCcw,
  Server,
  X,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ExecutionEnvKind, ProjectRecord } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { ProjectFilesModal } from '../workstation/ProjectFilesModal';
import { ProjectModal } from '../workstation/ProjectModal';

const ENV_META: { id: ExecutionEnvKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'local', label: 'Локально', icon: Laptop },
  { id: 'ssh', label: 'SSH', icon: Server },
  { id: 'docker', label: 'Docker', icon: Container },
];

export type WorkspaceModalSection = 'project' | 'tasks' | 'logs';

interface WorkspaceControlsModalProps {
  open: boolean;
  initialSection?: WorkspaceModalSection;
  onClose: () => void;
}

export const WorkspaceControlsModal: React.FC<WorkspaceControlsModalProps> = ({
  open,
  initialSection = 'project',
  onClose,
}) => {
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
    executionEnv,
    setActiveExecutionEnv,
    chatVisibility,
    navigationVisibility,
    uiStyle,
    setActiveTab,
  } = useOneCoreStore();

  const tokens = getUiTokens(uiStyle);
  const showNav = (key: string) => navigationVisibility[key] !== false;

  const [section, setSection] = useState<WorkspaceModalSection>(initialSection);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [filesModalOpen, setFilesModalOpen] = useState(false);

  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [treeActionFeedback, setTreeActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialSection === 'tasks' && !showNav('workspace.tasks')) {
        setSection('project');
      } else if (initialSection === 'logs' && !showNav('workspace.action-log')) {
        setSection('project');
      } else {
        setSection(initialSection);
      }
    }
  }, [open, initialSection, navigationVisibility]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !modalOpen && !filesModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, modalOpen, filesModalOpen, onClose]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

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
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Управление рабочим пространством и проектом"
            className={cn(
              'flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border shadow-2xl',
              tokens.cardBg,
              tokens.cardBorder,
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Рабочая область
                </div>
                <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeProject ? `${activeProject.name} · управление проектом` : 'Проект и среда выполнения'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть окно управления проектом"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 px-5 py-2.5 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSection('project')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                  section === 'project'
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800',
                )}
              >
                <FolderCog className="h-3.5 w-3.5" />
                <span>Проект и среда</span>
              </button>
              {showNav('workspace.tasks') && (
                <button
                  type="button"
                  onClick={() => setSection('tasks')}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                    section === 'tasks'
                      ? 'bg-blue-600 text-white'
                      : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  <ListTodo className="h-3.5 w-3.5" />
                  <span>Задачи ({projectWorkspace.tasks.length})</span>
                </button>
              )}
              {showNav('workspace.action-log') && (
                <button
                  type="button"
                  onClick={() => setSection('logs')}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                    section === 'logs'
                      ? 'bg-blue-600 text-white'
                      : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Журнал действий ({projectLogs.length})</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {section === 'project' && (
                <>
                  <div className="space-y-2">
                    {showNav('workspace.project-title') && (
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Активный проект
                      </label>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {showNav('workspace.project-select') && (
                        <select
                          value={activeProjectId}
                          onChange={(event) => {
                            const projectId = event.target.value;
                            if (projectId === '__create_project__') {
                              setEditingProject(null);
                              setModalOpen(true);
                              return;
                            }
                            void selectProject(projectId);
                          }}
                          aria-label="Выбор проекта"
                          className={cn(
                            'min-w-[220px] flex-1 h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-900 dark:text-zinc-100',
                            tokens.inputRadius,
                          )}
                        >
                          <option value="">Без проекта</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name} ({project.folderSource})
                            </option>
                          ))}
                          {showNav('workspace.project-create') && (
                            <option value="__create_project__">+ Новый проект</option>
                          )}
                        </select>
                      )}
                      {showNav('workspace.project-create') && (showNav('workspace.project-create.icon') || showNav('workspace.project-create.label')) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProject(null);
                            setModalOpen(true);
                          }}
                          title="Новый проект"
                          aria-label="Новый проект"
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {showNav('workspace.project-create.icon') && <Plus className="h-3.5 w-3.5" />}
                          {showNav('workspace.project-create.label') && <span>Новый</span>}
                        </button>
                      )}
                      {showNav('workspace.project-edit') && showNav('workspace.project-edit.icon') && activeProject && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProject(activeProject);
                            setModalOpen(true);
                          }}
                          title="Настроить проект"
                          aria-label="Настроить проект"
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <FolderCog className="h-3.5 w-3.5" />
                          <span>Настроить</span>
                        </button>
                      )}
                    </div>
                    {activeProject && (
                      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-[11px] font-mono text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 break-all">
                        {activeProject.folderPath}
                      </div>
                    )}
                  </div>

                  {activeProject && chatVisibility.showExecutionEnvBar && showNav('workspace.environment') && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Среда выполнения команд
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {ENV_META.map((env) => {
                          const Icon = env.icon;
                          const active = executionEnv.activeEnv === env.id;
                          if (!showNav(`workspace.env.${env.id}`)) return null;
                          const showEnvIcon = showNav(`workspace.env.${env.id}.icon`);
                          const showEnvLabel = showNav(`workspace.env.${env.id}.label`);
                          if (!showEnvIcon && !showEnvLabel) return null;
                          return (
                            <button
                              key={env.id}
                              type="button"
                              onClick={() => setActiveExecutionEnv(env.id)}
                              aria-pressed={active}
                              aria-label={env.label}
                              title={env.label}
                              className={cn(
                                'min-h-9 px-3 inline-flex items-center justify-center gap-2 border text-xs font-medium transition-colors',
                                tokens.inputRadius,
                                active
                                  ? tokens.activeHighlight
                                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                              )}
                            >
                              {showEnvIcon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                              {showEnvLabel && <span>{env.label}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeProject && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Быстрые операции с проектом
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {chatVisibility.showProjectTree && showNav('workspace.project-files') && (showNav('workspace.project-files.icon') || showNav('workspace.project-files.label')) && (
                          <button
                            type="button"
                            onClick={() => setFilesModalOpen(true)}
                            aria-label="Файлы проекта"
                            className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:border-blue-500 dark:border-zinc-800 dark:text-zinc-200"
                          >
                            {showNav('workspace.project-files.icon') && <FolderOpen className="h-3.5 w-3.5" />}
                            {showNav('workspace.project-files.label') && <span>Файлы проекта</span>}
                            <span className="font-mono tabular-nums text-zinc-400">{files.length}</span>
                          </button>
                        )}
                        {showNav('workspace.new-file') && (
                          <button
                            type="button"
                            onClick={() => setNewFileOpen((v) => !v)}
                            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:border-blue-500 dark:border-zinc-800 dark:text-zinc-200"
                          >
                            {showNav('workspace.new-file.icon') && <FilePlus2 className="h-3.5 w-3.5" />}
                            <span>Новый файл</span>
                          </button>
                        )}
                        {showNav('workspace.git-status') && (
                          <button
                            type="button"
                            onClick={() => void handleQuickGitStatus()}
                            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:border-blue-500 dark:border-zinc-800 dark:text-zinc-200"
                          >
                            {showNav('workspace.git-status.icon') && <GitBranch className="h-3.5 w-3.5" />}
                            <span>git status</span>
                          </button>
                        )}
                        {showNav('workspace.undo') && (
                          <button
                            type="button"
                            onClick={() => void handleQuickUndo()}
                            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:border-amber-500 dark:border-zinc-800 dark:text-zinc-200"
                          >
                            {showNav('workspace.undo.icon') && <RotateCcw className="h-3.5 w-3.5" />}
                            <span>Откат (/undo)</span>
                          </button>
                        )}
                      </div>

                      {showNav('workspace.new-file-form') && newFileOpen && (
                        <form
                          onSubmit={handleCreateFile}
                          className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2 dark:border-zinc-800 dark:bg-zinc-900/50"
                        >
                          <input
                            type="text"
                            value={newFilePath}
                            onChange={(e) => setNewFilePath(e.target.value)}
                            placeholder="например: src/example.ts"
                            className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                          />
                          <textarea
                            rows={4}
                            value={newFileContent}
                            onChange={(e) => setNewFileContent(e.target.value)}
                            placeholder="Содержимое файла..."
                            className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs resize-y"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setNewFileOpen(false)}
                              className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300"
                            >
                              Отмена
                            </button>
                            <button
                              type="submit"
                              disabled={!newFilePath.trim()}
                              className="h-8 px-3 rounded-lg bg-blue-600 text-xs font-medium text-white disabled:opacity-45"
                            >
                              Записать на диск
                            </button>
                          </div>
                        </form>
                      )}

                      {showNav('workspace.feedback') && treeActionFeedback && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-mono text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                          {treeActionFeedback}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {section === 'tasks' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Задачи активного проекта
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('tasks');
                        onClose();
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Открыть страницу задач
                    </button>
                  </div>
                  {projectWorkspace.tasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-500 dark:border-zinc-800">
                      В текущем проекте пока нет задач.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {projectWorkspace.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-2 rounded-xl border border-zinc-200/80 px-3 py-2 text-xs dark:border-zinc-800"
                        >
                          <span
                            className={cn(
                              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                              task.status === 'done'
                                ? 'bg-emerald-500'
                                : task.status === 'in-progress'
                                  ? 'bg-blue-500'
                                  : 'bg-zinc-400',
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</div>
                            {task.description && (
                              <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {task.description}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-[10px] uppercase text-zinc-400">
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {section === 'logs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Последние действия по проекту
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('project-history');
                        onClose();
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Полная история проекта
                    </button>
                  </div>
                  {projectLogs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-500 dark:border-zinc-800">
                      Записей действий пока нет.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {projectLogs.slice(0, 20).map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            'rounded-xl border border-zinc-200/80 px-3 py-2 font-mono text-[11px] dark:border-zinc-800',
                            log.undone && 'opacity-55 line-through',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 text-zinc-500">
                            <span>[{log.kind}]</span>
                            <span className="tabular-nums">{new Date(log.timestamp).toLocaleTimeString('ru-RU')}</span>
                          </div>
                          <div className="mt-0.5 text-zinc-800 dark:text-zinc-200">{log.summary}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
        onSelectFile={(filePath) => {
          void selectFile(filePath, true);
          onClose();
        }}
      />
    </>
  );
};

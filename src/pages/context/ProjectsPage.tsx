import React, { useState } from 'react';
import { CalendarClock, FileText, FolderKanban, Pencil, Plus, Wrench } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ProjectRecord, ProjectsSectionId } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { ProjectModal } from '../../components/workstation/ProjectModal';
import { ProjectPlanModal } from '../../components/projects/ProjectPlanModal';
import { ProjectAllowedToolsSection } from './ProjectAllowedToolsPage';

interface ProjectsPageProps {
  planModalOpen: boolean;
  onClosePlanModal: () => void;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Дата неизвестна' : date.toLocaleDateString('ru-RU');
}

const SOURCE_LABELS: Record<ProjectRecord['folderSource'], string> = {
  local: 'Локальный',
  ssh: 'SSH',
  github: 'GitHub',
};

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ planModalOpen, onClosePlanModal }) => {
  const {
    projects,
    activeProjectId,
    selectProject,
    projectsLoading,
    projectsWorkspaceLoading,
    projectWorkspace,
    projectWorkspaceError,
    projectsSection,
    setProjectsSection,
    setActiveNavSubItemId,
  } = useOneCoreStore();

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const openProjectModal = async (project: ProjectRecord | null) => {
    if (project && project.id !== activeProjectId) {
      await selectProject(project.id);
    }
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const handleSelectTab = (id: string) => {
    const nextSection = id as ProjectsSectionId;
    setProjectsSection(nextSection);
    setActiveNavSubItemId(nextSection === 'allowed-tools' ? 'sub-projects-tools' : 'sub-projects-list');
  };

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'new-project',
            label: 'Новый проект',
            icon: <Plus className="h-3.5 w-3.5" />,
            onClick: () => void openProjectModal(null),
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Проекты</h1>
        </div>
      </PageHeader>

      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Подразделы проектов"
            selectedId={projectsSection}
            onSelect={handleSelectTab}
            items={[
              { id: 'list', label: 'Список проектов', icon: <FolderKanban className="h-3.5 w-3.5" /> },
              { id: 'allowed-tools', label: 'Разрешённые инструменты', icon: <Wrench className="h-3.5 w-3.5" /> },
            ]}
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">
            {projectsSection === 'allowed-tools' ? (
              <ProjectAllowedToolsSection />
            ) : (
              <div>
                {projectsLoading ? (
                  <div className="py-12 text-center text-sm text-zinc-500">Загрузка проектов…</div>
                ) : projects.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center text-center">
                    <FolderKanban className="h-9 w-9 text-zinc-400" />
                    <h2 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Проектов пока нет</h2>
                    <p className="mt-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
                      Создайте проект, чтобы связать с ним задачи, план и историю процессов.
                    </p>
                    <button
                      type="button"
                      onClick={() => void openProjectModal(null)}
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-500"
                    >
                      <Plus className="h-4 w-4" />
                      Создать проект
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50">
                    {projects.map((project) => {
                      const selected = project.id === activeProjectId;
                      return (
                        <div
                          key={project.id}
                          className={cn(
                            'flex min-w-0 items-center gap-2 px-3 sm:px-4',
                            selected ? 'bg-blue-50/80 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-zinc-900/70',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!selected) void selectProject(project.id);
                            }}
                            aria-pressed={selected}
                            className="flex min-w-0 flex-1 items-center gap-4 py-4 text-left"
                          >
                            <span
                              className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                selected
                                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-zinc-400',
                              )}
                            >
                              <FolderKanban className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {project.name}
                                </span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {SOURCE_LABELS[project.folderSource]}
                                </span>
                                {selected && (
                                  <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                    Выбран
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                                {project.description || project.folderPath || 'Описание не задано'}
                              </span>
                              <span className="mt-1 block truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                                {project.folderPath}
                              </span>
                            </span>
                            <span className="hidden shrink-0 items-center gap-1.5 text-[10px] text-zinc-400 sm:inline-flex">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {formatUpdatedAt(project.updatedAt)}
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Настроить проект"
                            aria-label={`Настроить проект ${project.name}`}
                            onClick={() => void openProjectModal(project)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {activeProject && projectsWorkspaceLoading && (
                  <p className="mt-3 text-xs text-zinc-500">Загрузка данных выбранного проекта…</p>
                )}
                {activeProject && projectWorkspaceError && (
                  <p className="mt-3 text-xs text-rose-500">{projectWorkspaceError}</p>
                )}
                {activeProject && !projectsWorkspaceLoading && !projectWorkspaceError && (
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                    <FileText className="h-3.5 w-3.5" />
                    Задач в выбранном проекте: {projectWorkspace.tasks.length}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </PageContent>

      <ProjectModal
        open={projectModalOpen}
        editingProject={editingProject}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
      />
      <ProjectPlanModal
        open={planModalOpen}
        project={activeProject}
        onClose={onClosePlanModal}
      />
    </PageLayout>
  );
};

import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

const PROJECT_TOOL_CATALOG = [
  { id: 'read_file', label: 'read_file', desc: 'Чтение файлов проекта' },
  { id: 'search_code', label: 'search_code', desc: 'Поиск по кодовой базе' },
  { id: 'list_files', label: 'list_files', desc: 'Просмотр дерева каталогов' },
  { id: 'write_file', label: 'write_file', desc: 'Запись и изменение файлов' },
  { id: 'run_command', label: 'run_command', desc: 'Запуск команд в терминале проекта' },
  { id: 'git', label: 'git', desc: 'Операции Git в каталоге проекта' },
  { id: 'web_search', label: 'web_search', desc: 'Веб-поиск через браузерные инструменты' },
  { id: 'web_read', label: 'web_read', desc: 'Чтение веб-страниц по URL' },
];

export const ProjectAllowedToolsSection: React.FC = () => {
  const { uiStyle, projects, activeProjectId, updateProjectAllowedTools } = useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || projects[0]?.id || '');
  const [toolsStatus, setToolsStatus] = useState<string | null>(null);
  const activeProject = projects.find((project) => project.id === (selectedProjectId || activeProjectId)) ?? projects[0] ?? null;
  const currentTools = activeProject?.allowedTools ?? [];

  const handleToggleTool = async (toolId: string) => {
    if (!activeProject) return;
    const next = currentTools.includes(toolId)
      ? currentTools.filter((item) => item !== toolId)
      : [...currentTools, toolId];
    setToolsStatus(null);
    const result = await updateProjectAllowedTools(activeProject.id, next);
    setToolsStatus(
      result.ok ? `Права проекта «${activeProject.name}» обновлены.` : result.error || 'Не удалось обновить права.',
    );
  };

  return (
    <section className={cn('p-6 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Разрешённые инструменты проекта (Runtime Guard)
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Сервер проверяет этот список перед записью файлов, выполнением команд и веб-инструментами.
          </p>
        </div>
        {projects.length > 0 && (
          <select
            value={activeProject?.id ?? ''}
            onChange={(event) => {
              setSelectedProjectId(event.target.value);
              setToolsStatus(null);
            }}
            className={cn(
              'h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
              tokens.inputRadius,
            )}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        )}
      </div>
      {toolsStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400">{toolsStatus}</p>}
      {!activeProject ? (
        <p className="text-xs text-zinc-500">Подключите проект, чтобы настраивать его инструменты.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PROJECT_TOOL_CATALOG.map((tool) => {
            const enabled = currentTools.includes(tool.id);
            return (
              <label
                key={tool.id}
                className={cn(
                  'p-3 border flex items-start justify-between gap-3 cursor-pointer transition-colors',
                  tokens.cardRadius,
                  enabled
                    ? tokens.activeHighlight
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60',
                )}
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">{tool.label}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{tool.desc}</div>
                </div>
                <input type="checkbox" checked={enabled} onChange={() => void handleToggleTool(tool.id)} className="mt-1 accent-blue-600 shrink-0" />
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const ProjectAllowedToolsPage: React.FC = () => (
  <PageLayout>
    <PageHeader>
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
        <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-semibold">Разрешённые инструменты</h1>
      </div>
    </PageHeader>
    <PageContent>
      <div className="py-6">
        <ProjectAllowedToolsSection />
      </div>
    </PageContent>
  </PageLayout>
);

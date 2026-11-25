import React, { useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { QuantGuideModal } from '../models/QuantGuideModal';
import { ProjectsContextPanel } from '../projects/ProjectsContextPanel';

interface PageContextSidebarProps {
  projectListCount: number;
  onOpenPlanModal: () => void;
  onSelectProjectTab: (tab: 'tasks' | 'processes' | 'project-history', projectId: string) => void;
}

const CONTEXT_TITLES: Record<string, string> = {
  dashboard: 'Сводка системы',
  terminal: 'Терминал проекта',
  browser: 'Веб-поиск и чтение',
  notes: 'Личный блокнот',
  projects: 'Рабочие проекты',
  tasks: 'Задачи проектов',
  processes: 'Процессы проектов',
  files: 'Файлы и поиск',
  'project-history': 'История проектов',
  models: 'Провайдеры / Модели',
  directories: 'Справочники',
  skills: 'Библиотека навыков',
  instructions: 'Регламенты и схемы',
  mcp: 'Серверы MCP',
  'tools-hooks': 'Lifecycle Hooks',
  settings: 'Параметры приложения',
  permissions: 'Разрешения и политики',
  security: 'Безопасность',
  system: 'Система и среда',
  'operations-log': 'Журнал операций',
  'error-log': 'Журнал ошибок',
  memory: 'Память и профиль агента',
  'tasks-history': 'История задач',
  'agent-journal': 'Активность агента',
};

export const PageContextSidebar: React.FC<PageContextSidebarProps> = ({
  projectListCount,
  onOpenPlanModal,
  onSelectProjectTab,
}) => {
  const {
    activeTab,
    settingsSection,
    uiStyle,
    projects,
    activeProjectId,
    files,
    localModels,
    activeModelId,
    hardwareProfile,
    hardwareLoading,
    hardwareError,
    serverStatus,
    agentActivity,
    sessions,
    activeSessionId,
    settingsSaveStatus,
    mcpServers,
    hooks,
    skills,
    permissions,
    teamExecutionResult,
    setActiveTab,
  } = useOneCoreStore();

  const [isQuantGuideOpen, setIsQuantGuideOpen] = useState(false);

  if (activeTab === 'workstation') return null;

  const tokens = getUiTokens(uiStyle);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex w-[288px] xl:w-[312px] shrink-0 min-h-0 flex-col overflow-y-auto rounded-2xl border p-4 shadow-[0_4px_20px_-2px_rgba(30,41,59,0.06)]',
          uiStyle === 'mica-windows' && 'mica-panel',
          tokens.sidebarBg,
          tokens.cardBorder,
        )}
        aria-label="Контекст текущего раздела"
      >
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-3">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="w-full text-left rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 transition-colors hover:bg-blue-500/10 dark:border-blue-500/30 dark:bg-blue-950/20"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
            <span>Дашборд системы</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
            <div>
              <span className="text-zinc-400 block text-[10px]">Модель</span>
              <span className="font-medium truncate block">{localModels.find((m) => m.id === activeModelId)?.name || 'Не выбрана'}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">Сервер</span>
              <span className="font-medium capitalize block">{serverStatus}</span>
            </div>
          </div>
        </button>
      </div>

      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Контекст</div>
        <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {activeTab === 'settings' && settingsSection === 'execution-env'
            ? 'Execution Environments'
            : activeTab === 'settings' && settingsSection === 'gateway'
              ? 'Messaging Gateway'
              : activeTab === 'settings' && settingsSection === 'ssh-github'
                ? 'Remote connection'
                : activeTab === 'models' && settingsSection === 'roles-pipeline'
                  ? 'General Agent'
                  : activeTab === 'models' && settingsSection === 'subagents-delegation'
                    ? 'SUB Agents'
                    : activeTab === 'models' && (settingsSection === 'llama-gguf' || settingsSection === 'model-search' || settingsSection === 'llama-models')
                      ? 'Центр GGUF'
                      : activeTab === 'models' && ['engine-paths', 'llama-paged-attention', 'llama-openai-api', 'llama-benchmark'].includes(settingsSection)
                        ? 'LlamaServer'
                        : CONTEXT_TITLES[activeTab] ?? 'Параметры приложения'}
        </h2>
      </div>

      <div className="py-3 space-y-3">
        {activeTab === 'notes' && (
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500">Хранение заметок</div>
            <div className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">Локально на устройстве</div>
            <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
              Записи сохраняются в хранилище ONE CORE AI и доступны после перезапуска.
            </p>
          </div>
        )}

        {(activeTab === 'terminal' || activeTab === 'files') && (
          <>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Активный проект</div>
              <div className="mt-1 break-words text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {activeProject ? activeProject.name : 'Не выбран'}
              </div>
              {activeProject && (
                <div className="mt-1 break-all font-mono text-[10px] text-zinc-500">
                  {activeProject.folderPath}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Файлов в индексе</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {files.length}
              </div>
            </div>
          </>
        )}

        {activeTab === 'browser' && (
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500">Веб-инструменты</div>
            <div className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">Подтверждаемые запросы</div>
            <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
              Каждый поисковый запрос и чтение страницы выполняются только после явного запуска пользователем.
            </p>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Активная модель</div>
              <div className="mt-1 break-words text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {localModels.find((model) => model.id === activeModelId)?.name || 'Не выбрана'}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Состояние AI-сервера</div>
              <div className="mt-1 text-xs font-medium capitalize text-zinc-900 dark:text-zinc-100">{serverStatus}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Состояние агента</div>
              <div className="mt-1 text-xs font-medium capitalize text-zinc-900 dark:text-zinc-100">{agentActivity}</div>
            </div>
          </>
        )}

        {activeTab === 'models' && (
          <>
            <button
              type="button"
              onClick={() => setIsQuantGuideOpen(true)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-zinc-800 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-blue-500" />
                <span className="truncate">Памятка по квантованию</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </button>
            <div className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Реальный профиль системы</div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">Видеокарта</div>
              {hardwareLoading && !hardwareProfile ? (
                <div className="text-xs text-zinc-500">Определение GPU…</div>
              ) : hardwareProfile?.gpus.length ? (
                hardwareProfile.gpus.map((gpu) => (
                  <div key={gpu.name} className="space-y-1">
                    <div className="break-words text-xs font-semibold text-zinc-900 dark:text-zinc-100">{gpu.name}</div>
                    <div className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      VRAM: {gpu.vramFreeGb} / {gpu.vramTotalGb} GB
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {gpu.driverOrRuntime || 'Драйвер не определён'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{hardwareError || 'GPU не обнаружен'}</div>
              )}
              {hardwareProfile && (
                <div className="mt-2 border-t border-zinc-200 pt-2 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Бэкенд: {hardwareProfile.recommendedBackend.toUpperCase()} · {hardwareProfile.backendVersion}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">Остальные характеристики</div>
              {hardwareProfile ? (
                <div className="space-y-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <div><span className="text-zinc-500">ОС:</span> {hardwareProfile.os.platform} {hardwareProfile.os.release} · {hardwareProfile.os.arch}</div>
                  <div><span className="text-zinc-500">CPU:</span> {hardwareProfile.cpu.model} · {hardwareProfile.cpu.cores} ядер</div>
                  <div><span className="text-zinc-500">RAM:</span> {hardwareProfile.ram.freeGb} / {hardwareProfile.ram.totalGb} GB свободно</div>
                  <div><span className="text-zinc-500">Диск:</span> {hardwareProfile.disk.freeGb} / {hardwareProfile.disk.totalGb} GB свободно</div>
                  <div className="break-all text-[10px] text-zinc-500">{hardwareProfile.disk.path}</div>
                </div>
              ) : (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {hardwareLoading ? 'Определение системы…' : hardwareError || 'Данные системы недоступны'}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Локальные модели</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{localModels.length}</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Активная: {localModels.find((model) => model.id === activeModelId)?.name || 'Не выбрана'}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">Сервер: {serverStatus}</div>
            </div>
            {teamExecutionResult && (
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-[11px] text-zinc-500">Последний командный запуск</div>
                <div className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {teamExecutionResult.status} · циклов: {teamExecutionResult.cyclesExecuted}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'projects' && (
          <ProjectsContextPanel
            onOpenPlan={onOpenPlanModal}
            onNavigate={onSelectProjectTab}
          />
        )}

        {(activeTab === 'tasks' || activeTab === 'processes' || activeTab === 'project-history') && (
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500">Проектов в текущем списке</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{projectListCount}</div>
          </div>
        )}

        {(activeTab === 'skills' || activeTab === 'instructions' || activeTab === 'directories') && (
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 space-y-2">
            <div className="text-[11px] text-zinc-500">Регламенты и навыки</div>
            <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
              Активных навыков: {skills.filter((s) => s.enabled).length} / {skills.length}
            </div>
            <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
              Схемы контрактов и подтверждённые документы знаний проверяются в реальном времени при запуске оркестратора.
            </p>
          </div>
        )}

        {(activeTab === 'mcp' || activeTab === 'tools-hooks') && (
          <>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Серверы MCP</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {mcpServers.length}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Подключено: {mcpServers.filter((m) => m.lastStatus === 'ok').length}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500">Жизненный цикл хуков</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {hooks.filter((h) => h.enabled).length} / {hooks.length}
              </div>
            </div>
          </>
        )}

        {(activeTab === 'agent-journal' || activeTab === 'operations-log' || activeTab === 'error-log' || activeTab === 'memory' || activeTab === 'tasks-history') && (
          <>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[11px] text-zinc-500">Состояние агента</div>
              <div className="mt-1 text-xs font-medium capitalize text-zinc-900 dark:text-zinc-100">{agentActivity}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[11px] text-zinc-500">Активная сессия</div>
              <div className="mt-1 text-xs font-medium break-words text-zinc-900 dark:text-zinc-100">
                {sessions.find((session) => session.id === activeSessionId)?.title || 'Не выбрана'}
              </div>
            </div>
          </>
        )}

        {(activeTab === 'settings' || activeTab === 'permissions' || activeTab === 'security' || activeTab === 'system') && (
          <>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[11px] text-zinc-500">Сохранение настроек</div>
              <div className="mt-1 text-xs font-medium capitalize text-zinc-900 dark:text-zinc-100">{settingsSaveStatus}</div>
            </div>
            {activeTab === 'settings' && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-[11px] text-zinc-500">Активный раздел</div>
                <div className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">{settingsSection}</div>
              </div>
            )}
            {activeTab === 'permissions' && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-[11px] text-zinc-500">Правила политик</div>
                <div className="mt-1 text-xs font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                  {permissions.length} правил
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </aside>
      <QuantGuideModal
        open={isQuantGuideOpen}
        onClose={() => setIsQuantGuideOpen(false)}
        hardwareProfile={hardwareProfile}
      />
    </>
  );
};

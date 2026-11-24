import React, { useState } from 'react';
import { Check, Container, Laptop, Plus, Server, Trash2, Webhook, Wrench } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AppHookEvent, ExecutionEnvKind, ToolsHooksSectionId } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { getPageUiTokens } from '../../utils/uiStyle';

const PROJECT_TOOL_CATALOG = [
  { id: 'read_file', label: 'read_file', desc: 'Чтение файлов проекта' },
  { id: 'search_code', label: 'search_code', desc: 'Поиск по кодовой базе' },
  { id: 'list_files', label: 'list_files', desc: 'Просмотр дерева каталогов' },
  { id: 'write_file', label: 'write_file', desc: 'Запись и изменение файлов' },
  { id: 'run_command', label: 'run_command', desc: 'Запуск команд в терминале проекта' },
  { id: 'web_search', label: 'web_search', desc: 'Веб-поиск через браузерные инструменты' },
  { id: 'web_read', label: 'web_read', desc: 'Чтение веб-страниц по URL' },
];

const HOOK_EVENTS: { id: AppHookEvent; label: string }[] = [
  { id: 'pre_file_write', label: 'pre_file_write (перед записью файла)' },
  { id: 'post_file_write', label: 'post_file_write (после записи файла)' },
  { id: 'pre_command', label: 'pre_command (перед командой терминала)' },
  { id: 'post_command', label: 'post_command (после команды терминала)' },
  { id: 'team_run_start', label: 'team_run_start (старт командного запуска)' },
  { id: 'team_run_finish', label: 'team_run_finish (завершение командного запуска)' },
];

export const ExecutionEnvironmentPanel: React.FC = () => {
  const { uiStyle, executionEnv, setActiveExecutionEnv, updateExecutionEnv, sshHosts, openSettingsSection } =
    useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);

  const envCards: {
    id: ExecutionEnvKind;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'local', title: 'Локально (Windows)', subtitle: 'PowerShell / CMD напрямую в папке проекта', icon: Laptop },
    { id: 'ssh', title: 'Удалённый SSH-хост', subtitle: 'Использует профили OpenSSH из раздела SSH и GitHub', icon: Server },
    { id: 'docker', title: 'Docker-контейнер', subtitle: 'Изолированная песочница без риска для хоста', icon: Container },
  ];

  return (
    <div className={cn('p-6 border space-y-5', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
      <div>
        <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Среды выполнения команд (Execution Environments)
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Выберите, где агент запускает сборку, тесты и терминальные команды: локально, по SSH или внутри Docker.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {envCards.map((card) => {
          const Icon = card.icon;
          const selected = executionEnv.activeEnv === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveExecutionEnv(card.id)}
              className={cn(
                'p-4 border text-left transition-colors space-y-1.5',
                tokens.cardRadius,
                selected
                  ? tokens.activeHighlight
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60',
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-4 h-4 text-blue-500" />
                {selected && <Check className="w-4 h-4 text-blue-500" />}
              </div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{card.subtitle}</div>
            </button>
          );
        })}
      </div>

      {executionEnv.activeEnv === 'local' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Оболочка Windows</label>
            <select
              value={executionEnv.localShell}
              onChange={(e) => updateExecutionEnv({ localShell: e.target.value as 'powershell' | 'cmd' })}
              className={cn(
                'w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                tokens.inputRadius,
              )}
            >
              <option value="powershell">PowerShell 7 / Windows PowerShell</option>
              <option value="cmd">Command Prompt (cmd.exe)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Рабочий каталог</label>
            <input
              type="text"
              value={executionEnv.localWorkdir}
              onChange={(e) => updateExecutionEnv({ localWorkdir: e.target.value })}
              className={cn(
                'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                tokens.inputRadius,
              )}
            />
          </div>
        </div>
      )}

      {executionEnv.activeEnv === 'ssh' && (
        <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Целевой SSH-хост из ~/.ssh/config
            </label>
            <button
              type="button"
              onClick={() => openSettingsSection('ssh-github')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Настроить ключи и хосты SSH →
            </button>
          </div>
          <select
            value={executionEnv.sshHostId}
            onChange={(e) => updateExecutionEnv({ sshHostId: e.target.value })}
            className={cn(
              'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
              tokens.inputRadius,
            )}
          >
            {sshHosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.alias} ({h.user}@{h.hostName}:{h.port})
              </option>
            ))}
          </select>
        </div>
      )}

      {executionEnv.activeEnv === 'docker' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Образ контейнера</label>
            <input
              type="text"
              value={executionEnv.dockerImage}
              onChange={(e) => updateExecutionEnv({ dockerImage: e.target.value })}
              className={cn(
                'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                tokens.inputRadius,
              )}
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Каталог внутри (/workspace)</label>
            <input
              type="text"
              value={executionEnv.dockerWorkdir}
              onChange={(e) => updateExecutionEnv({ dockerWorkdir: e.target.value })}
              className={cn(
                'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                tokens.inputRadius,
              )}
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Сеть контейнера</label>
            <select
              value={executionEnv.dockerNetworkMode}
              onChange={(e) => updateExecutionEnv({ dockerNetworkMode: e.target.value as 'bridge' | 'none' })}
              className={cn(
                'w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                tokens.inputRadius,
              )}
            >
              <option value="bridge">bridge (доступ в сеть)</option>
              <option value="none">none (строгий офлайн)</option>
            </select>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer pt-2">
        <input
          type="checkbox"
          checked={executionEnv.requireApprovalBeforeExec}
          onChange={(e) => updateExecutionEnv({ requireApprovalBeforeExec: e.target.checked })}
          className="accent-blue-600"
        />
        <span>Запрашивать подтверждение пользователя перед выполнением команд в терминале (Cline Safe Act)</span>
      </label>
    </div>
  );
};

export const ToolsHooksPage: React.FC = () => {
  const {
    uiStyle,
    projects,
    activeProjectId,
    updateProjectAllowedTools,
    hooks,
    addHook,
    updateHook,
    deleteHook,
    toolsHooksSection,
    setToolsHooksSection,
  } = useOneCoreStore();

  const tokens = getPageUiTokens(uiStyle);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || projects[0]?.id || '');
  const [toolsStatus, setToolsStatus] = useState<string | null>(null);

  const [hookName, setHookName] = useState('');
  const [hookEvent, setHookEvent] = useState<AppHookEvent>('post_file_write');
  const [hookCommand, setHookCommand] = useState('');
  const [hookTimeout, setHookTimeout] = useState(15000);

  const activeProject = projects.find((p) => p.id === (selectedProjectId || activeProjectId)) ?? projects[0] ?? null;
  const currentTools = activeProject?.allowedTools ?? [];

  const handleToggleTool = async (toolId: string) => {
    if (!activeProject) return;
    const next = currentTools.includes(toolId)
      ? currentTools.filter((item) => item !== toolId)
      : [...currentTools, toolId];
    setToolsStatus(null);
    const res = await updateProjectAllowedTools(activeProject.id, next);
    setToolsStatus(
      res.ok ? `Права проекта «${activeProject.name}» обновлены.` : res.error || 'Не удалось обновить права.',
    );
  };

  const handleAddHook = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hookName.trim() || !hookCommand.trim()) return;
    addHook({
      name: hookName.trim(),
      event: hookEvent,
      command: hookCommand.trim(),
      enabled: true,
      timeoutMs: Math.max(1000, Number(hookTimeout) || 15000),
    });
    setHookName('');
    setHookCommand('');
  };

  const showTools = toolsHooksSection === 'all' || toolsHooksSection === 'tools';
  const showHooks = toolsHooksSection === 'all' || toolsHooksSection === 'hooks';

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">
            {toolsHooksSection === 'hooks'
              ? 'Lifecycle Hooks'
              : toolsHooksSection === 'tools'
                ? 'Разрешённые инструменты (Tools)'
                : 'Инструменты и Hooks'}
          </h1>
        </div>
      </PageHeader>
      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Разделы Tools и Hooks"
            items={[
              { id: 'all', label: 'Все' },
              { id: 'tools', label: 'Tools', icon: <Wrench className="h-3.5 w-3.5" /> },
              { id: 'hooks', label: 'Hooks', icon: <Webhook className="h-3.5 w-3.5" /> },
            ]}
            selectedId={toolsHooksSection}
            onSelect={(id) => setToolsHooksSection(id as ToolsHooksSectionId)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">

          {/* Per-project tool whitelist */}
          {showTools && (
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
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setToolsStatus(null);
                  }}
                  className={cn(
                    'h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
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
                        <div className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {tool.label}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{tool.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => void handleToggleTool(tool.id)}
                        className="mt-1 accent-blue-600 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {toolsHooksSection === 'all' && <ExecutionEnvironmentPanel />}

          {/* Lifecycle Hooks */}
          {showHooks && (
          <section className={cn('p-6 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Webhook className="h-4 w-4 text-blue-500" />
                <span>Lifecycle Hooks</span>
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Команды выполняются на сервере при реальных событиях записи файлов, терминала и командной оркестрации.
              </p>
            </div>

            <form onSubmit={handleAddHook} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3">
                <label className="block text-[11px] text-zinc-500 mb-1">Название</label>
                <input
                  type="text"
                  required
                  value={hookName}
                  onChange={(e) => setHookName(e.target.value)}
                  placeholder="Typecheck on write"
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] text-zinc-500 mb-1">Событие</label>
                <select
                  value={hookEvent}
                  onChange={(e) => setHookEvent(e.target.value as AppHookEvent)}
                  className={cn(
                    'w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                >
                  {HOOK_EVENTS.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="block text-[11px] text-zinc-500 mb-1">Shell-команда</label>
                <input
                  type="text"
                  required
                  value={hookCommand}
                  onChange={(e) => setHookCommand(e.target.value)}
                  placeholder="npm run lint"
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                    tokens.inputRadius,
                  )}
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <input
                  type="number"
                  min={1000}
                  max={60000}
                  step={1000}
                  value={hookTimeout}
                  onChange={(e) => setHookTimeout(Number(e.target.value) || 15000)}
                  aria-label="Таймаут мс"
                  className={cn(
                    'w-20 h-9 px-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs tabular-nums',
                    tokens.inputRadius,
                  )}
                />
                <button
                  type="submit"
                  className={cn('h-9 flex-1 px-3 text-xs font-medium inline-flex items-center justify-center gap-1 whitespace-nowrap', tokens.inputRadius, tokens.accentButton)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить
                </button>
              </div>
            </form>

            {hooks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Хуки пока не настроены.
              </div>
            ) : (
              <div className="space-y-2">
                {hooks.map((hook) => (
                  <div
                    key={hook.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{hook.name}</span>
                        <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                          {hook.event}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{hook.command}</div>
                      {hook.lastRunAt && (
                        <div className="text-[10px] text-zinc-400">
                          Последний запуск: {new Date(hook.lastRunAt).toLocaleString('ru-RU')} · exit{' '}
                          {hook.lastExitCode ?? '—'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hook.enabled}
                          onChange={(e) => updateHook(hook.id, { enabled: e.target.checked })}
                          className="accent-blue-600"
                        />
                        Вкл.
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await requestDeleteWarning({
                            variant: 'simple',
                            title: 'Удалить хук?',
                            description: 'Правило жизненного цикла будет удалено.',
                            itemName: hook.name,
                          });
                          if (confirmed) deleteHook(hook.id);
                        }}
                        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-rose-500/10 hover:text-rose-500 text-zinc-400 inline-flex items-center justify-center"
                        title="Удалить хук"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

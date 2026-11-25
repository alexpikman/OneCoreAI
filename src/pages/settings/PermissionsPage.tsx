import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, FolderCog, RefreshCw, Shield, Wrench } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentJournalEvent, PermissionPolicy } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

const PROJECT_TOOL_IDS = [
  'read_file',
  'search_code',
  'list_files',
  'write_file',
  'run_command',
  'git',
  'web_search',
  'web_read',
] as const;

const POLICY_META: Record<PermissionPolicy, { label: string; badgeClass: string }> = {
  allow: {
    label: 'Авто',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  ask: {
    label: 'Запрос',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  deny: {
    label: 'Запрет',
    badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
};

export const PermissionsPage: React.FC = () => {
  const {
    uiStyle,
    permissions,
    projects,
    activeProjectId,
    setActiveTab,
    setSettingsSection,
    setGeneralAgentTab,
    setAgentTeamSection,
    setAgentTeamFocus,
    setProjectsSection,
    setActiveNavSubItemId,
  } = useOneCoreStore();

  const tokens = getPageUiTokens(uiStyle);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || projects[0]?.id || '');
  const [auditEvents, setAuditEvents] = useState<AgentJournalEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const selectedProject = projects.find((p) => p.id === (selectedProjectId || activeProjectId)) ?? projects[0] ?? null;

  const loadPermissionEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const response = await apiFetch('/api/agent-journal');
      const data = (await response.json()) as { ok?: boolean; events?: AgentJournalEvent[] };
      if (response.ok && data.ok && Array.isArray(data.events)) {
        const filtered = data.events.filter(
          (event) =>
            event.category === 'tool' ||
            event.category === 'terminal' ||
            /approval|permission|подтверж|запрещ|блокир/i.test(`${event.title} ${event.summary}`),
        );
        setAuditEvents(filtered.slice(0, 25));
      }
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    void loadPermissionEvents();
  }, [loadPermissionEvents]);

  const allowCount = permissions.filter((rule) => rule.policy === 'allow').length;
  const askCount = permissions.filter((rule) => rule.policy === 'ask').length;
  const denyCount = permissions.filter((rule) => rule.policy === 'deny').length;
  const projectTools = selectedProject?.allowedTools ?? [];

  const openGeneralAgentPermissions = () => {
    setActiveTab('models');
    setSettingsSection('roles-pipeline');
    setGeneralAgentTab('permissions');
    setAgentTeamSection('permissions');
    setAgentTeamFocus('permissions');
    setActiveNavSubItemId('sub-permissions');
  };

  const openGeneralAgentTools = () => {
    setActiveTab('models');
    setSettingsSection('roles-pipeline');
    setGeneralAgentTab('tools');
    setAgentTeamSection('tools');
    setAgentTeamFocus('tools');
    setActiveNavSubItemId('sub-agent-tools');
  };

  const openProjectAllowedTools = () => {
    setActiveTab('projects');
    setProjectsSection('allowed-tools');
    setActiveNavSubItemId('sub-projects-tools');
  };

  return (
    <PageLayout>
      <PageHeader
        actions={[
          {
            id: 'refresh-permissions-audit',
            label: 'Обновить аудит',
            icon: <RefreshCw className={cn('h-3.5 w-3.5', loadingEvents && 'animate-spin')} />,
            onClick: () => void loadPermissionEvents(),
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Разрешения и политики доступа</h1>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-6 py-6">
        <section className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Источники настройки политик и разрешений
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Редактирование политик вынесено в профильные разделы без дублирования форм: здесь отображается
              сводный контур активных правил и журнал проверок выполнения.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={openGeneralAgentPermissions}
              className="text-left rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-4 transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-500/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <Shield className="h-3.5 w-3.5 text-blue-500" />
                  General Agent → Разрешения
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Редактирование глобальных правил (Авто / Запрос / Запрет) для Agent Core.
              </p>
              <div className="mt-2 font-mono text-[10px] text-zinc-500">
                {allowCount} авто · {askCount} запрос · {denyCount} запрет
              </div>
            </button>

            <button
              type="button"
              onClick={openProjectAllowedTools}
              className="text-left rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-4 transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-500/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <FolderCog className="h-3.5 w-3.5 text-blue-500" />
                  Проекты → Разрешённые инструменты
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Настройка Runtime Guard (<code className="font-mono">allowedTools</code>) для конкретного проекта.
              </p>
              <div className="mt-2 font-mono text-[10px] text-zinc-500">
                {selectedProject ? `${selectedProject.name}: ${projectTools.length} активн.` : 'Проект не выбран'}
              </div>
            </button>

            <button
              type="button"
              onClick={openGeneralAgentTools}
              className="text-left rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-4 transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-500/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <Wrench className="h-3.5 w-3.5 text-blue-500" />
                  General Agent → Инструменты агента
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Реестр инструментов, доступ субагентов, метки <code className="font-mono">(SYS)</code> и схемы взаимодействия.
              </p>
              <div className="mt-2 font-mono text-[10px] text-zinc-500">
                ROLE_CONTRACTS + привязки документов
              </div>
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section
            className={cn(
              'lg:col-span-6 p-5 border space-y-4',
              tokens.cardRadius,
              tokens.cardBg,
              tokens.cardBorder,
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Сводка действующего контура безопасности
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Режим только для чтения. Изменения выполняются в профильных разделах выше.
                </p>
              </div>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{permissions.length} правил</span>
            </div>

            <div className="space-y-2">
              {permissions.map((rule) => {
                const policy = POLICY_META[rule.policy];
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] text-zinc-500">{rule.category}</div>
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{rule.title}</div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                        policy.badgeClass,
                      )}
                    >
                      {policy.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-zinc-200/80 pt-3 space-y-2.5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Активный белый список проекта
                </h3>
                {projects.length > 0 && (
                  <select
                    value={selectedProject?.id ?? ''}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    aria-label="Выбор проекта для просмотра разрешённых инструментов"
                    className={cn(
                      'h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
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

              {!selectedProject ? (
                <p className="text-xs text-zinc-500">Нет активных проектов.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_TOOL_IDS.map((toolId) => {
                    const active = projectTools.includes(toolId);
                    return (
                      <span
                        key={toolId}
                        className={cn(
                          'rounded-md border px-2 py-1 font-mono text-[11px] whitespace-nowrap',
                          active
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600',
                        )}
                      >
                        {toolId}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section
            className={cn(
              'lg:col-span-6 p-5 border space-y-3',
              tokens.cardRadius,
              tokens.cardBg,
              tokens.cardBorder,
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  События проверок, подтверждений и терминала
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Последние 25 событий из журнала операций (<code className="font-mono">/api/agent-journal</code>),
                  связанных с инструментами и политиками доступа.
                </p>
              </div>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{auditEvents.length}</span>
            </div>

            {auditEvents.length === 0 ? (
              <p className="text-xs text-zinc-500">Записей проверок пока нет.</p>
            ) : (
              <div className="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
                {auditEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{ev.title}</span>
                      <span className="font-mono text-[10px] text-zinc-400 shrink-0">{ev.status}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 break-words">{ev.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </PageContent>
    </PageLayout>
  );
};

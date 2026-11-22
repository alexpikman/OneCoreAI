import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Shield } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentJournalEvent, PermissionPolicy } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

const PROJECT_TOOLS = [
  'read_file',
  'search_code',
  'list_files',
  'write_file',
  'run_command',
  'web_search',
  'web_read',
];

export const PermissionsPage: React.FC = () => {
  const { uiStyle, permissions, setPermissionPolicy, projects, activeProjectId, updateProjectAllowedTools } =
    useOneCoreStore();

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
        setAuditEvents(filtered.slice(0, 20));
      }
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    void loadPermissionEvents();
  }, [loadPermissionEvents]);

  const toggleProjectTool = async (toolId: string) => {
    if (!selectedProject) return;
    const current = selectedProject.allowedTools ?? [];
    const next = current.includes(toolId) ? current.filter((item) => item !== toolId) : [...current, toolId];
    await updateProjectAllowedTools(selectedProject.id, next);
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section
            className={cn(
              'lg:col-span-7 p-5 border space-y-4',
              tokens.cardRadius,
              tokens.cardBg,
              tokens.cardBorder,
            )}
          >
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Глобальная матрица разрешений
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Определяет политику Agent Core для чтения/записи файлов, терминала, Git и веб-инструментов.
              </p>
            </div>

            <div className="space-y-2.5">
              {permissions.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-zinc-500">{rule.category}</div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{rule.title}</div>
                    <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">{rule.description}</p>
                  </div>

                  <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 shrink-0">
                    {(
                      [
                        { val: 'allow', label: 'Авто' },
                        { val: 'ask', label: 'Запрос' },
                        { val: 'deny', label: 'Запрет' },
                      ] as { val: PermissionPolicy; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setPermissionPolicy(rule.id, opt.val)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap',
                          rule.policy === opt.val
                            ? opt.val === 'deny'
                              ? 'bg-rose-600 text-white'
                              : opt.val === 'ask'
                                ? 'bg-amber-600 text-white'
                                : 'bg-emerald-600 text-white'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="lg:col-span-5 space-y-6">
            <section className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Белый список проекта
                </h2>
                {projects.length > 0 && (
                  <select
                    value={selectedProject?.id ?? ''}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
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
                <div className="flex flex-wrap gap-2">
                  {PROJECT_TOOLS.map((toolId) => {
                    const active = (selectedProject.allowedTools ?? []).includes(toolId);
                    return (
                      <button
                        key={toolId}
                        type="button"
                        onClick={() => void toggleProjectTool(toolId)}
                        aria-pressed={active}
                        className={cn(
                          'h-8 px-2.5 rounded-lg border font-mono text-xs transition-colors whitespace-nowrap',
                          active
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-500',
                        )}
                      >
                        {toolId}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={cn('p-5 border space-y-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                События проверок и терминала
              </h2>
              {auditEvents.length === 0 ? (
                <p className="text-xs text-zinc-500">Записей проверок пока нет.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
        </div>
      </PageContent>
    </PageLayout>
  );
};

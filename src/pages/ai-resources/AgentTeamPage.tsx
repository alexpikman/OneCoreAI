import React, { useEffect } from 'react';
import { BookOpen, Bot, GitBranch, Shield, Sliders, UserCheck } from 'lucide-react';
import { AIResourcePageLayout as PageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { GeneralAgentTabId } from '../../types/onecore';
import { AgentRolesPage } from './AgentRolesPage';
import { DirectivesPage } from './DirectivesPage';
import { GeneralAgentInstructionsPage } from './GeneralAgentInstructionsPage';
import { PermissionsLibrarySection } from './PermissionsLibrarySection';

export const AgentTeamPage: React.FC<{ initialTab?: GeneralAgentTabId }> = ({ initialTab }) => {
  const {
    generalAgentTab,
    setGeneralAgentTab,
    setAgentTeamSection,
    setAgentTeamFocus,
    setSettingsSection,
    setSubAgentsTab,
    setActiveNavSubItemId,
    setActiveTab,
    roles,
    enabledRoleIds,
    directives,
    permissions,
    settingsError,
  } = useOneCoreStore();

  useEffect(() => {
    if (initialTab && initialTab !== generalAgentTab) {
      setGeneralAgentTab(initialTab);
    }
  }, [initialTab, generalAgentTab, setGeneralAgentTab]);

  const handleSelectTab = (id: string) => {
    const nextTab = id as GeneralAgentTabId;
    setGeneralAgentTab(nextTab);
    setAgentTeamSection(nextTab);
    setAgentTeamFocus(
      nextTab === 'permissions'
        ? 'permissions'
        : nextTab === 'directives'
          ? 'directives'
          : nextTab === 'instructions'
            ? 'general'
            : 'roles',
    );
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">General Agent</h1>
        </div>
      </PageHeader>

      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Страницы General Agent"
            selectedId={generalAgentTab}
            onSelect={handleSelectTab}
            items={[
              { id: 'permissions', label: 'Разрешения', icon: <Shield className="h-3.5 w-3.5" /> },
              { id: 'directives', label: 'Системные указания', icon: <Sliders className="h-3.5 w-3.5" /> },
              { id: 'instructions', label: 'Инструкции', icon: <BookOpen className="h-3.5 w-3.5" /> },
              { id: 'roles', label: 'Роли', icon: <UserCheck className="h-3.5 w-3.5" /> },
            ]}
            footer={
              <div className="mt-2 pb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Правил разрешений:{' '}
                    <strong className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                      {permissions.length}
                    </strong>
                  </span>
                  <span>
                    Системных указаний:{' '}
                    <strong className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                      {directives.filter((d) => d.enabled).length} / {directives.length}
                    </strong>
                  </span>
                  <span>
                    Активных ролей:{' '}
                    <strong className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                      {enabledRoleIds.length} / {roles.length}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSubAgentsTab('delegation');
                    setAgentTeamSection('delegation');
                    setAgentTeamFocus('pipeline');
                    setActiveNavSubItemId('sub-pipeline');
                    setSettingsSection('subagents-delegation');
                    setActiveTab('models');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                >
                  <GitBranch className="h-3 w-3" />
                  <span>SUB Agents</span>
                </button>
              </div>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">
            {settingsError && (
              <p
                role="alert"
                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {settingsError}
              </p>
            )}

            {generalAgentTab === 'permissions' && <PermissionsLibrarySection />}
            {generalAgentTab === 'directives' && <DirectivesPage />}
            {generalAgentTab === 'instructions' && <GeneralAgentInstructionsPage />}
            {generalAgentTab === 'roles' && <AgentRolesPage />}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

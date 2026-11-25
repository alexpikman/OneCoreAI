import React, { useEffect } from 'react';
import { Bot, GitBranch, Play, Users } from 'lucide-react';
import { AIResourcePageLayout as PageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { SubAgentsTabId } from '../../types/onecore';
import { SubAgentsDelegationSection } from './SubAgentsDelegationSection';
import { TeamExecutionPage } from './TeamExecutionPage';
import { SubAgentsRegistryPage } from './SubAgentsRegistryPage';

export const SubAgentsPage: React.FC<{ initialTab?: SubAgentsTabId }> = ({ initialTab }) => {
  const {
    subAgentsTab,
    setSubAgentsTab,
    setAgentTeamSection,
    setAgentTeamFocus,
    setGeneralAgentTab,
    setSettingsSection,
    setActiveTab,
    pipelineStages,
    pipelineProjectName,
    teamExecutionResult,
    settingsError,
  } = useOneCoreStore();

  useEffect(() => {
    if (initialTab && initialTab !== subAgentsTab) {
      setSubAgentsTab(initialTab);
    }
  }, [initialTab, subAgentsTab, setSubAgentsTab]);

  const handleSelectTab = (id: string) => {
    const nextTab = id as SubAgentsTabId;
    setSubAgentsTab(nextTab);
    if (nextTab !== 'registry') {
      setAgentTeamSection(nextTab);
      setAgentTeamFocus(nextTab === 'delegation' ? 'pipeline' : 'orchestration');
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">SUB Agents</h1>
        </div>
      </PageHeader>

      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Страницы SUB Agents"
            selectedId={subAgentsTab}
            onSelect={handleSelectTab}
            items={[
              { id: 'delegation', label: 'Субагенты и делегирование', icon: <GitBranch className="h-3.5 w-3.5" /> },
              { id: 'team-execution', label: 'Командное выполнение', icon: <Play className="h-3.5 w-3.5" /> },
              { id: 'registry', label: 'Реестр субагентов', icon: <Users className="h-3.5 w-3.5" /> },
            ]}
            footer={
              <div className="mt-2 pb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Этапов пайплайна:{' '}
                    <strong className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                      {pipelineStages.length}
                    </strong>
                  </span>
                  <span>
                    Проект:{' '}
                    <strong className="font-medium text-zinc-700 dark:text-zinc-200">
                      {pipelineProjectName || 'Не задан'}
                    </strong>
                  </span>
                  {teamExecutionResult && (
                    <span>
                      Последний отчёт:{' '}
                      <strong className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                        {teamExecutionResult.status} · циклов: {teamExecutionResult.cyclesExecuted}
                      </strong>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGeneralAgentTab('permissions');
                    setAgentTeamFocus('permissions');
                    setSettingsSection('roles-pipeline');
                    setActiveTab('models');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                >
                  <Bot className="h-3 w-3" />
                  <span>General Agent</span>
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

            {subAgentsTab === 'delegation' && <SubAgentsDelegationSection />}
            {subAgentsTab === 'team-execution' && <TeamExecutionPage />}
            {subAgentsTab === 'registry' && <SubAgentsRegistryPage />}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

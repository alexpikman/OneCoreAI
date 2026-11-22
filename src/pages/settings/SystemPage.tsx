import React, { useState } from 'react';
import { Activity, Download, Server, Settings2 } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { GitHubInstallView } from '../../components/system/GitHubInstallView';
import { SystemConfigView } from '../../components/system/SystemConfigView';
import { ExecutionEnvironmentPanel } from '../integrations/ToolsHooksPage';

type SystemSection = 'execution-env' | 'installation' | 'ai-config';

export const SystemPage: React.FC = () => {
  const [section, setSection] = useState<SystemSection>('execution-env');

  return (
    <PageLayout>
      <PageHeader showSave={section === 'ai-config'}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Settings2 className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Система</h1>
          </div>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-5 pb-5 pt-2">
        <SecondaryTabBar
          ariaLabel="Разделы системы"
          items={[
            { id: 'execution-env', label: 'Среды выполнения', icon: <Server className="h-3.5 w-3.5" /> },
            { id: 'installation', label: 'Установка приложения', icon: <Download className="h-3.5 w-3.5" /> },
            { id: 'ai-config', label: 'AI и диагностика', icon: <Activity className="h-3.5 w-3.5" /> },
          ]}
          selectedId={section}
          onSelect={(id) => setSection(id as SystemSection)}
        />

        {section === 'execution-env' ? (
          <div className="mx-auto w-full max-w-4xl">
            <ExecutionEnvironmentPanel />
          </div>
        ) : section === 'installation' ? (
          <GitHubInstallView />
        ) : (
          <SystemConfigView />
        )}
      </PageContent>
    </PageLayout>
  );
};

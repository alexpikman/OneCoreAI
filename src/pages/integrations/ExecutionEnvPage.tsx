import React from 'react';
import { Container } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { ExecutionEnvironmentPanel } from './ToolsHooksPage';

export const ExecutionEnvPage: React.FC = () => (
  <PageLayout>
    <PageHeader>
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
        <Container className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-semibold">Среды выполнения (Execution Environments)</h1>
      </div>
    </PageHeader>
    <PageContent contentClassName="space-y-6 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <ExecutionEnvironmentPanel />
      </div>
    </PageContent>
  </PageLayout>
);

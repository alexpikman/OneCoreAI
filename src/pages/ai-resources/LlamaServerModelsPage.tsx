import React from 'react';
import { Cpu } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { LlamaServerWorkspace } from '../../components/settings/LlamaServerWorkspace';

export const LlamaServerModelsPage: React.FC = () => (
  <AIResourcePageLayout>
    <PageHeader>
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
        <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-semibold">Модели и запуск</h1>
      </div>
    </PageHeader>
    <PageContent scrollable={false} contentClassName="min-h-0 flex-1">
      <LlamaServerWorkspace />
    </PageContent>
  </AIResourcePageLayout>
);

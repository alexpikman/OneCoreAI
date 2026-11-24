import React from 'react';
import { Cloud, Cpu, Plug, Server, Sparkles } from 'lucide-react';
import { AIResourcePageLayout as PageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageTransition } from '../../components/layout/PageTransition';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { LlamaServerWorkspace } from '../../components/settings/LlamaServerWorkspace';
import { ProviderCategoryWorkspace } from '../../components/settings/ProviderCategoryWorkspace';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AiProviderCategory } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getProviderCategory } from '../../utils/providerCategories';

const CATEGORY_LABELS: Record<AiProviderCategory, string> = {
  local: 'LOCAL',
  cloud: 'CLOUD',
  compatible: 'COMPATIBLE',
  'llama-server': 'LLAMASERVER',
};

const CATEGORY_ICONS: Record<AiProviderCategory, React.ReactNode> = {
  local: <Cpu className="h-3.5 w-3.5" />,
  cloud: <Cloud className="h-3.5 w-3.5" />,
  compatible: <Plug className="h-3.5 w-3.5" />,
  'llama-server': <Server className="h-3.5 w-3.5" />,
};

const CATEGORY_ORDER: AiProviderCategory[] = ['local', 'cloud', 'compatible', 'llama-server'];

export const ProvidersPage: React.FC = () => {
  const {
    aiSettingsCategory,
    setAiSettingsCategory,
    freeProviders,
    activeProviderId,
    serverStatus,
  } = useOneCoreStore();

  const activeProvider = freeProviders.find((provider) => provider.id === activeProviderId) ?? null;
  const activeProviderCategory = activeProvider ? getProviderCategory(activeProvider.kind) : null;
  const activeProviderStatus = !activeProvider
    ? 'Не выбран'
    : activeProvider.enabled === false
      ? 'Выключен'
      : activeProvider.kind === 'llama-cpp'
        ? serverStatus === 'ready' || serverStatus === 'generating'
          ? 'Подключено'
          : serverStatus === 'loading'
            ? 'Подключение…'
            : serverStatus === 'error'
              ? 'Ошибка'
              : 'Не подключено'
        : activeProvider.status === 'connected'
          ? 'Подключено'
          : activeProvider.status === 'checking'
            ? 'Проверка…'
            : activeProvider.status === 'error'
              ? 'Ошибка'
              : 'Не подключено';

  return (
    <PageTransition mode="page" className="flex w-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageLayout>
        <PageHeader showSave={false}>
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl font-semibold">Провайдеры</h1>
          </div>
        </PageHeader>
        <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
          <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
            <SecondaryTabBar
              ariaLabel="Категории провайдеров ИИ"
              items={CATEGORY_ORDER.map((category) => ({
                id: category,
                label: CATEGORY_LABELS[category],
                icon: CATEGORY_ICONS[category],
              }))}
              selectedId={aiSettingsCategory}
              onSelect={(id) => setAiSettingsCategory(id as AiProviderCategory)}
              footer={
                <div className="mt-2 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>
                    Активный провайдер:{' '}
                    <strong className="font-medium text-zinc-700 dark:text-zinc-200">
                      {activeProvider?.name ?? 'Не выбран'}
                    </strong>
                  </span>
                  <span>
                    Режим:{' '}
                    <strong className="font-medium text-zinc-700 dark:text-zinc-200">
                      {activeProviderCategory ? CATEGORY_LABELS[activeProviderCategory] : '—'}
                    </strong>
                  </span>
                  <span>
                    Подключение:{' '}
                    <strong
                      className={cn(
                        'font-medium',
                        activeProviderStatus === 'Подключено'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : activeProviderStatus === 'Ошибка'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-zinc-700 dark:text-zinc-200',
                      )}
                    >
                      {activeProviderStatus}
                    </strong>
                  </span>
                </div>
              }
            />

            <main className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-4">
              {aiSettingsCategory === 'llama-server' ? (
                <LlamaServerWorkspace />
              ) : (
                <ProviderCategoryWorkspace category={aiSettingsCategory} />
              )}
            </main>
          </div>
        </PageContent>
      </PageLayout>
    </PageTransition>
  );
};

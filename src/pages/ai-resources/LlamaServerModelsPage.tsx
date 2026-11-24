import React, { useState } from 'react';
import { Check, Cpu, HardDrive, Play, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { LlamaServerWorkspace } from '../../components/settings/LlamaServerWorkspace';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { LlamaModelsSectionId } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export const LlamaServerModelsPage: React.FC = () => {
  const {
    llamaModelsSection,
    setLlamaModelsSection,
    localModels,
    activeModelId,
    selectLocalModel,
    deleteLocalModel,
    roles,
    activeRoleId,
    setActiveRole,
    setSettingsSection,
    setGgufHubTab,
    setActiveTab,
    serverStatus,
  } = useOneCoreStore();

  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  return (
    <AIResourcePageLayout>
      <PageHeader showSave={false}>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Модели и запуск</h1>
        </div>
      </PageHeader>
      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Разделы моделей и запуска"
            selectedId={llamaModelsSection}
            onSelect={(id) => setLlamaModelsSection(id as LlamaModelsSectionId)}
            items={[
              { id: 'launch', label: 'Управление запуском', icon: <Play className="h-3.5 w-3.5" /> },
              { id: 'installed', label: 'Установленные модели', icon: <HardDrive className="h-3.5 w-3.5" /> },
            ]}
            footer={
              <div className="mt-2 pb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Установлено GGUF:{' '}
                    <strong className="font-medium text-zinc-700 dark:text-zinc-200">{localModels.length}</strong>
                  </span>
                  <span>
                    Статус сервера:{' '}
                    <strong className="font-medium text-zinc-700 dark:text-zinc-200">{serverStatus}</strong>
                  </span>
                  <span>
                    Текущая роль:{' '}
                    <strong className="font-medium text-zinc-700 dark:text-zinc-200">
                      {roles.find((r) => r.id === activeRoleId)?.name ?? activeRoleId}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsSection('llama-gguf');
                    setGgufHubTab('search');
                    setActiveTab('models');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <Search className="h-3 w-3" />
                  Открыть каталог GGUF
                </button>
              </div>
            }
          />

          {llamaModelsSection === 'launch' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-5">
              <LlamaServerWorkspace />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">
              {banner && (
                <div
                  role={banner.ok ? 'status' : 'alert'}
                  className={cn(
                    'rounded-xl border px-4 py-2.5 text-xs',
                    banner.ok
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                  )}
                >
                  {banner.msg}
                </div>
              )}

              <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Библиотека установленных моделей ({localModels.length})
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Управляйте статусами, выбором текущей роли и запуском локальных моделей.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                      <span>Текущая роль:</span>
                      <select
                        value={activeRoleId}
                        onChange={(e) => setActiveRole(e.target.value)}
                        className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {localModels.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-xs text-zinc-500 dark:border-zinc-700 space-y-3">
                    <p>Локальные модели ещё не установлены.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsSection('llama-gguf');
                        setGgufHubTab('search');
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Перейти в каталог GGUF</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {localModels.map((model) => {
                      const isActive = model.id === activeModelId;
                      return (
                        <article
                          key={model.id}
                          className={cn(
                            'rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors',
                            isActive
                              ? 'border-blue-500/60 bg-blue-500/5'
                              : 'border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/60',
                          )}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {model.name}
                              </span>
                              <span className="font-mono text-[11px] text-zinc-500">{model.quant}</span>
                              {model.status === 'ready' && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Готова
                                </span>
                              )}
                            </div>
                            <div className="truncate font-mono text-[11px] text-zinc-500 tabular-nums">
                              {model.totalBytes > 0 ? formatBytes(model.totalBytes) : `${model.sizeGb} GB`} · {model.localPath}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {model.status === 'ready' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await selectLocalModel(model.id);
                                  if (res.ok) {
                                    setBanner({ ok: true, msg: `Модель «${model.name}» выбрана для запуска.` });
                                    setLlamaModelsSection('launch');
                                  } else {
                                    setBanner({ ok: false, msg: res.error || 'Не удалось выбрать модель.' });
                                  }
                                }}
                                className={cn(
                                  'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap',
                                  isActive
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-900 text-white hover:bg-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-blue-500 dark:hover:text-white',
                                )}
                              >
                                {isActive ? <Check className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                <span>{isActive ? 'Активна' : 'Запуск'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                const confirmed = await requestDeleteWarning({
                                  variant: 'confirmation',
                                  title: 'Удалить локальную модель?',
                                  description: 'Файл модели будет удалён с диска и из каталога.',
                                  itemName: model.name,
                                  confirmLabel: 'Удалить',
                                });
                                if (confirmed) {
                                  await deleteLocalModel(model.id);
                                }
                              }}
                              title="Удалить модель"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500 dark:border-zinc-800"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </PageContent>
    </AIResourcePageLayout>
  );
};

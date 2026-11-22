import React, { useState } from 'react';
import { BookOpen, Bot, Brain, Plus, Trash2 } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentSkill, AiProviderCategory, FreeProviderProfile } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { getProviderCategory } from '../../utils/providerCategories';
import { getPageUiTokens } from '../../utils/uiStyle';

function formatSkillTimestamp(value?: string): string {
  if (!value) return 'Не применялся';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('ru-RU');
}

export const SkillsDirectoryPage: React.FC = () => {
  const {
    uiStyle,
    skills,
    toggleSkill,
    addSkill,
    updateSkill,
    deleteSkill,
    incrementSkillUsage,
    subagentConfig,
    updateSubagentConfig,
    roles,
  } = useOneCoreStore();

  const tokens = getPageUiTokens(uiStyle);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [skillTitle, setSkillTitle] = useState('');
  const [skillCategory, setSkillCategory] = useState<AgentSkill['category']>('Разработка');
  const [skillTrigger, setSkillTrigger] = useState('');
  const [skillBody, setSkillBody] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skills[0]?.id ?? '');

  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? skills[0];

  const subagentProviderSettings =
    subagentConfig.providerProfilesByRole[subagentConfig.defaultRoleId] ?? subagentConfig;
  const subagentProvider =
    subagentProviderSettings.providers.find(
      (provider) =>
        provider.id === subagentProviderSettings.providerSelectionByCategory[subagentProviderSettings.providerCategory],
    ) ?? subagentProviderSettings.providers[0];

  const updateSubagentProvider = (providerId: string, patch: Partial<FreeProviderProfile>) =>
    updateSubagentConfig({
      providerProfilesByRole: {
        ...subagentConfig.providerProfilesByRole,
        [subagentConfig.defaultRoleId]: {
          ...subagentProviderSettings,
          providers: subagentProviderSettings.providers.map((provider) =>
            provider.id === providerId ? { ...provider, ...patch } : provider,
          ),
        },
      },
    });

  const selectSubagentCategory = (category: AiProviderCategory) =>
    updateSubagentConfig({
      providerProfilesByRole: {
        ...subagentConfig.providerProfilesByRole,
        [subagentConfig.defaultRoleId]: {
          ...subagentProviderSettings,
          providerCategory: category,
        },
      },
    });

  const providersForSubagentCategory = (category: AiProviderCategory) =>
    subagentProviderSettings.providers.filter((provider) => getProviderCategory(provider.kind) === category);

  const handleCreateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillTitle.trim()) return;
    addSkill({
      title: skillTitle,
      category: skillCategory,
      triggerHint: skillTrigger || 'Активируется при совпадении контекста задачи',
      contentMarkdown:
        skillBody.trim() ||
        `---\nname: ${skillTitle.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}\n---\nИнструкция навыка: ${skillTitle}`,
      source: 'custom',
    });
    setSkillTitle('');
    setSkillTrigger('');
    setSkillBody('');
    setNewSkillOpen(false);
  };

  return (
    <AIResourcePageLayout>
      <PageHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl font-semibold">Самообучающиеся навыки SKILL.md (agentskills.io)</h1>
          </div>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-6 py-6">
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>Библиотека навыков</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setNewSkillOpen((v) => !v)}
              className={cn(
                'h-8 px-3 text-xs font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap',
                tokens.inputRadius,
                tokens.accentButton,
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать навык</span>
            </button>
          </div>

          {newSkillOpen && (
            <form
              onSubmit={handleCreateSkill}
              className={cn('p-4 border border-blue-500/30 bg-blue-500/5 space-y-3', tokens.cardRadius)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={skillTitle}
                  onChange={(e) => setSkillTitle(e.target.value)}
                  placeholder="Название навыка..."
                  className={cn(
                    'sm:col-span-2 h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                />
                <select
                  value={skillCategory}
                  onChange={(e) => setSkillCategory(e.target.value as AgentSkill['category'])}
                  className={cn(
                    'h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                >
                  <option value="Разработка">Разработка</option>
                  <option value="DevOps">DevOps</option>
                  <option value="Исследование">Исследование</option>
                  <option value="Автоматизация">Автоматизация</option>
                </select>
              </div>
              <input
                type="text"
                value={skillTrigger}
                onChange={(e) => setSkillTrigger(e.target.value)}
                placeholder="Когда применять (триггер)..."
                className={cn(
                  'w-full h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs',
                  tokens.inputRadius,
                )}
              />
              <textarea
                rows={4}
                value={skillBody}
                onChange={(e) => setSkillBody(e.target.value)}
                placeholder="Markdown-инструкция SKILL.md..."
                className={cn(
                  'w-full p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs',
                  tokens.inputRadius,
                )}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewSkillOpen(false)}
                  className={cn('h-8 px-3 border border-zinc-200 dark:border-zinc-800 text-xs', tokens.inputRadius)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={cn('h-8 px-3 text-xs font-medium', tokens.inputRadius, tokens.accentButton)}
                >
                  Сохранить в библиотеку
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-2 max-h-96 overflow-y-auto pr-1">
              {skills.map((sk) => (
                <div
                  key={sk.id}
                  onClick={() => setSelectedSkillId(sk.id)}
                  className={cn(
                    'p-3 border cursor-pointer flex items-start justify-between gap-2 transition-colors',
                    tokens.cardRadius,
                    selectedSkill?.id === sk.id
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {sk.title}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5 tabular-nums">
                      {sk.category} · {sk.usageCount}x · {sk.source}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {formatSkillTimestamp(sk.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={sk.enabled}
                      onChange={() => toggleSkill(sk.id)}
                      className="accent-blue-600"
                    />
                    {sk.source !== 'builtin' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await requestDeleteWarning({
                            variant: 'simple',
                            title: 'Удалить навык?',
                            description: 'Навык будет удалён из пользовательской библиотеки.',
                            itemName: sk.title,
                          });
                          if (confirmed) deleteSkill(sk.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-rose-500"
                        title="Удалить навык"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedSkill && (
              <div className="lg:col-span-7 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-zinc-500">{selectedSkill.slug}/SKILL.md</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">{selectedSkill.triggerHint}</span>
                    <button
                      type="button"
                      onClick={() => incrementSkillUsage(selectedSkill.id)}
                      className="rounded border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
                    >
                      Отметить применение
                    </button>
                  </div>
                </div>
                <textarea
                  rows={12}
                  value={selectedSkill.contentMarkdown}
                  onChange={(e) => updateSkill(selectedSkill.id, { contentMarkdown: e.target.value })}
                  className={cn(
                    'w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500',
                    tokens.inputRadius,
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {/* Subagents Delegation Settings */}
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                <span>Субагенты и делегирование</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Изолированные воркеры с отдельными профилями, настраиваемыми правилами делегирования и привязкой к плану проекта.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={subagentConfig.enabled}
                onChange={(e) => updateSubagentConfig({ enabled: e.target.checked })}
                className="accent-blue-600"
              />
              <span>Включено</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Параллельных воркеров</label>
              <input
                type="number"
                min={1}
                max={32}
                value={subagentConfig.maxParallel}
                onChange={(e) =>
                  updateSubagentConfig({ maxParallel: Math.max(1, Number(e.target.value) || 4) })
                }
                className={cn(
                  'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs tabular-nums',
                  tokens.inputRadius,
                )}
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Лимит шагов (итераций)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={subagentConfig.maxIterations}
                onChange={(e) =>
                  updateSubagentConfig({ maxIterations: Math.max(1, Number(e.target.value) || 12) })
                }
                className={cn(
                  'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs tabular-nums',
                  tokens.inputRadius,
                )}
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Роль по умолчанию</label>
              <select
                value={subagentConfig.defaultRoleId}
                onChange={(e) => updateSubagentConfig({ defaultRoleId: e.target.value })}
                className={cn(
                  'w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                  tokens.inputRadius,
                )}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2.5">
              <label className="block text-[11px] text-zinc-500">
                Отдельное подключение субагента ·{' '}
                {roles.find((role) => role.id === subagentConfig.defaultRoleId)?.name ?? 'Выбранная роль'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['local', 'cloud', 'compatible', 'llama-server'] as const).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => selectSubagentCategory(category)}
                    aria-pressed={subagentProviderSettings.providerCategory === category}
                    className={cn(
                      'h-8 px-3 border text-[11px] font-semibold tracking-wide whitespace-nowrap',
                      tokens.inputRadius,
                      subagentProviderSettings.providerCategory === category
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300',
                    )}
                  >
                    {category === 'llama-server' ? 'LLAMASERVER' : category.toUpperCase()}
                  </button>
                ))}
              </div>
              <select
                value={subagentProvider?.id ?? ''}
                onChange={(event) => {
                  const providerId = event.target.value;
                  updateSubagentConfig({
                    providerProfilesByRole: {
                      ...subagentConfig.providerProfilesByRole,
                      [subagentConfig.defaultRoleId]: {
                        ...subagentProviderSettings,
                        providerSelectionByCategory: {
                          ...subagentProviderSettings.providerSelectionByCategory,
                          [subagentProviderSettings.providerCategory]: providerId,
                        },
                      },
                    },
                  });
                }}
                className={cn(
                  'w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                  tokens.inputRadius,
                )}
              >
                {providersForSubagentCategory(subagentProviderSettings.providerCategory).map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              {subagentProvider && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-zinc-500">Base URL субагента</span>
                    <input
                      value={subagentProvider.baseUrl}
                      onChange={(event) => updateSubagentProvider(subagentProvider.id, { baseUrl: event.target.value })}
                      className={cn(
                        'h-9 w-full px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono',
                        tokens.inputRadius,
                      )}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-zinc-500">API Key субагента</span>
                    <input
                      type="password"
                      value={subagentProvider.apiKey}
                      onChange={(event) => updateSubagentProvider(subagentProvider.id, { apiKey: event.target.value })}
                      className={cn(
                        'h-9 w-full px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                        tokens.inputRadius,
                      )}
                      placeholder="Ключ хранится отдельно от основного агента"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[10px] text-zinc-500">Модель субагента</span>
                    <select
                      value={subagentProvider.selectedModel}
                      onChange={(event) =>
                        updateSubagentProvider(subagentProvider.id, { selectedModel: event.target.value })
                      }
                      className={cn(
                        'h-9 w-full px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono',
                        tokens.inputRadius,
                      )}
                    >
                      {subagentProvider.availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>

          <section className="space-y-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Правила запуска субагентов</h3>
                <p className="text-[10px] text-zinc-500">
                  Правила добавляются к каждому поручению. Привязанные к плану получают актуальный план активного проекта.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSubagentConfig({
                    rules: [
                      ...(subagentConfig.rules ?? []),
                      {
                        id: `sub-rule-${Date.now()}`,
                        title: 'Новое правило',
                        instruction: 'Опишите ожидаемое поведение субагента.',
                        enabled: true,
                        locked: false,
                        bindToPlan: true,
                      },
                    ],
                  })
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                <Plus className="h-3 w-3" />
                Добавить правило
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[680px] text-left text-[10px]">
                <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900/70">
                  <tr>
                    <th className="px-2.5 py-2 font-medium">Правило / инструкция</th>
                    <th className="px-2 py-2 text-center font-medium">Вкл.</th>
                    <th className="px-2 py-2 text-center font-medium">Фикс.</th>
                    <th className="px-2 py-2 text-center font-medium">План</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(subagentConfig.rules ?? []).map((rule) => (
                    <tr key={rule.id} className="border-t border-zinc-100 align-top dark:border-zinc-800/80">
                      <td className="space-y-1.5 px-2.5 py-2">
                        <input
                          value={rule.title}
                          disabled={rule.locked}
                          aria-label="Название правила"
                          onChange={(event) =>
                            updateSubagentConfig({
                              rules: (subagentConfig.rules ?? []).map((item) =>
                                item.id === rule.id ? { ...item, title: event.target.value } : item,
                              ),
                            })
                          }
                          className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-[10px] font-semibold disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <textarea
                          rows={2}
                          value={rule.instruction}
                          disabled={rule.locked}
                          aria-label="Инструкция правила"
                          onChange={(event) =>
                            updateSubagentConfig({
                              rules: (subagentConfig.rules ?? []).map((item) =>
                                item.id === rule.id ? { ...item, instruction: event.target.value } : item,
                              ),
                            })
                          }
                          className="w-full resize-y rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[10px] leading-relaxed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          aria-label="Включить правило"
                          onChange={(event) =>
                            updateSubagentConfig({
                              rules: (subagentConfig.rules ?? []).map((item) =>
                                item.id === rule.id ? { ...item, enabled: event.target.checked } : item,
                              ),
                            })
                          }
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.locked}
                          aria-label="Зафиксировать правило"
                          onChange={(event) =>
                            updateSubagentConfig({
                              rules: (subagentConfig.rules ?? []).map((item) =>
                                item.id === rule.id ? { ...item, locked: event.target.checked } : item,
                              ),
                            })
                          }
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.bindToPlan}
                          aria-label="Связать с планом проекта"
                          onChange={(event) =>
                            updateSubagentConfig({
                              rules: (subagentConfig.rules ?? []).map((item) =>
                                item.id === rule.id ? { ...item, bindToPlan: event.target.checked } : item,
                              ),
                            })
                          }
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        {!rule.locked && (
                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = await requestDeleteWarning({
                                variant: 'simple',
                                title: 'Удалить правило?',
                                description: 'Правило будет удалено из настроек субагентов.',
                                itemName: rule.title,
                              });
                              if (confirmed) {
                                updateSubagentConfig({
                                  rules: (subagentConfig.rules ?? []).filter((item) => item.id !== rule.id),
                                });
                              }
                            }}
                            title="Удалить правило"
                            aria-label="Удалить правило"
                            className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </PageContent>
    </AIResourcePageLayout>
  );
};

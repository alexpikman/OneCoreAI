import React, { useState } from 'react';
import { Bot, Flame, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import {
  CRITICAL_GOD_MODE_RULES,
  GENERAL_AGENT_AUTHORITY_META,
} from '../../data/generalAgentModes';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { GeneralAgentAuthorityMode } from '../../types/onecore';
import { cn } from '../../utils/cn';

const AVAILABLE_CAPABILITIES = ['list_files', 'read_file', 'search_code', 'read_knowledge'] as const;

export const GeneralAgentInstructionsPage: React.FC = () => {
  const {
    generalAgentConfig,
    updateGeneralAgentConfig,
    setGeneralAgentAuthorityMode,
    openGodProModal,
    deactivateGodProMode,
    createCustomSubagent,
    deleteCustomSubagent,
    saveSettings,
  } = useOneCoreStore();

  const [generalAgentSaveStatus, setGeneralAgentSaveStatus] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [subPurpose, setSubPurpose] = useState('');
  const [subInstructions, setSubInstructions] = useState('');
  const [subCaps, setSubCaps] = useState<string[]>(['list_files', 'read_file', 'search_code', 'read_knowledge']);
  const [subReadOnly, setSubReadOnly] = useState(true);

  const authorityMode: GeneralAgentAuthorityMode = generalAgentConfig.authorityMode ?? 'god';
  const customSubagents = generalAgentConfig.customSubagents ?? [];

  const handleSaveGeneralAgentConfig = async () => {
    const result = await saveSettings();
    setGeneralAgentSaveStatus(
      result.ok ? 'Настройки общего агента сохранены.' : result.error || 'Не удалось сохранить настройки.',
    );
  };

  const handleAuthoritySelect = async (mode: GeneralAgentAuthorityMode) => {
    if (mode === 'god-pro') {
      if (authorityMode === 'god-pro') return;
      openGodProModal();
      return;
    }
    const result = await setGeneralAgentAuthorityMode(mode);
    setGeneralAgentSaveStatus(
      result.ok
        ? `Активен режим ${GENERAL_AGENT_AUTHORITY_META[mode].shortLabel}.`
        : result.error || 'Не удалось переключить режим.',
    );
  };

  const handleToggleCap = (cap: string) => {
    setSubCaps((prev) =>
      prev.includes(cap) ? prev.filter((item) => item !== cap) : [...prev, cap],
    );
  };

  const handleCreateSubagent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subName.trim() || !subPurpose.trim() || !subInstructions.trim()) return;
    await createCustomSubagent({
      name: subName,
      purpose: subPurpose,
      instructions: subInstructions,
      allowedCapabilities: subCaps,
      readOnly: subReadOnly,
    });
    setSubName('');
    setSubPurpose('');
    setSubInstructions('');
    setGeneralAgentSaveStatus('Кастомный субагент создан и сохранён.');
  };

  return (
    <div className="space-y-4">
      <section
        id="agent-authority-modes"
        className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Режим полномочий Общего агента (GOD / GodPro)
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Общий агент работает без навязанной роли: свободно открывает и читает файлы, конструирует субагентов с правами и задачами. В режиме GOD любое действие из списка краха ставится на паузу до вашего подтверждения.
            </p>
          </div>
          {authorityMode === 'god-pro' && (
            <button
              type="button"
              onClick={() => void deactivateGodProMode('god')}
              className="h-8 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 dark:text-rose-300 whitespace-nowrap"
            >
              Отключить GodPro (вернуть GOD)
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(['standard', 'god', 'god-pro'] as const).map((mode) => {
            const meta = GENERAL_AGENT_AUTHORITY_META[mode];
            const active = authorityMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => void handleAuthoritySelect(mode)}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition-colors',
                  active
                    ? mode === 'god-pro'
                      ? 'border-rose-500 bg-rose-500/10'
                      : mode === 'god'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-blue-500 bg-blue-500/10'
                    : 'border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {mode === 'god-pro' ? (
                      <Flame className="h-3.5 w-3.5 text-rose-500" />
                    ) : mode === 'god' ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                    )}
                    {meta.label}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                    {active ? 'АКТИВЕН' : 'ВЫБРАТЬ'}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {meta.summaryRu}
                </p>
              </button>
            );
          })}
        </div>

        {authorityMode === 'god-pro' && generalAgentConfig.godProActivation && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200">
            GodPro активирован: {new Date(generalAgentConfig.godProActivation.activatedAt).toLocaleString('ru-RU')} · контрольная фраза и отказ от ответственности разработчика подтверждены.
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Список угроз краха (Стоп-контроль режима GOD)
            </h3>
            <span className="font-mono text-[10px] text-zinc-500">
              {CRITICAL_GOD_MODE_RULES.length} правил
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2 md:grid-cols-2">
            {CRITICAL_GOD_MODE_RULES.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-zinc-200/80 bg-white p-2.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-950/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{rule.titleRu}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase',
                      rule.riskLevel === 'critical'
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                    )}
                  >
                    {rule.riskLevel}
                  </span>
                </div>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">{rule.descriptionRu}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {rule.examples.slice(0, 4).map((ex) => (
                    <code
                      key={ex}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {ex}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="agent-block-general"
        className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">Общий агент</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Инструкции, схема поведения и системный промпт, используемые по умолчанию и при отключённых узких ролях.
            </p>
          </div>
          <span className="font-mono text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {GENERAL_AGENT_AUTHORITY_META[authorityMode].badgeRu}
          </span>
        </div>

        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
          <label className="block min-w-[230px] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Инструкции</span>
            <textarea
              rows={10}
              value={generalAgentConfig.instructions}
              onChange={(event) => {
                updateGeneralAgentConfig({ instructions: event.target.value });
                setGeneralAgentSaveStatus(null);
              }}
              className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block min-w-[230px] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Схема поведения: этапы, правила и ограничения
            </span>
            <textarea
              rows={10}
              value={generalAgentConfig.behaviorSchema}
              onChange={(event) => {
                updateGeneralAgentConfig({ behaviorSchema: event.target.value });
                setGeneralAgentSaveStatus(null);
              }}
              className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block min-w-[230px] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Системный промпт
            </span>
            <textarea
              rows={10}
              value={generalAgentConfig.systemPrompt}
              onChange={(event) => {
                updateGeneralAgentConfig({ systemPrompt: event.target.value });
                setGeneralAgentSaveStatus(null);
              }}
              className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {generalAgentSaveStatus ??
              'Изменения применяются к контексту общего агента; нажмите «Сохранить общий агент» для записи на диск.'}
          </span>
          <button
            type="button"
            onClick={() => void handleSaveGeneralAgentConfig()}
            className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-500 whitespace-nowrap"
          >
            Сохранить общий агент
          </button>
        </div>
      </section>

      <section
        id="agent-custom-subagents"
        className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <Bot className="h-4 w-4 text-blue-500" />
              Кастомные субагенты Общего агента ({customSubagents.length})
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Субагенты, созданные самим Общим агентом через create_custom_subagent или добавленные вручную с точными правами и инструкциями.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleCreateSubagent(e)} className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-transparent p-4 dark:border-zinc-800 dark:bg-transparent md:grid-cols-2">
          <input
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="Имя субагента (например, RouteAuditor)"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={subPurpose}
            onChange={(e) => setSubPurpose(e.target.value)}
            placeholder="Назначение и зона ответственности"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <textarea
            rows={2}
            value={subInstructions}
            onChange={(e) => setSubInstructions(e.target.value)}
            placeholder="Точные указания, что и как должен проверить/выполнить субагент"
            className="md:col-span-2 rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] md:col-span-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Права:</span>
            {AVAILABLE_CAPABILITIES.map((cap) => (
              <label key={cap} className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950">
                <input
                  type="checkbox"
                  checked={subCaps.includes(cap)}
                  onChange={() => handleToggleCap(cap)}
                />
                <code className="font-mono text-[10px]">{cap}</code>
              </label>
            ))}
            <label className="ml-auto inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={subReadOnly}
                onChange={(e) => setSubReadOnly(e.target.checked)}
              />
              <span>Read-only</span>
            </label>
            <button
              type="submit"
              disabled={!subName.trim() || !subPurpose.trim() || !subInstructions.trim()}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Добавить субагента</span>
            </button>
          </div>
        </form>

        {customSubagents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Пока нет кастомных субагентов. Общий агент может создать их автоматически под задачу в чате или вы можете добавить их выше.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {customSubagents.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</span>
                      <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {item.createdBy === 'general-agent' ? 'создан агентом' : 'создан вручную'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{item.purpose}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteCustomSubagent(item.id)}
                    aria-label={`Удалить субагента ${item.name}`}
                    className="rounded p-1 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-2 rounded bg-white p-2 text-[11px] text-zinc-700 border border-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  {item.instructions}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.allowedCapabilities.map((cap) => (
                    <code
                      key={cap}
                      className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                    >
                      {cap}
                    </code>
                  ))}
                </div>
                {item.lastResultSummary && (
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Последний итог: {item.lastResultSummary}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

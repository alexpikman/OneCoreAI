import React, { useState } from 'react';
import { useOneCoreStore } from '../../store/useOneCoreStore';

export const GeneralAgentInstructionsPage: React.FC = () => {
  const { generalAgentConfig, updateGeneralAgentConfig, saveSettings } = useOneCoreStore();
  const [generalAgentSaveStatus, setGeneralAgentSaveStatus] = useState<string | null>(null);

  const handleSaveGeneralAgentConfig = async () => {
    const result = await saveSettings();
    setGeneralAgentSaveStatus(
      result.ok ? 'Настройки общего агента сохранены.' : result.error || 'Не удалось сохранить настройки.',
    );
  };

  return (
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
          Универсальный режим
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
  );
};

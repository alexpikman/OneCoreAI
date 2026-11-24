import React, { useMemo, useState } from 'react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ModelDirective } from '../../types/onecore';
import { cn } from '../../utils/cn';

type DirectiveFilter = 'Все' | ModelDirective['category'];

const DIRECTIVE_CATEGORIES: DirectiveFilter[] = [
  'Все',
  'Качество кода',
  'Архитектура',
  'Безопасность',
  'Стиль ответа',
];

export const DirectivesPage: React.FC = () => {
  const { directives, toggleDirective, addCustomDirective } = useOneCoreStore();

  const [directiveCategoryFilter, setDirectiveCategoryFilter] = useState<DirectiveFilter>('Все');
  const [dirTitle, setDirTitle] = useState('');
  const [dirInstruction, setDirInstruction] = useState('');
  const [dirCategory, setDirCategory] = useState<ModelDirective['category']>('Качество кода');

  const visibleDirectives = useMemo(
    () =>
      directiveCategoryFilter === 'Все'
        ? directives
        : directives.filter((dir) => dir.category === directiveCategoryFilter),
    [directiveCategoryFilter, directives],
  );

  const handleAddDirective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirTitle.trim() || !dirInstruction.trim()) return;
    addCustomDirective({
      category: dirCategory,
      title: dirTitle.trim(),
      instruction: dirInstruction.trim(),
      enabled: true,
    });
    setDirTitle('');
    setDirInstruction('');
  };

  return (
    <section
      id="agent-block-directives"
      className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Системные указания (Directives)
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Фильтруйте директивы по категориям и добавляйте собственные правила в системный промпт.
          </p>
        </div>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">
          {directives.filter((d) => d.enabled).length} / {directives.length} активно
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {DIRECTIVE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setDirectiveCategoryFilter(category)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
              directiveCategoryFilter === category
                ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleDirectives.map((dir) => (
          <label
            key={dir.id}
            className={cn(
              'block cursor-pointer rounded-xl border p-3.5 transition-colors',
              dir.enabled
                ? 'border-blue-500/40 bg-blue-500/5'
                : 'border-zinc-200/80 bg-zinc-50/60 opacity-75 dark:border-zinc-800 dark:bg-zinc-900/30',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-zinc-500">{dir.category}</div>
                <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {dir.title}
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {dir.instruction}
                </p>
              </div>
              <input
                type="checkbox"
                checked={dir.enabled}
                onChange={() => toggleDirective(dir.id)}
                className="mt-1 shrink-0 rounded accent-blue-600"
              />
            </div>
          </label>
        ))}
      </div>

      <form onSubmit={handleAddDirective} className="space-y-2.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Добавить новое указание</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={dirTitle}
            onChange={(e) => setDirTitle(e.target.value)}
            placeholder="Название правила"
            className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 sm:col-span-2"
          />
          <select
            value={dirCategory}
            onChange={(e) => setDirCategory(e.target.value as ModelDirective['category'])}
            className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="Качество кода">Качество кода</option>
            <option value="Архитектура">Архитектура</option>
            <option value="Безопасность">Безопасность</option>
            <option value="Стиль ответа">Стиль ответа</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={dirInstruction}
            onChange={(e) => setDirInstruction(e.target.value)}
            placeholder="Текст инструкции для модели..."
            className="h-8 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={!dirTitle.trim() || !dirInstruction.trim()}
            className="h-8 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-45 whitespace-nowrap dark:bg-zinc-100 dark:text-zinc-900"
          >
            Добавить
          </button>
        </div>
      </form>
    </section>
  );
};

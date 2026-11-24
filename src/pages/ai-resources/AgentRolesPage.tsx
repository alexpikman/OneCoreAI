import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentMode } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';

export const AgentRolesPage: React.FC = () => {
  const {
    roles,
    enabledRoleIds,
    toggleAgentRole,
    setActiveRole,
    addCustomRole,
    deleteCustomRole,
    localModels,
    activeModelId,
  } = useOneCoreStore();

  const [roleName, setRoleName] = useState('');
  const [roleTagline, setRoleTagline] = useState('');
  const [rolePrompt, setRolePrompt] = useState('');
  const [roleMode, setRoleMode] = useState<AgentMode>('act');
  const [roleTemp, setRoleTemp] = useState(0.2);

  const activeModel = localModels.find((m) => m.id === activeModelId);

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || !rolePrompt.trim()) return;
    addCustomRole({
      name: roleName.trim(),
      persona: 'custom',
      tagline: roleTagline.trim() || 'Пользовательская системная роль',
      systemPrompt: rolePrompt.trim(),
      defaultMode: roleMode,
      recommendedTemp: roleTemp,
      accentHex: '#06B6D4',
    });
    setRoleName('');
    setRoleTagline('');
    setRolePrompt('');
  };

  return (
    <div className="min-w-0 space-y-5">
      {/* Создание новой роли */}
      <section
        id="agent-block-create-role"
        className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111114]"
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          <div>
            <h2 className="font-display flex items-center gap-1.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <Plus className="h-4 w-4 text-blue-500" />
              <span>Создание новой роли</span>
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Создайте и активируйте специализированную роль (например, Rust Performance Tuner или Security Auditor).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Название роли</label>
              <input
                type="text"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Например: Системный оптимизатор"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Краткая специализация</label>
              <input
                type="text"
                value={roleTagline}
                onChange={(e) => setRoleTagline(e.target.value)}
                placeholder="Профилирование памяти, SIMD и асинхронный Tokio"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Системный промпт роли</label>
            <textarea
              rows={3}
              required
              value={rolePrompt}
              onChange={(e) => setRolePrompt(e.target.value)}
              placeholder="Опишите стиль мышления, формат ответов и приоритеты проверки кода..."
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Режим по умолчанию</label>
              <select
                value={roleMode}
                onChange={(e) => setRoleMode(e.target.value as AgentMode)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="act">Act (Диффы и терминал)</option>
                <option value="plan">Plan (Только анализ)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600 tabular-nums dark:text-zinc-400">
                Temperature ({roleTemp.toFixed(2)})
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={roleTemp}
                onChange={(e) => setRoleTemp(parseFloat(e.target.value))}
                className="mt-2 w-full accent-blue-600"
              />
            </div>
          </div>

          <button
            type="submit"
            className="h-9 w-full rounded-lg bg-blue-600 text-xs font-medium text-white transition-colors hover:bg-blue-500 whitespace-nowrap"
          >
            Создать и активировать роль
          </button>
        </form>
      </section>

      {/* Доступные роли — горизонтально в 1 ряд */}
      <section
        id="agent-block-roles"
        className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Доступные роли {activeModel ? `для модели ${activeModel.name}` : ''}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Каталог специализаций, промптов, режимов PLAN/ACT, температуры и активности ролей в чате.
            </p>
          </div>
          <span className="font-mono text-xs text-zinc-500 tabular-nums">
            {enabledRoleIds.length} / {roles.length} активны
          </span>
        </div>

        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2">
          {roles.map((r) => {
            const active = enabledRoleIds.includes(r.id);
            return (
              <article
                key={r.id}
                className={cn(
                  'flex w-72 shrink-0 flex-col justify-between gap-3 rounded-xl border p-4 transition-colors sm:w-80',
                  active
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40',
                )}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.name}
                    </span>
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleAgentRole(r.id)}
                        className="accent-blue-600"
                      />
                      <span className={active ? 'text-blue-600 dark:text-blue-400' : ''}>
                        {active ? 'Активна' : 'Выкл.'}
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.tagline}</p>
                  <div className="font-mono text-[11px] text-zinc-500 tabular-nums">
                    {r.defaultMode.toUpperCase()} · temp {r.recommendedTemp.toFixed(2)}
                  </div>
                  <p className="line-clamp-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {r.systemPrompt}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setActiveRole(r.id)}
                    className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                  >
                    Сделать основной в чате
                  </button>
                  {r.isCustom && (
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await requestDeleteWarning({
                          variant: 'simple',
                          title: 'Удалить роль агента?',
                          description: 'Пользовательская роль будет удалена.',
                          itemName: r.name,
                        });
                        if (confirmed) deleteCustomRole(r.id);
                      }}
                      title="Удалить роль"
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-rose-200 px-2.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30 whitespace-nowrap"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Удалить</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

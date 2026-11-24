import React from 'react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { PermissionPolicy } from '../../types/onecore';
import { cn } from '../../utils/cn';

export const PermissionsLibrarySection: React.FC = () => {
  const { permissions, setPermissionPolicy } = useOneCoreStore();

  return (
    <section
      id="agent-block-permissions"
      className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Библиотека разрешений
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Политики Auto, Request и Deny применяются движком Agent Core перед выполнением каждого действия или команды.
          </p>
        </div>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">
          {permissions.length} правил
        </span>
      </div>

      <div className="space-y-2.5">
        {permissions.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-zinc-500">{rule.category}</div>
              <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {rule.title}
              </div>
              <p className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">{rule.description}</p>
            </div>

            <div className="inline-flex shrink-0 items-center rounded-lg bg-zinc-200/80 p-0.5 dark:bg-zinc-800">
              {(
                [
                  { val: 'allow', label: 'Авто' },
                  { val: 'ask', label: 'Запрос' },
                  { val: 'deny', label: 'Запрет' },
                ] as { val: PermissionPolicy; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setPermissionPolicy(rule.id, opt.val)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
                    rule.policy === opt.val
                      ? opt.val === 'deny'
                        ? 'bg-rose-600 text-white'
                        : opt.val === 'ask'
                          ? 'bg-amber-600 text-white'
                          : 'bg-emerald-600 text-white'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

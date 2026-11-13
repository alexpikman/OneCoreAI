import React from 'react';
import { Cpu, FolderKanban, House, Settings } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AppTab } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';

const NAV_ITEMS: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'workstation', label: 'Рабочий стол', icon: House },
  { id: 'models', label: 'Модели', icon: Cpu },
  { id: 'projects', label: 'Проекты', icon: FolderKanban },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export const AppNavigation: React.FC = () => {
  const { activeTab, setActiveTab, uiStyle } = useOneCoreStore();
  const tokens = getUiTokens(uiStyle);

  return (
    <aside className={cn('w-14 lg:w-52 shrink-0 border-r px-2 lg:px-3 py-3', tokens.sidebarBg, tokens.cardBorder)}>
      <nav aria-label="Основные разделы" className="flex flex-col gap-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'w-full h-10 px-2 lg:px-3 inline-flex items-center justify-center lg:justify-start gap-3 border text-xs font-medium transition-colors',
                tokens.inputRadius,
                isActive
                  ? tokens.activeHighlight
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Cpu, FolderKanban, House, Settings } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AppTab } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { LeftSidebar } from '../workstation/LeftSidebar';

const NAV_ITEMS: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'workstation', label: 'Рабочий стол', icon: House },
  { id: 'models', label: 'Модели', icon: Cpu },
  { id: 'projects', label: 'Проекты', icon: FolderKanban },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export const AppNavigation: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    uiStyle,
    appNavigationWidth,
    chatVisibility,
  } = useOneCoreStore();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const tokens = getUiTokens(uiStyle);

  useEffect(() => {
    setMobileExpanded(false);
  }, [activeTab]);

  return (
    <aside
      className={cn(
        'app-navigation shrink-0 border-r px-2 lg:px-3 py-2 flex flex-col overflow-hidden',
        mobileExpanded && 'app-navigation-expanded',
        tokens.sidebarBg,
        tokens.cardBorder,
      )}
      style={{ '--app-navigation-width': `${appNavigationWidth}px` } as React.CSSProperties}
    >
      <nav aria-label="Основные разделы" className="shrink-0 flex flex-col gap-1 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setMobileExpanded(false);
              }}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'w-full h-8 px-2 lg:px-3 inline-flex items-center justify-center lg:justify-start gap-2.5 border text-xs font-medium transition-colors',
                tokens.inputRadius,
                isActive
                  ? tokens.activeHighlight
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className={cn(mobileExpanded ? 'inline' : 'hidden lg:inline')}>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileExpanded((expanded) => !expanded)}
          aria-expanded={mobileExpanded}
          aria-label={mobileExpanded ? 'Свернуть подменю' : 'Развернуть подменю'}
          title={mobileExpanded ? 'Свернуть подменю' : 'Развернуть подменю'}
          className="mt-1 h-7 inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 lg:hidden"
        >
          {mobileExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </nav>

      <div className={cn('flex-1 min-h-0 flex flex-col overflow-hidden', !mobileExpanded && 'hidden lg:flex')}>
        {activeTab === 'workstation' && chatVisibility.showLeftSidebar && <LeftSidebar />}
      </div>
    </aside>
  );
};

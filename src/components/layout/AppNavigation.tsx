import React, { useEffect, useState } from 'react';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  FolderKanban,
  House,
  KeyRound,
  LayoutGrid,
  MessageCircle,
  RefreshCw,
  Server,
  Settings,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AppTab, SettingsSectionId } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { LeftSidebar } from '../workstation/LeftSidebar';

const NAV_ITEMS: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'workstation', label: 'Рабочий стол', icon: House },
  { id: 'models', label: 'Модели', icon: Cpu },
  { id: 'projects', label: 'Проекты', icon: FolderKanban },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

const SETTINGS_ITEMS: {
  id: SettingsSectionId;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'ui-chat', label: 'Интерфейс и области чата', group: 'Все настройки', icon: LayoutGrid },
  { id: 'execution-env', label: 'Среды: Local / SSH / Docker', group: 'Все настройки', icon: Server },
  { id: 'gateway', label: 'Шлюз мессенджеров', group: 'Все настройки', icon: MessageCircle },
  { id: 'ssh-github', label: 'Доступ SSH и GitHub', group: 'Все настройки', icon: KeyRound },
  { id: 'github-download', label: 'Скачивание с GitHub', group: 'Все настройки', icon: Download },
  { id: 'updates', label: 'Обновления приложения', group: 'Все настройки', icon: RefreshCw },
];

const MODEL_SETTINGS_ITEMS: {
  id: SettingsSectionId;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'providers', label: 'Провайдеры и API-модели', group: 'НАСТРОЙКИ', icon: Sparkles },
  { id: 'model-manager', label: 'Менеджер моделей', group: 'НАСТРОЙКИ', icon: Cpu },
  { id: 'engine-paths', label: 'Локальные модели и вычисления', group: 'НАСТРОЙКИ', icon: Cpu },
  { id: 'roles-pipeline', label: 'Роли и пайплайн', group: 'НАСТРОЙКИ', icon: UserCheck },
  { id: 'skills-memory', label: 'Навыки, память и субагенты', group: 'НАСТРОЙКИ', icon: Brain },
];

export const AppNavigation: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    uiStyle,
    appNavigationWidth,
    chatVisibility,
    settingsSection,
    setSettingsSection,
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
                if (item.id === 'settings' && ['providers', 'model-manager', 'engine-paths', 'roles-pipeline', 'skills-memory'].includes(settingsSection)) {
                  setSettingsSection('ui-chat');
                }
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
        {(activeTab === 'settings' || activeTab === 'models') && (
          <nav aria-label={activeTab === 'models' ? 'Настройки моделей' : 'Подразделы настроек'} className="flex-1 min-h-0 overflow-y-auto py-2">
            {(activeTab === 'models' ? MODEL_SETTINGS_ITEMS : SETTINGS_ITEMS).map((item, index, items) => {
              const Icon = item.icon;
              const groupStart = index === 0 || items[index - 1]?.group !== item.group;
              const isActive = settingsSection === item.id;
              return (
                <React.Fragment key={item.id}>
                  {groupStart && (
                    <div className="px-2 lg:px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 first:pt-1">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSettingsSection(item.id)}
                    title={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'w-full min-h-8 px-2 lg:px-3 py-1.5 inline-flex items-center gap-2 border text-left text-[11px] font-medium transition-colors',
                      tokens.inputRadius,
                      isActive
                        ? tokens.activeHighlight
                        : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
};

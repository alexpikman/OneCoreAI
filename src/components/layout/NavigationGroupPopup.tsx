import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavigationItem, NavigationGroup, NavigationSubItem } from '../../data/appNavigation';
import { cn } from '../../utils/cn';
import { NavTablerIcon } from './NavTablerIcon';

export interface VisibleNavPopupItem {
  item: NavigationItem;
  active: boolean;
  showIcon: boolean;
  showLabel: boolean;
}

interface NavigationGroupPopupProps {
  group: NavigationGroup | null;
  items: VisibleNavPopupItem[];
  anchorRect: { top: number; left: number; width: number } | null;
  onSelectItem: (item: NavigationItem) => void;
  onSelectSubItem: (sub: NavigationSubItem) => void;
  onClose: () => void;
  agentTeamSection: string;
  generalAgentTab: string;
  subAgentsTab: string;
  settingsSection: string;
  aiSettingsCategory: string;
  activeNavSubItemId: string | null;
  agentTeamFocus: string;
  sshGithubSection: string;
  ggufHubTab: string;
  llamaModelsSection: string;
  projectsSection: string;
  skillsSection: string;
  instructionsSection: string;
  intelligenceSection: string;
  directoriesSection: string;
  gatewayPlatform: string;
}

export const NavigationGroupPopup: React.FC<NavigationGroupPopupProps> = ({
  group,
  items,
  anchorRect,
  onSelectItem,
  onSelectSubItem,
  onClose,
  agentTeamSection,
  generalAgentTab,
  subAgentsTab,
  settingsSection,
  aiSettingsCategory,
  activeNavSubItemId,
  agentTeamFocus,
  sshGithubSection,
  ggufHubTab,
  llamaModelsSection,
  projectsSection,
  skillsSection,
  instructionsSection,
  intelligenceSection,
  directoriesSection,
  gatewayPlatform,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 280, top: 80 });

  useLayoutEffect(() => {
    if (!group || items.length === 0) return;

    const updatePosition = () => {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
      const panelRect = panelRef.current?.getBoundingClientRect();
      const panelWidth = panelRect?.width || 288;
      const panelHeight = panelRect?.height || 360;

      const rawLeft = anchorRect ? anchorRect.left + anchorRect.width + 10 : 280;
      const rawTop = anchorRect ? anchorRect.top - 8 : 80;

      const left = Math.max(12, Math.min(rawLeft, viewportWidth - panelWidth - 12));
      const top = Math.max(16, Math.min(rawTop, viewportHeight - panelHeight - 16));
      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [group, items.length, anchorRect]);

  useEffect(() => {
    if (!group) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (panelRef.current?.contains(target)) return;
      if (target?.closest('[data-nav-group-trigger]')) return;
      onClose();
    };
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [group, onClose]);

  if (!group || items.length === 0) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Подразделы: ${group.label}`}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      className="fixed z-50 w-72 max-h-[calc(100vh-32px)] flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 backdrop-blur-md shadow-xl dark:border-zinc-800 dark:bg-zinc-950/95 p-2"
    >
      <div className="flex-1 overflow-y-auto space-y-1">
        {items.map(({ item, active, showIcon, showLabel }) => {
          const hasSubItems = item.subItems && item.subItems.length > 0;
          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onSelectItem(item);
                  if (!hasSubItems) onClose();
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative w-full h-9 px-3 inline-flex items-center gap-2.5 rounded-xl text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70',
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-50',
                )}
              >
                {active && (
                  <span
                    className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400"
                    aria-hidden="true"
                  />
                )}
                {showIcon && (
                  <NavTablerIcon
                    name={item.icon}
                    className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400')}
                  />
                )}
                {showLabel && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
              </button>

              {hasSubItems && (
                <div className="ml-5 pl-3 border-l border-zinc-200 dark:border-zinc-800 space-y-1 my-1">
                  {item.subItems!.map((sub) => {
                    const subActive =
                      sub.generalAgentTab
                        ? active && generalAgentTab === sub.generalAgentTab
                        : sub.subAgentsTab
                          ? active && subAgentsTab === sub.subAgentsTab
                          : sub.agentFocus
                            ? active && agentTeamSection === sub.initialSection && agentTeamFocus === sub.agentFocus
                            : sub.initialSection
                              ? active && agentTeamSection === sub.initialSection
                              : sub.sshGithubSection
                                ? active && sshGithubSection === sub.sshGithubSection
                                : sub.gatewayPlatform
                                  ? active && gatewayPlatform === sub.gatewayPlatform
                                  : sub.ggufTab
                                    ? active && (settingsSection === 'llama-gguf' || settingsSection === 'model-search') && ggufHubTab === sub.ggufTab
                                    : sub.llamaModelsSection
                                      ? active && settingsSection === 'llama-models' && llamaModelsSection === sub.llamaModelsSection
                                      : sub.projectsSection
                                        ? active && projectsSection === sub.projectsSection
                                        : sub.skillsSection
                                          ? active && skillsSection === sub.skillsSection
                                          : sub.instructionsSection
                                            ? active && settingsSection !== 'intelligence-library' && instructionsSection === sub.instructionsSection
                                            : sub.intelligenceSection
                                              ? active && settingsSection === 'intelligence-library' && intelligenceSection === sub.intelligenceSection
                                              : sub.directoriesSection
                                                ? active && directoriesSection === sub.directoriesSection
                                                : sub.providerCategory
                                                  ? active && aiSettingsCategory === sub.providerCategory
                                                  : sub.section
                                                    ? active && settingsSection === sub.section
                                                    : active && activeNavSubItemId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          onSelectSubItem(sub);
                          onClose();
                        }}
                        aria-current={subActive ? 'page' : undefined}
                        className={cn(
                          'w-full h-8 px-2.5 inline-flex items-center gap-2 rounded-lg text-left text-xs transition-colors',
                          subActive
                            ? 'bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200',
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { NavigationItem, NavigationGroup } from '../../data/appNavigation';
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
  onClose: () => void;
}

export const NavigationGroupPopup: React.FC<NavigationGroupPopupProps> = ({
  group,
  items,
  anchorRect,
  onSelectItem,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [group, onClose]);

  if (!group || items.length === 0) return null;

  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const computedLeft = anchorRect ? Math.min(anchorRect.left + anchorRect.width + 10, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 310) : 280;
  const computedTop = anchorRect ? Math.max(16, Math.min(anchorRect.top - 8, viewportHeight - 420)) : 80;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Подразделы: ${group.label}`}
      style={{
        left: `${computedLeft}px`,
        top: `${computedTop}px`,
      }}
      className="fixed z-50 w-72 max-h-[calc(100vh-32px)] flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 backdrop-blur-md shadow-xl dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3.5 py-2.5 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Раздел навигации
          </div>
          <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {group.label}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню раздела"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {items.map(({ item, active, showIcon, showLabel }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectItem(item);
              onClose();
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
        ))}
      </div>
    </div>
  );
};

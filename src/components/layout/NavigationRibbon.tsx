import React from 'react';
import { cn } from '../../utils/cn';

export interface NavigationRibbonItem {
  id: string;
  label: string;
  ariaLabel?: string;
  icon?: React.ReactNode;
}

interface NavigationRibbonProps {
  items: NavigationRibbonItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
}

export const NavigationRibbon: React.FC<NavigationRibbonProps> = ({
  items,
  selectedId,
  onSelect,
  ariaLabel,
}) => (
  <nav
    aria-label={ariaLabel}
    className="flex w-full max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-lg bg-zinc-200/75 px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-zinc-800/80"
  >
    {items.map((item) => {
      const active = item.id === selectedId;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          aria-current={active ? 'page' : undefined}
          aria-label={!item.label ? item.ariaLabel : undefined}
          title={!item.label ? item.ariaLabel : undefined}
          className={cn(
            'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800',
            active
              ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
          )}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          {item.label && <span>{item.label}</span>}
        </button>
      );
    })}
  </nav>
);

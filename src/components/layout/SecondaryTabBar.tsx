import React from 'react';
import { cn } from '../../utils/cn';

export interface SecondaryTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SecondaryTabBarProps {
  items: SecondaryTabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  rightSlot?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const SecondaryTabBar: React.FC<SecondaryTabBarProps> = ({
  items,
  selectedId,
  onSelect,
  ariaLabel,
  rightSlot,
  footer,
  className,
}) => (
  <div className={cn('shrink-0 border-b border-zinc-200/80 pt-3 dark:border-zinc-800', className)}>
    <div className="flex items-center justify-between gap-3">
      <nav
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 border-b-2 px-1 pb-2.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70',
                active
                  ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
              )}
            >
              {item.icon && (
                <span className={cn('shrink-0', active ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400')} role="img" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      {rightSlot && <div className="shrink-0 pb-2">{rightSlot}</div>}
    </div>
    {footer}
  </div>
);

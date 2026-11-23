import React from 'react';
import { Loader2, Save } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { getUiTokens } from '../../utils/uiStyle';
import { PAGE_CONTAINER_CLASS } from './pageLayout';
import { PageSubNavigation } from './PageSubNavigation';

export interface PageHeaderAction {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  variant?: 'primary' | 'secondary';
}

interface PageHeaderProps {
  children: React.ReactNode;
  actions?: PageHeaderAction[];
  status?: { label: string; variant: 'success' | 'warning' };
  showSave?: boolean;
  showSubNavigation?: boolean;
}

/**
 * Shared page header and action controls.
 * The header remains outside the page's scrolling content.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ children, actions = [], status, showSave = true, showSubNavigation = true }) => {
  const uiStyle = useOneCoreStore((state) => state.uiStyle);
  const settingsSaveStatus = useOneCoreStore((state) => state.settingsSaveStatus);
  const settingsError = useOneCoreStore((state) => state.settingsError);
  const saveSettings = useOneCoreStore((state) => state.saveSettings);
  const pageSurface = getUiTokens(uiStyle).pageSurface;

  const headerActions: PageHeaderAction[] = [
    ...(showSave
      ? [{
          id: 'save-settings',
          label: settingsSaveStatus === 'saving' ? 'Сохранение…' : settingsError ? 'Повторить сохранение' : 'Сохранить',
          onClick: () => void saveSettings(),
          icon: settingsSaveStatus === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />,
          disabled: settingsSaveStatus === 'saving',
          title: settingsError || 'Сохранить настройки',
          variant: 'primary' as const,
        }]
      : []),
    ...actions,
  ];

  return (
    <header className={`sticky top-0 z-30 w-full shrink-0 ${pageSurface}`}>
      <div className={`${PAGE_CONTAINER_CLASS} flex h-12 min-w-0 items-center justify-between gap-4 ${showSubNavigation ? '' : 'border-b border-zinc-200 dark:border-zinc-800'}`}>
        <div className="min-w-0 flex-1 overflow-hidden [&_h1]:truncate [&_h1]:whitespace-nowrap">{children}</div>
        {(status || headerActions.length > 0) && (
            <div className="flex min-w-0 max-w-[48%] shrink-0 flex-nowrap items-center justify-end gap-2 overflow-hidden">
              {status && (
                <div
                  role="status"
                  className={status.variant === 'success'
                    ? 'inline-flex h-8 max-w-[180px] items-center gap-2 overflow-hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'inline-flex h-8 max-w-[180px] items-center gap-2 overflow-hidden rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}
                >
                  <span className={status.variant === 'success' ? 'h-2 w-2 shrink-0 rounded-full bg-emerald-500' : 'h-2 w-2 shrink-0 rounded-full bg-amber-500'} />
                  <span className="min-w-0 truncate">{status.label}</span>
                </div>
              )}
              {headerActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={action.disabled || action.loading}
                  onClick={action.onClick}
                  title={action.title || action.label}
                  className={action.variant === 'secondary'
                    ? 'inline-flex h-8 min-w-0 max-w-[220px] items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900'
                    : 'inline-flex h-8 min-w-0 max-w-[220px] items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500'}
                >
                  {action.icon && <span className="shrink-0">{action.icon}</span>}
                  {action.loading && !action.icon ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
                  <span className="min-w-0 truncate">{action.label}</span>
                </button>
              ))}
            </div>
          )}
      </div>
      {showSubNavigation && (
        <div className={`${PAGE_CONTAINER_CLASS} flex min-h-10 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800`}>
          <PageSubNavigation />
        </div>
      )}
    </header>
  );
};

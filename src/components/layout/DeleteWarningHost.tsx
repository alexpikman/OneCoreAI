import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { DELETE_WARNING_EVENT, type DeleteWarningOptions } from '../../utils/deleteWarning';

interface PendingWarning extends DeleteWarningOptions {
  resolve: (confirmed: boolean) => void;
}

export const DeleteWarningHost: React.FC = () => {
  const [pending, setPending] = useState<PendingWarning | null>(null);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const request = (event as CustomEvent<PendingWarning>).detail;
      setPending((current) => {
        current?.resolve(false);
        return request;
      });
    };

    window.addEventListener(DELETE_WARNING_EVENT, handleRequest);
    return () => window.removeEventListener(DELETE_WARNING_EVENT, handleRequest);
  }, []);

  const close = (confirmed: boolean) => {
    if (!pending) return;
    pending.resolve(confirmed);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        pending.resolve(false);
        setPending(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pending]);

  if (!pending) return null;

  const isConfirmation = pending.variant === 'confirmation';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(false); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-warning-title" aria-describedby="delete-warning-description" className={isConfirmation ? 'w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900' : 'w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900'}>
        <div className="flex items-start gap-3">
          <div className={isConfirmation ? 'rounded-xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400' : 'rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400'}>
            {isConfirmation ? <AlertTriangle className="h-5 w-5" /> : <Trash2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-warning-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{pending.title}</h2>
            <p id="delete-warning-description" className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600 dark:text-zinc-300">{pending.description}</p>
            {pending.itemName && <p className="mt-2 break-words text-xs font-semibold text-slate-800 dark:text-zinc-100">{pending.itemName}</p>}
          </div>
          <button type="button" onClick={() => close(false)} aria-label="Закрыть" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus onClick={() => close(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Отмена</button>
          <button type="button" onClick={() => close(true)} className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white transition hover:bg-rose-500">{pending.confirmLabel || 'Удалить'}</button>
        </div>
      </section>
    </div>
  );
};

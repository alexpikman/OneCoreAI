import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { NOTIFICATION_EVENT, type NotificationOptions } from '../../utils/notifications';

interface ActiveNotification extends NotificationOptions {
  id: number;
}

const styles = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-200 dark:border-emerald-900/70',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-900/70',
  },
  info: {
    icon: Info,
    iconClass: 'text-sky-600 dark:text-sky-400',
    borderClass: 'border-sky-200 dark:border-sky-900/70',
  },
};

export const NotificationHost: React.FC = () => {
  const [items, setItems] = useState<ActiveNotification[]>([]);

  useEffect(() => {
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<NotificationOptions>).detail;
      const id = Date.now() + Math.random();
      const item = { ...detail, id };
      setItems((current) => [...current.slice(-3), item]);
      if (detail.duration !== 0) {
        timers.set(id, setTimeout(() => {
          setItems((current) => current.filter((entry) => entry.id !== id));
          timers.delete(id);
        }, detail.duration ?? 3500));
      }
    };

    window.addEventListener(NOTIFICATION_EVENT, handleNotification);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, handleNotification);
      timers.forEach(clearTimeout);
    };
  }, []);

  const dismiss = (id: number) => setItems((current) => current.filter((item) => item.id !== id));

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-relevant="additions">
      {items.map((item) => {
        const style = styles[item.kind];
        const Icon = style.icon;
        return (
          <section key={item.id} role={item.kind === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur-md dark:bg-zinc-900/95 ${style.borderClass}`}>
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{item.title}</div>
              {item.message && <p className="mt-0.5 break-words text-xs leading-5 text-slate-600 dark:text-zinc-400">{item.message}</p>}
            </div>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Закрыть уведомление" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <X className="h-4 w-4" />
            </button>
          </section>
        );
      })}
    </div>
  );
};

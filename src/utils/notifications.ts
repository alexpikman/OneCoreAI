export type NotificationKind = 'success' | 'error' | 'info';

export interface NotificationOptions {
  kind: NotificationKind;
  title: string;
  message?: string;
  duration?: number;
}

export const NOTIFICATION_EVENT = 'onecore:notification';

export const notify = (options: NotificationOptions): void => {
  window.dispatchEvent(new CustomEvent<NotificationOptions>(NOTIFICATION_EVENT, { detail: options }));
};

export const notifySuccess = (title: string, message?: string): void =>
  notify({ kind: 'success', title, message });

export const notifyError = (title: string, message?: string): void =>
  notify({ kind: 'error', title, message, duration: 7000 });

export const notifyInfo = (title: string, message?: string): void =>
  notify({ kind: 'info', title, message });

export type DeleteWarningVariant = 'simple' | 'confirmation';

export interface DeleteWarningOptions {
  variant: DeleteWarningVariant;
  title: string;
  description: string;
  itemName?: string;
  confirmLabel?: string;
}

interface DeleteWarningRequest extends DeleteWarningOptions {
  resolve: (confirmed: boolean) => void;
}

const EVENT_NAME = 'onecore:request-delete-warning';

export function requestDeleteWarning(options: DeleteWarningOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<DeleteWarningRequest>(EVENT_NAME, {
      detail: { ...options, resolve },
    }));
  });
}

export { EVENT_NAME as DELETE_WARNING_EVENT };

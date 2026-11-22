export type OperationLifecycleStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface OperationRecord {
  id: string;
  parentOperationId?: string;
  sessionId?: string;
  messageId?: string;
  method: string;
  path: string;
  status: OperationLifecycleStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  cancelRequestedAt?: string;
  cancellationReason?: string;
}

type NewOperation = Omit<
  OperationRecord,
  'status' | 'startedAt' | 'finishedAt' | 'durationMs' | 'cancelRequestedAt' | 'cancellationReason'
>;

const MAX_OPERATION_RECORDS = 5000;
const operations = new Map<string, OperationRecord>();
const controllers = new Map<string, AbortController>();
const childOperations = new Map<string, Set<string>>();
const parentOperations = new Map<string, string>();

export function startOperation(operation: NewOperation): AbortSignal {
  const controller = new AbortController();
  controllers.set(operation.id, controller);
  operations.set(operation.id, {
    ...operation,
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  if (operation.parentOperationId) {
    const siblings = childOperations.get(operation.parentOperationId) ?? new Set<string>();
    siblings.add(operation.id);
    childOperations.set(operation.parentOperationId, siblings);
    parentOperations.set(operation.id, operation.parentOperationId);

    const parentController = controllers.get(operation.parentOperationId);
    if (parentController?.signal.aborted) {
      controller.abort(parentController.signal.reason);
    } else if (parentController) {
      parentController.signal.addEventListener(
        'abort',
        () => controller.abort(parentController.signal.reason),
        { once: true },
      );
    }
  }

  while (operations.size > MAX_OPERATION_RECORDS) {
    const oldestId = operations.keys().next().value;
    if (!oldestId) break;
    operations.delete(oldestId);
    controllers.delete(oldestId);
    const parentId = parentOperations.get(oldestId);
    if (parentId) childOperations.get(parentId)?.delete(oldestId);
    parentOperations.delete(oldestId);
    childOperations.delete(oldestId);
  }

  return controller.signal;
}

export function getOperationSignal(operationId: string): AbortSignal | undefined {
  return controllers.get(operationId)?.signal;
}

export function cancelOperation(operationId: string, reason = 'Операция отменена пользователем.'): boolean {
  const current = operations.get(operationId);
  const controller = controllers.get(operationId);
  if (!current || current.status !== 'running' || !controller) return false;

  const cancellationReason = reason.slice(0, 240);
  if (!current.cancelRequestedAt) {
    operations.set(operationId, {
      ...current,
      cancelRequestedAt: new Date().toISOString(),
      cancellationReason,
    });
  }
  if (!controller.signal.aborted) {
    controller.abort(new Error(cancellationReason));
  }

  for (const childId of childOperations.get(operationId) ?? []) {
    cancelOperation(childId, reason);
  }
  return true;
}

export function finishOperation(
  operationId: string,
  status: Exclude<OperationLifecycleStatus, 'running'>,
): void {
  const current = operations.get(operationId);
  if (!current || current.status !== 'running') return;

  if (status === 'cancelled') {
    cancelOperation(operationId, current.cancellationReason || 'Операция отменена.');
  }

  const controller = controllers.get(operationId);
  const finalStatus = controller?.signal.aborted ? 'cancelled' : status;
  const finishedAt = new Date().toISOString();
  operations.set(operationId, {
    ...current,
    ...(operations.get(operationId)?.cancelRequestedAt
      ? {
          cancelRequestedAt: operations.get(operationId)?.cancelRequestedAt,
          cancellationReason: operations.get(operationId)?.cancellationReason,
        }
      : {}),
    status: finalStatus,
    finishedAt,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(current.startedAt)),
  });

  controllers.delete(operationId);
  const parentId = parentOperations.get(operationId);
  if (parentId) childOperations.get(parentId)?.delete(operationId);
  parentOperations.delete(operationId);
  childOperations.delete(operationId);
}

export function getOperation(operationId: string): OperationRecord | undefined {
  const operation = operations.get(operationId);
  return operation ? { ...operation } : undefined;
}

export function listOperations(limit = 500): OperationRecord[] {
  return [...operations.values()]
    .slice(-Math.max(0, limit))
    .reverse()
    .map((operation) => ({ ...operation }));
}

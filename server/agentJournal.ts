import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'fs';
import path from 'path';
import type { ServerResponse } from 'http';
import { ensureOneCoreDirs } from './paths';

export type AgentJournalCategory =
  | 'agent'
  | 'model'
  | 'tool'
  | 'project'
  | 'terminal'
  | 'git'
  | 'subagent'
  | 'api'
  | 'system';

export type AgentJournalStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'info';

export interface AgentOperationContext {
  operationId: string;
  sessionId?: string;
  messageId?: string;
}

const operationContextStorage = new AsyncLocalStorage<AgentOperationContext>();

export function runWithAgentOperationContext<T>(
  context: AgentOperationContext,
  callback: () => T,
): T {
  return operationContextStorage.run(context, callback);
}

export interface AgentTraceMetadata {
  stageId: string;
  stageLabel: string;
  actorType: 'runtime' | 'agent' | 'model' | 'tool' | 'verification';
  actorId?: string;
  providerId?: string;
  modelId?: string;
  instructionId?: string;
  instructionVersion?: string;
  inputSummary?: string;
  outputSummary?: string;
  handoffTarget?: string;
  handoffReason?: string;
  toolName?: string;
}

export interface AgentJournalEvent {
  id: string;
  operationId: string;
  timestamp: string;
  category: AgentJournalCategory;
  level: 'info' | 'warning' | 'error';
  status: AgentJournalStatus;
  title: string;
  summary: string;
  source: string;
  projectId?: string;
  parentOperationId?: string;
  sessionId?: string;
  messageId?: string;
  durationMs?: number;
  details?: Record<string, string | number | boolean | null>;
  trace?: AgentTraceMetadata;
}

const MAX_EVENTS = 5000;
const subscribers = new Set<ServerResponse>();
let eventsCache: AgentJournalEvent[] | null = null;
let persistenceRequested = false;
let persistenceWorker: Promise<void> | null = null;
let persistenceError: unknown = null;

function getJournalPath(): string {
  return path.join(ensureOneCoreDirs().logsDir, 'agent-journal.json');
}

function readStoredEvents(): AgentJournalEvent[] {
  const journalPath = getJournalPath();
  if (!fs.existsSync(journalPath)) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as AgentJournalEvent[]) : [];
  } catch {
    return [];
  }
}

function getEventsCache(): AgentJournalEvent[] {
  if (!eventsCache) eventsCache = readStoredEvents();
  return eventsCache;
}

function persistEventsAsync(): void {
  persistenceRequested = true;
  if (persistenceWorker) return;

  persistenceWorker = (async () => {
    while (persistenceRequested) {
      persistenceRequested = false;

      try {
        const journalPath = getJournalPath();
        const temporaryPath = `${journalPath}.tmp`;
        const snapshot = JSON.stringify(getEventsCache().slice(-MAX_EVENTS));
        await fs.promises.writeFile(temporaryPath, snapshot, 'utf-8');
        await fs.promises.rename(temporaryPath, journalPath);
        persistenceError = null;
      } catch (error) {
        persistenceError = error;
        console.error('Failed to persist agent journal:', error);
      }
    }
  })().finally(() => {
    persistenceWorker = null;
    if (persistenceRequested) persistEventsAsync();
  });
}

export async function flushAgentJournal(): Promise<void> {
  while (persistenceWorker || persistenceRequested) {
    if (!persistenceWorker && persistenceRequested) persistEventsAsync();
    if (persistenceWorker) await persistenceWorker;
  }

  if (persistenceError) {
    const error = persistenceError;
    persistenceError = null;
    throw error;
  }
}

function publish(event: AgentJournalEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const response of subscribers) {
    if (response.destroyed || response.writableEnded) {
      subscribers.delete(response);
      continue;
    }
    response.write(payload);
  }
}

export function recordAgentEvent(
  event: Omit<AgentJournalEvent, 'id' | 'operationId' | 'timestamp'> & {
    id?: string;
    operationId?: string;
    timestamp?: string;
  },
): AgentJournalEvent {
  const context = operationContextStorage.getStore();
  const generatedId = `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const fullEvent: AgentJournalEvent = {
    ...context,
    ...event,
    id: event.id || generatedId,
    operationId: event.operationId || context?.operationId || event.id || generatedId,
    sessionId: event.sessionId ?? context?.sessionId,
    messageId: event.messageId ?? context?.messageId,
    timestamp: event.timestamp || new Date().toISOString(),
  };
  const events = getEventsCache();
  const existingIndex = events.findIndex((item) => item.id === fullEvent.id);
  if (existingIndex >= 0) events[existingIndex] = fullEvent;
  else events.push(fullEvent);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  persistEventsAsync();
  publish(fullEvent);
  return fullEvent;
}

export function beginAgentEvent(
  event: Omit<AgentJournalEvent, 'id' | 'operationId' | 'timestamp' | 'status' | 'durationMs'>,
): string {
  const operationId = `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  recordAgentEvent({ ...event, id: operationId, operationId, status: 'running' });
  return operationId;
}

export function finishAgentEvent(
  operationId: string,
  patch: Pick<AgentJournalEvent, 'status' | 'summary' | 'level'> & {
    durationMs?: number;
    details?: AgentJournalEvent['details'];
  },
): void {
  const current = getEventsCache().find((event) => event.id === operationId);
  if (!current) return;
  recordAgentEvent({ ...current, ...patch, details: { ...current.details, ...patch.details }, id: operationId, operationId });
}

export function readAgentJournal(limit = 500): AgentJournalEvent[] {
  return [...getEventsCache()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, Math.max(1, Math.min(limit, MAX_EVENTS)));
}

export function deleteAgentJournalEventsForProject(projectId: string): void {
  const events = getEventsCache();
  const retainedEvents = events.filter((event) => event.projectId !== projectId);
  if (retainedEvents.length === events.length) return;
  events.splice(0, events.length, ...retainedEvents);
  persistEventsAsync();
}

export function subscribeAgentJournal(response: ServerResponse): () => void {
  subscribers.add(response);
  return () => subscribers.delete(response);
}

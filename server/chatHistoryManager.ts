import fs from 'fs';
import path from 'path';
import type { AgentMessage, ChatSession } from '../src/types/onecore';
import { ensureOneCoreDirs } from './paths';

interface ChatHistoryManifest {
  version: 1;
  activeSessionId: string;
  sessions: ChatSession[];
  savedAt: string;
}

const MAX_SESSIONS = 500;
const MAX_MESSAGES_PER_SESSION = 2000;
const MAX_MESSAGE_CHARS = 250000;
const MAX_HISTORY_BYTES = 4 * 1024 * 1024;
const INTERRUPTED_MESSAGE_SUFFIX = '\n\n[Генерация прервана при завершении приложения.]';

function getChatHistoryPath(): string {
  return path.join(ensureOneCoreDirs().home, 'chat-history.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAgentMessage(value: unknown): value is AgentMessage {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'assistant') &&
    (value.mode === 'plan' || value.mode === 'act') &&
    typeof value.timestamp === 'string' &&
    typeof value.content === 'string' &&
    value.content.length <= MAX_MESSAGE_CHARS
  );
}

function normalizeSessions(value: unknown): ChatSession[] {
  if (!Array.isArray(value) || value.length > MAX_SESSIONS) {
    throw new Error(`История чатов должна содержать не более ${MAX_SESSIONS} сессий.`);
  }

  const sessionIds = new Set<string>();
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id.trim() ||
      entry.id.length > 120 ||
      sessionIds.has(entry.id) ||
      typeof entry.title !== 'string' ||
      entry.title.length > 240 ||
      typeof entry.updatedAt !== 'string' ||
      (entry.mode !== 'plan' && entry.mode !== 'act') ||
      !Array.isArray(entry.messages) ||
      entry.messages.length > MAX_MESSAGES_PER_SESSION ||
      !entry.messages.every(isAgentMessage)
    ) {
      throw new Error('В истории чатов обнаружена запись с неверным форматом.');
    }

    sessionIds.add(entry.id);
    const messages = (entry.messages as AgentMessage[]).map((message) => ({
      ...message,
      content: message.isStreaming
        ? `${message.content.slice(0, MAX_MESSAGE_CHARS - INTERRUPTED_MESSAGE_SUFFIX.length)}${INTERRUPTED_MESSAGE_SUFFIX}`
        : message.content,
      isStreaming: false,
      ...(message.subagentRun?.status === 'running'
        ? {
            subagentRun: {
              ...message.subagentRun,
              status: 'failed' as const,
              progressPct: 100,
              resultSummary: 'Работа прервана при завершении приложения.',
            },
          }
        : {}),
    }));
    return { ...entry, messages } as unknown as ChatSession;
  });
}

export function readChatHistory(): ChatHistoryManifest | null {
  const filePath = getChatHistoryPath();
  if (!fs.existsSync(filePath)) return null;

  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    typeof parsed.activeSessionId !== 'string' ||
    typeof parsed.savedAt !== 'string'
  ) {
    throw new Error('Файл истории чатов имеет неверный формат.');
  }

  const sessions = normalizeSessions(parsed.sessions);
  const activeSessionId = sessions.some((session) => session.id === parsed.activeSessionId)
    ? parsed.activeSessionId
    : sessions[0]?.id ?? '';

  return {
    version: 1,
    activeSessionId,
    sessions,
    savedAt: parsed.savedAt,
  };
}

export function saveChatHistory(input: {
  activeSessionId: string;
  sessions: unknown;
}): ChatHistoryManifest {
  if (typeof input.activeSessionId !== 'string' || input.activeSessionId.length > 120) {
    throw new Error('Некорректный идентификатор активного чата.');
  }

  const sessions = normalizeSessions(input.sessions);
  const activeSessionId = sessions.some((session) => session.id === input.activeSessionId)
    ? input.activeSessionId
    : sessions[0]?.id ?? '';
  const manifest: ChatHistoryManifest = {
    version: 1,
    activeSessionId,
    sessions,
    savedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(manifest, null, 2);
  if (Buffer.byteLength(serialized, 'utf-8') > MAX_HISTORY_BYTES) {
    throw new Error('История чатов превышает допустимый размер 4 МБ. Удалите крупные вложенные результаты или старые сессии.');
  }

  const filePath = getChatHistoryPath();
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, serialized, { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // chmod may be a no-op on Windows
  }

  return manifest;
}

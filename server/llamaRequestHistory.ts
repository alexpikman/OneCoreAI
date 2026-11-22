import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getOneCoreHome } from './paths';

export interface LlamaRuntimeUsageSnapshot {
  activeSlots: number;
  totalSlots: number;
  usedContextTokens: number;
  totalContextTokens: number;
}

export interface LlamaRequestRecord {
  id: string;
  startedAt: string;
  finishedAt: string;
  providerId: string;
  requestedModel: string;
  usedModel: string;
  stream: boolean;
  status: 'success' | 'error' | 'cancelled';
  durationMs: number;
  ttftMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  tokensPerSecond: number | null;
  runtimeUsageAtStart: LlamaRuntimeUsageSnapshot | null;
  runtimeUsageAtEnd: LlamaRuntimeUsageSnapshot | null;
  error?: string;
}

const MAX_RECORDS = 1000;

function historyPath(): string {
  return path.join(getOneCoreHome(), 'llama-request-history.json');
}

function readHistory(): LlamaRequestRecord[] {
  try {
    const filePath = historyPath();
    if (!fs.existsSync(filePath)) return [];
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LlamaRequestRecord =>
      Boolean(item) && typeof item === 'object' &&
      typeof (item as LlamaRequestRecord).id === 'string' &&
      typeof (item as LlamaRequestRecord).startedAt === 'string' &&
      typeof (item as LlamaRequestRecord).durationMs === 'number',
    ).slice(-MAX_RECORDS);
  } catch {
    return [];
  }
}

export function listLlamaRequestHistory(limit = 100): LlamaRequestRecord[] {
  const safeLimit = Number.isInteger(limit) ? Math.min(MAX_RECORDS, Math.max(1, limit)) : 100;
  return readHistory().slice(-safeLimit).reverse();
}

export function recordLlamaRequest(input: Omit<LlamaRequestRecord, 'id'>): void {
  try {
    const history = readHistory();
    history.push({ id: crypto.randomUUID(), ...input });
    const target = historyPath();
    const temporary = `${target}.tmp`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(history.slice(-MAX_RECORDS), null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, target);
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      // chmod may be unavailable on Windows.
    }
  } catch {
    // Analytics persistence must never interrupt inference responses.
  }
}

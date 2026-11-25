import { createHash } from 'node:crypto';
import path from 'node:path';
import type { AgentHandoffFileEntry } from '../../src/types/onecore';

export const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_SEARCH_FILE_BYTES = 512 * 1024;
export const MAX_EXCERPT_CHARS = 6_000;
export const MAX_TOOL_READ_CHARS = 24_000;
export const MAX_HANDOFF_FILES = 8;
export const MAX_HANDOFF_EXCERPT_CHARS = 16_000;
export const MAX_WORKER_TOTAL_CHARS = 40_000;

export interface FragmentCacheInput {
  taskId: string;
  normalizedPath: string;
  startLine: number;
  endLine: number;
  content: string;
}

export interface FragmentCacheResult {
  content: string;
  contentHash: string;
  cacheHit: boolean;
}

interface CachedFragment extends FragmentCacheResult {
  identity: string;
  expiresAt: number;
}

export class FragmentDeduplicationCache {
  private readonly entries = new Map<string, CachedFragment>();
  private readonly latestKeys = new Map<string, string>();

  constructor(
    private readonly maxEntries = 512,
    private readonly ttlMs = 5 * 60 * 1000,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error('Лимит кэша фрагментов должен быть положительным целым числом.');
    }
    if (!Number.isFinite(ttlMs) || ttlMs < 1) {
      throw new Error('TTL кэша фрагментов должен быть положительным числом.');
    }
  }

  getFragment(input: FragmentCacheInput): FragmentCacheResult {
    const normalizedPath = path.posix.normalize(input.normalizedPath.replace(/\\/g, '/')).replace(/^\.\//, '');
    const identity = JSON.stringify([input.taskId, normalizedPath, input.startLine, input.endLine]);
    const contentHash = createHash('sha256').update(input.content, 'utf-8').digest('hex');
    const key = JSON.stringify([input.taskId, normalizedPath, input.startLine, input.endLine, contentHash]);
    const now = Date.now();

    this.pruneExpired(now);
    const previousKey = this.latestKeys.get(identity);
    if (previousKey && previousKey !== key) this.entries.delete(previousKey);

    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) {
      this.entries.delete(key);
      this.entries.set(key, { ...cached, expiresAt: now + this.ttlMs });
      this.latestKeys.set(identity, key);
      return { content: cached.content, contentHash, cacheHit: true };
    }

    this.entries.set(key, {
      identity,
      content: input.content,
      contentHash,
      cacheHit: false,
      expiresAt: now + this.ttlMs,
    });
    this.latestKeys.set(identity, key);

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      const oldest = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      if (oldest && this.latestKeys.get(oldest.identity) === oldestKey) {
        this.latestKeys.delete(oldest.identity);
      }
    }

    return { content: input.content, contentHash, cacheHit: false };
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        if (this.latestKeys.get(entry.identity) === key) this.latestKeys.delete(entry.identity);
      }
    }
  }
}

export const workerFragmentDeduplicationCache = new FragmentDeduplicationCache();

export function extractLineFragment(
  content: string,
  requestedStartLine?: number,
  requestedEndLine?: number,
): { content: string; startLine: number; endLine: number } {
  const lineStarts = [0];
  const lineEnds: number[] = [];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\r' || content[index] === '\n') {
      lineEnds.push(index);
      if (content[index] === '\r' && content[index + 1] === '\n') index += 1;
      lineStarts.push(index + 1);
    }
  }
  lineEnds.push(content.length);
  if ((content.endsWith('\n') || content.endsWith('\r')) && lineStarts.length > 1) {
    lineStarts.pop();
    lineEnds.pop();
  }
  const startLine = requestedStartLine ?? 1;
  const endLine = requestedEndLine ?? lineStarts.length;
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    throw new Error('Диапазон строк файла должен быть положительным и иметь endLine не меньше startLine.');
  }
  if (startLine > lineStarts.length || endLine > lineStarts.length) {
    throw new Error('Диапазон строк ' + startLine + '-' + endLine + ' выходит за границы файла (' + lineStarts.length + ' строк).');
  }
  return { content: content.slice(lineStarts[startLine - 1], lineEnds[endLine - 1]), startLine, endLine };
}

export interface ProvisionedWorkerContext {
  workerId: string;
  taskId: string;
  context: string;
  files: AgentHandoffFileEntry[];
  providedFiles: string[];
  omittedFiles: Array<{ path: string; reason: string }>;
  initialChars: number;
  maxTotalChars: number;
}

export function buildProvisionedWorkerContext(input: {
  workerId: string;
  taskId?: string;
  files: AgentHandoffFileEntry[];
}): ProvisionedWorkerContext {
  const files: AgentHandoffFileEntry[] = [];
  const providedFiles: string[] = [];
  const omittedFiles: Array<{ path: string; reason: string }> = [];
  let remainingChars = MAX_HANDOFF_EXCERPT_CHARS;
  let initialChars = 0;

  for (const file of input.files.slice(0, MAX_HANDOFF_FILES)) {
    const excerpts: NonNullable<AgentHandoffFileEntry['excerpts']> = [];
    let remainingFileChars = MAX_EXCERPT_CHARS;
    for (const sourceExcerpt of file.excerpts ?? []) {
      if (remainingChars <= 0 || remainingFileChars <= 0) {
        omittedFiles.push({ path: file.path, reason: 'Исчерпан лимит фрагментов: 6 000 символов на файл и 16 000 символов на handoff.' });
        break;
      }
      const excerpt = sourceExcerpt.content.slice(0, Math.min(remainingFileChars, remainingChars));
      if (excerpt.length > 0) {
        excerpts.push({ ...sourceExcerpt, content: excerpt });
        remainingChars -= excerpt.length;
        remainingFileChars -= excerpt.length;
        initialChars += excerpt.length;
      }
      if (excerpt.length < sourceExcerpt.content.length) {
        omittedFiles.push({ path: file.path, reason: 'Фрагмент усечён лимитом 6 000 символов на файл или общим лимитом handoff.' });
      }
    }
    files.push({ ...file, ...(excerpts.length > 0 ? { excerpts } : {}) });
    if (excerpts.length > 0) providedFiles.push(file.path);
    else {
      omittedFiles.push({ path: file.path, reason: 'В handoff отсутствует содержимое файла; требуется самостоятельное чтение Worker.' });
    }
  }

  for (const file of input.files.slice(MAX_HANDOFF_FILES)) {
    omittedFiles.push({ path: file.path, reason: 'Превышен лимит handoff: максимум 8 файлов.' });
  }

  const context = [
    '## Evidence Registry Worker',
    `Worker ID: ${input.workerId}`,
    'Предоставленные фрагменты перечислены в Handoff (JSON). Они не являются подтверждением самостоятельного чтения Worker и не добавляются в filesInspected.',
    `Начальный контекст: ${initialChars} символов. Общий бюджет: ${MAX_WORKER_TOTAL_CHARS} символов.`,
    omittedFiles.length > 0
      ? `## Файлы и фрагменты, не включённые полностью\n${omittedFiles.map((file) => `- ${file.path}: ${file.reason}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');

  return {
    workerId: input.workerId,
    taskId: input.taskId ?? input.workerId,
    context,
    files,
    providedFiles,
    omittedFiles,
    initialChars,
    maxTotalChars: MAX_WORKER_TOTAL_CHARS,
  };
}

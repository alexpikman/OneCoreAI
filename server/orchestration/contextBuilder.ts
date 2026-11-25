import type { AgentHandoffFileEntry } from '../../src/types/onecore';

export const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_SEARCH_FILE_BYTES = 512 * 1024;
export const MAX_EXCERPT_CHARS = 6_000;
export const MAX_TOOL_READ_CHARS = 24_000;
export const MAX_HANDOFF_FILES = 8;
export const MAX_HANDOFF_EXCERPT_CHARS = 16_000;
export const MAX_WORKER_TOTAL_CHARS = 40_000;

export interface ProvisionedWorkerContext {
  workerId: string;
  context: string;
  files: AgentHandoffFileEntry[];
  providedFiles: string[];
  omittedFiles: Array<{ path: string; reason: string }>;
  initialChars: number;
  maxTotalChars: number;
}

export function buildProvisionedWorkerContext(input: {
  workerId: string;
  files: AgentHandoffFileEntry[];
}): ProvisionedWorkerContext {
  const files: AgentHandoffFileEntry[] = [];
  const providedFiles: string[] = [];
  const omittedFiles: Array<{ path: string; reason: string }> = [];
  let remainingChars = MAX_HANDOFF_EXCERPT_CHARS;
  let initialChars = 0;

  for (const file of input.files.slice(0, MAX_HANDOFF_FILES)) {
    const excerpts: NonNullable<AgentHandoffFileEntry['excerpts']> = [];
    for (const sourceExcerpt of file.excerpts ?? []) {
      if (remainingChars <= 0) {
        omittedFiles.push({ path: file.path, reason: 'Исчерпан лимит начальных фрагментов handoff (16 000 символов).' });
        break;
      }
      const excerpt = sourceExcerpt.content.slice(0, Math.min(MAX_EXCERPT_CHARS, remainingChars));
      if (excerpt.length > 0) {
        excerpts.push({ ...sourceExcerpt, content: excerpt });
        remainingChars -= excerpt.length;
        initialChars += excerpt.length;
      }
      if (excerpt.length < sourceExcerpt.content.length) {
        omittedFiles.push({ path: file.path, reason: 'Фрагмент усечён лимитом 6 000 символов на файл или общим лимитом handoff.' });
      }
    }
    files.push({ ...file, ...(excerpts.length > 0 ? { excerpts } : { excerpts: undefined }) });
    if (excerpts.length > 0) providedFiles.push(file.path);
    else if (!(file.excerpts?.length)) {
      omittedFiles.push({ path: file.path, reason: 'В handoff отсутствует содержимое файла; требуется самостоятельное чтение Worker.' });
    }
  }

  for (const file of input.files.slice(MAX_HANDOFF_FILES)) {
    omittedFiles.push({ path: file.path, reason: 'Превышен лимит handoff: максимум 8 файлов.' });
  }

  const context = [
    '## Evidence Registry Worker',
    `Worker ID: ${input.workerId}`,
    'Предоставленные фрагменты перечислены в Handoff (JSON). Они не являются самостоятельным чтением Worker и не добавляются в filesInspected.',
    `Начальный контекст: ${initialChars} символов. Общий бюджет: ${MAX_WORKER_TOTAL_CHARS} символов.`,
    omittedFiles.length > 0
      ? `## Файлы и фрагменты, не включённые полностью\n${omittedFiles.map((file) => `- ${file.path}: ${file.reason}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');

  return {
    workerId: input.workerId,
    context,
    files,
    providedFiles,
    omittedFiles,
    initialChars,
    maxTotalChars: MAX_WORKER_TOTAL_CHARS,
  };
}

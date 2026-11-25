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
  providedFiles: string[];
  omittedFiles: Array<{ path: string; reason: string }>;
  initialChars: number;
  maxTotalChars: number;
}

export function buildProvisionedWorkerContext(input: {
  workerId: string;
  files: AgentHandoffFileEntry[];
}): ProvisionedWorkerContext {
  const blocks: string[] = [];
  const providedFiles: string[] = [];
  const omittedFiles: Array<{ path: string; reason: string }> = [];
  let remainingChars = MAX_HANDOFF_EXCERPT_CHARS;

  for (const file of input.files.slice(0, MAX_HANDOFF_FILES)) {
    const excerptText = (file.excerpts ?? [])
      .map((excerpt) => excerpt.content)
      .join('\n');
    if (!excerptText) {
      omittedFiles.push({ path: file.path, reason: 'В handoff отсутствует содержимое файла; требуется самостоятельное чтение Worker.' });
      continue;
    }
    if (remainingChars <= 0) {
      omittedFiles.push({ path: file.path, reason: 'Исчерпан лимит начального контекста handoff (16 000 символов).' });
      continue;
    }
    const excerpt = excerptText.slice(0, Math.min(MAX_EXCERPT_CHARS, remainingChars));
    remainingChars -= excerpt.length;
    blocks.push(`### ${file.path} (предоставленный фрагмент; не является подтверждением чтения Worker)\n\`\`\`\n${excerpt}${excerpt.length < excerptText.length ? '\n[Фрагмент усечён]' : ''}\n\`\`\``);
    providedFiles.push(file.path);
    if (excerpt.length < excerptText.length) {
      omittedFiles.push({ path: file.path, reason: 'Фрагмент усечён лимитом начального контекста.' });
    }
  }

  for (const file of input.files.slice(MAX_HANDOFF_FILES)) {
    omittedFiles.push({ path: file.path, reason: 'Превышен лимит handoff: максимум 8 файлов.' });
  }

  const context = [
    '## Предоставленный контекст проекта',
    'Эти фрагменты подготовлены Dispatcher. Они не считаются самостоятельным чтением Worker и не добавляются в filesInspected.',
    ...blocks,
    omittedFiles.length > 0
      ? `## Файлы, не включённые полностью\n${omittedFiles.map((file) => `- ${file.path}: ${file.reason}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');

  return {
    workerId: input.workerId,
    context,
    providedFiles,
    omittedFiles,
    initialChars: context.length,
    maxTotalChars: MAX_WORKER_TOTAL_CHARS,
  };
}

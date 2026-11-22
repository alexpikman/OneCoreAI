import fs from 'node:fs';
import path from 'node:path';

export type KnowledgeStatus = 'draft' | 'review' | 'approved' | 'deprecated';

export interface KnowledgeDocumentSummary {
  id: string;
  version: string;
  status: KnowledgeStatus;
  ownerRole: string;
  triggers: string[];
  category: string;
  relativePath: string;
  title: string;
}

export interface KnowledgeDocument extends KnowledgeDocumentSummary {
  content: string;
}

const KNOWLEDGE_CATEGORIES = ['architecture', 'roles', 'procedures', 'protocols'] as const;
const MAX_DOCUMENT_BYTES = 64 * 1024;

function resolveKnowledgeFile(rootDir: string, relativePath: string): string {
  const root = fs.realpathSync(rootDir);
  const candidate = path.resolve(root, relativePath);
  const relative = path.relative(root, candidate);
  if (!relative || (relative === '..' || relative.startsWith(`..${path.sep}`)) || path.isAbsolute(relative)) {
    throw new Error('Путь документа знаний выходит за пределы справочника.');
  }

  const realPath = fs.realpathSync(candidate);
  const realRelative = path.relative(root, realPath);
  if ((realRelative === '..' || realRelative.startsWith(`..${path.sep}`)) || path.isAbsolute(realRelative)) {
    throw new Error('Символическая ссылка выходит за пределы справочника.');
  }
  const stat = fs.statSync(realPath);
  if (!stat.isFile() || stat.size > MAX_DOCUMENT_BYTES) {
    throw new Error('Документ знаний должен быть обычным файлом размером не более 64 КБ.');
  }
  return realPath;
}

function parseKnowledgeDocument(rootDir: string, category: string, filename: string): KnowledgeDocumentSummary | null {
  const relativePath = path.posix.join(category, filename);
  let absolutePath: string;
  try {
    absolutePath = resolveKnowledgeFile(rootDir, relativePath);
  } catch {
    return null;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;

  const metadata = frontmatter[1];
  const readScalar = (key: string) => metadata.match(new RegExp(`^\\s*${key}:\\s*([^\\r\\n]+)\\s*$`, 'm'))?.[1]?.trim();
  const id = readScalar('id');
  const version = readScalar('version');
  const status = readScalar('status') as KnowledgeStatus | undefined;
  const ownerRole = readScalar('owner_role');
  if (
    !id ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id) ||
    !version ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    !status ||
    !['draft', 'review', 'approved', 'deprecated'].includes(status) ||
    !ownerRole
  ) return null;

  const triggersBlock = metadata.match(/^triggers:\s*\r?\n((?:\s+-[^\r\n]*\r?\n?)*)/m)?.[1] ?? '';
  const triggers = [...triggersBlock.matchAll(/^\s+-\s*(.+?)\s*$/gm)].map((match) => match[1]);
  const title = content.slice(frontmatter[0].length).match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;

  return { id, version, status, ownerRole, triggers, category, relativePath, title };
}

export function listKnowledgeDocuments(knowledgeRoot: string): KnowledgeDocumentSummary[] {
  if (!fs.existsSync(knowledgeRoot)) return [];
  const root = fs.realpathSync(knowledgeRoot);
  const documents: KnowledgeDocumentSummary[] = [];

  for (const category of KNOWLEDGE_CATEGORIES) {
    const categoryPath = path.join(root, category);
    if (!fs.existsSync(categoryPath)) continue;
    for (const entry of fs.readdirSync(categoryPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.toLowerCase() === 'readme.md') continue;
      const document = parseKnowledgeDocument(root, category, entry.name);
      if (document) documents.push(document);
    }
  }

  const seenIds = new Set<string>();
  for (const document of documents) {
    if (seenIds.has(document.id)) throw new Error(`Повторяется идентификатор документа знаний: ${document.id}`);
    seenIds.add(document.id);
  }

  return documents.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
}

export function readApprovedKnowledgeDocument(knowledgeRoot: string, id: string): KnowledgeDocument {
  const normalizedId = id.trim();
  if (!normalizedId || normalizedId.length > 120) throw new Error('Некорректный идентификатор документа знаний.');

  const summary = listKnowledgeDocuments(knowledgeRoot).find((document) => document.id === normalizedId);
  if (!summary) throw new Error(`Документ знаний не найден: ${normalizedId}`);
  if (summary.status !== 'approved') {
    throw new Error(`Документ ${normalizedId} не утверждён и недоступен для автоматического применения.`);
  }

  const absolutePath = resolveKnowledgeFile(knowledgeRoot, summary.relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  return { ...summary, content };
}

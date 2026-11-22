import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ensureOneCoreDirs } from './paths';

export type ExternalReferenceStatus = 'unreviewed' | 'reviewed' | 'archived';
export type ExternalReferenceSourceType = 'repository' | 'documentation' | 'article' | 'video' | 'diagram' | 'other';

export interface ExternalReference {
  id: string;
  title: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: ExternalReferenceSourceType;
  collectedAt: string;
  summary: string;
  notes: string;
  architecture: string;
  tags: string[];
  status: ExternalReferenceStatus;
  createdAt: string;
  updatedAt: string;
}

const MAX_RECORDS = 2000;
const MAX_TEXT = 20000;
const SOURCE_TYPES: ExternalReferenceSourceType[] = ['repository', 'documentation', 'article', 'video', 'diagram', 'other'];
const STATUSES: ExternalReferenceStatus[] = ['unreviewed', 'reviewed', 'archived'];

function getStorePath(): string {
  return path.join(ensureOneCoreDirs().home, 'external-references.json');
}

function readRecords(): ExternalReference[] {
  const filePath = getStorePath();
  if (!fs.existsSync(filePath)) return [];
  try {
    const value: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ExternalReference =>
      Boolean(item && typeof item === 'object' &&
        typeof (item as ExternalReference).id === 'string' &&
        typeof (item as ExternalReference).title === 'string' &&
        typeof (item as ExternalReference).sourceUrl === 'string'),
    ).slice(-MAX_RECORDS);
  } catch {
    return [];
  }
}

function writeRecords(records: ExternalReference[]): void {
  const filePath = getStorePath();
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(records.slice(-MAX_RECORDS), null, 2), 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function boundedText(value: unknown, field: string, required = false): string {
  if (typeof value !== 'string') throw new Error(`Поле «${field}» должно быть текстом.`);
  const result = value.trim();
  if (required && !result) throw new Error(`Поле «${field}» обязательно.`);
  if (result.length > MAX_TEXT) throw new Error(`Поле «${field}» превышает лимит ${MAX_TEXT} символов.`);
  return result;
}

function normalizeInput(input: Record<string, unknown>): Omit<ExternalReference, 'id' | 'createdAt' | 'updatedAt'> {
  const title = boundedText(input.title, 'Название', true);
  const sourceUrl = boundedText(input.sourceUrl, 'Ссылка', true);
  if (sourceUrl.length > 2048) throw new Error('Ссылка не должна превышать 2048 символов.');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new Error('Укажите корректную абсолютную ссылку HTTP или HTTPS.');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Разрешены только ссылки HTTP или HTTPS.');
  }
  const sourceType = SOURCE_TYPES.includes(input.sourceType as ExternalReferenceSourceType)
    ? input.sourceType as ExternalReferenceSourceType
    : 'other';
  const status = STATUSES.includes(input.status as ExternalReferenceStatus)
    ? input.status as ExternalReferenceStatus
    : 'unreviewed';
  const rawTags = Array.isArray(input.tags) ? input.tags : [];
  const tags = [...new Set(rawTags.filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
  return {
    title,
    sourceUrl: parsedUrl.toString(),
    sourceTitle: boundedText(input.sourceTitle ?? '', 'Название источника'),
    sourceType,
    collectedAt: boundedText(input.collectedAt ?? new Date().toISOString(), 'Дата сбора', true).slice(0, 40),
    summary: boundedText(input.summary ?? '', 'Краткое описание'),
    notes: boundedText(input.notes ?? '', 'Заметки'),
    architecture: boundedText(input.architecture ?? '', 'Схема и маршрут'),
    tags,
    status,
  };
}

export function listExternalReferences(): ExternalReference[] {
  return readRecords().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveExternalReference(input: Record<string, unknown>, id?: string): ExternalReference {
  const records = readRecords();
  const existing = id ? records.find((record) => record.id === id) : undefined;
  if (id && !existing) throw new Error('Внешний материал не найден.');
  const now = new Date().toISOString();
  const normalized = normalizeInput(input);
  const saved: ExternalReference = {
    ...normalized,
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = existing
    ? records.map((record) => record.id === id ? saved : record)
    : [...records, saved];
  writeRecords(next);
  return saved;
}

export function deleteExternalReference(id: string): boolean {
  const records = readRecords();
  const next = records.filter((record) => record.id !== id);
  if (next.length === records.length) return false;
  writeRecords(next);
  return true;
}

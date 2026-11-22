import fs from 'fs';
import crypto from 'crypto';
import { getNotesManifestPath } from './paths';

export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesManifest {
  notes: NoteRecord[];
  savedAt: string;
}

const INITIAL_NOTE: NoteRecord = {
  id: 'dashboard-review-follow-up',
  title: 'Вернуться к проверке дашборда',
  content: 'Позже проверить достоверность и полноту показателей дашборда ONE CORE AI. Уточнить источники данных, отдельно проверить показатели CPU и GPU и убедиться, что интерфейс не показывает неподтверждённые значения.',
  createdAt: '2026-11-17T00:00:00.000Z',
  updatedAt: '2026-11-17T00:00:00.000Z',
};

function readManifest(): NotesManifest {
  const filePath = getNotesManifestPath();
  if (!fs.existsSync(filePath)) {
    const initial = { notes: [INITIAL_NOTE], savedAt: new Date().toISOString() };
    writeManifest(initial);
    return initial;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as NotesManifest;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.notes)) {
    throw new Error('Файл заметок имеет неверный формат');
  }
  return parsed;
}

function writeManifest(manifest: NotesManifest): void {
  const filePath = getNotesManifestPath();
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // chmod may be a no-op on Windows
  }
}

export function listNotes(): NoteRecord[] {
  return readManifest().notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createNote(input: { title?: unknown; content?: unknown }): NoteRecord {
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 160) : '';
  const content = typeof input.content === 'string' ? input.content.slice(0, 50000) : '';
  const now = new Date().toISOString();
  const note: NoteRecord = {
    id: crypto.randomUUID(),
    title: title || 'Новая заметка',
    content,
    createdAt: now,
    updatedAt: now,
  };
  const manifest = readManifest();
  if (manifest.notes.length >= 500) throw new Error('Достигнут лимит заметок (500)');
  manifest.notes.push(note);
  manifest.savedAt = now;
  writeManifest(manifest);
  return note;
}

export function updateNote(id: string, input: { title?: unknown; content?: unknown }): NoteRecord | null {
  const manifest = readManifest();
  const note = manifest.notes.find((item) => item.id === id);
  if (!note) return null;
  if (typeof input.title === 'string') note.title = input.title.trim().slice(0, 160) || 'Без названия';
  if (typeof input.content === 'string') note.content = input.content.slice(0, 50000);
  note.updatedAt = new Date().toISOString();
  manifest.savedAt = note.updatedAt;
  writeManifest(manifest);
  return note;
}

export function deleteNote(id: string): boolean {
  const manifest = readManifest();
  const nextNotes = manifest.notes.filter((item) => item.id !== id);
  if (nextNotes.length === manifest.notes.length) return false;
  manifest.notes = nextNotes;
  manifest.savedAt = new Date().toISOString();
  writeManifest(manifest);
  return true;
}

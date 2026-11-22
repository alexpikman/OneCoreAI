import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookPlus, Check, Clock3, FileText, Search, StickyNote, Trash2 } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { cn } from '../../utils/cn';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';

interface NoteRecord {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

export const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [activeNoteId, setActiveNoteId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveSequence = useRef(0);

  const activeNote = notes.find((note) => note.id === activeNoteId) ?? null;

  const refreshNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/notes');
      const data = (await response.json()) as { ok?: boolean; notes?: NoteRecord[]; error?: string };
      if (!response.ok || !data.ok || !Array.isArray(data.notes)) {
        throw new Error(data.error || `Не удалось загрузить заметки (HTTP ${response.status})`);
      }
      setNotes(data.notes);
      const first = data.notes[0];
      setActiveNoteId(first?.id ?? '');
      setTitle(first?.title ?? '');
      setContent(first?.content ?? '');
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заметки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    if (!dirty || !activeNoteId) return;
    const sequence = ++saveSequence.current;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const response = await apiFetch(`/api/notes/${encodeURIComponent(activeNoteId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content }),
        });
        const data = (await response.json()) as { ok?: boolean; note?: NoteRecord; error?: string };
        if (!response.ok || !data.ok || !data.note) throw new Error(data.error || 'Не удалось сохранить заметку');
        if (sequence === saveSequence.current) {
          setNotes((current) =>
            current
              .map((note) => (note.id === data.note!.id ? data.note! : note))
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
          setDirty(false);
          setError(null);
        }
      } catch (err) {
        if (sequence === saveSequence.current) {
          setError(err instanceof Error ? err.message : 'Ошибка сохранения заметки');
        }
      } finally {
        if (sequence === saveSequence.current) setSaving(false);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeNoteId, content, dirty, title]);

  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    if (!normalized) return notes;
    return notes.filter((note) => `${note.title} ${note.content}`.toLocaleLowerCase('ru').includes(normalized));
  }, [notes, query]);

  const saveCurrentDraft = async (): Promise<boolean> => {
    if (!dirty || !activeNoteId) return true;
    const sequence = ++saveSequence.current;
    setSaving(true);
    try {
      const response = await apiFetch(`/api/notes/${encodeURIComponent(activeNoteId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data = (await response.json()) as { ok?: boolean; note?: NoteRecord; error?: string };
      if (!response.ok || !data.ok || !data.note) throw new Error(data.error || 'Не удалось сохранить заметку');
      if (sequence === saveSequence.current) {
        setNotes((current) =>
          current
            .map((note) => (note.id === data.note!.id ? data.note! : note))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
        setDirty(false);
        setError(null);
      }
      return true;
    } catch (err) {
      if (sequence === saveSequence.current) {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения заметки');
      }
      return false;
    } finally {
      if (sequence === saveSequence.current) setSaving(false);
    }
  };

  const selectNote = async (note: NoteRecord) => {
    if (!(await saveCurrentDraft())) return;
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setDirty(false);
    setError(null);
  };

  const createNewNote = async () => {
    if (!(await saveCurrentDraft())) return;
    setError(null);
    try {
      const response = await apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Новая заметка', content: '' }),
      });
      const data = (await response.json()) as { ok?: boolean; note?: NoteRecord; error?: string };
      if (!response.ok || !data.ok || !data.note) throw new Error(data.error || 'Не удалось создать заметку');
      setNotes((current) => [data.note!, ...current]);
      setActiveNoteId(data.note.id);
      setTitle(data.note.title);
      setContent(data.note.content);
      setDirty(false);
      setError(null);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать заметку');
    }
  };

  const deleteActiveNote = async () => {
    if (!activeNote) return;
    const confirmed = await requestDeleteWarning({
      variant: 'simple',
      title: 'Удалить заметку?',
      description: 'Заметка будет удалена без возможности восстановления.',
      itemName: activeNote.title,
    });
    if (!confirmed) return;
    setError(null);
    try {
      const response = await apiFetch(`/api/notes/${encodeURIComponent(activeNote.id)}`, { method: 'DELETE' });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось удалить заметку');
      const remaining = notes.filter((note) => note.id !== activeNote.id);
      setNotes(remaining);
      if (remaining[0]) void selectNote(remaining[0]);
      else {
        setActiveNoteId('');
        setTitle('');
        setContent('');
        setDirty(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить заметку');
    }
  };

  return (
    <PageLayout>
      <PageHeader showSave={false}>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <StickyNote className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Заметки</h1>
        </div>
      </PageHeader>

      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 gap-4 py-5">
        <section className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Все заметки <span className="ml-1 tabular-nums text-zinc-400">{notes.length}</span>
            </span>
            <button
              type="button"
              onClick={() => void createNewNote()}
              disabled={saving}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              aria-label="Создать заметку"
              title="Создать заметку"
            >
              <BookPlus className="h-4 w-4" />
            </button>
          </div>
          <label className="relative m-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск заметок"
              className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-950"
            />
          </label>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
            {loading && <div className="px-3 py-6 text-center text-xs text-zinc-400">Загрузка заметок…</div>}
            {!loading && filteredNotes.length === 0 && (
              <div className="px-3 py-6 text-center text-xs leading-5 text-zinc-400">
                {query ? 'Ничего не найдено' : 'Пока нет заметок. Создайте первую.'}
              </div>
            )}
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => void selectNote(note)}
                disabled={saving}
                className={cn(
                  'w-full rounded-xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  activeNoteId === note.id
                    ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <span className="truncate text-xs font-semibold">{note.title || 'Без названия'}</span>
                </span>
                <span className="mt-1 block truncate pl-5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {note.content || 'Пустая заметка'}
                </span>
                <span className="mt-2 flex items-center gap-1 pl-5 text-[10px] text-zinc-400">
                  <Clock3 className="h-3 w-3" />
                  {formatDate(note.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/60">
          {activeNote ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
                <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {saving ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                      Сохранение…
                    </span>
                  ) : dirty ? (
                    'Есть несохранённые изменения'
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Сохранено
                    </span>
                  )}
                  {error && <span className="truncate text-rose-600 dark:text-rose-400">{error}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => void deleteActiveNote()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </button>
              </div>
              <input
                value={title}
                disabled={saving}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                }}
                maxLength={160}
                placeholder="Название заметки"
                className="mx-5 mt-5 w-[calc(100%-2.5rem)] border-0 bg-transparent text-lg font-semibold text-zinc-900 outline-none placeholder:text-zinc-300 focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              <textarea
                value={content}
                disabled={saving}
                onChange={(event) => {
                  setContent(event.target.value);
                  setDirty(true);
                }}
                maxLength={50000}
                placeholder="Начните писать…"
                className="mx-5 mb-5 mt-3 min-h-0 flex-1 resize-none border-0 bg-transparent text-sm leading-7 text-zinc-700 outline-none placeholder:text-zinc-300 focus:ring-0 dark:text-zinc-300 dark:placeholder:text-zinc-600"
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400">
                <StickyNote className="h-7 w-7" />
              </div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Выберите заметку</div>
              <p className="max-w-xs text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Или создайте новую запись в личном блокноте.
              </p>
              <button
                type="button"
                onClick={() => void createNewNote()}
                className="mt-1 inline-flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white transition hover:bg-blue-500"
              >
                <BookPlus className="h-4 w-4" />
                Создать заметку
              </button>
            </div>
          )}
        </section>
        {error && !activeNote && (
          <div
            role="alert"
            className="mx-6 mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {error}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { FileCode2, FilePlus2, FolderOpen, RotateCcw, Save, Search } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';

interface CodeSearchMatch {
  path: string;
  line: number;
  preview: string;
}

export const FilesPage: React.FC = () => {
  const {
    projects,
    activeProjectId,
    selectProject,
    files,
    selectedFilePath,
    selectFile,
    createOrWriteProjectFile,
    undoLastProjectAction,
  } = useOneCoreStore();

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const currentFile = files.find((item) => item.path === selectedFilePath) ?? null;

  const [fileFilter, setFileFilter] = useState('');
  const [contentQuery, setContentQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<CodeSearchMatch[]>([]);
  const [searching, setSearching] = useState(false);

  const [draftContent, setDraftContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDraftContent(currentFile?.content ?? '');
    setDirty(false);
  }, [currentFile?.path, currentFile?.content]);

  const filteredFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    if (!q) return files;
    return files.filter((file) => file.path.toLowerCase().includes(q) || file.name.toLowerCase().includes(q));
  }, [files, fileFilter]);

  const handleContentSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProject || !contentQuery.trim()) {
      setSearchMatches([]);
      return;
    }
    setSearching(true);
    setFeedback(null);
    try {
      const resp = await apiFetch(
        `/api/projects/${encodeURIComponent(activeProject.id)}/search?q=${encodeURIComponent(contentQuery.trim())}`,
      );
      const data = (await resp.json()) as {
        ok?: boolean;
        matches?: CodeSearchMatch[];
        error?: string;
      };
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setSearchMatches(data.matches ?? []);
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Ошибка поиска по файлам',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFilePath) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await createOrWriteProjectFile(
        selectedFilePath,
        draftContent,
        `Редактирование ${selectedFilePath}`,
      );
      if (!res.ok) throw new Error(res.error || 'Не удалось сохранить файл');
      setDirty(false);
      setFeedback({ kind: 'success', text: `Сохранено: ${selectedFilePath}` });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Ошибка сохранения файла',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFile = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newFilePath.trim();
    if (!trimmed) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await createOrWriteProjectFile(trimmed, '', `Создание файла ${trimmed}`);
      if (!res.ok) throw new Error(res.error || 'Не удалось создать файл');
      setNewFileOpen(false);
      setNewFilePath('');
      await selectFile(trimmed, true);
      setFeedback({ kind: 'success', text: `Создан файл: ${trimmed}` });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Ошибка создания файла',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    const res = await undoLastProjectAction();
    setFeedback({ kind: res.ok ? 'success' : 'error', text: res.message });
  };

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'new-file',
            label: 'Новый файл',
            icon: <FilePlus2 className="h-3.5 w-3.5" />,
            onClick: () => setNewFileOpen((v) => !v),
            disabled: !activeProject,
            variant: 'secondary',
          },
          {
            id: 'undo-file',
            label: 'Откат (/undo)',
            icon: <RotateCcw className="h-3.5 w-3.5" />,
            onClick: () => void handleUndo(),
            disabled: !activeProject,
            variant: 'secondary',
          },
          {
            id: 'save-file',
            label: saving ? 'Сохранение…' : 'Сохранить файл',
            icon: <Save className="h-3.5 w-3.5" />,
            onClick: () => void handleSaveFile(),
            disabled: !selectedFilePath || !dirty || saving,
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <FileCode2 className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Файлы и поиск</h1>
        </div>
      </PageHeader>

      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col gap-3 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeProjectId}
            onChange={(event) => void selectProject(event.target.value)}
            aria-label="Активный проект"
            className="h-9 min-w-[200px] rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">Выберите проект…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.folderSource})
              </option>
            ))}
          </select>

          <form onSubmit={handleContentSearch} className="flex min-w-[220px] flex-1 items-center gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={contentQuery}
                onChange={(event) => setContentQuery(event.target.value)}
                disabled={!activeProject}
                placeholder="Поиск текста по содержимому файлов проекта…"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-800 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <button
              type="submit"
              disabled={!activeProject || !contentQuery.trim() || searching}
              className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {searching ? 'Поиск…' : 'Искать в коде'}
            </button>
          </form>
        </div>

        {newFileOpen && (
          <form
            onSubmit={handleCreateFile}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/20"
          >
            <input
              type="text"
              value={newFilePath}
              onChange={(event) => setNewFilePath(event.target.value)}
              placeholder="Относительный путь файла, например: src/helper.ts"
              className="h-8 min-w-[220px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={() => setNewFileOpen(false)}
              className="h-8 rounded-lg border border-zinc-200 px-3 text-xs dark:border-zinc-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!newFilePath.trim() || saving}
              className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-50"
            >
              Создать
            </button>
          </form>
        )}

        {feedback && (
          <div
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs',
              feedback.kind === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
                : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
            )}
          >
            {feedback.text}
          </div>
        )}

        <div className="min-h-0 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="lg:col-span-4 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                <span>Дерево файлов</span>
                <span className="font-mono tabular-nums text-zinc-400">{filteredFiles.length}</span>
              </div>
              <input
                value={fileFilter}
                onChange={(event) => setFileFilter(event.target.value)}
                placeholder="Фильтр по имени или пути…"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-0.5">
              {!activeProject ? (
                <div className="py-8 text-center text-xs text-zinc-500">Выберите проект для просмотра файлов.</div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">Файлы не найдены.</div>
              ) : (
                filteredFiles.map((file) => {
                  const selected = file.path === selectedFilePath;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => void selectFile(file.path, true)}
                      className={cn(
                        'w-full rounded-lg px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors',
                        selected
                          ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{file.path}</span>
                        <span className="shrink-0 text-[10px] text-zinc-400 tabular-nums">{file.tokensEstimate} t</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {searchMatches.length > 0 && (
              <div className="max-h-44 overflow-y-auto border-t border-zinc-200 p-2.5 space-y-1 dark:border-zinc-800">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Совпадения ({searchMatches.length})
                </div>
                {searchMatches.slice(0, 20).map((match, idx) => (
                  <button
                    key={`${match.path}:${match.line}:${idx}`}
                    type="button"
                    onClick={() => void selectFile(match.path, true)}
                    className="w-full rounded-lg border border-zinc-200/80 px-2 py-1 text-left text-[11px] hover:border-blue-500 dark:border-zinc-800"
                  >
                    <div className="font-mono text-blue-600 dark:text-blue-400">
                      {match.path}:{match.line}
                    </div>
                    <div className="truncate font-mono text-[10px] text-zinc-500">{match.preview}</div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-8 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/60">
            {currentFile ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {currentFile.path}
                    </div>
                    <div className="text-[10px] text-zinc-500 tabular-nums">
                      Язык: {currentFile.language} · ~{currentFile.tokensEstimate} токенов ·{' '}
                      {dirty ? 'есть несохранённые изменения' : 'синхронизировано с диском'}
                    </div>
                  </div>
                </div>
                <textarea
                  value={draftContent}
                  onChange={(event) => {
                    setDraftContent(event.target.value);
                    setDirty(true);
                  }}
                  spellCheck={false}
                  className="min-h-0 flex-1 w-full resize-none border-0 bg-transparent p-4 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:ring-0 dark:text-zinc-200"
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-xs text-zinc-500">
                <FolderOpen className="h-7 w-7 text-zinc-400" />
                <span>Выберите файл слева, чтобы открыть и отредактировать его содержимое.</span>
              </div>
            )}
          </section>
        </div>
      </PageContent>
    </PageLayout>
  );
};

import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Save, Trash2, X } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ProjectRecord } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';

interface ProjectPlanModalProps {
  open: boolean;
  project: ProjectRecord | null;
  onClose: () => void;
}

export const ProjectPlanModal: React.FC<ProjectPlanModalProps> = ({ open, project, onClose }) => {
  const { projectWorkspace, saveProjectPlan, activeProjectId } = useOneCoreStore();
  const [content, setContent] = useState('');
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContent(projectWorkspace.plan?.content ?? '');
    setProgress(projectWorkspace.plan?.progress ?? 0);
    setError(null);
  }, [open, project?.id, projectWorkspace.plan?.content, projectWorkspace.plan?.progress]);

  if (!open || !project) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (project.id !== activeProjectId) {
      setError('Выбранный проект изменился. Закройте окно и выберите проект повторно.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProjectPlan({ content, progress });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось сохранить план');
      return;
    }
    onClose();
  };

  const handleDelete = async () => {
    if (project.id !== activeProjectId) {
      setError('Выбранный проект изменился. Закройте окно и выберите проект повторно.');
      return;
    }
    const confirmed = await requestDeleteWarning({ variant: 'simple', title: 'Удалить план проекта?', description: 'План проекта будет удалён.', itemName: project.name });
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    const result = await saveProjectPlan(null);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось удалить план');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-plan-title"
        className="flex max-h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0">
              <h2 id="project-plan-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">План проекта</h2>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{project.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-2 text-zinc-500 hover:bg-slate-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <label htmlFor="project-plan-content" className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Содержание плана
              </label>
              <textarea
                id="project-plan-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={14}
                maxLength={30000}
                placeholder="Этапы, цели, ожидаемые результаты и критерии завершения…"
                className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-zinc-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <p className="mt-1 text-right text-[10px] text-zinc-400">{content.length} / 30000</p>
            </div>
            <label className="block">
              <span className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                <span>Прогресс выполнения</span>
                <span className="font-mono">{progress}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(event) => setProgress(Number(event.target.value))}
                className="mt-2 w-full accent-blue-600"
              />
            </label>
            {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-zinc-800">
            <div>
              {projectWorkspace.plan && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить план
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-zinc-600 transition hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
                Отмена
              </button>
              <button type="submit" disabled={saving || !content.trim()} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50')}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? 'Сохранение…' : 'Сохранить план'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
};

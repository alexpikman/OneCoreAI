import React, { useCallback, useEffect, useState } from 'react';
import { Brain, FileText, Plus, RefreshCw, Save } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentMemoryKey } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

export const MemoryPage: React.FC = () => {
  const { uiStyle, memoryDocs, updateMemoryDoc, projects, activeProjectId, saveSettings } = useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);

  const [activeMemKey, setActiveMemKey] = useState<AgentMemoryKey>('soul');
  const [factInput, setFactInput] = useState('');
  const [projectMemoryContent, setProjectMemoryContent] = useState('');
  const [projectMemoryStatus, setProjectMemoryStatus] = useState<string | null>(null);
  const [loadingProjectMemory, setLoadingProjectMemory] = useState(false);

  const activeMemoryDoc = memoryDocs.find((m) => m.key === activeMemKey) ?? memoryDocs[0];
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const loadProjectMemory = useCallback(async () => {
    if (!activeProject) {
      setProjectMemoryContent('');
      setProjectMemoryStatus(null);
      return;
    }
    setLoadingProjectMemory(true);
    setProjectMemoryStatus(null);
    try {
      const response = await apiFetch(
        `/api/projects/${encodeURIComponent(activeProject.id)}/file?path=${encodeURIComponent('MEMORY.md')}`,
      );
      if (response.status === 404) {
        setProjectMemoryContent('');
        setProjectMemoryStatus('Файл MEMORY.md в корне проекта пока не создан.');
        return;
      }
      const data = (await response.json()) as { ok?: boolean; content?: string; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setProjectMemoryContent(data.content ?? '');
      setProjectMemoryStatus('Загружен реальный MEMORY.md активного проекта.');
    } catch (cause) {
      setProjectMemoryStatus(cause instanceof Error ? cause.message : 'Не удалось прочитать MEMORY.md проекта.');
    } finally {
      setLoadingProjectMemory(false);
    }
  }, [activeProject]);

  useEffect(() => {
    void loadProjectMemory();
  }, [loadProjectMemory]);

  const handleAppendFact = (event: React.FormEvent) => {
    event.preventDefault();
    if (!factInput.trim() || !activeMemoryDoc) return;
    const timestamp = new Date().toISOString().slice(0, 10);
    const next = `${activeMemoryDoc.content.trimEnd()}\n- [${timestamp}] ${factInput.trim()}\n`;
    updateMemoryDoc(activeMemoryDoc.key, next);
    setFactInput('');
  };

  const handleSaveProjectMemory = async () => {
    if (!activeProject) return;
    setProjectMemoryStatus(null);
    try {
      const response = await apiFetch(`/api/projects/${encodeURIComponent(activeProject.id)}/file`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-OneCore-Approval': 'user-confirmed',
        },
        body: JSON.stringify({
          path: 'MEMORY.md',
          content: projectMemoryContent,
          approved: true,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setProjectMemoryStatus('MEMORY.md сохранён в каталоге проекта.');
    } catch (cause) {
      setProjectMemoryStatus(cause instanceof Error ? cause.message : 'Ошибка сохранения MEMORY.md.');
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-xl font-semibold">Трёхслойная память агента</h1>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-6 py-6">
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Глобальная память OneCore (SOUL.md / MEMORY.md / USER.md)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Сохраняется между сессиями и передаётся агентам в системный контекст.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void saveSettings()}
              className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Save className="h-3.5 w-3.5" />
              Сохранить память
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {memoryDocs.map((doc) => (
              <button
                key={doc.key}
                type="button"
                onClick={() => setActiveMemKey(doc.key)}
                className={cn(
                  'px-3 py-1.5 border font-mono text-xs transition-colors',
                  tokens.inputRadius,
                  activeMemKey === doc.key
                    ? tokens.activeHighlight
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400',
                )}
              >
                {doc.filename} · {doc.title}
              </button>
            ))}
          </div>

          {activeMemoryDoc && (
            <>
              <textarea
                rows={10}
                value={activeMemoryDoc.content}
                onChange={(e) => updateMemoryDoc(activeMemoryDoc.key, e.target.value)}
                className={cn(
                  'w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                  tokens.inputRadius,
                )}
              />

              <form onSubmit={handleAppendFact} className="flex gap-2">
                <input
                  type="text"
                  value={factInput}
                  onChange={(e) => setFactInput(e.target.value)}
                  placeholder={`Добавить факт в ${activeMemoryDoc.filename}...`}
                  className={cn(
                    'flex-1 h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                />
                <button
                  type="submit"
                  disabled={!factInput.trim()}
                  className={cn(
                    'h-9 px-3.5 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-45 whitespace-nowrap',
                    tokens.inputRadius,
                    tokens.accentButton,
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить запись
                </button>
              </form>
            </>
          )}
        </div>

        <div className={cn('p-5 border space-y-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span>Локальный MEMORY.md активного проекта</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {activeProject ? `Проект: ${activeProject.name} (${activeProject.folderPath})` : 'Активный проект не выбран'}
              </p>
            </div>
            {activeProject && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadProjectMemory()}
                  disabled={loadingProjectMemory}
                  className="h-8 rounded-lg border border-zinc-200 px-2.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingProjectMemory && 'animate-spin')} />
                  Обновить
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProjectMemory()}
                  className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Save className="h-3.5 w-3.5" />
                  Записать в проект
                </button>
              </div>
            )}
          </div>

          {projectMemoryStatus && <p className="text-xs text-zinc-600 dark:text-zinc-300">{projectMemoryStatus}</p>}

          {activeProject && (
            <textarea
              rows={7}
              value={projectMemoryContent}
              onChange={(e) => setProjectMemoryContent(e.target.value)}
              placeholder="# Память проекта&#10;Записывайте архитектурные решения и договорённости проекта..."
              className={cn(
                'w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                tokens.inputRadius,
              )}
            />
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
};

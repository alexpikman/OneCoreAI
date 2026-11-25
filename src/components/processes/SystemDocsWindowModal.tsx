import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  FileCode2,
  FileText,
  FolderTree,
  Loader2,
  Maximize2,
  Minimize2,
  Search,
  X,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import type { LoadedSystemDocument, ScannedDocEntry, WorkflowNode } from '../../types/systemGraph';

interface SystemDocsWindowModalProps {
  open: boolean;
  onClose: () => void;
  documents: ScannedDocEntry[];
  nodes: WorkflowNode[];
  initialPath?: string | null;
  onFocusNode?: (nodeId: string) => void;
}

type CategoryFilter = 'all' | ScannedDocEntry['category'] | 'source';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'Все документы',
  architecture: 'Архитектура',
  intelligence: 'Intelligence (Draft)',
  knowledge: 'Knowledge Base',
  schema: 'JSON-схемы',
  governance: 'Governance',
  project: 'План и статусы',
  root: 'Корень проекта',
  source: 'Исходный код',
};

export const SystemDocsWindowModal: React.FC<SystemDocsWindowModalProps> = ({
  open,
  onClose,
  documents,
  nodes,
  initialPath,
  onFocusNode,
}) => {
  const [maximized, setMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loadedDoc, setLoadedDoc] = useState<LoadedSystemDocument | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const sourcePaths = useMemo(() => {
    const unique = new Set<string>();
    for (const node of nodes) {
      for (const file of node.sourceFiles) unique.add(file);
    }
    return [...unique].sort();
  }, [nodes]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  useEffect(() => {
    if (!open) return;
    if (initialPath) {
      setSelectedPath(initialPath);
      if (
        !documents.some((doc) => doc.path === initialPath) &&
        sourcePaths.includes(initialPath)
      ) {
        setCategoryFilter('source');
      } else {
        setCategoryFilter('all');
      }
      return;
    }
    if (!selectedPath && documents.length > 0) {
      setSelectedPath(documents[0].path);
    }
  }, [open, initialPath, documents, sourcePaths, selectedPath]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !selectedPath) return;
    const controller = new AbortController();

    const fetchDocument = async () => {
      try {
        setLoadingDoc(true);
        setDocError(null);
        const response = await apiFetch(
          `/api/system-graph/document?path=${encodeURIComponent(selectedPath)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          document?: LoadedSystemDocument;
          error?: string;
        };
        if (!response.ok || !payload.ok || !payload.document) {
          throw new Error(payload.error || `Не удалось открыть документ (HTTP ${response.status}).`);
        }
        setLoadedDoc(payload.document);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadedDoc(null);
        setDocError(err instanceof Error ? err.message : 'Ошибка чтения документа.');
      } finally {
        if (!controller.signal.aborted) setLoadingDoc(false);
      }
    };

    void fetchDocument();
    return () => controller.abort();
  }, [open, selectedPath]);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (categoryFilter === 'source') return [];
    return documents.filter((doc) => {
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
      if (!q) return true;
      return `${doc.path} ${doc.title} ${doc.id ?? ''} ${doc.status} ${doc.headings.join(' ')}`
        .toLowerCase()
        .includes(q);
    });
  }, [documents, categoryFilter, searchQuery]);

  const filteredSources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (categoryFilter !== 'all' && categoryFilter !== 'source') return [];
    return sourcePaths.filter((filePath) => (!q ? true : filePath.toLowerCase().includes(q)));
  }, [sourcePaths, categoryFilter, searchQuery]);

  const selectedDocMeta = useMemo(
    () => documents.find((doc) => doc.path === selectedPath) ?? null,
    [documents, selectedPath],
  );

  const relatedNodes = useMemo(() => {
    if (selectedDocMeta) {
      return selectedDocMeta.linkedNodeIds
        .map((id) => nodeById.get(id))
        .filter((node): node is WorkflowNode => Boolean(node));
    }
    return nodes.filter((node) => node.sourceFiles.includes(selectedPath));
  }, [selectedDocMeta, nodes, nodeById, selectedPath]);

  const copyPath = (value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedPath(value);
    setTimeout(() => setCopiedPath((current) => (current === value ? null : current)), 1600);
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Окно документации и расположений файлов"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-5 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-[#0D0E12] dark:text-zinc-100',
          maximized ? 'h-[96vh] w-[98vw]' : 'h-[86vh] w-full max-w-6xl',
        )}
      >
        {/* Window Title Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex min-w-0 items-center gap-2.5">
            <FolderTree className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">
                Окно документов и расположений системы
              </h2>
              <p className="truncate font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                Просканировано документов: {documents.length} · исходных модулей: {sourcePaths.length}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMaximized((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              title={maximized ? 'Восстановить размер окна' : 'Развернуть окно'}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span>{maximized ? 'Свернуть' : 'Во весь экран'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              aria-label="Закрыть окно документов"
            >
              <X className="h-3.5 w-3.5" />
              <span>Закрыть</span>
            </button>
          </div>
        </div>

        {/* Search & Category Strip */}
        <div className="flex flex-col gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-[#111217]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск документа по пути, заголовку, ID или разделу…"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0',
                  categoryFilter === cat
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800',
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Two-Pane Navigator + Document Content */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-12">
          {/* Left Tree / Index */}
          <aside className="min-h-0 overflow-y-auto border-b border-zinc-200 bg-zinc-50/70 p-3 space-y-3 md:col-span-4 md:border-b-0 md:border-r dark:border-zinc-800 dark:bg-zinc-950/50">
            {filteredDocuments.length > 0 && (
              <div className="space-y-1">
                <div className="px-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Документация проекта ({filteredDocuments.length})
                </div>
                {filteredDocuments.map((doc) => {
                  const active = selectedPath === doc.path;
                  return (
                    <button
                      key={doc.path}
                      type="button"
                      onClick={() => setSelectedPath(doc.path)}
                      className={cn(
                        'w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
                        active
                          ? 'border-blue-500/50 bg-blue-500/10 text-zinc-950 dark:text-zinc-50'
                          : 'border-transparent hover:border-zinc-200 hover:bg-white dark:hover:border-zinc-800 dark:hover:bg-zinc-900',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <span className="truncate">{doc.title}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500">{doc.status}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                        {doc.path}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] tabular-nums text-zinc-400">
                        <span>{doc.lineCount} стр.</span>
                        <span>·</span>
                        <span>узлов: {doc.linkedNodeIds.length}</span>
                        {doc.version && (
                          <>
                            <span>·</span>
                            <span>v{doc.version}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredSources.length > 0 && (
              <div className="space-y-1">
                <div className="px-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Связанные модули кода ({filteredSources.length})
                </div>
                {filteredSources.map((srcPath) => {
                  const active = selectedPath === srcPath;
                  return (
                    <button
                      key={srcPath}
                      type="button"
                      onClick={() => setSelectedPath(srcPath)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors',
                        active
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                          : 'border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-white dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900',
                      )}
                    >
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span className="truncate">{srcPath}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredDocuments.length === 0 && filteredSources.length === 0 && (
              <p className="px-2 py-8 text-center text-xs text-zinc-500">
                По запросу документы не найдены.
              </p>
            )}
          </aside>

          {/* Right Document Viewer */}
          <div className="flex min-h-0 flex-col md:col-span-8">
            {selectedPath ? (
              <>
                <div className="border-b border-zinc-200 bg-white px-4 py-3 space-y-2 dark:border-zinc-800 dark:bg-[#111217]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        <span className="break-all">{selectedPath}</span>
                      </div>
                      {selectedDocMeta && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <span>Категория: {selectedDocMeta.category}</span>
                          <span>·</span>
                          <span>Статус: {selectedDocMeta.status}</span>
                          {selectedDocMeta.id && (
                            <>
                              <span>·</span>
                              <span className="font-mono">id: {selectedDocMeta.id}</span>
                            </>
                          )}
                          {selectedDocMeta.ownerRole && (
                            <>
                              <span>·</span>
                              <span className="font-mono">owner: {selectedDocMeta.ownerRole}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyPath(selectedPath)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
                    >
                      {copiedPath === selectedPath ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Путь скопирован</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Копировать путь</span>
                        </>
                      )}
                    </button>
                  </div>

                  {relatedNodes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                      <span className="text-zinc-500 dark:text-zinc-400">Узлы на графе:</span>
                      {relatedNodes.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => {
                            onFocusNode?.(node.id);
                            onClose();
                          }}
                          className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 whitespace-nowrap"
                        >
                          {node.layerId} · {node.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 bg-zinc-50 dark:bg-[#090A0D]">
                  {loadingDoc && (
                    <div className="flex items-center gap-2 py-8 text-xs text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Чтение содержимого файла из репозитория…</span>
                    </div>
                  )}
                  {docError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{docError}</span>
                    </div>
                  )}
                  {!loadingDoc && !docError && loadedDoc && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        <span>{loadedDoc.title}</span>
                        <span>
                          {loadedDoc.lineCount} строк · {(loadedDoc.sizeBytes / 1024).toFixed(1)} КБ
                        </span>
                      </div>
                      <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-4 font-mono text-[11.5px] leading-5 text-zinc-800 whitespace-pre-wrap break-words dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                        {loadedDoc.content}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-xs text-zinc-500">
                Выберите документ или файл слева для просмотра расположения и содержимого.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

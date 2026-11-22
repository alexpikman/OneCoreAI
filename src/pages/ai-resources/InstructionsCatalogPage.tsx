import { useCallback, useEffect, useState, type FC, type FormEvent } from 'react';
import { BookOpen, ExternalLink, FileCode2, FileText, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { requestDeleteWarning } from '../../utils/deleteWarning';

type CatalogTab = 'knowledge' | 'schemas' | 'references';
type ReferenceStatus = 'unreviewed' | 'reviewed' | 'archived';
type ReferenceSourceType = 'repository' | 'documentation' | 'article' | 'video' | 'diagram' | 'other';

interface KnowledgeDocumentSummary {
  id: string;
  version: string;
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  ownerRole: string;
  triggers: string[];
  category: string;
  relativePath: string;
  title: string;
}

interface KnowledgeDocumentDetail extends KnowledgeDocumentSummary {
  content: string;
}

interface ExternalReference {
  id: string;
  title: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: ReferenceSourceType;
  collectedAt: string;
  summary: string;
  notes: string;
  architecture: string;
  tags: string[];
  status: ReferenceStatus;
  createdAt: string;
  updatedAt: string;
}

type ReferenceDraft = Omit<ExternalReference, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_DRAFT: ReferenceDraft = {
  title: '',
  sourceUrl: '',
  sourceTitle: '',
  sourceType: 'repository',
  collectedAt: new Date().toISOString().slice(0, 10),
  summary: '',
  notes: '',
  architecture: '',
  tags: [],
  status: 'unreviewed',
};

const SOURCE_LABELS: Record<ReferenceSourceType, string> = {
  repository: 'Репозиторий',
  documentation: 'Документация',
  article: 'Статья',
  video: 'Видео',
  diagram: 'Схема',
  other: 'Другое',
};

const STATUS_LABELS: Record<ReferenceStatus, string> = {
  unreviewed: 'Не изучено',
  reviewed: 'Изучено',
  archived: 'В архиве',
};

export const InstructionsCatalogPage: FC<{ defaultTab?: CatalogTab }> = ({ defaultTab = 'knowledge' }) => {
  const { generalAgentConfig, updateGeneralAgentConfig, saveSettings } = useOneCoreStore();

  const [tab, setTab] = useState<CatalogTab>(defaultTab);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocumentDetail | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<{
    agentHandoff: Record<string, unknown> | null;
    workerResult: Record<string, unknown> | null;
  }>({ agentHandoff: null, workerResult: null });
  const [enforcement, setEnforcement] = useState<{
    handoffSchemaLoaded: boolean;
    workerResultSchemaLoaded: boolean;
    approvedDocumentsCount: number;
    totalDocumentsCount: number;
  } | null>(null);

  const [references, setReferences] = useState<ExternalReference[]>([]);
  const [draft, setDraft] = useState<ReferenceDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [agentSaveStatus, setAgentSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [knowledgeRes, schemasRes, refsRes] = await Promise.all([
        apiFetch('/api/knowledge'),
        apiFetch('/api/knowledge/schemas'),
        apiFetch('/api/external-references'),
      ]);

      const knowledgeData = (await knowledgeRes.json()) as {
        ok?: boolean;
        documents?: KnowledgeDocumentSummary[];
      };
      if (knowledgeRes.ok && knowledgeData.ok && Array.isArray(knowledgeData.documents)) {
        setKnowledgeDocuments(knowledgeData.documents);
      }

      const schemaData = (await schemasRes.json()) as {
        ok?: boolean;
        schemas?: {
          agentHandoff: Record<string, unknown> | null;
          workerResult: Record<string, unknown> | null;
        };
        enforcement?: {
          handoffSchemaLoaded: boolean;
          workerResultSchemaLoaded: boolean;
          approvedDocumentsCount: number;
          totalDocumentsCount: number;
        };
      };
      if (schemasRes.ok && schemaData.ok && schemaData.schemas) {
        setSchemas(schemaData.schemas);
        if (schemaData.enforcement) setEnforcement(schemaData.enforcement);
      }

      const refsData = (await refsRes.json()) as {
        ok?: boolean;
        references?: ExternalReference[];
        error?: string;
      };
      if (!refsRes.ok || !refsData.ok || !Array.isArray(refsData.references)) {
        throw new Error(refsData.error || 'Не удалось загрузить внешние материалы.');
      }
      setReferences(refsData.references);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить каталог инструкций.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openKnowledgeDocument = async (id: string) => {
    setDocError(null);
    try {
      const response = await apiFetch(`/api/knowledge/documents/${encodeURIComponent(id)}`);
      const data = (await response.json()) as {
        ok?: boolean;
        document?: KnowledgeDocumentDetail;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.document) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setSelectedDoc(data.document);
    } catch (cause) {
      setSelectedDoc(null);
      setDocError(cause instanceof Error ? cause.message : 'Не удалось открыть документ.');
    }
  };

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setTagsText('');
    setEditingId(null);
  };

  const editReference = (reference: ExternalReference) => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...values } = reference;
    setDraft(values);
    setTagsText(values.tags.join(', '));
    setEditingId(reference.id);
    setError(null);
  };

  const submitReference = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...draft, tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean) };
      const response = await apiFetch(
        editingId ? `/api/external-references/${encodeURIComponent(editingId)}` : '/api/external-references',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось сохранить материал.');
      resetDraft();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить материал.');
    } finally {
      setSaving(false);
    }
  };

  const removeReference = async (id: string, title: string) => {
    const confirmed = await requestDeleteWarning({
      variant: 'simple',
      title: 'Удалить запись из локальной библиотеки?',
      description: 'Исследовательский материал будет удалён из локального каталога.',
      itemName: title,
    });
    if (!confirmed) return;
    try {
      const response = await apiFetch(`/api/external-references/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось удалить материал.');
      if (editingId === id) resetDraft();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить материал.');
    }
  };

  const handleSaveInstructions = async () => {
    const result = await saveSettings();
    setAgentSaveStatus(result.ok ? 'Инструкции общего агента сохранены.' : result.error || 'Ошибка сохранения.');
  };

  const visibleReferences = references.filter((reference) => {
    const value = [
      reference.title,
      reference.sourceTitle,
      reference.sourceUrl,
      reference.summary,
      reference.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return value.includes(query.trim().toLowerCase());
  });

  return (
    <AIResourcePageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'refresh-instructions-catalog',
            label: 'Обновить',
            icon: <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />,
            onClick: () => void refresh(),
            disabled: loading,
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Инструкции, регламенты и справочники</h1>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-5 pb-5 pt-2">
        <SecondaryTabBar
          ariaLabel="Внутренние разделы: Инструкции и справочники"
          items={[
            { id: 'knowledge', label: 'Регламенты и роли (Knowledge)', icon: <FileText className="h-3.5 w-3.5" /> },
            { id: 'schemas', label: 'JSON-схемы контрактов', icon: <FileCode2 className="h-3.5 w-3.5" /> },
            { id: 'references', label: 'Внешние материалы', icon: <BookOpen className="h-3.5 w-3.5" /> },
          ]}
          selectedId={tab}
          onSelect={(id) => setTab(id as CatalogTab)}
        />

        {error && (
          <p role="alert" className="text-xs text-rose-500">
            {error}
          </p>
        )}

        {tab === 'knowledge' && (
          <div className="space-y-5">
            {enforcement && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Утверждено и исполняется оркестратором: {enforcement.approvedDocumentsCount} из{' '}
                  {enforcement.totalDocumentsCount} документов
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  agent-handoff.v1: {enforcement.handoffSchemaLoaded ? 'OK' : 'MISSING'} · worker-result.v1:{' '}
                  {enforcement.workerResultSchemaLoaded ? 'OK' : 'MISSING'}
                </span>
              </div>
            )}

            <section className="space-y-3 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Инструкции общего агента (runtime context)
                  </h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Редактируемые инструкции и схема поведения общего агента, применяемые при запросах без узкой роли.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveInstructions()}
                  className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 whitespace-nowrap"
                >
                  Сохранить инструкции
                </button>
              </div>
              {agentSaveStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400">{agentSaveStatus}</p>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-zinc-500">Инструкции</span>
                  <textarea
                    rows={5}
                    value={generalAgentConfig.instructions}
                    onChange={(e) => {
                      updateGeneralAgentConfig({ instructions: e.target.value });
                      setAgentSaveStatus(null);
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-zinc-500">Схема поведения</span>
                  <textarea
                    rows={5}
                    value={generalAgentConfig.behaviorSchema}
                    onChange={(e) => {
                      updateGeneralAgentConfig({ behaviorSchema: e.target.value });
                      setAgentSaveStatus(null);
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Знания ONE CORE AI</h2>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Версионируемые регламенты ролей, процедур и протоколов. Только статус «approved» допускается к
                    исполнению.
                  </p>
                </div>
                <span className="text-[10px] text-zinc-500">{knowledgeDocuments.length} документов</span>
              </div>

              {knowledgeDocuments.length === 0 ? (
                <p className="text-xs text-zinc-500">Каталог знаний пуст или недоступен.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {knowledgeDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => void openKnowledgeDocument(doc.id)}
                      className="text-left rounded-lg border border-zinc-200 p-3 hover:border-blue-500 dark:border-zinc-800 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{doc.title}</span>
                        <span
                          className={
                            doc.status === 'approved'
                              ? 'rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                          }
                        >
                          {doc.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-zinc-400">
                        {doc.id} · v{doc.version}
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {doc.category} · {doc.ownerRole} · {doc.relativePath}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {docError && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  {docError}
                </div>
              )}

              {selectedDoc && (
                <div className="rounded-xl border border-blue-500/30 bg-zinc-50 p-4 dark:bg-zinc-900/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {selectedDoc.id} (v{selectedDoc.version}) — {selectedDoc.relativePath}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDoc(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      Закрыть
                    </button>
                  </div>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    {selectedDoc.content}
                  </pre>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'schemas' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  agent-handoff.v1.schema.json
                </h2>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                  {schemas.agentHandoff ? 'Загружена' : 'Отсутствует'}
                </span>
              </div>
              <pre className="max-h-[540px] overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
                {schemas.agentHandoff ? JSON.stringify(schemas.agentHandoff, null, 2) : 'Схема не найдена'}
              </pre>
            </section>
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  worker-result.v1.schema.json
                </h2>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                  {schemas.workerResult ? 'Загружена' : 'Отсутствует'}
                </span>
              </div>
              <pre className="max-h-[540px] overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
                {schemas.workerResult ? JSON.stringify(schemas.workerResult, null, 2) : 'Схема не найдена'}
              </pre>
            </section>
          </div>
        )}

        {tab === 'references' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">КАК У ДРУГИХ</h2>
              <span className="text-[10px] text-zinc-500">Отдельная исследовательская библиотека</span>
            </div>

            <div className="rounded-xl border border-blue-200/70 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
              Внешние материалы — исследовательские источники. Они не входят в утверждённые знания и не используются
              агентами как инструкции.
            </div>

            <form
              onSubmit={submitReference}
              className="space-y-3 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {editingId ? 'Редактирование материала' : 'Добавить внешний материал'}
                </h3>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetDraft}
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <X className="h-3.5 w-3.5" /> Отмена
                  </button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Название проекта / системы *
                  <input
                    required
                    maxLength={200}
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Ссылка на источник *
                  <input
                    required
                    type="url"
                    maxLength={2048}
                    value={draft.sourceUrl}
                    onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
                    placeholder="https://…"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Название источника
                  <input
                    maxLength={200}
                    value={draft.sourceTitle}
                    onChange={(event) => setDraft({ ...draft, sourceTitle: event.target.value })}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Тип источника
                  <select
                    value={draft.sourceType}
                    onChange={(event) => setDraft({ ...draft, sourceType: event.target.value as ReferenceSourceType })}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Дата сбора
                  <input
                    type="date"
                    value={draft.collectedAt.slice(0, 10)}
                    onChange={(event) => setDraft({ ...draft, collectedAt: event.target.value })}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Статус изучения
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft({ ...draft, status: event.target.value as ReferenceStatus })}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                Краткое описание
                <textarea
                  rows={2}
                  maxLength={20000}
                  value={draft.summary}
                  onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
              <label className="block space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                Архитектура и маршрут работы
                <textarea
                  rows={4}
                  maxLength={20000}
                  value={draft.architecture}
                  onChange={(event) => setDraft({ ...draft, architecture: event.target.value })}
                  placeholder="Компоненты, последовательность действий, роли, передачи, проверки…"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Теги через запятую
                  <input
                    value={tagsText}
                    onChange={(event) => setTagsText(event.target.value)}
                    placeholder="agents, workflow, tools"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Собственные заметки и выводы
                  <textarea
                    rows={2}
                    maxLength={20000}
                    value={draft.notes}
                    onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Сохранение…' : editingId ? 'Сохранить изменения' : 'Добавить в библиотеку'}
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по внешним материалам…"
                className="h-9 min-w-[220px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-500">{visibleReferences.length} материалов</span>
            </div>

            {loading && references.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-500">Загрузка библиотеки…</div>
            ) : visibleReferences.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Внешних материалов пока нет
              </div>
            ) : (
              <div className="space-y-3">
                {visibleReferences.map((reference) => (
                  <article
                    key={reference.id}
                    className="space-y-3 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{reference.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                          <span>{SOURCE_LABELS[reference.sourceType]}</span>
                          <span>·</span>
                          <span>{STATUS_LABELS[reference.status]}</span>
                          <span>·</span>
                          <span>Собрано: {reference.collectedAt.slice(0, 10)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={reference.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 whitespace-nowrap"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Источник
                        </a>
                        <button
                          type="button"
                          onClick={() => editReference(reference)}
                          className="h-8 rounded-lg px-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeReference(reference.id, reference.title)}
                          aria-label="Удалить материал"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {reference.sourceTitle && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{reference.sourceTitle}</p>
                    )}
                    {reference.summary && (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {reference.summary}
                      </p>
                    )}
                    {reference.architecture && (
                      <details className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/70">
                        <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          Схема и маршрут
                        </summary>
                        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {reference.architecture}
                        </pre>
                      </details>
                    )}
                    {reference.notes && (
                      <p className="whitespace-pre-wrap border-l-2 border-blue-300 pl-3 text-xs text-zinc-600 dark:border-blue-800 dark:text-zinc-400">
                        {reference.notes}
                      </p>
                    )}
                    {reference.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {reference.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </PageContent>
    </AIResourcePageLayout>
  );
};

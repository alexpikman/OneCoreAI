import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { BookOpen, Edit3, Eye, FileCode2, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { InstructionsSectionId } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';

type CatalogTab = 'knowledge' | 'schemas' | 'references';

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

export const InstructionsCatalogPage: FC<{ defaultTab?: CatalogTab }> = ({ defaultTab = 'knowledge' }) => {
  const {
    generalAgentConfig,
    updateGeneralAgentConfig,
    saveSettings,
    instructionsSection,
    setInstructionsSection,
  } = useOneCoreStore();

  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocumentDetail | null>(null);
  const [localDocDraft, setLocalDocDraft] = useState<string>('');
  const [docError, setDocError] = useState<string | null>(null);
  const [docFilterStatus, setDocFilterStatus] = useState<'all' | 'approved' | 'draft'>('all');
  const [docQuery, setDocQuery] = useState('');

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentSaveStatus, setAgentSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTab === 'schemas') {
      setInstructionsSection('schemas');
    }
  }, [defaultTab, setInstructionsSection]);

  const activeTab: InstructionsSectionId =
    instructionsSection === 'view' ||
    instructionsSection === 'edit' ||
    instructionsSection === 'schemas'
      ? instructionsSection
      : 'catalog';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [knowledgeRes, schemasRes] = await Promise.all([
        apiFetch('/api/knowledge'),
        apiFetch('/api/knowledge/schemas'),
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить регламенты и схемы.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openKnowledgeDocument = async (id: string, switchToTab?: 'view' | 'edit') => {
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
      setLocalDocDraft(data.document.content);
      if (switchToTab) setInstructionsSection(switchToTab);
    } catch (cause) {
      setSelectedDoc(null);
      setDocError(cause instanceof Error ? cause.message : 'Не удалось открыть документ.');
      if (switchToTab) setInstructionsSection(switchToTab);
    }
  };

  const handleSaveInstructions = async () => {
    const result = await saveSettings();
    setAgentSaveStatus(result.ok ? 'Инструкции общего агента сохранены.' : result.error || 'Ошибка сохранения.');
  };

  const visibleDocuments = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    return knowledgeDocuments.filter((doc) => {
      if (docFilterStatus === 'approved' && doc.status !== 'approved') return false;
      if (docFilterStatus === 'draft' && doc.status === 'approved') return false;
      if (!q) return true;
      return [doc.title, doc.id, doc.category, doc.ownerRole, doc.relativePath]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [docFilterStatus, docQuery, knowledgeDocuments]);

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
          <h1 className="text-xl font-semibold">Регламенты и схемы</h1>
        </div>
      </PageHeader>
      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Внутренние разделы: Регламенты и схемы"
            items={[
              { id: 'catalog', label: 'Каталог', icon: <FileText className="h-3.5 w-3.5" /> },
              { id: 'view', label: 'Просмотр', icon: <Eye className="h-3.5 w-3.5" /> },
              { id: 'edit', label: 'Редактирование', icon: <Edit3 className="h-3.5 w-3.5" /> },
              { id: 'schemas', label: 'JSON-схемы', icon: <FileCode2 className="h-3.5 w-3.5" /> },
            ]}
            selectedId={activeTab}
            onSelect={(id) => setInstructionsSection(id as InstructionsSectionId)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">

        {error && (
          <p role="alert" className="text-xs text-rose-500">
            {error}
          </p>
        )}

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

        {/* 1. Каталог регламентов, инструкций и схем */}
        {activeTab === 'catalog' && (
          <section className="space-y-4 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Каталог регламентов, инструкций и схем
                </h2>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Версионируемые регламенты ролей, процедур и протоколов. Только статус «approved» допускается к исполнению.
                </p>
              </div>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                {visibleDocuments.length} / {knowledgeDocuments.length} документов
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="Поиск по названию, роли, категории или пути…"
                className="h-8 min-w-[220px] flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <div className="inline-flex items-center rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
                {(
                  [
                    { id: 'all', label: 'Все' },
                    { id: 'approved', label: 'Approved' },
                    { id: 'draft', label: 'Draft / Review' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDocFilterStatus(item.id)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      docFilterStatus === item.id
                        ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {visibleDocuments.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">Каталог документов пуст или ничего не найдено.</p>
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2">
                {visibleDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => void openKnowledgeDocument(doc.id, 'view')}
                    className="text-left rounded-xl border border-zinc-200 bg-white p-3.5 hover:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900/40 transition-colors space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{doc.title}</span>
                      <span
                        className={
                          doc.status === 'approved'
                            ? 'font-mono text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400'
                            : 'font-mono text-[10.5px] font-medium text-amber-600 dark:text-amber-400'
                        }
                      >
                        {doc.status}
                      </span>
                    </div>
                    <div className="font-mono text-[10.5px] text-zinc-400 tabular-nums">
                      {doc.id} · v{doc.version}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {doc.category} · роль: {doc.ownerRole} · {doc.relativePath}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 2. Просмотр выбранного регламента */}
        {activeTab === 'view' && (
          <section className="space-y-4 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Просмотр документа и структуры схем
              </h2>
              <button
                type="button"
                onClick={() => setInstructionsSection('catalog')}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                ← Вернуться в каталог
              </button>
            </div>

            {docError && (
              <div
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
              >
                {docError}
              </div>
            )}

            {selectedDoc ? (
              <div className="rounded-xl border border-blue-500/30 bg-zinc-50 p-4 dark:bg-zinc-900/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedDoc.title}</div>
                    <div className="font-mono text-[11px] text-zinc-500">
                      {selectedDoc.id} (v{selectedDoc.version}) · {selectedDoc.relativePath}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInstructionsSection('edit')}
                    className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Открыть в редакторе
                  </button>
                </div>
                <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {selectedDoc.content}
                </pre>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700 space-y-2">
                <p>Выберите утверждённый документ (approved) из каталога для чтения его содержимого.</p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {knowledgeDocuments
                    .filter((doc) => doc.status === 'approved')
                    .slice(0, 4)
                    .map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => void openKnowledgeDocument(doc.id, 'view')}
                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        {doc.title}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 3. Редактирование инструкций общего агента и схемы поведения */}
        {activeTab === 'edit' && (
          <div className="space-y-5">
            <section className="space-y-3 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Редактирование инструкций и схемы поведения General Agent
                  </h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Активный регламент рабочего поведения, применяемый на сервере и в контексте агента.
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
                    rows={8}
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
                    rows={8}
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

            {selectedDoc && (
              <section className="space-y-3 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Черновик на базе регламента: {selectedDoc.title}
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Канонический файл {selectedDoc.relativePath} защищён контролем версий; здесь можно адаптировать текст и вставить в инструкции.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      updateGeneralAgentConfig({ instructions: localDocDraft });
                      setAgentSaveStatus('Текст перенесён в инструкции общего агента. Нажмите «Сохранить инструкции».');
                    }}
                    className="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Применить в инструкции
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={localDocDraft}
                  onChange={(e) => setLocalDocDraft(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-900"
                />
              </section>
            )}
          </div>
        )}

        {/* 4. JSON-схемы контрактов */}
        {activeTab === 'schemas' && (
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
          </div>
        </div>
      </PageContent>
    </AIResourcePageLayout>
  );
};

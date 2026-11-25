import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Boxes,
  GitBranch,
  Loader2,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { apiFetch } from '../../utils/apiFetch';

type ToolSubagentAccess = {
  roleKey: string;
  title: string;
  knowledgeDocId: string;
  capability: string;
  accessMode: 'read-only' | 'proposal-only' | 'orchestration';
  readOnly: boolean;
  modelTier: 'lightweight' | 'standard' | 'strong';
};

type ToolDocumentBinding = {
  docId?: string;
  title: string;
  path: string;
  section: string;
  status: string;
  verifiedOnDisk: boolean;
};

type ToolEntityBinding = {
  entityType: 'Module' | 'Contract' | 'Schema' | 'Endpoint' | 'Policy' | 'Gate' | 'Store';
  name: string;
  path: string;
  note: string;
};

type ToolInteractionSchema = {
  operationId: string;
  protocol: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  effects: string[];
  authorizationAndGuardrails: string[];
  confirmationPolicy: string;
  flowSteps: string[];
  documentBindings: ToolDocumentBinding[];
  entityBindings: ToolEntityBinding[];
};

type AgentToolEntry = {
  toolId: string;
  capabilityKey: string | null;
  title: string;
  subtitle: string;
  category: 'filesystem' | 'mutation' | 'execution' | 'knowledge-orchestration' | 'web-external';
  enforcementStatus: 'runtime-enforced' | 'approval-required' | 'orchestration-enforced';
  projectPermissionGate: string | null;
  generalAgentAccess: {
    allowed: boolean;
    modeConstraint: string;
    mechanism: string;
  };
  subagentAccess: ToolSubagentAccess[];
  subagentAccessNote: string;
  isSysSingleSubagent: boolean;
  sysDelegatedFrom: string | null;
  sysReason: string | null;
  interactionSchema: ToolInteractionSchema;
};

type ToolsRegistryResponse = {
  ok?: boolean;
  tools?: AgentToolEntry[];
  summary?: {
    totalTools: number;
    sysSingleSubagentCount: number;
    subagentEnabledCount: number;
    generalAgentDirectCount: number;
    verifiedDocumentsCount: number;
  };
  error?: string;
};

type FilterMode =
  | 'all'
  | 'sys'
  | 'subagents'
  | 'filesystem'
  | 'mutation'
  | 'execution'
  | 'knowledge-orchestration'
  | 'web-external';

const CATEGORY_LABELS: Record<AgentToolEntry['category'], string> = {
  filesystem: 'Файлы и код',
  mutation: 'Изменение файлов',
  execution: 'Терминал и хуки',
  'knowledge-orchestration': 'Знания и оркестрация',
  'web-external': 'Веб и протоколы',
};

const ENFORCEMENT_LABELS: Record<AgentToolEntry['enforcementStatus'], string> = {
  'runtime-enforced': 'Runtime Guard',
  'approval-required': 'Требует подтверждения',
  'orchestration-enforced': 'Контракт оркестрации',
};

const ACCESS_MODE_LABELS: Record<ToolSubagentAccess['accessMode'], string> = {
  'read-only': 'чтение',
  'proposal-only': 'предложение',
  orchestration: 'оркестрация',
};

export const AgentToolsRegistryPage: React.FC = () => {
  const [tools, setTools] = useState<AgentToolEntry[]>([]);
  const [summary, setSummary] = useState<ToolsRegistryResponse['summary'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadRegistry = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiFetch('/api/tools/registry', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const data = (await response.json()) as ToolsRegistryResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.tools)) {
          throw new Error(data.error || `Не удалось загрузить реестр инструментов (HTTP ${response.status}).`);
        }
        setTools(data.tools);
        setSummary(data.summary ?? null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить реестр инструментов.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadRegistry();
    return () => controller.abort();
  }, []);

  const filteredTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tools.filter((tool) => {
      if (filterMode === 'sys' && !tool.isSysSingleSubagent) return false;
      if (filterMode === 'subagents' && tool.subagentAccess.length === 0) return false;
      if (
        (filterMode === 'filesystem' ||
          filterMode === 'mutation' ||
          filterMode === 'execution' ||
          filterMode === 'knowledge-orchestration' ||
          filterMode === 'web-external') &&
        tool.category !== filterMode
      ) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        tool.toolId,
        tool.capabilityKey ?? '',
        tool.title,
        tool.subtitle,
        tool.projectPermissionGate ?? '',
        tool.isSysSingleSubagent ? 'sys системный субагент' : '',
        tool.subagentAccess.map((s) => `${s.roleKey} ${s.title} ${s.knowledgeDocId}`).join(' '),
        tool.interactionSchema.operationId,
        tool.interactionSchema.documentBindings.map((d) => `${d.docId ?? ''} ${d.title} ${d.path}`).join(' '),
        tool.interactionSchema.entityBindings.map((e) => `${e.name} ${e.path}`).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [tools, searchQuery, filterMode]);

  const filterButtons: Array<{ id: FilterMode; label: string }> = [
    { id: 'all', label: `Все (${tools.length})` },
    { id: 'sys', label: `(SYS) 1 субагент (${tools.filter((t) => t.isSysSingleSubagent).length})` },
    { id: 'subagents', label: `Субагенты (${tools.filter((t) => t.subagentAccess.length > 0).length})` },
    { id: 'filesystem', label: 'Файлы и код' },
    { id: 'mutation', label: 'Изменение' },
    { id: 'execution', label: 'Терминал и хуки' },
    { id: 'knowledge-orchestration', label: 'Знания и оркестрация' },
    { id: 'web-external', label: 'Веб и протоколы' },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <Wrench className="h-4 w-4 text-blue-500" />
            Инструменты агента
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Реестр всех инструментов системы для General Agent и субагентов на основе runtime-контрактов ролей (
            <code className="font-mono">ROLE_CONTRACTS</code>) и утверждённых регламентов. Индикатор{' '}
            <code className="rounded bg-violet-500/10 px-1 py-0.5 font-mono text-[10px] font-semibold text-violet-700 dark:text-violet-300">
              (SYS)
            </code>{' '}
            отмечает инструменты, доступные только одному системному субагенту, принимающему задачу от общего агента или другого субагента.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {loading ? (
            <span>Загрузка…</span>
          ) : (
            <>
              <span>Инструментов: {summary?.totalTools ?? tools.length}</span>
              <span>·</span>
              <span>(SYS): {summary?.sysSingleSubagentCount ?? tools.filter((t) => t.isSysSingleSubagent).length}</span>
              <span>·</span>
              <span>Документов: {summary?.verifiedDocumentsCount ?? 0}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по инструментам, ролям субагентов, документам и сущностям…"
            aria-label="Поиск по реестру инструментов агента"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilterMode(btn.id)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
                filterMode === btn.id
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-400 dark:hover:bg-zinc-900',
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка реестра инструментов и схем взаимодействия…
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && filteredTools.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          По заданному фильтру или запросу инструменты не найдены.
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filteredTools.map((tool) => {
            const primaryDoc = tool.interactionSchema.documentBindings[0];
            const allDocsVerified = tool.interactionSchema.documentBindings.every((d) => d.verifiedOnDisk);

            return (
              <article
                key={tool.toolId}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tool.title}</h3>
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {tool.toolId}
                      </span>
                      {tool.capabilityKey && tool.capabilityKey !== tool.toolId && (
                        <span className="rounded-md border border-zinc-200 px-2 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          cap:{tool.capabilityKey}
                        </span>
                      )}
                      {tool.isSysSingleSubagent && (
                        <span
                          title={tool.sysReason ?? 'Инструмент используется только 1 субагентом'}
                          className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-700 dark:text-violet-300"
                        >
                          (SYS)
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{tool.subtitle}</p>
                  </div>

                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium shrink-0',
                      tool.enforcementStatus === 'approval-required'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : tool.enforcementStatus === 'orchestration-enforced'
                          ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                    )}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {ENFORCEMENT_LABELS[tool.enforcementStatus]}
                  </span>
                </div>

                {/* Metadata row */}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {CATEGORY_LABELS[tool.category]}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    General Agent: {tool.generalAgentAccess.allowed ? 'доступен' : 'через делегирование'} ({tool.generalAgentAccess.modeConstraint})
                  </span>
                  {tool.projectPermissionGate && (
                    <code className="rounded border border-zinc-200 px-2 py-1 font-mono text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                      gate:{tool.projectPermissionGate}
                    </code>
                  )}
                  {tool.interactionSchema.effects.map((effect) => (
                    <code
                      key={effect}
                      className="rounded border border-zinc-200 px-2 py-1 font-mono text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                    >
                      {effect}
                    </code>
                  ))}
                </div>

                {/* Subagent access mapping */}
                <div className="mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                      <GitBranch className="h-3.5 w-3.5 text-blue-500" />
                      Доступ субагентов
                      <span className="font-mono text-[10px] text-zinc-500">
                        ({tool.subagentAccess.length})
                      </span>
                    </span>
                    {tool.isSysSingleSubagent && tool.sysDelegatedFrom && (
                      <span className="text-[10px] font-medium text-violet-700 dark:text-violet-300">
                        (SYS) Принимает задачу от: {tool.sysDelegatedFrom}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{tool.subagentAccessNote}</p>

                  {tool.subagentAccess.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tool.subagentAccess.map((role) => (
                        <span
                          key={role.roleKey}
                          title={`Документ: ${role.knowledgeDocId} · capability: ${role.capability}`}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]',
                            tool.isSysSingleSubagent
                              ? 'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200'
                              : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300',
                          )}
                        >
                          <span className="font-semibold">{role.title}</span>
                          <code className="font-mono text-zinc-500 dark:text-zinc-400">{role.roleKey}</code>
                          <span className="text-zinc-400">·</span>
                          <span>{ACCESS_MODE_LABELS[role.accessMode]}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                      subagentAccess: [] (роль-контракты не выдают это capability воркерам)
                    </div>
                  )}
                </div>

                {/* Documents, entities & expandable interaction schema */}
                <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {primaryDoc
                          ? `${primaryDoc.title} · ${primaryDoc.path}`
                          : 'Документы не привязаны'}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-2">
                      <span>Документов: {tool.interactionSchema.documentBindings.length}</span>
                      <span>·</span>
                      <span>Сущностей: {tool.interactionSchema.entityBindings.length}</span>
                      <span>·</span>
                      <span className={allDocsVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {allDocsVerified ? 'привязки проверены' : 'есть неподтверждённые пути'}
                      </span>
                    </span>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer select-none text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
                      Схема взаимодействия, привязки к документам и сущностям
                    </summary>

                    <div className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3.5 text-xs dark:bg-zinc-900/60">
                      {/* Protocol & confirmation summary */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950/70">
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Operation ID и протокол</div>
                          <div className="mt-1 font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                            {tool.interactionSchema.operationId}
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                            {tool.interactionSchema.protocol}
                          </div>
                        </div>
                        <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950/70">
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Подтверждение и механизм вызова</div>
                          <div className="mt-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                            {tool.interactionSchema.confirmationPolicy}
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                            {tool.generalAgentAccess.mechanism}
                          </div>
                        </div>
                      </div>

                      {/* Flow steps */}
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                          Поток взаимодействия (Control Layer / Execution)
                        </div>
                        <ol className="mt-1.5 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                          {tool.interactionSchema.flowSteps.map((step) => (
                            <li key={step} className="rounded bg-white px-2.5 py-1.5 border border-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-950/60">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Input / Output schemas */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950/70">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Input Schema</div>
                          <dl className="mt-1.5 space-y-1 font-mono text-[10.5px]">
                            {Object.entries(tool.interactionSchema.inputSchema).map(([field, desc]) => (
                              <div key={field} className="flex flex-col">
                                <dt className="font-semibold text-zinc-800 dark:text-zinc-200">{field}</dt>
                                <dd className="text-zinc-500 dark:text-zinc-400">{desc}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                        <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950/70">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Output Schema</div>
                          <dl className="mt-1.5 space-y-1 font-mono text-[10.5px]">
                            {Object.entries(tool.interactionSchema.outputSchema).map(([field, desc]) => (
                              <div key={field} className="flex flex-col">
                                <dt className="font-semibold text-zinc-800 dark:text-zinc-200">{field}</dt>
                                <dd className="text-zinc-500 dark:text-zinc-400">{desc}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>

                      {/* Guardrails */}
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                          Авторизация и Guardrails
                        </div>
                        <ul className="mt-1 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-300 list-disc pl-4">
                          {tool.interactionSchema.authorizationAndGuardrails.map((rule) => (
                            <li key={rule}>{rule}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Document Bindings */}
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                          <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                          Привязка к документам системы
                        </div>
                        <div className="mt-1.5 space-y-1.5">
                          {tool.interactionSchema.documentBindings.map((doc) => (
                            <div
                              key={`${doc.path}:${doc.section}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950/70"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{doc.title}</span>
                                  {doc.docId && (
                                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                      {doc.docId}
                                    </code>
                                  )}
                                </div>
                                <div className="mt-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                                  {doc.path} · {doc.section}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0',
                                  doc.verifiedOnDisk
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                                )}
                              >
                                {doc.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Entity Bindings */}
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                          <Boxes className="h-3.5 w-3.5 text-blue-500" />
                          Привязка к сущностям кода и контрактам
                        </div>
                        <div className="mt-1.5 space-y-1.5">
                          {tool.interactionSchema.entityBindings.map((entity) => (
                            <div
                              key={`${entity.entityType}:${entity.name}:${entity.path}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950/70"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                    {entity.entityType}
                                  </span>
                                  <code className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                    {entity.name}
                                  </code>
                                </div>
                                <div className="mt-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
                                  {entity.note}
                                </div>
                              </div>
                              <code className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">
                                {entity.path}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

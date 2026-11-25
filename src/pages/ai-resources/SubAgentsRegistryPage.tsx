import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Loader2, Search, ShieldCheck, Users } from 'lucide-react';
import { MarkdownLite } from '../../components/agent/MarkdownLite';

type KnowledgeDocument = {
  id: string;
  version: string;
  status: 'approved' | 'draft' | 'review' | 'deprecated';
  relativePath: string;
  title: string;
  content: string | null;
};

type BuiltInRole = {
  roleKey: string;
  knowledgeDocId: string;
  uiRoleId: string;
  title: string;
  readOnly: boolean;
  modelTier: 'lightweight' | 'standard' | 'strong';
  allowedCapabilities: string[];
  runtimeKind: 'primary-agent' | 'orchestration' | 'specialist';
  knowledgeDocument: KnowledgeDocument | null;
};

type RegistryResponse = {
  ok?: boolean;
  roles?: BuiltInRole[];
  error?: string;
};

const RUNTIME_KIND_LABELS: Record<BuiltInRole['runtimeKind'], string> = {
  'primary-agent': 'Контракт основного агента',
  orchestration: 'Оркестрация команды',
  specialist: 'Специалист команды',
};

const MODEL_TIER_LABELS: Record<BuiltInRole['modelTier'], string> = {
  lightweight: 'Лёгкая',
  standard: 'Стандартная',
  strong: 'Сильная',
};

function getDocumentBody(content: string): string {
  return content
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/^# .+\r?\n/, '')
    .replace(/^## /gm, '### ')
    .trim();
}

export const SubAgentsRegistryPage: React.FC = () => {
  const [roles, setRoles] = useState<BuiltInRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadRegistry = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/agents/registry', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const data = (await response.json()) as RegistryResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.roles)) {
          throw new Error(data.error || `Не удалось загрузить реестр (HTTP ${response.status}).`);
        }
        setRoles(data.roles);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить реестр субагентов.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadRegistry();
    return () => controller.abort();
  }, []);

  const filteredRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) =>
      [
        role.roleKey,
        role.title,
        role.knowledgeDocId,
        role.allowedCapabilities.join(' '),
        role.knowledgeDocument?.title ?? '',
        role.knowledgeDocument?.content ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [roles, searchQuery]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <Users className="h-4 w-4 text-blue-500" />
            Реестр встроенных ролей
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Реестр формируется из runtime-контрактов сервера и связанных утверждённых документов знаний.
            Роль описывает ответственность исполнителя и не означает отдельный постоянно работающий процесс.
          </p>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {loading ? 'Загрузка…' : `Контрактов: ${roles.length}`}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск по ролям, документам и возможностям…"
          aria-label="Поиск по реестру субагентов"
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-500"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка runtime-контрактов и документов…
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && filteredRoles.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          По заданному запросу роли не найдены.
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filteredRoles.map((role) => {
            const document = role.knowledgeDocument;
            const approved = document?.status === 'approved' && Boolean(document.content);

            return (
              <article key={role.roleKey} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{role.title}</h3>
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {role.roleKey}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {RUNTIME_KIND_LABELS[role.runtimeKind]}
                    </p>
                  </div>
                  <span className={approved
                    ? 'inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300'
                    : 'inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300'}>
                    <ShieldCheck className="h-3 w-3" />
                    {approved ? `Инструкция v${document?.version}` : 'Инструкция не утверждена'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    Модель: {MODEL_TIER_LABELS[role.modelTier]}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {role.readOnly ? 'Только чтение' : 'Разрешения на предложения записи'}
                  </span>
                  {role.allowedCapabilities.map((capability) => (
                    <code key={capability} className="rounded border border-zinc-200 px-2 py-1 font-mono text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      {capability}
                    </code>
                  ))}
                </div>

                <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  {document ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{document.title} · {document.relativePath}</span>
                      </span>
                      <span className="shrink-0">Статус: {document.status}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Связанный документ знаний не найден: {role.knowledgeDocId}
                    </p>
                  )}

                  {approved ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer select-none text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
                        Ответственность, правила и ограничения
                      </summary>
                      <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
                        <MarkdownLite content={getDocumentBody(document.content as string)} />
                      </div>
                    </details>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Содержимое документа скрыто: runtime использует только утверждённые документы знаний.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

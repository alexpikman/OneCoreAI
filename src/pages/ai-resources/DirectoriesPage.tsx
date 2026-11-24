import { useCallback, useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import {
  BookOpen,
  ClipboardList,
  Database,
  ExternalLink,
  Hash,
  RefreshCw,
  Save,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { DirectoriesSectionId } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { requestDeleteWarning } from '../../utils/deleteWarning';

type ReferenceStatus = 'unreviewed' | 'reviewed' | 'archived';
type ReferenceSourceType = 'repository' | 'documentation' | 'article' | 'video' | 'diagram' | 'other';

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

interface ReferenceTableRow {
  code: string;
  title: string;
  scope: string;
  notes: string;
}

const REFERENCE_TABLES: Array<{
  id: string;
  title: string;
  subtitle: string;
  columns: [string, string, string, string];
  rows: ReferenceTableRow[];
}> = [
  {
    id: 'roles-contracts',
    title: 'Роли оркестрации и уровни моделей',
    subtitle: 'Каноническое сопоставление ролей, режимов работы и требований к контексту.',
    columns: ['Роль', 'Режим', 'Класс модели', 'Зона ответственности'],
    rows: [
      { code: 'General Agent', title: 'PLAN / ACT', scope: 'standard', notes: 'Базовый универсальный агент при отключённых ролях' },
      { code: 'Manager', title: 'PLAN', scope: 'strong', notes: 'Постановка задачи, ограничение циклов, reconciliation результата' },
      { code: 'Dispatcher', title: 'PLAN', scope: 'lightweight', notes: 'Маршрутизация task-handoff и выбор специалистов' },
      { code: 'Researcher', title: 'PLAN (read-only)', scope: 'lightweight', notes: 'Поиск источников, инспекция файлов и фактов без правки кода' },
      { code: 'Analyst / Architect', title: 'PLAN', scope: 'strong', notes: 'Декомпозиция требований, проектирование модулей и схем' },
      { code: 'Coder / Developer', title: 'ACT', scope: 'standard', notes: 'Внесение правок через diff-патчи с проверкой Guardrails' },
      { code: 'Tester / QA', title: 'ACT (checks)', scope: 'standard', notes: 'Запуск тестовых прогонов, линтинга и верификация контракта v1' },
    ],
  },
  {
    id: 'permission-policies',
    title: 'Матрица политик разрешений (Agent Core)',
    subtitle: 'Три уровня контроля операций перед выполнением инструментом.',
    columns: ['Политика', 'Ключ', 'Поведение', 'Применение'],
    rows: [
      { code: 'Авто', title: 'allow', scope: 'Без паузы', notes: 'Безопасные read-only и явно разрешённые действия' },
      { code: 'Запрос', title: 'ask', scope: 'Подтверждение', notes: 'Требует ручного подтверждения перед записью или терминалом' },
      { code: 'Запрет', title: 'deny', scope: 'Блокировка', notes: 'Жёсткий отказ на уровне Runtime Guard (удаление, внешние команды)' },
    ],
  },
  {
    id: 'gguf-quant-scale',
    title: 'Справочная шкала квантизации GGUF',
    subtitle: 'Ориентиры потребления VRAM и точности вывода для локального llama-server.',
    columns: ['Квантование', 'Бит/вес', 'Точность', 'Рекомендация'],
    rows: [
      { code: 'IQ4_XS', title: '~4.25 bpw', scope: 'Базовая', notes: 'Минимальный объём VRAM; подходит для 4–6 GB GPU' },
      { code: 'Q4_K_M', title: '~4.85 bpw', scope: 'Сбалансированная', notes: 'Стандарт по умолчанию для кода и рассуждений' },
      { code: 'Q5_K_M', title: '~5.68 bpw', scope: 'Высокая', notes: 'Меньше деградации на сложных длинных промптах' },
      { code: 'Q8_0', title: '8.50 bpw', scope: 'Эталонная', notes: 'Максимальная точность локального квантования при запасе VRAM' },
    ],
  },
];

interface TermEntry {
  term: string;
  category: string;
  definition: string;
  source: string;
}

const DIRECTORY_TERMS: TermEntry[] = [
  {
    term: 'General Agent',
    category: 'Архитектура',
    definition: 'Универсальный контур агента с отдельными инструкциями, схемой поведения и системным промптом, активный по умолчанию или когда узкие роли не включены.',
    source: 'AgentTeamPage / GeneralAgentConfig',
  },
  {
    term: 'Agent Handoff v1',
    category: 'Контракт',
    definition: 'Типизированный JSON-контракт передачи поручения от Manager/Dispatcher конкретному специалисту с критериями приёмки и списком разрешённых возможностей.',
    source: 'agent-handoff.v1.schema.json',
  },
  {
    term: 'Worker Result v1',
    category: 'Контракт',
    definition: 'Стандартизованный отчёт специалиста со списком проверенных файлов, выполненными командами, найденными замечаниями (findings) и открытыми вопросами.',
    source: 'worker-result.v1.schema.json',
  },
  {
    term: 'PLAN / ACT режимы',
    category: 'Исполнение',
    definition: 'PLAN ограничивает агента анализом, проектированием и чтением; ACT разрешает модификацию файлов и запуск команд с учётом политик.',
    source: 'Runtime Guard / AgentMode',
  },
  {
    term: 'Directives (Системные указания)',
    category: 'Поведение',
    definition: 'Модульные правила по категориям (Качество кода, Архитектура, Безопасность, Стиль ответа), добавляемые в системный промпт активной роли.',
    source: 'ModelDirective',
  },
  {
    term: 'SKILL.md (agentskills.io)',
    category: 'Навыки',
    definition: 'Переносимый Markdown-документ с YAML frontmatter (name, trigger, version, trust), описывающий повторяемую методику решения задачи.',
    source: 'Skill Registry',
  },
  {
    term: 'Execution Environment',
    category: 'Изоляция',
    definition: 'Среда исполнения терминальных команд агента: локальная оболочка ОС, удалённый SSH-хост из ~/.ssh/config или изолированный Docker-контейнер.',
    source: 'ExecutionEnvConfig',
  },
  {
    term: 'Manager Reconciliation',
    category: 'Контроль',
    definition: 'Финальная сверка результатов всех субагентов с критериями приёмки, проверками терминала и открытыми вопросами перед закрытием задачи.',
    source: 'team-execution v1.0.0',
  },
];

interface ConstantEntry {
  key: string;
  value: string;
  unit: string;
  description: string;
}

const PROJECT_CONSTANTS: ConstantEntry[] = [
  { key: 'DEV_SERVER_PORT', value: '3000', unit: 'TCP', description: 'Порт HTTP-сервера Express + Vite / production bundle' },
  { key: 'DEFAULT_LLAMA_SERVER_URL', value: 'http://127.0.0.1:8080/v1', unit: 'URL', description: 'Локальный OpenAI-compatible endpoint для llama-server' },
  { key: 'DEFAULT_OLLAMA_URL', value: 'http://127.0.0.1:11434', unit: 'URL', description: 'Стандартный адрес локального демона Ollama' },
  { key: 'AGENT_HANDOFF_SCHEMA_VERSION', value: '1', unit: 'semver major', description: 'Версия схемы контракта передачи задач (agent-handoff.v1)' },
  { key: 'WORKER_RESULT_SCHEMA_VERSION', value: '1', unit: 'semver major', description: 'Версия схемы отчёта воркера (worker-result.v1)' },
  { key: 'TEAM_MAX_CYCLES_LIMIT', value: '1 – 4', unit: 'cycles', description: 'Ограниченный диапазон итераций командной оркестрации' },
  { key: 'SUBAGENT_MAX_PARALLEL', value: '32', unit: 'workers', description: 'Верхний предел параллельных воркеров в настройках субагентов' },
  { key: 'HOOK_TIMEOUT_RANGE_MS', value: '1 000 – 60 000', unit: 'ms', description: 'Допустимый таймаут выполнения серверных lifecycle hooks' },
  { key: 'CANONICAL_KNOWLEDGE_DIR', value: 'docs/knowledge/', unit: 'path', description: 'Каталог версионируемых регламентов и JSON-схем' },
  { key: 'INTELLIGENCE_ARCH_DIR', value: 'docs/intelligence-architecture/', unit: 'path', description: 'Каталог архитектурных спецификаций General Agent' },
];

export const DirectoriesPage: FC = () => {
  const { directoriesSection, setDirectoriesSection } = useOneCoreStore();

  const [references, setReferences] = useState<ExternalReference[]>([]);
  const [draft, setDraft] = useState<ReferenceDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [termCategoryFilter, setTermCategoryFilter] = useState<string>('Все');

  const refreshReferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/external-references');
      const data = (await response.json()) as {
        ok?: boolean;
        references?: ExternalReference[];
        error?: string;
      };
      if (!response.ok || !data.ok || !Array.isArray(data.references)) {
        throw new Error(data.error || 'Не удалось загрузить внешние справочные материалы.');
      }
      setReferences(data.references);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить справочники.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshReferences();
  }, [refreshReferences]);

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
      const payload = {
        ...draft,
        tags: tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
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
      await refreshReferences();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить материал.');
    } finally {
      setSaving(false);
    }
  };

  const removeReference = async (id: string, title: string) => {
    const confirmed = await requestDeleteWarning({
      variant: 'simple',
      title: 'Удалить запись из справочника?',
      description: 'Внешний исследовательский материал будет удалён из локального каталога.',
      itemName: title,
    });
    if (!confirmed) return;
    try {
      const response = await apiFetch(`/api/external-references/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось удалить материал.');
      if (editingId === id) resetDraft();
      await refreshReferences();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить материал.');
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTables = useMemo(() => {
    if (!normalizedQuery) return REFERENCE_TABLES;
    return REFERENCE_TABLES.map((table) => ({
      ...table,
      rows: table.rows.filter((row) =>
        [table.title, row.code, row.title, row.scope, row.notes].join(' ').toLowerCase().includes(normalizedQuery),
      ),
    })).filter((table) => table.rows.length > 0);
  }, [normalizedQuery]);

  const termCategories = useMemo(
    () => ['Все', ...Array.from(new Set(DIRECTORY_TERMS.map((item) => item.category)))],
    [],
  );

  const filteredTerms = useMemo(
    () =>
      DIRECTORY_TERMS.filter((entry) => {
        if (termCategoryFilter !== 'Все' && entry.category !== termCategoryFilter) return false;
        if (!normalizedQuery) return true;
        return [entry.term, entry.category, entry.definition, entry.source].join(' ').toLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery, termCategoryFilter],
  );

  const filteredConstants = useMemo(
    () =>
      PROJECT_CONSTANTS.filter((entry) => {
        if (!normalizedQuery) return true;
        return [entry.key, entry.value, entry.unit, entry.description].join(' ').toLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery],
  );

  const filteredReferences = useMemo(
    () =>
      references.filter((reference) => {
        if (!normalizedQuery) return true;
        return [
          reference.title,
          reference.sourceTitle,
          reference.sourceUrl,
          reference.summary,
          reference.tags.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, references],
  );

  return (
    <AIResourcePageLayout>
      <PageHeader
        showSave={false}
        actions={[
          {
            id: 'refresh-directories',
            label: 'Обновить',
            icon: <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />,
            onClick: () => void refreshReferences(),
            disabled: loading,
            variant: 'secondary',
          },
        ]}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Справочники</h1>
        </div>
      </PageHeader>
      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Разделы справочников"
            items={[
              { id: 'data', label: 'Таблицы и списки', icon: <Table2 className="h-3.5 w-3.5" /> },
              { id: 'terms', label: 'Термины и определения', icon: <BookOpen className="h-3.5 w-3.5" /> },
              { id: 'constants', label: 'Константы проекта', icon: <Hash className="h-3.5 w-3.5" /> },
              { id: 'search', label: 'Поиск по справочникам', icon: <Search className="h-3.5 w-3.5" /> },
            ]}
            selectedId={directoriesSection}
            onSelect={(id) => setDirectoriesSection(id as DirectoriesSectionId)}
            footer={
              <div className="mt-2 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                <span>
                  Таблиц: <strong className="font-medium text-zinc-700 dark:text-zinc-200">{REFERENCE_TABLES.length}</strong>
                </span>
                <span>
                  Терминов: <strong className="font-medium text-zinc-700 dark:text-zinc-200">{DIRECTORY_TERMS.length}</strong>
                </span>
                <span>
                  Констант: <strong className="font-medium text-zinc-700 dark:text-zinc-200">{PROJECT_CONSTANTS.length}</strong>
                </span>
                <span>
                  Внешних записей: <strong className="font-medium text-zinc-700 dark:text-zinc-200">{references.length}</strong>
                </span>
              </div>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">

        {/* Shared Directory Search Bar */}
        <section className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#111114]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по таблицам, терминам, константам и внешним материалам…"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-8 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Очистить поиск"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <span className="text-xs text-zinc-500 tabular-nums">
              Найдено: {filteredTables.reduce((acc, t) => acc + t.rows.length, 0)} строк · {filteredTerms.length} терминов ·{' '}
              {filteredConstants.length} констант · {filteredReferences.length} материалов
            </span>
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        )}

        {/* TAB 1 (and unified view in search): Reference Tables + External References Catalog */}
        {(directoriesSection === 'data' || directoriesSection === 'search') && (
          <div className="space-y-5">
            {filteredTables.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                По вашему запросу строки в справочных таблицах не найдены.
              </div>
            ) : (
              filteredTables.map((table) => (
                <section
                  key={table.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Database className="h-4 w-4 text-blue-500" />
                        <span>{table.title}</span>
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{table.subtitle}</p>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{table.rows.length} поз.</span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400">
                        <tr>
                          {table.columns.map((col) => (
                            <th key={col} className="px-3 py-2 font-semibold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                        {table.rows.map((row) => (
                          <tr key={`${table.id}-${row.code}`} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                            <td className="px-3 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                              {row.code}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-blue-700 dark:text-blue-400 whitespace-nowrap tabular-nums">
                              {row.title}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                              {row.scope}
                            </td>
                            <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{row.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {/* TAB 2 (and unified view in search): Terms & Definitions */}
        {(directoriesSection === 'terms' || directoriesSection === 'search') && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Термины и определения</h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Глоссарий ключевых понятий архитектуры агентов, контрактов и локального runtime.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {termCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTermCategoryFilter(cat)}
                    className={
                      termCategoryFilter === cat
                        ? 'rounded-lg border border-blue-500/50 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300'
                        : 'rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {filteredTerms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Термины не найдены.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredTerms.map((item) => (
                  <article
                    key={item.term}
                    className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.term}</h3>
                      <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">{item.category}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{item.definition}</p>
                    <div className="font-mono text-[10px] text-zinc-400">{item.source}</div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3 (and unified view in search): Project Constants */}
        {(directoriesSection === 'constants' || directoriesSection === 'search') && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Константы проекта</h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Действующие лимиты оркестрации, порты, версии JSON-схем и канонические директории.
                </p>
              </div>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{filteredConstants.length} шт.</span>
            </div>

            {filteredConstants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Константы не найдены.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Ключ</th>
                      <th className="px-3 py-2 font-semibold">Значение</th>
                      <th className="px-3 py-2 font-semibold">Ед.</th>
                      <th className="px-3 py-2 font-semibold">Назначение</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {filteredConstants.map((constant) => (
                      <tr key={constant.key} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                        <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {constant.key}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                          {constant.value}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                          {constant.unit}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{constant.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* External References Directory ("КАК У ДРУГИХ") shown in Data & Search tabs */}
        {(directoriesSection === 'data' || directoriesSection === 'search') && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Справочник внешних систем (КАК У ДРУГИХ)
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Исследовательские источники. Не входят в утверждённые знания и не исполняются агентами напрямую.
                </p>
              </div>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                {filteredReferences.length} записей
              </span>
            </div>

            {directoriesSection === 'data' && (
              <form
                onSubmit={submitReference}
                className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {editingId ? 'Редактирование записи' : 'Добавить внешний материал'}
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
                    Источник
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
                    Заметки
                    <input
                      value={draft.notes}
                      onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Save className="h-3.5 w-3.5" />{' '}
                    {saving ? 'Сохранение…' : editingId ? 'Сохранить изменения' : 'Добавить в справочник'}
                  </button>
                </div>
              </form>
            )}

            {loading && references.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">Загрузка справочных записей…</div>
            ) : filteredReferences.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Внешних записей пока нет.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredReferences.map((reference) => (
                  <article
                    key={reference.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{reference.title}</h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                          <span>{SOURCE_LABELS[reference.sourceType]}</span>
                          <span>·</span>
                          <span>{STATUS_LABELS[reference.status]}</span>
                          <span>·</span>
                          <span className="tabular-nums">{reference.collectedAt.slice(0, 10)}</span>
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
                        {directoriesSection === 'data' && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                    {reference.summary && (
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{reference.summary}</p>
                    )}
                    {reference.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                        {reference.tags.map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          )}
          </div>
        </div>
      </PageContent>
    </AIResourcePageLayout>
  );
};

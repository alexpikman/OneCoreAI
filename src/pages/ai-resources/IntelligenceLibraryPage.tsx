import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  FileCode2,
  FolderGit2,
  GitBranch,
  Layers3,
  Network,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { IntelligenceSectionId } from '../../types/onecore';

const DOCUMENT_BASE_URL =
  'https://github.com/alexpikman/OneCoreAI/blob/main/docs/intelligence-architecture/';

const DOCUMENTS: Array<{
  id: Exclude<IntelligenceSectionId, 'all'>;
  group: string;
  items: Array<{
    title: string;
    description: string;
    path: string;
    url?: string;
    icon: React.ComponentType<{ className?: string }>;
    status: 'Draft' | 'Approved' | 'Canonical';
  }>;
}> = [
  {
    id: 'fundament',
    group: 'Фундамент',
    items: [
      {
        title: 'Ontology',
        description: 'Сущности General Agent, специализации, компетенции, роли, связи и архитектурные инварианты.',
        path: 'ontology.md',
        icon: GitBranch,
        status: 'Draft',
      },
      {
        title: 'Playbook Schema',
        description: 'Структура сценария, фаз, условий, переходов, outputs и бюджетов.',
        path: 'playbook-schema.md',
        icon: FileCode2,
        status: 'Draft',
      },
    ],
  },
  {
    id: 'execution',
    group: 'Механизмы исполнения',
    items: [
      {
        title: 'Execution Model',
        description: 'Preflight, Runtime Resolver, Execution Snapshot, Playbook Engine и Control Layer.',
        path: 'execution-model.md',
        icon: Workflow,
        status: 'Draft',
      },
      {
        title: 'Capability Contract',
        description: 'Операции Tool, эффекты, Authorization, Guardrails, Confirmation и enforcement.',
        path: 'capability-contract.md',
        icon: ShieldCheck,
        status: 'Draft',
      },
      {
        title: 'Decision Trace',
        description: 'Аудит решений, проверок политик, операций и фактических результатов.',
        path: 'decision-trace.md',
        icon: ClipboardCheck,
        status: 'Draft',
      },
    ],
  },
  {
    id: 'delegation',
    group: 'Субагенты и делегирование',
    items: [
      {
        title: 'Delegation Model',
        description: 'Manager, Dispatcher и workers; handoff, изоляция контекста и приёмка результатов.',
        path: 'delegation-model.md',
        icon: Network,
        status: 'Draft',
      },
    ],
  },
  {
    id: 'context',
    group: 'Контекст и каталог навыков',
    items: [
      {
        title: 'Skill Registry',
        description: 'Происхождение, версии, доверие, проверка и безопасное подключение внешних SKILL.md.',
        path: 'skill-registry.md',
        icon: BookOpen,
        status: 'Draft',
      },
      {
        title: 'Task Context Package',
        description: 'Сборка минимального контекста задачи из Skills, инструкций, ограничений и evidence.',
        path: 'task-context-package.md',
        icon: Layers3,
        status: 'Draft',
      },
    ],
  },
  {
    id: 'runtime',
    group: 'Runtime-контракты',
    items: [
      {
        title: 'Multi-agent Runtime',
        description: 'Утверждённая архитектура текущего оркестратора, Manager/Dispatcher и workers.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/architecture/multi-agent-runtime.md',
        icon: Network,
        status: 'Approved',
      },
      {
        title: 'Agent Handoff v1',
        description: 'Действующий контракт передачи поручения субагенту.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/protocols/task-handoff.md',
        icon: FileCode2,
        status: 'Approved',
      },
      {
        title: 'Worker Result v1',
        description: 'Действующий протокол возврата результата и evidence от worker.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/protocols/worker-result.md',
        icon: ClipboardCheck,
        status: 'Approved',
      },
      {
        title: 'agent-handoff.v1.schema.json',
        description: 'Рабочая JSON Schema входящего handoff. В этой ветке не меняется.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/schemas/agent-handoff.v1.schema.json',
        icon: ShieldCheck,
        status: 'Approved',
      },
      {
        title: 'worker-result.v1.schema.json',
        description: 'Рабочая JSON Schema результата worker. В этой ветке не меняется.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/schemas/worker-result.v1.schema.json',
        icon: ShieldCheck,
        status: 'Approved',
      },
    ],
  },
  {
    id: 'implementation',
    group: 'Сценарии и реализация',
    items: [
      {
        title: 'Code Audit',
        description: 'Первый вертикальный сценарий: анализ, тестирование и ревью в режиме read-only.',
        path: 'code-audit.md',
        icon: BookOpen,
        status: 'Draft',
      },
      {
        title: 'Implementation Roadmap',
        description: 'Аудит текущего кода, read-only прототип, Registry и контролируемое исполнение.',
        path: 'implementation-roadmap.md',
        icon: Workflow,
        status: 'Draft',
      },
    ],
  },
  {
    id: 'sources',
    group: 'Внешние источники',
    items: [
      {
        title: 'docs/intelligence-architecture/',
        description: 'Канонический каталог спецификаций General Agent (Ontology, Execution, Delegation, Registry).',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/tree/main/docs/intelligence-architecture',
        icon: FolderGit2,
        status: 'Canonical',
      },
      {
        title: 'docs/knowledge/',
        description: 'Регламенты ролей, процедуры и исполняемые документы Knowledge Catalog.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/tree/main/docs/knowledge',
        icon: FolderGit2,
        status: 'Canonical',
      },
      {
        title: 'docs/knowledge/schemas/',
        description: 'Канонические JSON Schema контрактов оркестрации v1.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/tree/main/docs/knowledge/schemas',
        icon: FileCode2,
        status: 'Canonical',
      },
      {
        title: 'docs/project/',
        description: 'Проектные спецификации, карты интеграций и заметки реализации репозитория.',
        path: '',
        url: 'https://github.com/alexpikman/OneCoreAI/tree/main/docs/project',
        icon: FolderGit2,
        status: 'Canonical',
      },
    ],
  },
];

export const IntelligenceLibraryPage = () => {
  const { intelligenceSection, setIntelligenceSection } = useOneCoreStore();

  const visibleSections =
    intelligenceSection === 'all'
      ? DOCUMENTS
      : DOCUMENTS.filter((section) => section.id === intelligenceSection);

  return (
    <AIResourcePageLayout>
      <PageHeader showSave={false}>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Intelligence Library</h1>
        </div>
      </PageHeader>
      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Разделы Intelligence Library"
            items={[
              { id: 'all', label: 'Все разделы' },
              { id: 'fundament', label: 'Фундамент' },
              { id: 'execution', label: 'Исполнение' },
              { id: 'delegation', label: 'Делегирование' },
              { id: 'context', label: 'Контекст' },
              { id: 'runtime', label: 'Runtime' },
              { id: 'implementation', label: 'Реализация' },
              { id: 'sources', label: 'Источники' },
            ]}
            selectedId={intelligenceSection}
            onSelect={(id) => setIntelligenceSection(id as IntelligenceSectionId)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">

        <section className="rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Библиотека архитектуры General Agent
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Канонические документы и контракты. Источник истины — файлы в репозитории; этот экран служит
                структурированным каталогом и навигацией.
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Проектирование · Draft / Approved
            </span>
          </div>
        </section>

        {visibleSections.map((section) => (
          <section key={section.id} id={`intel-group-${section.id}`} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {section.group}
              </h2>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">{section.items.length}</span>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {section.items.map((document) => {
                const Icon = document.icon;
                return (
                  <a
                    key={document.title}
                    href={document.url || DOCUMENT_BASE_URL + document.path}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex min-w-0 items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{document.title}</span>
                        <span
                          className={
                            document.status === 'Approved'
                              ? 'font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400'
                              : document.status === 'Canonical'
                                ? 'font-mono text-[10px] font-semibold text-blue-700 dark:text-blue-400'
                                : 'font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400'
                          }
                        >
                          {document.status}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {document.description}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-blue-500" />
                  </a>
                );
              })}
            </div>
          </section>
        ))}

        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Черновые спецификации пока не являются исполняемыми runtime-контрактами. Публикация и подключение к General
          Agent возможны только после ревью, утверждения схем и проверки реализации.
        </p>
          </div>
        </div>
      </PageContent>
    </AIResourcePageLayout>
  );
};

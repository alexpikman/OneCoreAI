import { BookOpen, FileCode2, GitBranch, ShieldCheck, Workflow, ClipboardCheck, ArrowUpRight, Layers3, Network } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';

const DOCUMENTS = [
  {
    group: 'Фундамент',
    items: [
      { title: 'Ontology v2', description: 'Сущности General Agent, специализации, компетенции, роли, связи и архитектурные инварианты.', path: 'ontology-v2.md', icon: GitBranch, status: 'Draft' },
      { title: 'Playbook Schema v1.1', description: 'Структура сценария, фаз, условий, переходов, outputs и бюджетов.', path: 'playbook-schema-v1.1.md', icon: FileCode2, status: 'Draft' },
    ],
  },
  {
    group: 'Механизмы исполнения',
    items: [
      { title: 'Execution Model v2', description: 'Preflight, Runtime Resolver, Execution Snapshot, Playbook Engine и Control Layer.', path: 'execution-model-v2.md', icon: Workflow, status: 'Draft' },
      { title: 'Capability Contract v1', description: 'Операции Tool, эффекты, Authorization, Guardrails, Confirmation и enforcement.', path: 'capability-contract-v1.md', icon: ShieldCheck, status: 'Draft' },
      { title: 'Decision Trace v1', description: 'Аудит решений, проверок политик, операций и фактических результатов.', path: 'decision-trace-v1.md', icon: ClipboardCheck, status: 'Draft' },
    ],
  },
  {
    group: 'Субагенты и делегирование',
    items: [
      { title: 'Delegation Model v1', description: 'Manager, Dispatcher и workers; handoff, изоляция контекста и приёмка результатов.', path: 'delegation-model-v1.md', icon: Network, status: 'Draft' },
    ],
  },
  {
    group: 'Контекст и каталог навыков',
    items: [
      { title: 'Skill Registry v1', description: 'Происхождение, версии, доверие, проверка и безопасное подключение внешних SKILL.md.', path: 'skill-registry-v1.md', icon: BookOpen, status: 'Draft' },
      { title: 'Task Context Package v1', description: 'Сборка минимального контекста задачи из Skills, инструкций, ограничений и evidence.', path: 'task-context-package-v1.md', icon: Layers3, status: 'Draft' },
    ],
  },
  {
    group: 'Действующие контракты runtime',
    items: [
      { title: 'Multi-agent Runtime', description: 'Утверждённая архитектура текущего оркестратора, Manager/Dispatcher и workers.', path: '', url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/architecture/multi-agent-runtime.md', icon: Network, status: 'Approved' },
      { title: 'Agent Handoff v1', description: 'Действующий контракт передачи поручения субагенту.', path: '', url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/protocols/task-handoff.md', icon: FileCode2, status: 'Approved' },
      { title: 'Worker Result v1', description: 'Действующий протокол возврата результата и evidence от worker.', path: '', url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/protocols/worker-result.md', icon: ClipboardCheck, status: 'Approved' },
      { title: 'agent-handoff.v1.schema.json', description: 'Рабочая JSON Schema входящего handoff. В этой ветке не меняется.', path: '', url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/schemas/agent-handoff.v1.schema.json', icon: ShieldCheck, status: 'Approved' },
      { title: 'worker-result.v1.schema.json', description: 'Рабочая JSON Schema результата worker. В этой ветке не меняется.', path: '', url: 'https://github.com/alexpikman/OneCoreAI/blob/main/docs/knowledge/schemas/worker-result.v1.schema.json', icon: ShieldCheck, status: 'Approved' },
    ],
  },
  {
    group: 'Сценарии и реализация',
    items: [
      { title: 'Code Audit v1', description: 'Первый вертикальный сценарий: анализ, тестирование и ревью в режиме read-only.', path: 'code-audit-v1.md', icon: BookOpen, status: 'Draft' },
      { title: 'Implementation Roadmap', description: 'Аудит текущего кода, read-only прототип, Registry и контролируемое исполнение.', path: 'implementation-roadmap.md', icon: Workflow, status: 'Draft' },
    ],
  },
] as const;

const DOCUMENT_BASE_URL =
  'https://github.com/alexpikman/OneCoreAI/blob/feat/agents-knowledge-reorganization/docs/intelligence-architecture/';

export const IntelligenceLibraryPage = () => (
  <AIResourcePageLayout>
    <PageHeader showSave={false} showSubNavigation={false}>
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-semibold">Intelligence Library</h1>
      </div>
    </PageHeader>
    <PageContent contentClassName="space-y-6 pb-6 pt-4">
      <section className="rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Библиотека архитектуры General Agent</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Канонические документы и контракты. Источник истины — файлы в репозитории; этот экран служит каталогом и навигацией.
            </p>
          </div>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Проектирование · Draft
          </span>
        </div>
      </section>

      {DOCUMENTS.map((section) => (
        <section key={section.group} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{section.group}</h2>
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
                      <span className={document.status === 'Approved' ? 'rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}>{document.status}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{document.description}</span>
                  </span>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-blue-500" />
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Документы пока не являются исполняемыми runtime-контрактами. Публикация и подключение к General Agent возможны только после ревью, утверждения схем и проверки реализации.
      </p>
    </PageContent>
  </AIResourcePageLayout>
);

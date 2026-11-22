import { BookOpen, FileCode2, GitBranch, ShieldCheck, Workflow, ClipboardCheck, ArrowUpRight } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';

const DOCUMENTS = [
  {
    group: 'Фундамент',
    items: [
      {
        title: 'Ontology v2',
        description: 'Сущности General Agent, специализации, компетенции, роли, связи и архитектурные инварианты.',
        path: 'ontology-v2.md',
        icon: GitBranch,
      },
      {
        title: 'Playbook Schema v1.1',
        description: 'Структура сценария, фаз, условий, переходов, outputs, бюджетов и правил выбора специализации.',
        path: 'playbook-schema-v1.1.md',
        icon: FileCode2,
      },
    ],
  },
  {
    group: 'Механизмы исполнения',
    items: [
      {
        title: 'Execution Model v2',
        description: 'Preflight, Runtime Resolver, Execution Snapshot, Playbook Engine и Control Layer.',
        path: 'execution-model-v2.md',
        icon: Workflow,
      },
      {
        title: 'Capability Contract v1',
        description: 'Операции Tool, аргументы, эффекты, Authorization, Guardrails, Confirmation и enforcement.',
        path: 'capability-contract-v1.md',
        icon: ShieldCheck,
      },
      {
        title: 'Decision Trace v1',
        description: 'Формат аудита решений, альтернатив, проверок политик, операций и фактических результатов.',
        path: 'decision-trace-v1.md',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    group: 'Сценарии и реализация',
    items: [
      {
        title: 'Code Audit v1',
        description: 'Первый вертикальный сценарий: анализ, тестирование и ревью в режиме read-only.',
        path: 'code-audit-v1.md',
        icon: BookOpen,
      },
      {
        title: 'Implementation Roadmap',
        description: 'Последовательность аудита текущего кода, read-only прототипа, Registry и контролируемого исполнения.',
        path: 'implementation-roadmap.md',
        icon: Workflow,
      },
    ],
  },
] as const;

const DOCUMENT_BASE_URL =
  'https://github.com/alexpikman/OneCoreAI/blob/feat/intelligence-library/docs/intelligence-architecture/';

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
                  key={document.path}
                  href={`${DOCUMENT_BASE_URL}${document.path}`}
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
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Draft</span>
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

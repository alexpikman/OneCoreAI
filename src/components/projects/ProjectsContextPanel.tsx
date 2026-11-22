import React, { useEffect, useState } from 'react';
import { FileText, History, ListTodo, Workflow } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentJournalEvent } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';

interface ProjectsContextPanelProps {
  onOpenPlan: () => void;
  onNavigate: (tab: 'tasks' | 'processes' | 'project-history', projectId: string) => void;
}

export const ProjectsContextPanel: React.FC<ProjectsContextPanelProps> = ({ onOpenPlan, onNavigate }) => {
  const { projects, activeProjectId, projectWorkspace, projectsWorkspaceLoading } = useOneCoreStore();
  const [events, setEvents] = useState<AgentJournalEvent[]>([]);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const project = projects.find((item) => item.id === activeProjectId) ?? null;

  useEffect(() => {
    let active = true;
    void apiFetch('/api/agent-journal')
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить процессы');
        const data = (await response.json()) as { ok?: boolean; events?: AgentJournalEvent[] };
        if (active && data.ok && Array.isArray(data.events)) setEvents(data.events);
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setHistoryCount(0);
      return;
    }
    let active = true;
    void apiFetch('/api/projects/' + encodeURIComponent(activeProjectId) + '/logs')
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить историю проекта');
        const data = (await response.json()) as { ok?: boolean; logs?: unknown[] };
        if (active && data.ok && Array.isArray(data.logs)) setHistoryCount(data.logs.length);
      })
      .catch(() => {
        if (active) setHistoryCount(null);
      });
    return () => {
      active = false;
    };
  }, [activeProjectId]);

  const actionCount = events.filter((event) => event.projectId === activeProjectId).length;

  if (!project) {
    return (
      <p className="py-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Выберите проект в центральном списке. Здесь появятся связанные задачи, план и процессы.
      </p>
    );
  }

  const cards: { title: string; description: string; count: string; icon: React.ComponentType<{ className?: string }>; action: () => void; disabled?: boolean }[] = [
    {
      title: 'Задачи',
      description: 'Все задачи проекта',
      count: projectsWorkspaceLoading ? '…' : String(projectWorkspace.tasks.length),
      icon: ListTodo,
      action: () => onNavigate('tasks', activeProjectId),
    },
    {
      title: 'План',
      description: projectsWorkspaceLoading ? 'Загрузка плана…' : projectWorkspace.plan ? 'План проекта · ' + projectWorkspace.plan.progress + '% выполнения' : 'План ещё не создан',
      count: projectsWorkspaceLoading ? '…' : projectWorkspace.plan ? '1' : '0',
      icon: FileText,
      action: onOpenPlan,
      disabled: projectsWorkspaceLoading,
    },
    {
      title: 'Действия',
      description: 'История процессов проекта',
      count: String(actionCount),
      icon: Workflow,
      action: () => onNavigate('processes', activeProjectId),
    },
    {
      title: 'История проекта',
      description: 'Файлы, команды, Git, задачи и план',
      count: historyCount === null ? '…' : String(historyCount),
      icon: History,
      action: () => onNavigate('project-history', activeProjectId),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">ВЫБРАННЫЙ ПРОЕКТ</p>
        <p className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{project.name}</p>
        <p className="mt-1 break-all text-[10px] text-zinc-500 dark:text-zinc-400">{project.folderPath}</p>
      </div>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.title}
            type="button"
            onClick={card.action}
            disabled={card.disabled}
            className="w-full rounded-xl border border-slate-200 bg-white/80 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/70 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                {card.title}
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{card.count}</span>
            </span>
            <span className="mt-1 block text-[10px] text-zinc-500 dark:text-zinc-400">{card.description}</span>
          </button>
        );
      })}
    </div>
  );
};

import React, { useState } from 'react';
import { Play, Square, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';

interface CommandExecutionRecord {
  id: string;
  operationId: string;
  projectId: string;
  projectName: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  durationMs?: number;
}

const PRESET_COMMANDS = ['git status', 'git log -n 5 --oneline', 'npm test', 'npm run lint'];

export const TerminalPage: React.FC = () => {
  const { projects, activeProjectId, selectProject, executionEnv } = useOneCoreStore();
  const [commandInput, setCommandInput] = useState('');
  const [runningOpId, setRunningOpId] = useState<string | null>(null);
  const [history, setHistory] = useState<CommandExecutionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;

  const handleRunCommand = async (cmdOverride?: string) => {
    const command = (cmdOverride ?? commandInput).trim();
    if (!command || !activeProject) return;

    const opId = `term-${Date.now().toString(36)}`;
    const recordId = opId;
    const startedMs = Date.now();
    const initialRecord: CommandExecutionRecord = {
      id: recordId,
      operationId: opId,
      projectId: activeProject.id,
      projectName: activeProject.name,
      command,
      stdout: '',
      stderr: '',
      exitCode: null,
      status: 'running',
      startedAt: new Date(startedMs).toISOString(),
    };

    setError(null);
    setRunningOpId(opId);
    setHistory((prev) => [initialRecord, ...prev]);

    try {
      const resp = await apiFetch(`/api/projects/${encodeURIComponent(activeProject.id)}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OneCore-Approval': 'user-confirmed',
          'X-OneCore-Operation-Id': opId,
        },
        body: JSON.stringify({ command, approved: true }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        error?: string;
      };
      const durationMs = Date.now() - startedMs;

      if (!resp.ok) {
        const errMsg = data.error || `HTTP ${resp.status}`;
        setError(errMsg);
        setHistory((prev) =>
          prev.map((item) =>
            item.id === recordId
              ? {
                  ...item,
                  stderr: data.stderr || errMsg,
                  exitCode: data.exitCode ?? 1,
                  status: 'failed',
                  durationMs,
                }
              : item,
          ),
        );
        return;
      }

      setHistory((prev) =>
        prev.map((item) =>
          item.id === recordId
            ? {
                ...item,
                stdout: data.stdout ?? '',
                stderr: data.stderr ?? '',
                exitCode: data.exitCode ?? 0,
                status: data.exitCode === 0 ? 'completed' : 'failed',
                durationMs,
              }
            : item,
        ),
      );
      if (!cmdOverride) setCommandInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка выполнения команды';
      setError(msg);
      setHistory((prev) =>
        prev.map((item) =>
          item.id === recordId
            ? { ...item, stderr: msg, exitCode: 1, status: 'failed', durationMs: Date.now() - startedMs }
            : item,
        ),
      );
    } finally {
      setRunningOpId(null);
    }
  };

  const handleCancelRunning = async () => {
    if (!runningOpId) return;
    try {
      await apiFetch(`/api/operations/${encodeURIComponent(runningOpId)}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OneCore-Approval': 'user-confirmed',
        },
        body: JSON.stringify({ approved: true }),
      });
    } catch {
      // Operation completion will update status.
    }
  };

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        actions={
          history.length > 0
            ? [
                {
                  id: 'clear-terminal',
                  label: 'Очистить вывод',
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  onClick: () => setHistory([]),
                  variant: 'secondary',
                },
              ]
            : []
        }
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <TerminalIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Терминал</h1>
        </div>
      </PageHeader>

      <PageContent contentClassName="space-y-4 py-5">
        <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <select
                value={activeProject?.id ?? ''}
                onChange={(event) => void selectProject(event.target.value)}
                aria-label="Целевой проект для терминала"
                className="h-9 min-w-[200px] rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {projects.length === 0 ? (
                  <option value="">Нет доступных проектов</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.folderSource})
                    </option>
                  ))
                )}
              </select>
              {activeProject && (
                <span className="truncate font-mono text-[11px] text-zinc-500">
                  {activeProject.folderPath} · среда: {executionEnv.activeEnv}
                </span>
              )}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleRunCommand();
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
              disabled={!activeProject || Boolean(runningOpId)}
              placeholder={
                activeProject
                  ? 'Введите команду (выполняется в папке активного проекта)…'
                  : 'Сначала создайте или выберите проект'
              }
              className="h-9 min-w-[240px] flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs text-zinc-900 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {runningOpId ? (
              <button
                type="button"
                onClick={() => void handleCancelRunning()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-500"
              >
                <Square className="h-3.5 w-3.5" />
                <span>Остановить</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!activeProject || !commandInput.trim()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Выполнить</span>
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_COMMANDS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={!activeProject || Boolean(runningOpId)}
                onClick={() => void handleRunCommand(preset)}
                className="h-7 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 font-mono text-[11px] text-zinc-700 hover:border-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                $ {preset}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-14 text-center text-xs text-zinc-500 dark:border-zinc-700">
            Выполненные команды и реальный вывод stdout/stderr появятся здесь.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 text-zinc-100 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2 font-mono">
                    <span className="text-emerald-400">$</span>
                    <span className="truncate font-semibold">{item.command}</span>
                    <span className="text-[11px] text-zinc-400">({item.projectName})</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] tabular-nums">
                    {typeof item.durationMs === 'number' && (
                      <span className="text-zinc-400">{item.durationMs} мс</span>
                    )}
                    <span
                      className={cn(
                        'font-mono font-semibold',
                        item.status === 'running'
                          ? 'text-blue-400'
                          : item.exitCode === 0
                            ? 'text-emerald-400'
                            : 'text-rose-400',
                      )}
                    >
                      {item.status === 'running' ? 'Выполняется…' : `exit ${item.exitCode}`}
                    </span>
                  </div>
                </div>
                <div className="p-4 font-mono text-xs leading-relaxed">
                  {item.stdout && <pre className="whitespace-pre-wrap break-words text-zinc-100">{item.stdout}</pre>}
                  {item.stderr && (
                    <pre className="mt-2 whitespace-pre-wrap break-words text-rose-300">{item.stderr}</pre>
                  )}
                  {!item.stdout && !item.stderr && item.status !== 'running' && (
                    <span className="text-zinc-500">Вывод отсутствует</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
};

import React, { useState } from 'react';
import { AlertTriangle, Bot, FileCode2, Loader2, Play, Shield, Terminal } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';

const SPECIALIST_ROLES = [
  { id: 'role-researcher', label: 'Researcher' },
  { id: 'role-analyst', label: 'Analyst' },
  { id: 'role-architect', label: 'Architect' },
  { id: 'role-coder', label: 'Coder' },
  { id: 'role-developer', label: 'Developer' },
  { id: 'role-tester', label: 'Tester' },
  { id: 'role-qa', label: 'QA' },
];

export const TeamExecutionPage: React.FC = () => {
  const {
    projects,
    activeProjectId,
    teamExecutionResult,
    teamExecutionRunning,
    teamExecutionError,
    runTeamExecution,
    clearTeamExecutionResult,
  } = useOneCoreStore();

  const [teamObjective, setTeamObjective] = useState('');
  const [teamMaxCycles, setTeamMaxCycles] = useState(2);
  const [selectedSpecialistRoles, setSelectedSpecialistRoles] = useState<string[]>([
    'role-researcher',
    'role-architect',
    'role-tester',
    'role-qa',
  ]);
  const [selectedTeamProjectId, setSelectedTeamProjectId] = useState<string>(activeProjectId || '');

  const toggleSpecialistRole = (roleId: string) => {
    setSelectedSpecialistRoles((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId],
    );
  };

  const handleRunTeamExecution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamObjective.trim()) return;
    await runTeamExecution({
      projectId: selectedTeamProjectId || activeProjectId || undefined,
      objective: teamObjective.trim(),
      requestedRoles: selectedSpecialistRoles,
      maxCycles: teamMaxCycles,
    });
  };

  return (
    <div className="space-y-5">
      {/* Командное выполнение */}
      <section
        id="agent-block-orchestration"
        className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
      >
        <div>
          <h2 className="font-display flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <Bot className="h-4 w-4 text-blue-500" />
            <span>Командное выполнение (Manager → Dispatcher → Specialists)</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Ограниченный цикл оркестрации по регламенту team-execution v1.0.0: контракты agent-handoff.v1 и
            worker-result.v1 проверяются перед завершением каждого шага.
          </p>
        </div>

        <form onSubmit={(e) => void handleRunTeamExecution(e)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className="mb-1 block text-[11px] text-zinc-500">Целевой проект</label>
              <select
                value={selectedTeamProjectId || activeProjectId || ''}
                onChange={(e) => setSelectedTeamProjectId(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {projects.length === 0 ? (
                  <option value="">Нет подключённых проектов</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.folderPath})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-[11px] text-zinc-500">Макс. циклов (1–4)</label>
              <input
                type="number"
                min={1}
                max={4}
                value={teamMaxCycles}
                onChange={(e) =>
                  setTeamMaxCycles(Math.max(1, Math.min(4, Number(e.target.value) || 1)))
                }
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs tabular-nums text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-end md:col-span-3">
              <button
                type="submit"
                disabled={teamExecutionRunning || !teamObjective.trim()}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
              >
                {teamExecutionRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                <span>{teamExecutionRunning ? 'Оркестрация…' : 'Запустить команду'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">Задача для команды агентов</label>
            <textarea
              rows={3}
              required
              value={teamObjective}
              onChange={(e) => setTeamObjective(e.target.value)}
              placeholder="Например: Провести аудит маршрутов API и контрактов валидации, выявить пробелы в проверках и предложить план исправления."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <div className="mb-1.5 text-[11px] text-zinc-500">Подключаемые роли специалистов</div>
            <div className="flex flex-wrap gap-2">
              {SPECIALIST_ROLES.map((spec) => {
                const active = selectedSpecialistRoles.includes(spec.id);
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => toggleSpecialistRole(spec.id)}
                    aria-pressed={active}
                    className={cn(
                      'h-8 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap',
                      active
                        ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                        : 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400',
                    )}
                  >
                    {spec.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {teamExecutionError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {teamExecutionError}
          </div>
        )}
      </section>

      {/* Отчёт о выполнении и контроль */}
      <section
        id="agent-block-control"
        className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Отчёт о выполнении и контроль</span>
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Статус оркестрации, уровень риска, циклы, валидация контрактов v1, проверки терминала, замечания и Manager Reconciliation.
            </p>
          </div>
          {teamExecutionResult && (
            <button
              type="button"
              onClick={clearTeamExecutionResult}
              className="h-8 rounded-lg border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              Очистить отчёт
            </button>
          )}
        </div>

        {!teamExecutionResult ? (
          <div className="space-y-1.5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
            <div className="font-medium text-zinc-700 dark:text-zinc-300">
              Отчёт контроля выполнения появится после запуска команды.
            </div>
            <div className="font-mono text-[11px] text-zinc-400 tabular-nums">
              Выбрано специалистов: {selectedSpecialistRoles.length} · Лимит циклов: {teamMaxCycles} · Контракты: agent-handoff.v1 / worker-result.v1
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 font-semibold',
                    teamExecutionResult.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  )}
                >
                  Статус: {teamExecutionResult.status}
                </span>
                <span className="font-mono text-zinc-500 tabular-nums">
                  Риск: {teamExecutionResult.riskLevel} · Циклы: {teamExecutionResult.cyclesExecuted}/
                  {teamExecutionResult.maxCycles} · Задач: {teamExecutionResult.tasks.length}
                </span>
              </div>
              <span className="font-mono text-[10px] text-zinc-400">{teamExecutionResult.operationId}</span>
            </div>

            <div className="space-y-2.5">
              {teamExecutionResult.tasks.map((task) => (
                <article
                  key={task.taskId}
                  className="space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-[10px] text-zinc-400 tabular-nums">
                        Цикл {task.cycle} · {task.taskId}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{task.roleTitle}</span>
                      <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {task.modelTier} · {task.modelName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span
                        className={
                          task.validationOk
                            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                            : 'font-semibold text-rose-600 dark:text-rose-400'
                        }
                      >
                        {task.validationOk ? 'Контракт v1 валиден' : 'Ошибка контракта'}
                      </span>
                      <span className="font-mono text-zinc-400 tabular-nums">{task.durationMs} мс</span>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {task.result.summary}
                  </p>

                  {task.validationErrors.length > 0 && (
                    <div className="rounded-lg border border-rose-300 bg-rose-50/80 p-2 text-[11px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                      {task.validationErrors.join('; ')}
                    </div>
                  )}

                  {task.result.filesInspected.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                      <FileCode2 className="h-3 w-3" />
                      {task.result.filesInspected.map((file) => (
                        <code
                          key={file}
                          className="rounded bg-zinc-200/60 px-1.5 py-0.5 font-mono dark:bg-zinc-800"
                        >
                          {file}
                        </code>
                      ))}
                    </div>
                  )}

                  {task.result.checks.length > 0 && (
                    <div className="space-y-1">
                      {task.result.checks.map((chk, idx) => (
                        <div
                          key={`${task.taskId}-chk-${idx}`}
                          className="flex items-center justify-between gap-2 rounded bg-zinc-950 px-2.5 py-1.5 font-mono text-[10px] text-zinc-200"
                        >
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <Terminal className="h-3 w-3 shrink-0 text-emerald-400" />
                            {chk.command}
                          </span>
                          <span
                            className={
                              chk.status === 'passed' ? 'shrink-0 text-emerald-400' : 'shrink-0 text-amber-400'
                            }
                          >
                            {chk.status} (exit {chk.exitCode ?? '—'})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {task.result.findings.length > 0 && (
                    <div className="space-y-1">
                      {task.result.findings.map((finding, idx) => (
                        <div
                          key={`${task.taskId}-f-${idx}`}
                          className="rounded border border-zinc-200 bg-white px-2.5 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <span className="font-mono text-[10px] uppercase text-amber-600 dark:text-amber-400">
                            [{finding.severity}]
                          </span>{' '}
                          <span className="text-zinc-800 dark:text-zinc-200">{finding.statement}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {teamExecutionResult.unresolvedQuestions.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Открытые вопросы:
                </div>
                <ul className="ml-5 list-disc space-y-0.5">
                  {teamExecutionResult.unresolvedQuestions.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Итоговый отчёт Manager Reconciliation
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {teamExecutionResult.finalReport}
              </pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

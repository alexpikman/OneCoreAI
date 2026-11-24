import React, { useState } from 'react';
import { ArrowDown, CheckCircle2, GitBranch, Play, RotateCcw, Sliders } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';

export const SubAgentsDelegationSection: React.FC = () => {
  const {
    roles,
    pipelineStages,
    pipelineProjectName,
    pipelineStack,
    pipelineRunning,
    setPipelineConfig,
    updateStageRole,
    runSinglePipelineStage,
    runFullPipeline,
    resetPipeline,
    setActiveRole,
    setActiveTab,
    sendPrompt,
  } = useOneCoreStore();

  const [selectedStageId, setSelectedStageId] = useState(pipelineStages[0].id);
  const selectedStage = pipelineStages.find((st) => st.id === selectedStageId) ?? pipelineStages[0];

  return (
    <section
      id="agent-block-pipeline"
      className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-[#111114]"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <GitBranch className="h-4 w-4 text-blue-500" />
            <span>Конфигурация пайплайна</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Проект, технологический стек, этапы пайплайна и назначение ролей по шагам.
          </p>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Целевой проект</label>
              <input
                type="text"
                value={pipelineProjectName}
                onChange={(e) => setPipelineConfig(e.target.value, pipelineStack)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Технологический стек</label>
              <input
                type="text"
                value={pipelineStack}
                onChange={(e) => setPipelineConfig(pipelineProjectName, e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={resetPipeline}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Сбросить</span>
          </button>
          <button
            type="button"
            disabled={pipelineRunning}
            onClick={runFullPipeline}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{pipelineRunning ? 'Выполняется пайплайн...' : 'Запустить пайплайн'}</span>
          </button>
        </div>
      </div>

      {/* Connected Nodes Graph */}
      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        {pipelineStages.map((stage, idx) => {
          const stageRole = roles.find((r) => r.id === stage.assignedRoleId) ?? roles[0];
          const isSelected = stage.id === selectedStageId;
          return (
            <React.Fragment key={stage.id}>
              <button
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
                className={cn(
                  'flex w-full flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-all sm:flex-row sm:items-center',
                  isSelected
                    ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/30'
                    : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                      0{stage.stepNumber}
                    </span>
                    <span
                      className={cn(
                        'text-[10.5px] font-medium',
                        stage.status === 'done'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : stage.status === 'error'
                            ? 'text-rose-600 dark:text-rose-400'
                            : stage.status === 'running'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-zinc-400',
                      )}
                    >
                      {stage.status === 'done'
                        ? 'Готово'
                        : stage.status === 'error'
                          ? 'Ошибка'
                          : stage.status === 'running'
                            ? 'В работе...'
                            : 'Ожидание'}
                    </span>
                  </div>
                  <div className="font-display mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {stage.title}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {stage.shortGoal}
                  </p>
                </div>

                <div className="shrink-0 border-t border-zinc-200/70 pt-2 text-[11px] sm:border-t-0 sm:pt-0 sm:text-right dark:border-zinc-800/80">
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    Роль: {stageRole.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-zinc-400">
                    {stage.outputArtifact}
                  </div>
                </div>
              </button>

              {idx < pipelineStages.length - 1 && (
                <div className="flex items-center justify-center py-0.5 text-zinc-400 dark:text-zinc-600">
                  <ArrowDown className="h-4 w-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage Inspector & Runner */}
      <div className="grid grid-cols-1 items-center gap-5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 lg:grid-cols-12 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="space-y-2 lg:col-span-7">
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
            <span className="tabular-nums">Этап 0{selectedStage.stepNumber}</span>
            <span>·</span>
            <span>Режим {selectedStage.mode.toUpperCase()}</span>
            <span>·</span>
            <span>Артефакт: {selectedStage.outputArtifact}</span>
          </div>
          <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {selectedStage.title}
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{selectedStage.shortGoal}</p>
          {selectedStage.resultNote && (
            <div
              className={cn(
                'mt-2 flex items-center gap-2 rounded-lg border p-2.5 text-xs',
                selectedStage.status === 'error'
                  ? 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
              )}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{selectedStage.resultNote}</span>
            </div>
          )}
        </div>

        <div className="space-y-3 lg:col-span-5">
          <div>
            <label className="mb-1 inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <Sliders className="h-3.5 w-3.5" />
              Назначенная роль модели для этого шага
            </label>
            <select
              value={selectedStage.assignedRoleId}
              onChange={(e) => updateStageRole(selectedStage.id, e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.defaultMode.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runSinglePipelineStage(selectedStage.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Выполнить этот шаг</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRole(selectedStage.assignedRoleId);
                setActiveTab('workstation');
                sendPrompt(
                  `Выполни этап «${selectedStage.title}» для проекта ${pipelineProjectName} (${pipelineStack}): ${selectedStage.shortGoal}`,
                );
              }}
              className="h-9 rounded-lg border border-zinc-200 px-3.5 text-xs font-medium text-zinc-700 hover:border-blue-500 dark:border-zinc-800 dark:text-zinc-200 whitespace-nowrap"
            >
              Открыть в чате агента
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

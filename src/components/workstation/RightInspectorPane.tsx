import React, { useEffect, useState } from 'react';
import { Activity, Bot, CheckCircle2, Cpu, Layers, Play, Power, RefreshCw, ShieldCheck, SlidersHorizontal, XCircle } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { GpuBackend } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';

const BACKEND_OPTIONS: { value: GpuBackend; label: string }[] = [
  { value: 'auto', label: 'Авто (CUDA / Vulkan → CPU)' },
  { value: 'cuda', label: 'NVIDIA CUDA 12.4' },
  { value: 'vulkan', label: 'Vulkan 1.3 (Любой GPU)' },
  { value: 'cpu', label: 'Только CPU AVX2' },
];

export const RightInspectorPane: React.FC = () => {
  const {
    files,
    toggleFileContext,
    includeProjectTree,
    setIncludeProjectTree,
    includeTerminalOutput,
    setIncludeTerminalOutput,
    inferenceSettings,
    updateInferenceSettings,
    localModels,
    activeModelId,
    serverStatus,
    toggleServerPower,
    tokensPerSec,
    vramUsedGb,
    ramUsedGb,
    chatVisibility,
    uiStyle,
    freeProviders,
    modelCategory,
    providerSelectionByCategory,
    subagentRuns,
    launchSubagent,
    clearCompletedSubagents,
    hardwareProfile,
    projects,
    activeProjectId,
    projectWorkspace,
    activeProviderId,
    modelSource,
    modelCapabilityReport,
    modelCapabilityStatus,
    checkModelCapabilities,
    lastTokenUsage,
  } = useOneCoreStore();

  const [quickSubagentPrompt, setQuickSubagentPrompt] = useState('');
  const tokens = getUiTokens(uiStyle);
  const activeModel = localModels.find((m) => m.id === activeModelId);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const activeProvider = freeProviders.find((provider) => provider.id === activeProviderId);
  const runtimeProvider = freeProviders.find(
    (provider) => provider.id === providerSelectionByCategory.runtime,
  );
  const runtimeConnected =
    modelCategory === 'runtime' &&
    (runtimeProvider?.kind === 'llama-cpp' || runtimeProvider?.kind === 'custom') &&
    runtimeProvider.status === 'connected';

  useEffect(() => {
    const currentReportMatches =
      modelCapabilityReport?.projectId === activeProjectId &&
      modelCapabilityReport?.providerId === activeProvider?.id &&
      modelCapabilityReport?.modelId === (modelSource === 'runtime' ? activeModel?.filename : activeProvider?.selectedModel);
    if (
      activeProvider &&
      !currentReportMatches &&
      modelCapabilityStatus !== 'checking' &&
      modelCapabilityStatus !== 'error'
    ) {
      void checkModelCapabilities();
    }
  }, [
    activeProvider?.id,
    activeProvider?.selectedModel,
    activeModel?.filename,
    modelSource,
    activeProjectId,
    modelCapabilityReport?.providerId,
    modelCapabilityReport?.modelId,
    modelCapabilityStatus,
    checkModelCapabilities,
  ]);

  const includedTokens =
    files.filter((f) => f.inContext).reduce((acc, f) => acc + f.tokensEstimate, 0) +
    (includeProjectTree ? 180 : 0) +
    (includeTerminalOutput ? 120 : 0);

  const vramPct =
    inferenceSettings.maxVramGb > 0
      ? Math.min(100, Math.round((vramUsedGb / inferenceSettings.maxVramGb) * 100))
      : 0;
  const ramPct =
    inferenceSettings.maxRamGb > 0
      ? Math.min(100, Math.round((ramUsedGb / inferenceSettings.maxRamGb) * 100))
      : 0;

  const statusLabel =
    serverStatus === 'generating'
      ? 'Генерация'
      : serverStatus === 'loading'
        ? 'Загрузка в память'
        : serverStatus === 'error'
          ? 'Ошибка'
          : serverStatus === 'stopped'
            ? 'Остановлен'
            : 'Модель выбрана';

  const handleLaunchQuickSubagent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSubagentPrompt.trim()) return;
    launchSubagent({ prompt: quickSubagentPrompt });
    setQuickSubagentPrompt('');
  };

  return (
    <aside className={cn('w-full lg:w-[288px] xl:w-[312px] shrink-0 border-t lg:border-t-0 lg:border-l flex flex-col overflow-y-auto', tokens.sidebarBg)}>
      {/* Project workspace and effective application permissions */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            Проект и доступы
          </span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded', activeProject ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800')}>
            {activeProject ? 'Подключён' : 'Не выбран'}
          </span>
        </div>
        {activeProject ? (
          <>
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{activeProject.name}</div>
              <div className="text-[10.5px] text-zinc-500 truncate" title={activeProject.folderPath}>{activeProject.folderPath}</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                <div className="text-zinc-500">Задачи</div>
                <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{projectWorkspace.tasks.length}</div>
              </div>
              <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                <div className="text-zinc-500">Прогресс плана</div>
                <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{projectWorkspace.plan?.progress ?? 0}%</div>
              </div>
            </div>
            <div className="space-y-1">
              {([
                ['Чтение файлов', modelCapabilityReport?.application.readFiles.available ?? (activeProject.allowedTools?.includes('read_file') ?? true)],
                ['Изменение файлов', modelCapabilityReport?.application.writeFiles.available ?? (activeProject.allowedTools?.includes('write_file') ?? true)],
                ['Удаление файлов', false],
                ['Терминал', modelCapabilityReport?.application.runCommands.available ?? (activeProject.allowedTools?.includes('run_command') ?? true)],
                ['Git', modelCapabilityReport?.application.git.available ?? (activeProject.allowedTools?.includes('git') ?? true)],
                ['SSH', false],
                ['GitHub API', false],
              ] as Array<[string, boolean]>).map(([label, enabled]) => (
                <div key={label} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
                  <span className={cn('inline-flex items-center gap-1', enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400')}>
                    {enabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {enabled ? 'Разрешено' : 'Недоступно'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Запись и команды требуют подтверждения. Удаление, SSH и прямые GitHub-действия пока не подключены к агенту.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-zinc-500">Выберите проект, чтобы агент получил его задачи, план, файлы и разрешения.</p>
        )}
      </div>

      {/* Model self-report is not an application permission grant */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-blue-500" />
            Возможности модели
          </span>
          <button type="button" onClick={() => void checkModelCapabilities()} disabled={modelCapabilityStatus === 'checking' || !activeProvider} className="inline-flex items-center gap-1 text-[10.5px] text-blue-600 dark:text-blue-400 disabled:opacity-40">
            <RefreshCw className={cn('w-3 h-3', modelCapabilityStatus === 'checking' && 'animate-spin')} />
            Проверить
          </button>
        </div>
        <div className="text-[10.5px] text-zinc-500 truncate">{activeProvider?.name ?? 'Провайдер не выбран'} · {modelSource === 'runtime' ? activeModel?.filename ?? 'Runtime-модель' : activeProvider?.selectedModel ?? 'Модель не выбрана'}</div>
        {modelCapabilityReport ? (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Окно контекста по самооценке</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">{modelCapabilityReport.contextWindowTokens?.toLocaleString('ru-RU') ?? 'Неизвестно'} tok</span>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">Заявлено самой моделью · не гарантия</div>
            {([
              ['Чтение файлов', 'readFiles'],
              ['Изменение файлов', 'writeFiles'],
              ['Удаление файлов', 'deleteFiles'],
              ['Выполнение команд', 'runCommands'],
              ['Git', 'git'],
              ['SSH', 'ssh'],
              ['GitHub', 'github'],
              ['Веб-доступ', 'web'],
              ['Function calling', 'functionCalling'],
              ['Vision', 'vision'],
            ] as const).map(([label, key]) => {
              const claim = modelCapabilityReport.selfReported[key];
              const appTool = modelCapabilityReport.application[key];
              return (
                <div key={key} className="py-1 border-b border-zinc-100 dark:border-zinc-800/70 space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
                    <span className={cn('font-medium', claim === true ? 'text-emerald-600 dark:text-emerald-400' : claim === false ? 'text-rose-500' : 'text-zinc-400')}>
                      {claim === true ? 'Модель: да' : claim === false ? 'Модель: нет' : 'Модель: ?'}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    OneCoreAI: {appTool.available ? 'доступно' : 'недоступно'} · {appTool.reason}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-zinc-500 leading-relaxed">{modelCapabilityReport.notes}</p>
            <p className="text-[10px] text-zinc-500">Проверено: {new Date(modelCapabilityReport.checkedAt).toLocaleString('ru-RU')}</p>
          </>
        ) : (
          <p className="text-[10.5px] text-zinc-500">
            {modelCapabilityStatus === 'checking' ? 'Модель отвечает на проверочный запрос…' : modelCapabilityStatus === 'error' ? 'Проверка не удалась. Возможности модели неизвестны.' : 'Самооценка ещё не запрашивалась.'}
          </p>
        )}
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Самооценка не выдаёт разрешений. Реальные доступы определяются инструментами OneCoreAI и политикой проекта.
        </p>
      </div>

      {/* Token usage and memory telemetry */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-zinc-500" />
          Токены и память
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
            <div className="text-zinc-500">Вход</div>
            <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{lastTokenUsage?.promptTokens?.toLocaleString('ru-RU') ?? '—'}</div>
          </div>
          <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
            <div className="text-zinc-500">Выход</div>
            <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{lastTokenUsage?.completionTokens?.toLocaleString('ru-RU') ?? '—'}</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Последний запрос</span>
          <span className="font-mono tabular-nums">{lastTokenUsage?.totalTokens?.toLocaleString('ru-RU') ?? 'нет данных'} tok</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Оценка файлового контекста</span>
          <span className="font-mono tabular-nums">~{includedTokens.toLocaleString('ru-RU')} tok</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Настроенное окно</span>
          <span className="font-mono tabular-nums">{inferenceSettings.contextSize.toLocaleString('ru-RU')} tok</span>
        </div>
        <div className="text-[10px] text-zinc-500">Точный usage зависит от ответа провайдера; оценка файлового контекста приблизительная.</div>
        {runtimeConnected ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">VRAM рантайма</span>
              <span className="font-mono tabular-nums">{serverStatus === 'stopped' ? '0.0' : vramUsedGb} GB</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Системная RAM</span>
              <span className="font-mono tabular-nums">{ramUsedGb} GB</span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-zinc-500">Память облачной модели приложению не видна.</div>
        )}
      </div>

      {/* Local runtime telemetry */}
      {chatVisibility.showTelemetry && runtimeConnected && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-3">
          <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-500" />
                  Локальный рантайм
                </span>
                <button
                  type="button"
                  onClick={toggleServerPower}
                  className={cn(
                    'px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors',
                    serverStatus === 'stopped'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-rose-500',
                  )}
                >
                  <Power className="w-3 h-3" />
                  <span>{serverStatus === 'stopped' ? 'Запуск' : 'Стоп'}</span>
                </button>
          </div>

          <div className={cn('p-3 border space-y-2.5', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {activeModel?.name ?? 'Модель не выбрана'}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium shrink-0',
                      serverStatus === 'stopped'
                        ? 'text-zinc-500'
                        : serverStatus === 'error'
                          ? 'text-rose-500'
                          : serverStatus === 'generating'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  {inferenceSettings.detectedBackend} · {activeModel?.quant ?? '—'} ·{' '}
                  <span className="tabular-nums">
                    {tokensPerSec > 0 ? `${tokensPerSec} tok/s` : hardwareProfile ? `${hardwareProfile.cpu.cores} ядер` : 'ожидание'}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-500 dark:text-zinc-400">VRAM GPU</span>
                    <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                      {inferenceSettings.maxVramGb > 0
                        ? `${serverStatus === 'stopped' ? '0.0' : vramUsedGb} / ${inferenceSettings.maxVramGb} GB`
                        : 'GPU не обнаружен'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        vramPct > 90 ? 'bg-amber-500' : 'bg-blue-600',
                      )}
                      style={{ width: `${serverStatus === 'stopped' ? 0 : vramPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-500 dark:text-zinc-400">System RAM (ОС)</span>
                    <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                      {ramUsedGb} / {inferenceSettings.maxRamGb} GB
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-zinc-500 dark:bg-zinc-400 transition-all duration-300"
                      style={{ width: `${ramPct}%` }}
                    />
                  </div>
                </div>
          </div>
        </div>
      )}

      {/* Section 2: Quick Inference Settings */}
      {chatVisibility.showInferenceControls && runtimeConnected && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            <span>Параметры инференса</span>
          </div>

          <div>
            <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
              Ускорение GPU (Windows)
            </label>
            <select
              value={inferenceSettings.gpuBackend}
              onChange={(e) =>
                updateInferenceSettings({ gpuBackend: e.target.value as GpuBackend })
              }
              className={cn('w-full h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500', tokens.inputRadius)}
            >
              {BACKEND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-zinc-500 dark:text-zinc-400">Temperature</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {inferenceSettings.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={inferenceSettings.temperature}
              onChange={(e) =>
                updateInferenceSettings({ temperature: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-zinc-500 dark:text-zinc-400">Контекстное окно (n_ctx)</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {inferenceSettings.contextSize.toLocaleString('ru-RU')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[4096, 8192, 16384, 32768].map((ctx) => (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => updateInferenceSettings({ contextSize: ctx })}
                  className={cn(
                    'py-1 rounded text-[11px] font-mono tabular-nums border transition-colors',
                    inferenceSettings.contextSize === ctx
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {ctx / 1024}K
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-zinc-500 dark:text-zinc-400">GPU Layers (-ngl)</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {inferenceSettings.gpuBackend === 'cpu' ? 0 : inferenceSettings.gpuLayers}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={99}
              step={1}
              disabled={inferenceSettings.gpuBackend === 'cpu'}
              value={inferenceSettings.gpuBackend === 'cpu' ? 0 : inferenceSettings.gpuLayers}
              onChange={(e) =>
                updateInferenceSettings({ gpuLayers: parseInt(e.target.value, 10) })
              }
              className="w-full accent-blue-600 disabled:opacity-40"
            />
          </div>
        </div>
      )}

      {/* Section 2.5: OneCore Subagents Parallel Runner */}
      {chatVisibility.showSubagentsPanel && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-500" />
              <span>Субагенты</span>
              <span className="font-mono tabular-nums text-[11px] text-zinc-500">
                ({subagentRuns.length})
              </span>
            </span>
            {subagentRuns.some((r) => r.status === 'completed') && (
              <button
                type="button"
                onClick={clearCompletedSubagents}
                className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Очистить
              </button>
            )}
          </div>

          <form onSubmit={handleLaunchQuickSubagent} className="flex gap-1.5">
            <input
              type="text"
              value={quickSubagentPrompt}
              onChange={(e) => setQuickSubagentPrompt(e.target.value)}
              placeholder="Параллельная подзадача..."
              className={cn(
                'flex-1 min-w-0 h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                tokens.inputRadius,
              )}
            />
            <button
              type="submit"
              disabled={!quickSubagentPrompt.trim()}
              title="Запустить субагента"
              className={cn(
                'h-8 px-2.5 disabled:opacity-45 text-[11px] font-medium inline-flex items-center gap-1 shrink-0',
                tokens.inputRadius,
                tokens.accentButton,
              )}
            >
              <Play className="w-3 h-3" />
            </button>
          </form>

          {subagentRuns.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {subagentRuns.slice(0, 4).map((run) => (
                <div
                  key={run.id}
                  className={cn('p-2 border text-[11px] space-y-1', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {run.title}
                    </span>
                    <span
                      className={cn(
                        'font-mono tabular-nums shrink-0',
                        run.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400',
                      )}
                    >
                      {run.progressPct}%
                    </span>
                  </div>
                  <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
                    {run.roleName} · {run.modelName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 3: Active Context */}
      {chatVisibility.showActiveContext && (
        <div className="p-4 flex-1">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              Файлы контекста
            </span>
            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
              ~{includedTokens} / {inferenceSettings.contextSize} tok
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            <label className={cn('flex items-center justify-between gap-2 px-2 py-1.5 border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900/50 text-xs cursor-pointer', tokens.cardRadius)}>
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeProjectTree}
                  onChange={(e) => setIncludeProjectTree(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span>Дерево проекта</span>
              </span>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">180</span>
            </label>

            <label className={cn('flex items-center justify-between gap-2 px-2 py-1.5 border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900/50 text-xs cursor-pointer', tokens.cardRadius)}>
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeTerminalOutput}
                  onChange={(e) => setIncludeTerminalOutput(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span>Вывод терминала</span>
              </span>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">120</span>
            </label>
          </div>

          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
            Открытые файлы в промпте
          </div>
          <div className="space-y-1">
            {files.map((file) => (
              <label
                key={file.path}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={file.inContext}
                    onChange={() => toggleFileContext(file.path)}
                    className="accent-blue-600 rounded shrink-0"
                  />
                  <span className="font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300 truncate">
                    {file.name}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0">
                  {file.tokensEstimate}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{inferenceSettings.detectedGpuName}</span>
          </div>
        </div>
      )}
    </aside>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Circle, Download, Loader2, PackageCheck, PlayCircle, X } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { FreeProviderProfile, LocalModel } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';

type LlamaCheckState = 'pending' | 'checking' | 'success' | 'error';

type LlamaCheckStep = {
  label: string;
  state: LlamaCheckState;
  detail?: string;
};

type LlamaServerChecks = {
  downloaded: boolean;
  installed: boolean;
  running: boolean;
  version: string | null;
  executablePath: string | null;
};

type ModelChoice =
  | { key: string; kind: 'gguf'; model: LocalModel; label: string }
  | { key: string; kind: 'provider'; provider: FreeProviderProfile; modelName: string; label: string };

const isGguf = (model: LocalModel) =>
  model.status === 'ready' && model.sourceType !== 'ollama' && model.filename.toLowerCase().endsWith('.gguf');

export const ModelSwitcherModal: React.FC = () => {
  const {
    localModels,
    refreshLocalModels,
    freeProviders,
    activeProviderId,
    activeModelId,
    fetchProviderModels,
    updateFreeProvider,
    setActiveProvider,
    setModelCategory,
    saveSettings,
    refreshLlamaCppStatus,
  } = useOneCoreStore();
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [expandedProviderId, setExpandedProviderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [checksFinished, setChecksFinished] = useState(false);
  const [llamaChecks, setLlamaChecks] = useState<LlamaServerChecks | null>(null);
  const [checkSteps, setCheckSteps] = useState<LlamaCheckStep[]>([
    { label: 'Определение текущего состояния llama-server…', state: 'pending' },
    { label: 'Поиск системных файлов llama-server…', state: 'pending' },
    { label: 'Проверка установленных компонентов llama-server…', state: 'pending' },
    { label: 'Проверка текущего состояния llama-server…', state: 'pending' },
  ]);

  const inspectLlamaServer = async () => {
    const initialSteps: LlamaCheckStep[] = [
      { label: 'Определение текущего состояния llama-server…', state: 'pending' },
      { label: 'Поиск системных файлов llama-server…', state: 'pending' },
      { label: 'Проверка установленных компонентов llama-server…', state: 'pending' },
      { label: 'Проверка текущего состояния llama-server…', state: 'pending' },
    ];
    setChecksFinished(false);
    setLlamaChecks(null);
    setCheckSteps(initialSteps);
    let discoveredChecks: LlamaServerChecks | null = null;
    const updateStep = (index: number, patch: Partial<LlamaCheckStep>) => {
      setCheckSteps((current) => current.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ));
    };

    try {
      await refreshLocalModels();
      updateStep(0, { state: 'checking' });
      const initialResponse = await apiFetch('/api/models/llama-cpp/status');
      const initialStatus = await initialResponse.json() as { ok?: boolean; status?: string; error?: string };
      if (!initialResponse.ok || !initialStatus.ok) throw new Error(initialStatus.error || 'Не удалось определить состояние llama-server.');
      updateStep(0, { state: 'success', detail: initialStatus.status === 'ready' ? 'Сервер уже запущен.' : 'Текущее состояние определено.' });

      updateStep(1, { state: 'checking' });
      const checksResponse = await apiFetch('/api/models/llama-cpp/checks');
      const checks = await checksResponse.json() as {
        ok?: boolean;
        downloaded?: boolean;
        installed?: boolean;
        running?: boolean;
        version?: string | null;
        executablePath?: string | null;
        error?: string;
      };
      if (!checksResponse.ok || !checks.ok) throw new Error(checks.error || 'Не удалось выполнить поиск системных файлов llama-server.');
      const installed = checks.installed === true;
      discoveredChecks = {
        downloaded: checks.downloaded === true,
        installed,
        running: checks.running === true || initialStatus.status === 'ready',
        version: checks.version ?? null,
        executablePath: checks.executablePath ?? null,
      };
      setLlamaChecks(discoveredChecks);
      const executableFound = Boolean(checks.executablePath && installed);
      updateStep(1, {
        state: executableFound ? 'success' : 'error',
        detail: executableFound ? checks.executablePath ?? undefined : 'Исполняемый файл llama-server не найден.',
      });

      updateStep(2, { state: 'checking' });
      updateStep(2, {
        state: installed ? 'success' : 'error',
        detail: installed ? checks.version || 'Компоненты llama-server установлены.' : 'Установленные компоненты llama-server не обнаружены.',
      });

      updateStep(3, { state: 'checking' });
      let running = checks.running === true || initialStatus.status === 'ready';
      if (!running && checks.downloaded === true && installed) {
        await refreshLocalModels();
        const state = useOneCoreStore.getState();
        const llamaProvider = state.freeProviders.find((provider) => provider.kind === 'llama-cpp');
        const selectedModel = llamaProvider?.selectedModel?.trim().toLowerCase();
        const readyModel = state.localModels.find((model) =>
          model.status === 'ready'
          && model.sourceType !== 'ollama'
          && model.filename.toLowerCase().endsWith('.gguf')
          && (!selectedModel
            ? model.id === state.activeModelId
            : [model.filename, model.name, model.localPath].some((value) =>
                value.toLowerCase() === selectedModel || value.toLowerCase().endsWith(`/${selectedModel}`),
              )),
        );
        if (readyModel) {
          const startResponse = await apiFetch('/api/models/llama-cpp/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved: true }),
          });
          const startData = await startResponse.json() as { ok?: boolean; status?: string; error?: string };
          if (!startResponse.ok || !startData.ok || startData.status !== 'ready') {
            throw new Error(startData.error || 'Автоматический запуск llama-server не подтвердил готовность.');
          }
          running = true;
          updateStep(3, { state: 'success', detail: 'Сервер автоматически запущен.' });
        } else {
          updateStep(3, { state: 'error', detail: 'Нет выбранной готовой GGUF-модели для запуска.' });
        }
      } else {
        updateStep(3, {
          state: running ? 'success' : 'error',
          detail: running ? 'llama-server запущен и отвечает.' : 'Сервер остановлен; автоматический запуск невозможен без скачанного и установленного runtime.',
        });
      }

      setLlamaChecks({
        downloaded: checks.downloaded === true,
        installed,
        running,
        version: checks.version ?? null,
        executablePath: checks.executablePath ?? null,
      });
      if (running) await refreshLlamaCppStatus();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Не удалось проверить llama-server.';
      setLlamaChecks(discoveredChecks
        ? { ...discoveredChecks, running: false }
        : { downloaded: false, installed: false, running: false, version: null, executablePath: null });
      setError(message);
      setCheckSteps((current) => current.map((step) =>
        step.state === 'checking' ? { ...step, state: 'error', detail: message } : step,
      ));
    } finally {
      setChecksFinished(true);
    }
  };

  useEffect(() => {
    const show = () => {
      setOpen(true);
      setError('');
      const connected = useOneCoreStore.getState().freeProviders.filter(
        (provider) => provider.kind !== 'llama-cpp' && provider.enabled !== false && provider.status === 'connected',
      );
      void Promise.all(connected.map((provider) => fetchProviderModels(provider.id)));
      void inspectLlamaServer();
    };
    window.addEventListener('onecore:open-model-switcher', show);
    return () => window.removeEventListener('onecore:open-model-switcher', show);
  }, [fetchProviderModels, refreshLocalModels]);

  const choices = useMemo<ModelChoice[]>(() => {
    const local: ModelChoice[] = localModels.filter(isGguf).map((model) => ({
      key: `gguf:${model.id}`,
      kind: 'gguf',
      model,
      label: model.name || model.filename,
    }));
    const providers: ModelChoice[] = freeProviders
      .filter((provider) => provider.kind !== 'llama-cpp' && provider.enabled !== false && provider.status === 'connected')
      .flatMap((provider) => provider.availableModels.map((modelName) => ({
        key: `provider:${provider.id}:${modelName}`,
        kind: 'provider' as const,
        provider,
        modelName,
        label: modelName,
      })));
    return [...local, ...providers];
  }, [localModels, freeProviders]);

  const providerGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; choices: ModelChoice[] }>();
    choices.forEach((choice) => {
      const id = choice.kind === 'gguf' ? 'llama-cpp' : choice.provider.id;
      const name = choice.kind === 'gguf' ? 'Локальные модели · llama.cpp' : choice.provider.name;
      const group = groups.get(id) ?? { id, name, choices: [] };
      group.choices.push(choice);
      groups.set(id, group);
    });
    return Array.from(groups.values());
  }, [choices]);

  useEffect(() => {
    if (!open) return;
    const active = choices.find((choice) =>
      choice.kind === 'gguf'
        ? choice.model.id === activeModelId && activeProviderId === freeProviders.find((provider) => provider.kind === 'llama-cpp')?.id
        : choice.provider.id === activeProviderId && choice.modelName === choice.provider.selectedModel,
    );
    setSelectedKey(active?.key ?? choices[0]?.key ?? '');
  }, [open, choices, activeModelId, activeProviderId]);

  useEffect(() => {
    if (!open || !providerGroups.length) return;
    const activeGroup = providerGroups.find((group) => group.choices.some((choice) =>
      choice.kind === 'gguf'
        ? choice.model.id === activeModelId && activeProviderId === freeProviders.find((provider) => provider.kind === 'llama-cpp')?.id
        : choice.provider.id === activeProviderId && choice.modelName === choice.provider.selectedModel,
    ));
    setExpandedProviderId(activeGroup?.id ?? providerGroups[0].id);
  }, [open, providerGroups, activeModelId, activeProviderId, freeProviders]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError('');
  };

  const notify = (title: string, detail: string) => {
    useOneCoreStore.setState((state) => ({
      notifications: [
        { id: `model-switch-${Date.now()}`, title, detail, timestamp: new Date().toTimeString().slice(0, 8), read: false },
        ...state.notifications,
      ],
    }));
  };

  const connect = async () => {
    const choice = choices.find((item) => item.key === selectedKey);
    if (!choice || busy) return;

    const before = useOneCoreStore.getState();
    const previousProviderId = before.activeProviderId;
    const previousProvider = before.freeProviders.find((provider) => provider.id === previousProviderId);
    const previousModelName = previousProvider?.selectedModel || before.localModels.find((model) => model.id === before.activeModelId)?.filename || 'Не выбрана';
    const previousLlamaWasReady = before.serverStatus === 'ready' && previousProvider?.kind === 'llama-cpp';
    const llamaProvider = before.freeProviders.find((provider) => provider.kind === 'llama-cpp');

    setBusy(true);
    setError('');
    try {
      if (choice.kind === 'gguf') {
        if (!llamaProvider) throw new Error('Провайдер llama.cpp не найден в настройках.');
        setStage('Активация GGUF-модели…');
        const activateResponse = await apiFetch(`/api/models/local/${encodeURIComponent(choice.model.id)}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true }),
        });
        const activateData = await activateResponse.json() as { ok?: boolean; error?: string };
        if (!activateResponse.ok || !activateData.ok) {
          throw new Error(activateData.error || `HTTP ${activateResponse.status}`);
        }

        updateFreeProvider(llamaProvider.id, { selectedModel: choice.model.filename });
        setActiveProvider(llamaProvider.id);
        setModelCategory('llama-server');

        setStage('Сохранение выбора модели…');
        const saved = await saveSettings();
        if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить выбранную модель.');

        setStage('Установка runtime и запуск llama-server…');
        const startResponse = await apiFetch('/api/models/llama-cpp/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true }),
        });
        const startData = await startResponse.json() as { ok?: boolean; status?: string; error?: string };
        if (!startResponse.ok || !startData.ok || startData.status !== 'ready') {
          throw new Error(startData.error || 'llama-server не подтвердил готовность модели.');
        }
        await Promise.all([refreshLocalModels(), refreshLlamaCppStatus()]);
      } else {
        setStage('Проверка подключения к провайдеру…');
        const connected = await fetchProviderModels(choice.provider.id);
        const latestProvider = useOneCoreStore.getState().freeProviders.find((provider) => provider.id === choice.provider.id);
        if (!connected || !latestProvider?.availableModels.includes(choice.modelName)) {
          throw new Error(latestProvider?.lastCheckMessage || 'Модель больше не доступна у провайдера.');
        }
        updateFreeProvider(choice.provider.id, { selectedModel: choice.modelName });
        setActiveProvider(choice.provider.id);
        setStage('Сохранение выбора модели…');
        const saved = await saveSettings();
        if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить выбранную модель.');
      }

      notify('Модель изменена', `${previousModelName} → ${choice.label}`);
      setOpen(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Не удалось подключить модель.';
      setError(message);
      const current = useOneCoreStore.getState();
      if (choice.kind === 'gguf') {
        if (before.activeModelId && before.activeModelId !== choice.model.id) {
          await apiFetch(`/api/models/local/${encodeURIComponent(before.activeModelId)}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved: true }),
          });
        }
        const currentLlama = current.freeProviders.find((provider) => provider.kind === 'llama-cpp');
        if (currentLlama && llamaProvider) updateFreeProvider(currentLlama.id, { selectedModel: llamaProvider.selectedModel });
      } else {
        updateFreeProvider(choice.provider.id, { selectedModel: choice.provider.selectedModel });
      }
      if (previousProvider) setActiveProvider(previousProviderId);
      const rollback = await saveSettings();
      if (!rollback.ok) notify('Ошибка восстановления настроек модели', rollback.error || message);
      if (previousLlamaWasReady) {
        const restoreResponse = await apiFetch('/api/models/llama-cpp/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true }),
        });
        if (!restoreResponse.ok) notify('Не удалось восстановить предыдущую модель', 'llama-server не запустился после отката.');
      }
      notify('Не удалось подключить модель', message);
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="model-switcher-title" className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#12161d]">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="model-switcher-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Выбор модели</h2>
          <button type="button" onClick={close} disabled={busy} aria-label="Закрыть" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </header>
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Состояние llama-server</h3>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {checksFinished ? 'Проверка завершена' : 'Выполняется проверка…'}
            </span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {([
              { key: 'downloaded', label: 'СКАЧАН', Icon: Download },
              { key: 'installed', label: 'УСТАНОВЛЕН', Icon: PackageCheck },
              { key: 'running', label: 'ЗАПУЩЕН', Icon: PlayCircle },
            ] as const).map(({ key, label, Icon }) => {
              const value = llamaChecks?.[key];
              const checking = !checksFinished || checkSteps[3]?.state === 'checking';
              const stateClass = value === true
                ? 'text-emerald-600 drop-shadow-[0_0_7px_rgba(16,185,129,0.55)] dark:text-emerald-400'
                : value === false
                  ? 'text-rose-600 dark:text-rose-400'
                  : checking
                    ? 'animate-pulse text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.65)]'
                    : 'text-zinc-300 opacity-60 dark:text-zinc-600';
              return (
                <div key={key} className="flex flex-col items-center gap-1 rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-900/70">
                  <span className="text-[9px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
                  <Icon className={`h-5 w-5 transition-colors ${stateClass}`} aria-label={value === true ? `${label}: успешно` : value === false ? `${label}: не выполнено` : `${label}: проверяется`} />
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5">
            {checkSteps.map((step, index) => {
              const StepIcon = step.state === 'success' ? CheckCircle2
                : step.state === 'error' ? AlertCircle
                  : step.state === 'checking' ? Loader2 : Circle;
              return (
                <div key={index} className="flex items-start gap-2 text-[10px]">
                  <span className="min-w-0 flex-1 text-zinc-600 dark:text-zinc-400">{step.label}</span>
                  <StepIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    step.state === 'success' ? 'text-emerald-600 dark:text-emerald-400'
                      : step.state === 'error' ? 'text-rose-600 dark:text-rose-400'
                        : step.state === 'checking' ? 'animate-spin text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]'
                          : 'text-zinc-300 dark:text-zinc-600'
                  }`} />
                </div>
              );
            })}
          </div>
          {llamaChecks?.version && (
            <p className="mt-2 truncate text-[10px] text-zinc-500 dark:text-zinc-400" title={llamaChecks.executablePath ?? undefined}>
              {llamaChecks.version} · {llamaChecks.executablePath}
            </p>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {!checksFinished ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Определение доступных моделей…
            </div>
          ) : providerGroups.length ? providerGroups.map((group) => {
            const expanded = expandedProviderId === group.id;
            const groupHasSelection = group.choices.some((choice) => choice.key === selectedKey);
            const groupHasActive = group.choices.some((choice) => choice.kind === 'gguf'
              ? choice.model.id === activeModelId && activeProviderId === 'prov-llama-cpp'
              : choice.provider.id === activeProviderId && choice.modelName === choice.provider.selectedModel);
            return (
              <section key={group.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={busy}
                  aria-expanded={expanded}
                  onClick={() => setExpandedProviderId(expanded ? '' : group.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{group.name}</span>
                    <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">{group.choices.length} моделей</span>
                  </span>
                  {groupHasActive && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Активен</span>}
                  {groupHasSelection && !groupHasActive && <span className="text-[10px] text-blue-600 dark:text-blue-400">Выбрано</span>}
                  <span className="text-zinc-400"><span className={`inline-block transition-transform ${expanded ? 'rotate-180' : ''}`}>⌄</span></span>
                </button>
                {expanded && (
                  <div className="space-y-1 border-t border-zinc-200 p-2 dark:border-zinc-800">
                    {group.choices.map((choice) => {
                      const selected = selectedKey === choice.key;
                      const active = choice.kind === 'gguf'
                        ? choice.model.id === activeModelId && activeProviderId === 'prov-llama-cpp'
                        : choice.provider.id === activeProviderId && choice.modelName === choice.provider.selectedModel;
                      return (
                        <button
                          key={choice.key}
                          type="button"
                          disabled={busy}
                          onClick={() => setSelectedKey(choice.key)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${selected ? 'border-blue-400 bg-blue-50 dark:border-blue-500/60 dark:bg-blue-500/10' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>{selected && <Check className="h-3 w-3" />}</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">{choice.label}</span>
                          {active && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Активна</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          }) : <p className="px-3 py-8 text-center text-xs text-zinc-500">Нет доступных моделей. Подключите провайдера или добавьте GGUF-файл.</p>}
        </div>
        {error && <p role="alert" className="border-t border-rose-200 px-5 py-3 text-xs text-rose-600 dark:border-rose-900/60 dark:text-rose-400">{error}</p>}
        <footer className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="min-w-0 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{busy ? stage : 'Выберите модель из доступного списка'}</span>
          <button type="button" onClick={() => void connect()} disabled={busy || !selectedKey} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-bold tracking-[0.12em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'ПОДКЛЮЧЕНИЕ…' : 'ПОДКЛЮЧИТЬ МОДЕЛЬ'}
          </button>
        </footer>
      </section>
    </div>
  );
};

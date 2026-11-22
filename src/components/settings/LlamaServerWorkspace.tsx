import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cpu, Loader2, Play, Power, RefreshCw, Square, Trash2, Users } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { LocalModel, ServerStatus, SubagentProviderSettings } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';

interface RuntimeSnapshot {
  status: ServerStatus;
  modelId: string | null;
  baseUrl: string;
  error: string | null;
}

const isGguf = (model: LocalModel) =>
  model.status === 'ready' && model.sourceType !== 'ollama' && model.filename.toLowerCase().endsWith('.gguf');

const modelMatches = (model: LocalModel, selected: string) =>
  Boolean(selected) && [model.id, model.filename, model.name, model.localPath].some((value) => value === selected || value.endsWith(`/${selected}`));

const fieldClassName = 'h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

export const LlamaServerWorkspace: React.FC = () => {
  const {
    localModels,
    localModelsError,
    hardwareProfile,
    hardwareLoading,
    hardwareError,
    refreshLocalModels,
    freeProviders,
    activeProviderId,
    activeModelId,
    roles,
    subagentConfig,
    updateSubagentConfig,
    updateFreeProvider,
    setActiveProvider,
    saveSettings,
    serverStatus,
    refreshLlamaCppStatus,
  } = useOneCoreStore();
  const llamaProvider = freeProviders.find((provider) => provider.kind === 'llama-cpp');
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [runtimeInstalled, setRuntimeInstalled] = useState<boolean | null>(null);
  const [runtimeCheckError, setRuntimeCheckError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(activeModelId);
  const [selectedAgentId, setSelectedAgentId] = useState('primary');
  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'assign' | 'load' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const models = useMemo(() => localModels.filter(isGguf), [localModels]);
  const running = runtime?.status === 'ready' || runtime?.status === 'generating';
  const currentStatus = runtime?.status ?? serverStatus;

  const refreshRuntime = useCallback(async (includeModels = false) => {
    const [, statusResult, checksResult] = await Promise.allSettled([
      includeModels ? refreshLocalModels() : Promise.resolve(),
      apiFetch('/api/models/llama-cpp/status').then(async (response) => {
        const data = await response.json() as { ok?: boolean; status?: ServerStatus; modelId?: string | null; baseUrl?: string; error?: string | null };
        if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
        setRuntime({
          status: data.status ?? 'stopped',
          modelId: data.modelId ?? null,
          baseUrl: data.baseUrl ?? llamaProvider?.baseUrl ?? '',
          error: data.error ?? null,
        });
      }),
      apiFetch('/api/models/llama-cpp/checks').then(async (response) => {
        const data = await response.json() as { ok?: boolean; installed?: boolean; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
        setRuntimeInstalled(Boolean(data.installed));
        setRuntimeCheckError(null);
      }),
    ]);
    if (statusResult.status === 'rejected') {
      setRuntime((current) => current ? { ...current, error: statusResult.reason instanceof Error ? statusResult.reason.message : 'Не удалось получить состояние сервера.' } : null);
    }
    if (checksResult.status === 'rejected') {
      setRuntimeInstalled(null);
      setRuntimeCheckError(checksResult.reason instanceof Error ? checksResult.reason.message : 'Не удалось проверить установку llama.cpp.');
    }
    await refreshLlamaCppStatus();
  }, [llamaProvider?.baseUrl, refreshLocalModels, refreshLlamaCppStatus]);

  useEffect(() => {
    setSelectedModelId(activeModelId);
  }, [activeModelId]);

  useEffect(() => {
    void refreshRuntime(true);
    const runtimeTimer = window.setInterval(() => void refreshRuntime(false), 3000);
    const modelsTimer = window.setInterval(() => void refreshRuntime(true), 15000);
    return () => {
      window.clearInterval(runtimeTimer);
      window.clearInterval(modelsTimer);
    };
  }, [refreshRuntime]);

  const assignedAgents = (model: LocalModel) => {
    const names: string[] = [];
    const primaryProvider = freeProviders.find((provider) => provider.id === activeProviderId);
    if (primaryProvider?.kind === 'llama-cpp' && modelMatches(model, primaryProvider.selectedModel)) names.push('Основной агент');
    for (const [roleId, profile] of Object.entries(subagentConfig.providerProfilesByRole)) {
      const providerId = profile.providerSelectionByCategory['llama-server'];
      const provider = profile.providers.find((item) => item.id === providerId && item.kind === 'llama-cpp');
      if (provider && modelMatches(model, provider.selectedModel)) {
        names.push(roles.find((role) => role.id === roleId)?.name ?? roleId);
      }
    }
    return names;
  };

  const handleAssign = async () => {
    const model = models.find((item) => item.id === selectedModelId);
    if (!model || !llamaProvider) {
      setError('Выберите доступную GGUF-модель.');
      return;
    }
    setBusyAction('assign');
    setError(null);
    setNotice(null);
    try {
      if (selectedAgentId === 'primary') {
        updateFreeProvider(llamaProvider.id, { selectedModel: model.filename });
        setActiveProvider(llamaProvider.id);
      } else {
        const existing = subagentConfig.providerProfilesByRole[selectedAgentId] ?? subagentConfig;
        const assignedProvider = { ...llamaProvider, selectedModel: model.filename, availableModels: [model.filename] };
        const providers = existing.providers.some((provider) => provider.id === llamaProvider.id)
          ? existing.providers.map((provider) => provider.id === llamaProvider.id ? assignedProvider : provider)
          : [...existing.providers, assignedProvider];
        const profile: SubagentProviderSettings = {
          ...existing,
          providerCategory: 'llama-server',
          providerSelectionByCategory: {
            ...existing.providerSelectionByCategory,
            'llama-server': llamaProvider.id,
          },
          providers,
        };
        updateSubagentConfig({ providerProfilesByRole: { [selectedAgentId]: profile } });
      }
      const saved = await saveSettings();
      if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить назначение модели.');
      setNotice(`Модель ${model.name} назначена: ${selectedAgentId === 'primary' ? 'Основной агент' : roles.find((role) => role.id === selectedAgentId)?.name ?? selectedAgentId}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось подключить модель к агенту.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleLoad = async (model: LocalModel) => {
    setBusyModelId(model.id);
    setBusyAction('load');
    setError(null);
    setNotice(null);
    try {
      const activated = await apiFetch(`/api/models/local/${encodeURIComponent(model.id)}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const activatedData = await activated.json() as { ok?: boolean; error?: string };
      if (!activated.ok || !activatedData.ok) throw new Error(activatedData.error || `HTTP ${activated.status}`);
      if (llamaProvider && activeProviderId === llamaProvider.id) {
        updateFreeProvider(llamaProvider.id, { selectedModel: model.filename });
        const saved = await saveSettings();
        if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить выбранную модель LlamaServer.');
      }
      const started = await apiFetch('/api/models/llama-cpp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const startedData = await started.json() as { ok?: boolean; status?: ServerStatus; error?: string };
      if (!started.ok || !startedData.ok || startedData.status !== 'ready') throw new Error(startedData.error || 'llama-server не подтвердил готовность модели.');
      await refreshRuntime(true);
      setNotice(`Модель «${model.name}» загружена в llama-server.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить модель.');
      await refreshRuntime();
    } finally {
      setBusyModelId(null);
      setBusyAction(null);
    }
  };

  const handleUnload = async () => {
    setBusyAction('load');
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch('/api/models/llama-cpp/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      await refreshRuntime();
      setNotice('llama-server остановлен. Модель выгружена из памяти.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось остановить llama-server.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (model: LocalModel) => {
    const confirmed = await requestDeleteWarning({
      variant: 'confirmation',
      title: 'Удалить GGUF-модель?',
      description: 'Файл модели будет удалён из локальной библиотеки OneCoreAI. Это действие нельзя отменить.',
      itemName: model.filename,
      confirmLabel: 'Удалить модель',
    });
    if (!confirmed) return;
    setBusyModelId(model.id);
    setBusyAction('delete');
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(`/api/models/local/${encodeURIComponent(model.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      await refreshRuntime(true);
      setNotice(`Модель «${model.name}» удалена из локальной библиотеки.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить модель.');
    } finally {
      setBusyModelId(null);
      setBusyAction(null);
    }
  };

  const handleStartServer = async () => {
    if (running) {
      await handleUnload();
      return;
    }
    if (runtimeInstalled !== true) {
      setError('llama.cpp не установлен. Перейдите в раздел «Настройки → AI / Inference · LlamaServer», скачайте и установите runtime.');
      return;
    }
    const model = models.find((item) => item.id === selectedModelId) ?? models.find((item) => item.id === activeModelId);
    if (!model) {
      setError('Сначала выберите GGUF-модель в форме справа.');
      return;
    }
    await handleLoad(model);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Модели и запуск</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Управление локальными GGUF-моделями и единственным экземпляром llama-server. Состояние и действия связаны с runtime OneCoreAI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void refreshRuntime(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <RefreshCw className="h-3.5 w-3.5" />Обновить данные
          </button>
          <button type="button" onClick={() => void handleStartServer()} disabled={busyAction !== null || (!running && (!models.length || runtimeInstalled !== true))} className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50', running ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-blue-600 hover:bg-blue-500')}>
            {busyAction === 'load' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
            {running ? 'Остановить сервер' : 'Запустить сервер'}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">llama-server</div>
          <div className={cn('mt-2 text-sm font-semibold', running ? 'text-emerald-600 dark:text-emerald-400' : currentStatus === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-300')}>
            {currentStatus === 'loading' ? 'Запускается' : running ? 'Работает' : currentStatus === 'error' ? 'Ошибка' : 'Остановлен'}
          </div>
          <div className="mt-1 break-all text-[10px] text-zinc-500 dark:text-zinc-400">{runtime?.baseUrl || llamaProvider?.baseUrl || 'Адрес runtime не определён'}</div>
          <div className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">Внешние клиенты: нет телеметрии</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Локальная библиотека</div>
          <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{models.length} GGUF-моделей</div>
          <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">Готовые файлы, доступные для запуска</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Аппаратный профиль</div>
          {hardwareLoading && !hardwareProfile ? <div className="mt-2 text-xs text-zinc-500">Определение оборудования…</div> : hardwareProfile ? (
            <>
              <div className="mt-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{hardwareProfile.gpus[0]?.name || hardwareProfile.cpu.model}</div>
              <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">RAM {hardwareProfile.ram.freeGb} / {hardwareProfile.ram.totalGb} GB · VRAM {hardwareProfile.freeVramGb} / {hardwareProfile.totalVramGb} GB</div>
            </>
          ) : <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hardwareError || 'Данные оборудования недоступны'}</div>}
        </div>
      </section>

      {runtimeInstalled === false && !running && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300" role="alert">
          llama.cpp не установлен. Установите runtime в «Настройки → AI / Inference → LlamaServer».
        </div>
      )}
      {(runtimeCheckError || error || localModelsError || runtime?.error) && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300" role="alert">
          {runtimeCheckError || error || localModelsError || runtime?.error}
        </div>
      )}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">{notice}</div>}

      <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="min-w-0 xl:col-span-7">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Доступные GGUF-модели</h2>
              <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">Выберите одну модель для общего экземпляра llama-server</p>
            </div>
            <span className="text-[10px] tabular-nums text-zinc-400">{models.length} файлов</span>
          </div>
          <div className="space-y-2">
            {models.length ? models.map((model) => {
              const selected = model.id === activeModelId;
              const loaded = running && runtime?.modelId === model.id;
              const agents = assignedAgents(model);
              const busy = busyModelId === model.id;
              return (
                <article key={model.id} className={cn('rounded-xl border bg-white p-4 transition-colors dark:bg-zinc-950/40', loaded ? 'border-emerald-500/50' : selectedModelId === model.id ? 'border-blue-500/50' : 'border-zinc-200 dark:border-zinc-800')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{model.name || model.filename}</h3>
                      <p className="mt-1 break-all text-[10px] text-zinc-500 dark:text-zinc-400">{model.filename}</p>
                      <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{model.sizeGb.toFixed(2)} GB · {model.quant || 'GGUF'} · {model.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected && <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[9px] font-semibold text-blue-700 dark:text-blue-300">Выбрана</span>}
                      {loaded && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">В памяти</span>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{agents.length ? 'Агенты: ' + agents.join(', ') : 'Не назначена агентам'}</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedModelId(model.id)} className="inline-flex h-8 items-center rounded-lg border border-zinc-200 px-3 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Выбрать</button>
                      <button type="button" onClick={() => loaded ? void handleUnload() : void handleLoad(model)} disabled={busyAction !== null || busy} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold text-white disabled:opacity-50', loaded ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-blue-600 hover:bg-blue-500')}>
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : loaded ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {loaded ? 'Выгрузить' : 'Загрузить'}
                      </button>
                      <button type="button" onClick={() => void handleDelete(model)} disabled={busyAction !== null || busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30">
                        <Trash2 className="h-3 w-3" />Удалить
                      </button>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-12 text-center dark:border-zinc-700">
                <Cpu className="mx-auto h-6 w-6 text-zinc-400" />
                <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">GGUF-модели не найдены</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Загрузите модель через «Центр GGUF» или импортируйте файл в локальную библиотеку.</p>
              </div>
            )}
          </div>
        </section>

        <section className="h-fit rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 xl:col-span-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Запуск и назначение</h2>
            <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">Настройки runtime редактируются централизованно в разделе LlamaServer</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-zinc-600 dark:text-zinc-300">Выбранная модель</label>
              <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)} className={fieldClassName}>
                <option value="">Выберите GGUF-модель</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.name || model.filename}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-zinc-600 dark:text-zinc-300">Base URL</label>
              <input readOnly value={runtime?.baseUrl || llamaProvider?.baseUrl || 'http://127.0.0.1:8080/v1'} className={cn(fieldClassName, 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400')} />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-zinc-600 dark:text-zinc-300">Агент</label>
              <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} className={fieldClassName}>
                <option value="primary">Основной агент</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => void handleAssign()} disabled={!selectedModelId || busyAction !== null} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-500/15 disabled:opacity-50 dark:text-blue-300">
              {busyAction === 'assign' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}Назначить агенту
            </button>
          </div>
          <div className="mt-4 border-t border-zinc-200 pt-3 text-[10px] leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Все агенты используют один управляемый процесс llama-server. Одновременно загружена одна GGUF-модель; назначение модели агенту не создаёт отдельный runtime.
          </div>
        </section>
      </div>
    </div>
  );
};
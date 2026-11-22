import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, Loader2, RefreshCw } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { LocalModel, ServerStatus } from '../../types/onecore';
import { cn } from '../../utils/cn';

interface LlamaRuntimeSnapshot {
  status: ServerStatus;
  pid: number | null;
  modelId: string | null;
  modelPath: string | null;
  baseUrl: string;
  error: string | null;
}

type CheckState = 'ok' | 'pending' | 'error' | 'off';

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();

const modelMatchesSelection = (model: LocalModel | undefined, selectedModel: string) => {
  if (!model || !selectedModel.trim()) return false;
  const selected = normalizePath(selectedModel);
  const candidates = [model.localPath, model.filename, model.name].map(normalizePath);
  return candidates.some((candidate) => candidate === selected || candidate.endsWith(`/${selected}`));
};

const StatusLine: React.FC<{
  title: string;
  detail: string;
  state: CheckState;
}> = ({ title, detail, state }) => {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'pending' ? Loader2 : state === 'error' ? AlertCircle : Circle;
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <Icon className={cn(
        'mt-0.5 h-4 w-4 shrink-0',
        state === 'ok' ? 'text-emerald-600 dark:text-emerald-400' :
          state === 'pending' ? 'animate-spin text-blue-600 dark:text-blue-400' :
            state === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400 dark:text-zinc-500',
      )} />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">{title}</div>
        <div className="mt-0.5 break-words text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">{detail}</div>
      </div>
    </div>
  );
};

export const LlamaCppDiagnostics: React.FC = () => {
  const {
    localModels,
    localModelsError,
    refreshLocalModels,
    refreshLlamaCppStatus,
    freeProviders,
    activeProviderId,
  } = useOneCoreStore();
  const [runtime, setRuntime] = useState<LlamaRuntimeSnapshot | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (includeModels = true) => {
    setRefreshing(true);
    const [, statusResult] = await Promise.allSettled([
      includeModels ? refreshLocalModels() : Promise.resolve(),
      fetch('/api/models/llama-cpp/status').then(async (response) => {
        const data = await response.json() as { ok?: boolean; error?: string } & Partial<LlamaRuntimeSnapshot>;
        if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
        setRuntime({
          status: data.status ?? 'stopped',
          pid: data.pid ?? null,
          modelId: data.modelId ?? null,
          modelPath: data.modelPath ?? null,
          baseUrl: data.baseUrl ?? '',
          error: data.error ?? null,
        });
        setRuntimeError(null);
      }),
    ]);
    if (statusResult.status === 'rejected') {
      setRuntimeError(statusResult.reason instanceof Error ? statusResult.reason.message : 'Не удалось проверить llama-server.');
    }
    await refreshLlamaCppStatus();
    setRefreshing(false);
  }, [refreshLocalModels, refreshLlamaCppStatus]);

  useEffect(() => {
    void refresh();
    const runtimeTimer = window.setInterval(() => void refresh(false), 3_000);
    const modelsTimer = window.setInterval(() => void refresh(true), 15_000);
    return () => {
      window.clearInterval(runtimeTimer);
      window.clearInterval(modelsTimer);
    };
  }, [refresh]);

  const ggufModels = useMemo(
    () => localModels.filter((model) => model.status === 'ready' && model.sourceType !== 'ollama' && model.localPath.toLowerCase().endsWith('.gguf')),
    [localModels],
  );
  const activeProvider = freeProviders.find((provider) => provider.id === activeProviderId) ?? null;
  const loadedModel = runtime?.modelId ? localModels.find((model) => model.id === runtime.modelId) : undefined;
  const serverReady = runtime?.status === 'ready';
  const serverLoading = runtime?.status === 'loading';
  const modelLoaded = serverReady && Boolean(runtime?.modelId);
  const agentUsesLlama = activeProvider?.kind === 'llama-cpp';
  const agentModelMatches = agentUsesLlama && modelMatchesSelection(loadedModel, activeProvider.selectedModel);
  const runtimeStatus: CheckState = runtimeError || runtime?.status === 'error'
    ? 'error'
    : serverLoading ? 'pending'
      : serverReady ? 'ok' : 'off';

  const agentDetail = !activeProvider
    ? 'Активный провайдер не выбран.'
    : !agentUsesLlama
      ? `Активен другой провайдер: ${activeProvider.name} · ${activeProvider.selectedModel || 'модель не выбрана'}`
      : agentModelMatches
        ? `${activeProvider.name} использует загруженную модель: ${loadedModel?.name || loadedModel?.filename || activeProvider.selectedModel}`
        : serverReady
          ? `В настройках выбрана «${activeProvider.selectedModel || 'модель не выбрана'}», но она не совпадает с моделью, загруженной в сервер.`
          : `Провайдер выбран, модель настроена: ${activeProvider.selectedModel || 'не выбрана'}, но активного подключения к модели нет.`;

  return (
    <section className="mt-3 rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">Состояние локального ИИ</h3>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">Четыре независимых уровня проверки · обновление каждые 3 секунды</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          Обновить
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StatusLine
          title={`1. Модели: ${ggufModels.length ? `найдены (${ggufModels.length})` : 'не найдены'}`}
          state={localModelsError ? 'error' : ggufModels.length ? 'ok' : 'off'}
          detail={localModelsError || (ggufModels.length
            ? ggufModels.slice(0, 4).map((model) => model.filename || model.name).join(' · ') + (ggufModels.length > 4 ? ` · и ещё ${ggufModels.length - 4}` : '')
            : 'В каталоге OneCoreAI нет готовых GGUF-файлов.')}
        />
        <StatusLine
          title={`2. llama-server: ${runtime?.status === 'ready' ? 'запущен' : runtime?.status === 'loading' ? 'запускается' : runtime?.status === 'error' ? 'ошибка' : 'остановлен'}`}
          state={runtimeStatus}
          detail={runtimeError || runtime?.error || (runtime?.status === 'ready'
            ? `PID: ${runtime.pid ?? '—'} · API: ${runtime.baseUrl}`
            : runtime?.status === 'loading' ? 'Ожидание готовности API…' : 'Процесс llama-server не запущен.')}
        />
        <StatusLine
          title={`3. Модель в llama-server: ${modelLoaded ? 'загружена' : serverLoading && runtime?.modelId ? 'загружается' : 'не загружена'}`}
          state={modelLoaded ? 'ok' : serverLoading && runtime?.modelId ? 'pending' : 'off'}
          detail={modelLoaded
            ? `${loadedModel?.name || runtime?.modelId} · ${runtime?.modelPath || 'путь не определён'}`
            : serverLoading && runtime?.modelId
              ? `Загружается: ${loadedModel?.name || runtime.modelId}`
              : 'Сервер не подтвердил загрузку модели.'}
        />
        <StatusLine
          title={`4. Модель агента: ${agentModelMatches ? 'подключена' : 'не подключена'}`}
          state={agentModelMatches ? 'ok' : 'off'}
          detail={agentDetail}
        />
      </div>
    </section>
  );
};

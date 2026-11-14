import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  Circle,
  ExternalLink,
  KeyRound,
  Laptop,
  Loader2,
  Power,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AiProviderCategory, FreeProviderKind, FreeProviderProfile } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';

const CATEGORY_LABELS: Record<AiProviderCategory, string> = {
  local: 'LOCAL',
  cloud: 'CLOUD',
  runtime: 'RUNTIME',
};

const CATEGORY_ORDER: AiProviderCategory[] = ['local', 'cloud', 'runtime'];

const categoryForProvider = (kind: FreeProviderKind): AiProviderCategory => {
  if (kind === 'ollama' || kind === 'lmstudio') return 'local';
  if (
    kind === 'deepseek-api' ||
    kind === 'qwen-api' ||
    kind === 'openai-api' ||
    kind === 'openrouter-free' ||
    kind === 'groq-free'
  ) {
    return 'cloud';
  }
  return 'runtime';
};

const categoryProviders = (providers: FreeProviderProfile[], category: AiProviderCategory) =>
  providers.filter((provider) => categoryForProvider(provider.kind) === category);

const providerLinkMap: Partial<Record<FreeProviderKind, { label: string; url: string }>> = {
  'deepseek-api': { label: 'Получить API Key', url: 'https://platform.deepseek.com/api_keys' },
  'qwen-api': { label: 'Получить API Key', url: 'https://bailian.console.aliyun.com/?tab=model#/api-key' },
  'openai-api': { label: 'Получить API Key', url: 'https://platform.openai.com/api-keys' },
  'openrouter-free': { label: 'Получить API Key', url: 'https://openrouter.ai/keys' },
  'groq-free': { label: 'Получить API Key', url: 'https://console.groq.com/keys' },
  'llama-cpp': { label: 'Скачать llama.cpp', url: 'https://github.com/ggml-org/llama.cpp/releases' },
  ollama: { label: 'Скачать Ollama', url: 'https://ollama.com/download' },
  lmstudio: { label: 'Открыть LM Studio', url: 'https://lmstudio.ai/' },
};

const providerTag = (provider: FreeProviderProfile) => {
  switch (provider.kind) {
    case 'openrouter-free':
    case 'groq-free':
      return 'Бесплатный тариф';
    case 'llama-cpp':
      return 'Локальный сервер · llama.cpp';
    case 'ollama':
      return 'Локальный сервер · Ollama';
    case 'lmstudio':
      return 'Локальный сервер · LM Studio';
    case 'custom':
      return 'OpenAI-compatible';
    case 'deepseek-api':
    case 'qwen-api':
    case 'openai-api':
      return 'Облако · API-ключ';
  }
};

const serverStatusLabel = (status: string) => {
  switch (status) {
    case 'generating':
      return 'Модель выполняет запрос';
    case 'loading':
      return 'Загрузка модели';
    case 'error':
      return 'Ошибка сервера';
    case 'ready':
      return 'Сервер запущен';
    default:
      return 'Сервер остановлен';
  }
};

export const AiSettingsModal: React.FC = () => {
  const {
    aiSettingsModalOpen,
    aiSettingsCategory,
    setAiSettingsCategory,
    closeAiSettingsModal,
    freeProviders,
    roles,
    enabledRoleIds,
    toggleAgentRole,
    activeProviderId,
    updateFreeProvider,
    saveSettings,
    fetchProviderModels,
    setActiveProvider,
    serverStatus,
    toggleServerPower,
    uiStyle,
  } = useOneCoreStore();

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pendingProviderId, setPendingProviderId] = useState(activeProviderId);

  useEffect(() => {
    if (aiSettingsModalOpen) setPendingProviderId(activeProviderId);
  }, [aiSettingsModalOpen, activeProviderId]);

  const visibleProviders = useMemo(
    () => categoryProviders(freeProviders, aiSettingsCategory),
    [freeProviders, aiSettingsCategory],
  );
  const chosenProvider = visibleProviders.find((provider) => provider.id === pendingProviderId) ?? null;
  const activeProvider = freeProviders.find((provider) => provider.id === activeProviderId) ?? null;
  const activeProviderCategory = activeProvider ? categoryForProvider(activeProvider.kind) : null;
  const activeProviderStatus = !activeProvider
    ? 'Не выбран'
    : activeProvider.kind === 'llama-cpp'
      ? serverStatus === 'ready' || serverStatus === 'generating'
        ? 'Подключено'
        : serverStatus === 'loading'
          ? 'Подключение…'
          : serverStatus === 'error'
            ? 'Ошибка'
            : 'Не подключено'
      : activeProvider.status === 'connected'
        ? 'Подключено'
        : activeProvider.status === 'checking'
          ? 'Проверка…'
          : activeProvider.status === 'error'
            ? 'Ошибка'
            : 'Не подключено';
  const providerLink = chosenProvider ? providerLinkMap[chosenProvider.kind] : undefined;
  const hasLlamaServer = chosenProvider?.kind === 'llama-cpp';
  const tokens = useMemo(() => getUiTokens(uiStyle), [uiStyle]);

  const handleSelectProvider = (providerId: string) => {
    setPendingProviderId(providerId);
    setValidationError(null);
  };

  const validateProvider = () => {
    if (!chosenProvider) {
      setValidationError('Выберите провайдера в текущей категории.');
      return false;
    }
    if (chosenProvider.requiresKey && !chosenProvider.apiKey.trim()) {
      setValidationError('Для выбранного провайдера нужен API-ключ. Добавьте ключ и повторите подключение.');
      return false;
    }
    if (!chosenProvider.baseUrl.trim()) {
      setValidationError('Укажите базовый URL для выбранного провайдера.');
      return false;
    }
    return true;
  };

  const handleConnect = async () => {
    if (!validateProvider() || !chosenProvider) return;

    setConnecting(true);
    setValidationError(null);
    try {
      const connected = await fetchProviderModels(chosenProvider.id);
      if (!connected) {
        const latestProvider = useOneCoreStore.getState().freeProviders.find((provider) => provider.id === chosenProvider.id);
        setValidationError(latestProvider?.lastCheckMessage || 'Не удалось подключиться к провайдеру.');
        return;
      }

      setActiveProvider(chosenProvider.id);
      const result = await saveSettings();
      if (!result.ok) {
        setValidationError(result.error || 'Подключение установлено, но не удалось сохранить его.');
        return;
      }
      setValidationError(null);
    } finally {
      setConnecting(false);
    }
  };

  const handleSave = async () => {
    setSubmitting(true);
    setValidationError(null);
    try {
      const result = await saveSettings();
      if (!result.ok) {
        setValidationError(result.error || 'Не удалось сохранить настройки.');
        return;
      }
      closeAiSettingsModal();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckModels = async () => {
    if (!chosenProvider) return;
    await fetchProviderModels(chosenProvider.id);
  };

  return (
    <AnimatePresence>
      {aiSettingsModalOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAiSettingsModal}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative flex h-[610px] max-h-[88vh] w-[860px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#12161d]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shrink-0 border-b border-zinc-200/80 px-5 pt-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Глобальные настройки ИИ
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Провайдер и модель для чата и задач
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeAiSettingsModal}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    aria-label="Закрыть"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1">
                  {CATEGORY_ORDER.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setAiSettingsCategory(category);
                        setValidationError(null);
                      }}
                      aria-pressed={aiSettingsCategory === category}
                      className={cn(
                        'border-b-2 px-4 pb-2.5 text-[11px] font-semibold tracking-[0.16em] transition-colors',
                        aiSettingsCategory === category
                          ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                          : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                      )}
                    >
                      {CATEGORY_LABELS[category]}
                    </button>
                  ))}
                </div>
                <div className="grid w-[54%] grid-cols-4 gap-1.5">
                  {roles.filter((role) => ['developer', 'architect', 'reviewer', 'qa'].includes(role.persona)).map((role) => {
                    const enabled = enabledRoleIds.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        aria-pressed={enabled}
                        onClick={() => toggleAgentRole(role.id)}
                        className={cn(
                          'min-w-0 rounded-md border px-1.5 py-1.5 text-center text-[9px] font-medium transition-colors',
                          enabled
                            ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800',
                        )}
                      >
                        <span className="block truncate">{role.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                <span>Активный провайдер: <strong className="font-medium text-zinc-700 dark:text-zinc-200">{activeProvider?.name ?? 'Не выбран'}</strong></span>
                <span>Режим: <strong className="font-medium text-zinc-700 dark:text-zinc-200">{activeProviderCategory ? CATEGORY_LABELS[activeProviderCategory] : '—'}</strong></span>
                <span>Подключение: <strong className={cn('font-medium', activeProviderStatus === 'Подключено' ? 'text-emerald-600 dark:text-emerald-400' : activeProviderStatus === 'Ошибка' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-200')}>{activeProviderStatus}</strong></span>
              </div>
            </header>

            <main className="grid min-h-0 flex-1 grid-cols-12 gap-3 px-4 pb-4 pt-2">
              <div className="col-span-5 h-full space-y-2 overflow-y-auto pr-1">
                {visibleProviders.map((provider) => {
                  const isSelected = provider.id === pendingProviderId;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => handleSelectProvider(provider.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-500/10'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:bg-zinc-900',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                          <span className="truncate">{provider.name}</span>
                          {provider.isLocal ? (
                            <Laptop className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Server className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                          {providerTag(provider)}
                        </span>
                      </span>
                      <span className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true">
                        {isSelected ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5 opacity-40" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="col-span-7 h-full overflow-y-auto pl-1">
                {chosenProvider ? (
                  <section className="min-h-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                          Выбранный провайдер
                        </div>
                        <h2 className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {chosenProvider.name}
                        </h2>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium',
                          chosenProvider.status === 'connected'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : chosenProvider.status === 'error'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                        )}
                      >
                        {chosenProvider.status === 'connected'
                          ? 'Подключен'
                          : chosenProvider.status === 'checking'
                            ? 'Проверка…'
                            : chosenProvider.status === 'error'
                              ? 'Ошибка'
                              : 'Не проверен'}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {chosenProvider.description}
                    </p>
                    {providerLink && (
                      <a
                        href={providerLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {providerLink.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {(aiSettingsCategory === 'runtime' || hasLlamaServer) && (
                      <div className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                              {hasLlamaServer ? 'Локальный llama-server' : 'Проверка среды выполнения'}
                            </div>
                            <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                              {hasLlamaServer ? serverStatusLabel(serverStatus) : chosenProvider.lastCheckMessage || 'OpenAI-compatible endpoint'}
                            </div>
                          </div>
                          {hasLlamaServer ? (
                            <button
                              type="button"
                              onClick={toggleServerPower}
                              disabled={serverStatus === 'generating' || serverStatus === 'loading'}
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50',
                                serverStatus === 'stopped' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-zinc-700 hover:bg-zinc-600',
                              )}
                            >
                              <Power className="h-3 w-3" />
                              {serverStatus === 'stopped' ? 'Запустить сервер' : 'Остановить'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleCheckModels()}
                              disabled={chosenProvider.status === 'checking'}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              {chosenProvider.status === 'checking' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              Проверить endpoint
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                          Base URL
                        </span>
                        <input
                          type="text"
                          value={chosenProvider.baseUrl}
                          onChange={(event) =>
                            updateFreeProvider(chosenProvider.id, { baseUrl: event.target.value })
                          }
                          className={cn(
                            'h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
                            tokens.inputRadius,
                          )}
                        />
                      </label>

                      {chosenProvider.requiresKey && (
                        <label className="block">
                          <span className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                            <KeyRound className="h-3 w-3" />
                            API Key {aiSettingsCategory === 'runtime' ? '(необязательно)' : ''}
                          </span>
                          <input
                            type="password"
                            value={chosenProvider.apiKey}
                            onChange={(event) =>
                              updateFreeProvider(chosenProvider.id, { apiKey: event.target.value })
                            }
                            className={cn(
                              'h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
                              tokens.inputRadius,
                            )}
                            placeholder={aiSettingsCategory === 'cloud' ? 'Введите API Key' : 'Необязательно'}
                          />
                        </label>
                      )}

                      <label className="block">
                        <span className="mb-1 block text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                          Model
                        </span>
                        <select
                          value={chosenProvider.selectedModel}
                          onChange={(event) =>
                            updateFreeProvider(chosenProvider.id, { selectedModel: event.target.value })
                          }
                          className={cn(
                            'h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
                            tokens.inputRadius,
                          )}
                        >
                          {chosenProvider.availableModels.length ? (
                            chosenProvider.availableModels.map((modelName) => (
                              <option key={modelName} value={modelName}>
                                {modelName}
                              </option>
                            ))
                          ) : (
                            <option value={chosenProvider.selectedModel}>
                              {chosenProvider.selectedModel || 'Выберите модель'}
                            </option>
                          )}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => void handleCheckModels()}
                        disabled={chosenProvider.status === 'checking'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {chosenProvider.status === 'checking' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Проверить модели
                      </button>
                    </div>
                  </section>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl border border-zinc-200 px-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    {visibleProviders.length === 0 ? 'Нет провайдеров в этой категории.' : 'Выберите провайдера в списке. Активное подключение не изменится до нажатия «ПОДКЛЮЧИТЬ». '}
                  </div>
                )}
              </div>
            </main>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                {validationError ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{validationError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    Подключение сохраняется автоматически. «СОХРАНИТЬ» отдельно сохраняет настройки.
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting || submitting || !chosenProvider}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3.5 py-2 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-300"
                >
                  {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  ПОДКЛЮЧИТЬ
                </button>
                <button
                  type="button"
                  onClick={closeAiSettingsModal}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={submitting || connecting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  СОХРАНИТЬ
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

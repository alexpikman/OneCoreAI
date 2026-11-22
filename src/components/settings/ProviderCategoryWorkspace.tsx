import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Cpu,
  ExternalLink,
  Laptop,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AiProviderCategory, FreeProviderKind, FreeProviderProfile } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { getProviderCategory } from '../../utils/providerCategories';
import { ProviderModelsModal } from './ProviderModelsModal';

interface ProviderKindPreset {
  kind: FreeProviderKind;
  label: string;
  badgeText: string;
  defaultName: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  isLocal: boolean;
  description: string;
  link?: { label: string; url: string };
}

const PRESETS_BY_CATEGORY: Record<Exclude<AiProviderCategory, 'llama-server'>, ProviderKindPreset[]> = {
  local: [
    {
      kind: 'ollama',
      label: 'Ollama (OpenAI API)',
      badgeText: 'Локально · OpenAI API',
      defaultName: 'Ollama (локальный сервер)',
      defaultBaseUrl: 'http://127.0.0.1:11434/v1',
      defaultModel: '',
      requiresKey: false,
      isLocal: true,
      description: 'Прямое подключение к локальному демону Ollama без ограничений контекста или токенов.',
      link: { label: 'Скачать Ollama', url: 'https://ollama.com/download' },
    },
    {
      kind: 'lmstudio',
      label: 'LM Studio (Port 1234)',
      badgeText: 'Локально · Port 1234',
      defaultName: 'LM Studio (локальный сервер)',
      defaultBaseUrl: 'http://127.0.0.1:1234/v1',
      defaultModel: 'qwen2.5-coder-7b-instruct',
      requiresKey: false,
      isLocal: true,
      description: 'Локальный OpenAI-compatible сервер LM Studio.',
      link: { label: 'Открыть LM Studio', url: 'https://lmstudio.ai/' },
    },
  ],
  cloud: [
    {
      kind: 'deepseek-api',
      label: 'DeepSeek API',
      badgeText: 'Облако · API-ключ',
      defaultName: 'DeepSeek API',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      requiresKey: true,
      isLocal: false,
      description: 'Официальный облачный API DeepSeek. Требуется API-ключ.',
      link: { label: 'Получить API Key', url: 'https://platform.deepseek.com/api_keys' },
    },
    {
      kind: 'qwen-api',
      label: 'Qwen API (DashScope)',
      badgeText: 'Облако · API-ключ',
      defaultName: 'Qwen API (DashScope)',
      defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      defaultModel: 'qwen-plus',
      requiresKey: true,
      isLocal: false,
      description: 'Официальный OpenAI-compatible API Qwen через DashScope.',
      link: { label: 'Получить API Key', url: 'https://bailian.console.aliyun.com/?tab=model#/api-key' },
    },
    {
      kind: 'openai-api',
      label: 'OpenAI API',
      badgeText: 'Облако · API-ключ',
      defaultName: 'OpenAI API',
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      requiresKey: true,
      isLocal: false,
      description: 'Официальный облачный API OpenAI.',
      link: { label: 'Получить API Key', url: 'https://platform.openai.com/api-keys' },
    },
    {
      kind: 'openrouter-free',
      label: 'OpenRouter (:free)',
      badgeText: '$0.00 · Без списаний',
      defaultName: 'OpenRouter (:free)',
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
      requiresKey: true,
      isLocal: false,
      description: 'Автоматический фильтр строго по бесплатным облачным моделям (:free).',
      link: { label: 'Получить API Key', url: 'https://openrouter.ai/keys' },
    },
    {
      kind: 'groq-free',
      label: 'Groq Free Tier',
      badgeText: 'Бесплатный LPU-кластер',
      defaultName: 'Groq Free Tier',
      defaultBaseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
      requiresKey: true,
      isLocal: false,
      description: 'Высокоскоростной бесплатный тариф Groq.',
      link: { label: 'Получить API Key', url: 'https://console.groq.com/keys' },
    },
  ],
  compatible: [
    {
      kind: 'custom',
      label: 'OpenAI-compatible endpoint',
      badgeText: 'OpenAI-compatible',
      defaultName: 'Мой OpenAI-compatible сервер',
      defaultBaseUrl: 'http://127.0.0.1:8000/v1',
      defaultModel: '',
      requiresKey: true,
      isLocal: true,
      description: 'Пользовательское OpenAI-compatible подключение (vLLM, TabbyAPI, LocalAI, VPS).',
    },
  ],
};

const ALL_PRESETS = new Map<FreeProviderKind, ProviderKindPreset>(
  Object.values(PRESETS_BY_CATEGORY)
    .flat()
    .map((preset) => [preset.kind, preset]),
);

const CATEGORY_COPY: Record<
  Exclude<AiProviderCategory, 'llama-server'>,
  { title: string; subtitle: string; emptyTitle: string; formSubtitle: string }
> = {
  local: {
    title: 'Локальные провайдеры',
    subtitle: 'Ollama, LM Studio и другие локальные серверы',
    emptyTitle: 'Локальных провайдеров пока нет',
    formSubtitle: 'Локальный endpoint (LOCAL)',
  },
  cloud: {
    title: 'Облачные провайдеры',
    subtitle: 'DeepSeek, Qwen, OpenAI, OpenRouter, Groq и другие API',
    emptyTitle: 'Облачных провайдеров пока нет',
    formSubtitle: 'Облачный API (CLOUD)',
  },
  compatible: {
    title: 'OpenAI-compatible серверы',
    subtitle: 'Все ваши OpenAI-compatible endpoints (vLLM, TabbyAPI, VPS)',
    emptyTitle: 'Подключений пока нет',
    formSubtitle: 'OpenAI-compatible endpoint (COMPATIBLE)',
  },
};

const inputClassName =
  'h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-900/60 dark:disabled:text-zinc-400';

interface ProviderCategoryWorkspaceProps {
  category: Exclude<AiProviderCategory, 'llama-server'>;
}

export const ProviderCategoryWorkspace: React.FC<ProviderCategoryWorkspaceProps> = ({ category }) => {
  const {
    freeProviders,
    activeProviderId,
    addFreeProvider,
    updateFreeProvider,
    deleteFreeProvider,
    fetchProviderModels,
    saveSettings,
  } = useOneCoreStore();

  const presets = PRESETS_BY_CATEGORY[category];
  const defaultPreset = presets[0];
  const copy = CATEGORY_COPY[category];

  const providers = useMemo(
    () => freeProviders.filter((provider) => getProviderCategory(provider.kind) === category),
    [freeProviders, category],
  );

  const [kind, setKind] = useState<FreeProviderKind>(defaultPreset.kind);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState(defaultPreset.defaultBaseUrl);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(defaultPreset.defaultModel);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modelsModalProviderId, setModelsModalProviderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const resetForm = (nextCategoryPresets = presets) => {
    const preset = nextCategoryPresets[0];
    setEditingProviderId(null);
    setKind(preset.kind);
    setName('');
    setBaseUrl(preset.defaultBaseUrl);
    setApiKey('');
    setModel(preset.defaultModel);
    setError(null);
    setMessage(null);
  };

  useEffect(() => {
    resetForm(PRESETS_BY_CATEGORY[category]);
    setModelsModalProviderId(null);
  }, [category]);

  const editingProvider = useMemo(
    () => (editingProviderId ? providers.find((item) => item.id === editingProviderId) ?? null : null),
    [editingProviderId, providers],
  );
  const activePreset = ALL_PRESETS.get(kind) ?? defaultPreset;

  const handleKindChange = (nextKind: FreeProviderKind) => {
    const prevPreset = ALL_PRESETS.get(kind);
    const nextPreset = ALL_PRESETS.get(nextKind) ?? defaultPreset;
    setKind(nextKind);
    if (!editingProviderId) {
      if (!name.trim() || name === prevPreset?.defaultName) {
        setName(nextPreset.defaultName);
      }
      if (!baseUrl.trim() || baseUrl === prevPreset?.defaultBaseUrl) {
        setBaseUrl(nextPreset.defaultBaseUrl);
      }
      if (!model.trim() || model === prevPreset?.defaultModel) {
        setModel(nextPreset.defaultModel);
      }
    }
  };

  const handleStartAdd = () => {
    resetForm(presets);
    window.setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleEdit = (provider: FreeProviderProfile) => {
    setEditingProviderId(provider.id);
    setKind(provider.kind);
    setName(provider.name);
    setBaseUrl(provider.baseUrl);
    setApiKey('');
    setModel(provider.selectedModel);
    setError(null);
    setMessage(null);
    window.setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleToggleEnabled = async (provider: FreeProviderProfile) => {
    const nextEnabled = provider.enabled === false;
    setTogglingId(provider.id);
    setError(null);
    try {
      updateFreeProvider(provider.id, { enabled: nextEnabled });
      const saved = await saveSettings();
      if (!saved.ok) {
        updateFreeProvider(provider.id, { enabled: !nextEnabled });
        setError(saved.error || 'Не удалось сохранить состояние провайдера.');
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (provider: FreeProviderProfile) => {
    const confirmed = await requestDeleteWarning({
      variant: 'confirmation',
      title: 'Удалить провайдера?',
      description: 'Подключение и сохранённые параметры этого провайдера будут удалены из списка.',
      itemName: provider.name,
      confirmLabel: 'Удалить',
    });
    if (!confirmed) return;

    setDeletingId(provider.id);
    setError(null);
    setMessage(null);
    try {
      if (editingProviderId === provider.id) {
        resetForm(presets);
      }
      if (modelsModalProviderId === provider.id) {
        setModelsModalProviderId(null);
      }
      deleteFreeProvider(provider.id);
      const saved = await saveSettings();
      if (!saved.ok) {
        setError(saved.error || 'Не удалось сохранить удаление провайдера.');
        return;
      }
      setMessage(`Провайдер «${provider.name}» удалён.`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async () => {
    const normalizedName = name.trim();
    const normalizedUrl = baseUrl.trim();
    if (!normalizedName || !normalizedUrl) {
      setError('Укажите название провайдера и Base URL.');
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('protocol');
    } catch {
      setError('Base URL должен быть корректным HTTP или HTTPS адресом.');
      return;
    }

    const preset = ALL_PRESETS.get(kind) ?? defaultPreset;
    if (preset.requiresKey && kind !== 'custom' && !apiKey.trim()) {
      setError('Для выбранного облачного провайдера укажите API Key.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const providerId = `prov-${category}-${crypto.randomUUID()}`;
    const isLocalHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname);
    const provider: FreeProviderProfile = {
      id: providerId,
      kind,
      name: normalizedName,
      badgeText: preset.badgeText,
      baseUrl: normalizedUrl.replace(/\/+$/, ''),
      apiKey: apiKey.trim(),
      requiresKey: preset.requiresKey,
      isLocal: category === 'local' ? true : category === 'cloud' ? false : isLocalHost,
      enabled: true,
      selectedModel: model.trim(),
      availableModels: model.trim() ? [model.trim()] : [],
      description: preset.description,
      status: 'idle',
    };

    try {
      addFreeProvider(provider);
      const saved = await saveSettings();
      if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить провайдера.');
      const connected = await fetchProviderModels(providerId);
      const latest = useOneCoreStore.getState().freeProviders.find((item) => item.id === providerId);
      const savedAfterCheck = await saveSettings();
      if (!savedAfterCheck.ok) throw new Error(savedAfterCheck.error || 'Не удалось сохранить результат проверки.');
      if (!connected) {
        setError(latest?.lastCheckMessage || 'Провайдер добавлен, но endpoint /models не ответил.');
      } else {
        setMessage(`Провайдер «${normalizedName}» добавлен. Найдено моделей: ${latest?.availableModels.length ?? 0}.`);
        setName('');
        setApiKey('');
        setModel(preset.defaultModel);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось добавить провайдера.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProviderId || !name.trim() || !baseUrl.trim()) {
      setError('Укажите название провайдера и Base URL.');
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('protocol');
    } catch {
      setError('Base URL должен быть корректным HTTP или HTTPS адресом.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    const isLocalHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname);
    const patch: Partial<FreeProviderProfile> = {
      name: name.trim(),
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      selectedModel: model.trim(),
      isLocal: category === 'local' ? true : category === 'cloud' ? false : isLocalHost,
      status: 'idle',
    };
    if (apiKey.trim()) patch.apiKey = apiKey.trim();

    try {
      updateFreeProvider(editingProviderId, patch);
      const saved = await saveSettings();
      if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить изменения провайдера.');
      const connected = await fetchProviderModels(editingProviderId);
      const latest = useOneCoreStore.getState().freeProviders.find((item) => item.id === editingProviderId);
      const savedAfterCheck = await saveSettings();
      if (!savedAfterCheck.ok) throw new Error(savedAfterCheck.error || 'Не удалось сохранить результат проверки.');
      if (!connected) {
        setError(latest?.lastCheckMessage || 'Изменения сохранены, но сервер не ответил на /models.');
      } else {
        setMessage(`Провайдер «${latest?.name ?? name.trim()}» обновлён.`);
        resetForm(presets);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось обновить провайдера.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    resetForm(presets);
  };

  const datalistId = `provider-models-datalist-${category}`;
  const CategoryIcon = category === 'local' ? Laptop : category === 'cloud' ? Cloud : Server;

  return (
    <>
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: Unified Provider List */}
        <section className="flex min-h-0 flex-col lg:col-span-7">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.title}</h2>
                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {providers.length}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={handleStartAdd}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white transition hover:bg-blue-500 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить провайдер
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
            {providers.length ? (
              providers.map((provider) => {
                const isActive = provider.id === activeProviderId;
                const isEditing = provider.id === editingProviderId;
                const isEnabled = provider.enabled !== false;
                const isChecking = provider.status === 'checking';
                const isBusyToggle = togglingId === provider.id;
                const isBusyDelete = deletingId === provider.id;

                return (
                  <article
                    key={provider.id}
                    className={cn(
                      'flex min-h-[132px] flex-col justify-between gap-3 rounded-xl border p-4 transition-colors',
                      isEditing
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
                        : isActive && isEnabled
                          ? 'border-blue-500/40 bg-white dark:border-blue-500/40 dark:bg-zinc-950/50'
                          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40',
                      !isEnabled && 'opacity-75',
                    )}
                  >
                    {/* Card Top: Identity + Availability Indicator + On/Off Switch */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CategoryIcon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              category === 'local'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : category === 'cloud'
                                  ? 'text-violet-600 dark:text-violet-400'
                                  : 'text-blue-600 dark:text-blue-400',
                            )}
                          />
                          <h3 className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {provider.name}
                          </h3>
                          {isActive && isEnabled && (
                            <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                              Активный
                            </span>
                          )}
                          {isEditing && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              Редактируется
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate pl-6 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {provider.baseUrl}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        {/* Availability Status Indicator */}
                        <span
                          title={provider.lastCheckMessage || undefined}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
                            !isEnabled
                              ? 'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                              : provider.status === 'connected'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : provider.status === 'checking'
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                  : provider.status === 'error'
                                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                    : 'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                          )}
                        >
                          {isChecking ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                !isEnabled
                                  ? 'bg-zinc-400'
                                  : provider.status === 'connected'
                                    ? 'bg-emerald-500'
                                    : provider.status === 'error'
                                      ? 'bg-rose-500'
                                      : 'bg-amber-500',
                              )}
                            />
                          )}
                          {!isEnabled
                            ? 'Выключен'
                            : provider.status === 'connected'
                              ? 'Доступен'
                              : provider.status === 'checking'
                                ? 'Проверка…'
                                : provider.status === 'error'
                                  ? 'Недоступен'
                                  : 'Не проверен'}
                        </span>

                        {/* ВКЛ / ВЫКЛ Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          aria-label={`Переключить провайдер ${provider.name}: ${isEnabled ? 'ВКЛ' : 'ВЫКЛ'}`}
                          disabled={isBusyToggle}
                          onClick={() => void handleToggleEnabled(provider)}
                          className={cn(
                            'inline-flex h-6 items-center gap-1.5 rounded-full border px-1.5 text-[10px] font-bold tracking-wide transition-colors disabled:opacity-50',
                            isEnabled
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
                          )}
                        >
                          <span
                            className={cn(
                              'h-3.5 w-3.5 rounded-full transition-colors',
                              isEnabled ? 'bg-emerald-500' : 'bg-zinc-400',
                            )}
                          />
                          <span>{isEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Bottom: Model Count + Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800/80">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                          <Layers className="h-3 w-3 text-blue-500" />
                          Моделей: <strong className="tabular-nums">{provider.availableModels.length}</strong>
                        </span>
                        {provider.selectedModel && (
                          <span className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                            <Cpu className="h-3 w-3 shrink-0 text-zinc-400" />
                            <span className="truncate">{provider.selectedModel}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModelsModalProviderId(provider.id)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-500/20 dark:text-blue-300 whitespace-nowrap"
                        >
                          <Cpu className="h-3 w-3" />
                          Доступные модели
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(provider)}
                          disabled={submitting}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
                        >
                          <Pencil className="h-3 w-3" />
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(provider)}
                          disabled={submitting || isBusyDelete}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 whitespace-nowrap"
                        >
                          {isBusyDelete ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Удалить
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-12 text-center dark:border-zinc-700">
                <CategoryIcon className="mx-auto h-6 w-6 text-zinc-400" />
                <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">{copy.emptyTitle}</p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Нажмите «Добавить провайдер» или заполните форму справа.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Identical Add / Edit Provider Form */}
        <section className="flex h-full min-h-0 flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50 lg:col-span-5">
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                  {editingProviderId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {editingProviderId ? 'Редактирование провайдера' : 'Новый провайдер'}
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{copy.formSubtitle}</p>
                </div>
              </div>
              {activePreset.link && (
                <a
                  href={activePreset.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {activePreset.link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  Тип провайдера
                </span>
                <select
                  value={kind}
                  disabled={Boolean(editingProviderId)}
                  onChange={(event) => handleKindChange(event.target.value as FreeProviderKind)}
                  className={inputClassName}
                >
                  {presets.map((preset) => (
                    <option key={preset.kind} value={preset.kind}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  Название
                </span>
                <input
                  ref={nameInputRef}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={activePreset.defaultName}
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  Base URL
                </span>
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder={activePreset.defaultBaseUrl}
                  className={cn(inputClassName, 'font-mono')}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  API Key{' '}
                  <span className="font-normal text-zinc-400">
                    {activePreset.requiresKey && kind !== 'custom' ? '(обязателен)' : '(если требуется)'}
                  </span>
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    editingProvider?.secretConfigured
                      ? 'Ключ сохранён (оставьте пустым, чтобы не менять)'
                      : activePreset.requiresKey && kind !== 'custom'
                        ? 'Введите API Key'
                        : 'Необязательно'
                  }
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  Модель по умолчанию <span className="font-normal text-zinc-400">(необязательно)</span>
                </span>
                <input
                  list={datalistId}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={activePreset.defaultModel || 'ID модели из endpoint'}
                  className={cn(inputClassName, 'font-mono')}
                />
                <datalist id={datalistId}>
                  {(editingProvider?.availableModels ?? []).map((modelName) => (
                    <option key={modelName} value={modelName} />
                  ))}
                </datalist>
              </label>
            </div>
          </div>

          <div className="mt-4 shrink-0 space-y-2.5 border-t border-zinc-200 pt-3.5 dark:border-zinc-800">
            {error && (
              <p role="alert" className="text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={() => void (editingProviderId ? handleSaveEdit() : handleAdd())}
              disabled={submitting}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-semibold tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {editingProviderId ? 'СОХРАНИТЬ И ПРОВЕРИТЬ' : 'ДОБАВИТЬ И ПРОВЕРИТЬ'}
            </button>

            {editingProviderId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={submitting}
                className="h-8 w-full rounded-lg border border-zinc-200 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ОТМЕНИТЬ РЕДАКТИРОВАНИЕ
              </button>
            )}

            <div className="flex items-start gap-2 pt-1 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Каждое подключение проверяется по API /models и сохраняется отдельно в локальном хранилище.
            </div>
          </div>
        </section>
      </div>

      <ProviderModelsModal
        providerId={modelsModalProviderId}
        onClose={() => setModelsModalProviderId(null)}
      />
    </>
  );
};

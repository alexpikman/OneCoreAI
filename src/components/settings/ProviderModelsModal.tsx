import React, { useEffect, useMemo, useState } from 'react';
import { Check, Cpu, Loader2, RefreshCw, Search, Server, ShieldCheck, UserCheck, X } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';
import { getProviderCategory } from '../../utils/providerCategories';

interface ProviderModelsModalProps {
  providerId: string | null;
  onClose: () => void;
}

export const ProviderModelsModal: React.FC<ProviderModelsModalProps> = ({ providerId, onClose }) => {
  const {
    freeProviders,
    activeProviderId,
    roles,
    activeRoleId,
    setActiveRole,
    subagentConfig,
    fetchProviderModels,
    assignProviderModelToRole,
    saveSettings,
  } = useOneCoreStore();

  const provider = useMemo(
    () => freeProviders.find((item) => item.id === providerId) ?? null,
    [freeProviders, providerId],
  );

  const [selectedRoleId, setSelectedRoleId] = useState<string>(activeRoleId || roles[0]?.id || 'role-developer');
  const [searchQuery, setSearchQuery] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [busyModel, setBusyModel] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) return;
    setSelectedRoleId(activeRoleId || roles[0]?.id || 'role-developer');
    setSearchQuery('');
    setCustomModelInput('');
    setError(null);
    setNotice(null);
  }, [providerId, activeRoleId, roles]);

  useEffect(() => {
    if (!providerId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [providerId, onClose]);

  const allModels = useMemo(() => {
    const set = new Set<string>();
    for (const modelName of provider?.availableModels ?? []) {
      if (modelName.trim()) set.add(modelName.trim());
    }
    if (provider?.selectedModel.trim()) {
      set.add(provider.selectedModel.trim());
    }
    return Array.from(set);
  }, [provider?.availableModels, provider?.selectedModel]);

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter((modelName) => modelName.toLowerCase().includes(q));
  }, [allModels, searchQuery]);

  if (!provider) return null;

  const isEnabled = provider.enabled !== false;
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const roleProfile = selectedRole ? subagentConfig.providerProfilesByRole[selectedRole.id] : undefined;
  const roleSelectedCategory = roleProfile?.providerCategory;
  const roleSelectedProviderId = roleSelectedCategory
    ? roleProfile?.providerSelectionByCategory?.[roleSelectedCategory]
    : undefined;
  const roleAssignedProvider = roleProfile?.providers.find((item) => item.id === roleSelectedProviderId);
  const roleAssignedModel =
    roleAssignedProvider?.id === provider.id ? roleAssignedProvider.selectedModel : null;

  const handleRefreshModels = async () => {
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const ok = await fetchProviderModels(provider.id);
      const latest = useOneCoreStore.getState().freeProviders.find((item) => item.id === provider.id);
      if (!ok) {
        setError(latest?.lastCheckMessage || 'Не удалось получить список моделей с провайдера.');
        return;
      }
      const saved = await saveSettings();
      if (!saved.ok) {
        setError(saved.error || 'Список моделей получен, но не сохранён в настройках.');
        return;
      }
      setNotice(`Список моделей обновлён (${latest?.availableModels.length ?? 0}).`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    setActiveRole(roleId, false);
    setError(null);
    setNotice(null);
  };

  const handleActivateForRole = async (modelName: string) => {
    const trimmed = modelName.trim();
    if (!trimmed || !selectedRole) return;
    setBusyModel(trimmed);
    setError(null);
    setNotice(null);
    try {
      assignProviderModelToRole(provider.id, trimmed, selectedRole.id);
      const saved = await saveSettings();
      if (!saved.ok) {
        setError(saved.error || 'Не удалось сохранить активную модель для роли.');
        return;
      }
      setNotice(`Модель «${trimmed}» активирована для роли «${selectedRole.name}».`);
    } finally {
      setBusyModel(null);
    }
  };

  const providerCategoryLabel = getProviderCategory(provider.kind).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-models-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Server className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <h2
                id="provider-models-modal-title"
                className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Доступные модели · {provider.name}
              </h2>
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {providerCategoryLabel}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  !isEnabled
                    ? 'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                    : provider.status === 'connected'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : provider.status === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                )}
              >
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
                {!isEnabled
                  ? 'Выключен'
                  : provider.status === 'connected'
                    ? 'Доступен'
                    : provider.status === 'error'
                      ? 'Ошибка'
                      : 'Не проверен'}
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {provider.baseUrl}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно доступных моделей"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role Selector + Refresh Bar */}
        <div className="space-y-3 border-b border-zinc-200 bg-zinc-50/80 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
            <label className="block sm:col-span-7">
              <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                <UserCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Текущая роль (для активации модели)
              </span>
              <select
                value={selectedRole?.id ?? ''}
                onChange={(event) => handleRoleChange(event.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.defaultMode.toUpperCase()})
                    {role.id === activeRoleId ? ' · активна' : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-end gap-2 sm:col-span-5">
              <button
                type="button"
                onClick={() => void handleRefreshModels()}
                disabled={refreshing || provider.status === 'checking'}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {refreshing || provider.status === 'checking' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Обновить список с сервера
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>
              Сейчас у роли «<strong className="font-medium text-zinc-800 dark:text-zinc-200">{selectedRole?.name}</strong>»:{' '}
              <strong className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {roleAssignedProvider ? `${roleAssignedProvider.name} / ${roleAssignedProvider.selectedModel || 'не выбрана'}` : 'наследует основной провайдер'}
              </strong>
            </span>
            <span className="tabular-nums">Всего моделей: {allModels.length}</span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Фильтр по названию модели…"
              className="h-8.5 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Models List */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              {notice}
            </p>
          )}

          {filteredModels.length > 0 ? (
            filteredModels.map((modelName) => {
              const isRoleActive = roleAssignedModel === modelName;
              const isPrimaryActive = activeProviderId === provider.id && provider.selectedModel === modelName;
              const isBusy = busyModel === modelName;

              return (
                <div
                  key={modelName}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors',
                    isRoleActive || isPrimaryActive
                      ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-500/10'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span className="truncate font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {modelName}
                      </span>
                      {isRoleActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <Check className="h-3 w-3" />
                          Активна для роли
                        </span>
                      )}
                      {isPrimaryActive && (
                        <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          Основная
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(busyModel)}
                    onClick={() => void handleActivateForRole(modelName)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition whitespace-nowrap disabled:opacity-50',
                      isRoleActive && isPrimaryActive
                        ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-blue-600 text-white hover:bg-blue-500',
                    )}
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    {isRoleActive && isPrimaryActive ? 'Активна для роли' : 'Сделать активной для роли'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-700">
              <Cpu className="mx-auto h-5 w-5 text-zinc-400" />
              <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {allModels.length === 0
                  ? 'Модели ещё не загружены'
                  : 'Нет моделей по вашему фильтру'}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {allModels.length === 0
                  ? 'Нажмите «Обновить список с сервера», чтобы запросить реальные модели, или укажите ID модели ниже.'
                  : 'Очистите фильтр или введите ID модели вручную ниже.'}
              </p>
            </div>
          )}

          {/* Manual Model Assign Bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <input
              type="text"
              value={customModelInput}
              onChange={(event) => setCustomModelInput(event.target.value)}
              placeholder="Указать ID модели вручную для текущей роли…"
              className="h-8.5 min-w-48 flex-1 rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              disabled={!customModelInput.trim() || Boolean(busyModel)}
              onClick={() => void handleActivateForRole(customModelInput)}
              className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              Назначить вручную
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Выбранная модель сохраняется для роли и основного чата.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

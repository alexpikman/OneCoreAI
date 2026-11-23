import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, KeyRound, Laptop, LockKeyhole, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { FreeProviderKind } from '../../types/onecore';
import { apiFetch } from '../../utils/apiFetch';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { getProviderCategory } from '../../utils/providerCategories';

interface ProviderSecret {
  id: string;
  kind?: FreeProviderKind;
  name: string;
  requiresKey: boolean;
  configured: boolean;
  scope?: 'primary' | 'subagent';
  roleId?: string;
}

interface IntegrationSecret {
  kind: 'github' | 'cloud-fallback' | 'gateway';
  id: string;
  label: string;
  configured: boolean;
}

interface SecurityStatus {
  vault?: { configured: boolean; backend: string };
  providers?: ProviderSecret[];
  integrations?: IntegrationSecret[];
}

export const SecurityPage: React.FC = () => {
  const [status, setStatus] = useState<SecurityStatus>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [integrationValues, setIntegrationValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedProviderGroups, setExpandedProviderGroups] = useState<Record<string, boolean>>({});
  const [designerPairing, setDesignerPairing] = useState<{ code: string; apiBaseUrl: string; expiresAt: string } | null>(null);
  const [designerPairingBusy, setDesignerPairingBusy] = useState(false);

  const refresh = async () => {
    setLoadingStatus(true);
    setStatusError('');
    try {
      const response = await apiFetch('/api/security/secrets');
      const data = (await response.json()) as { ok?: boolean; error?: string } & SecurityStatus;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Не удалось загрузить состояние безопасности (HTTP ${response.status})`);
      }
      setStatus(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка загрузки состояния';
      setStatusError(message);
      throw e;
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  const createDesignerPairing = async () => {
    setDesignerPairingBusy(true);
    setError('');
    setNotice('');
    setDesignerPairing(null);
    try {
      const response = await apiFetch('/api/designer/pairing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OneCore-Approval': 'user-confirmed',
        },
        body: JSON.stringify({ approved: true }),
      });
      const responseBody = await response.text();
      let data: {
        ok?: boolean;
        code?: string;
        apiBaseUrl?: string;
        expiresAt?: string;
        error?: string;
      };
      try {
        data = responseBody.trim()
          ? JSON.parse(responseBody) as typeof data
          : {};
      } catch {
        const preview = responseBody.slice(0, 240).replace(/\\s+/g, ' ');
        throw new Error(
          `API подключения Designer вернул некорректный ответ (HTTP ${response.status}): ${preview || 'пустое тело ответа'}`,
        );
      }
      if (!response.ok || !data.ok || !data.code || !data.apiBaseUrl || !data.expiresAt) {
        const detail = data.error || (responseBody.trim() ? responseBody.slice(0, 240) : 'API вернул пустое тело ответа');
        throw new Error(`Не удалось создать код подключения Designer (HTTP ${response.status}). ${detail}`);
      }
      setDesignerPairing({
        code: data.code,
        apiBaseUrl: data.apiBaseUrl,
        expiresAt: data.expiresAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подключения Designer');
    } finally {
      setDesignerPairingBusy(false);
    }
  };

  const credentialId = (provider: ProviderSecret) =>
    `${provider.scope ?? 'primary'}:${provider.roleId ?? ''}:${provider.id}`;

  const providerGroups = useMemo(() => {
    const rawProviders = status.providers ?? [];
    const primaryById = new Map<string, ProviderSecret>();
    for (const item of rawProviders) {
      if ((item.scope ?? 'primary') !== 'primary') continue;
      const existing = primaryById.get(item.id);
      if (!existing || (!existing.configured && item.configured)) {
        primaryById.set(item.id, item);
      }
    }

    // Merge duplicate primary entries that share identical provider name + kind when unconfigured
    const uniquePrimary: ProviderSecret[] = [];
    const seenNameKind = new Set<string>();
    for (const item of primaryById.values()) {
      const signature = `${item.kind ?? ''}:${item.name.trim().toLowerCase()}`;
      if (seenNameKind.has(signature) && !item.configured) continue;
      seenNameKind.add(signature);
      uniquePrimary.push(item);
    }

    const resolveCategory = (provider: ProviderSecret): 'cloud' | 'compatible' | 'local' => {
      if (provider.kind) {
        const category = getProviderCategory(provider.kind);
        return category === 'llama-server' ? 'local' : category;
      }
      if (!provider.requiresKey || /ollama|lmstudio|llama/i.test(provider.id)) return 'local';
      if (provider.id === 'prov-custom' || /custom/i.test(provider.id)) return 'compatible';
      return 'cloud';
    };

    const cloudProviders = uniquePrimary.filter((p) => resolveCategory(p) === 'cloud');
    const compatibleProviders = uniquePrimary.filter((p) => resolveCategory(p) === 'compatible');
    const localProviders = uniquePrimary.filter((p) => resolveCategory(p) === 'local');

    // Keep subagent / role overrides only when distinct from primary or explicitly configured, deduplicated per scope/role/id
    const overrideByScopeId = new Map<string, ProviderSecret>();
    for (const item of rawProviders) {
      if (item.scope !== 'subagent') continue;
      const isUniqueToSubagent = !primaryById.has(item.id);
      if (!item.configured && !isUniqueToSubagent) continue;
      const key = `${item.roleId ?? ''}:${item.id}`;
      const existing = overrideByScopeId.get(key);
      if (!existing || (!existing.configured && item.configured)) {
        overrideByScopeId.set(key, item);
      }
    }
    const overrideProviders = Array.from(overrideByScopeId.values());

    return [
      {
        id: 'cloud',
        title: 'Облачные провайдеры (CLOUD)',
        description: 'Ключи облачных API (используются основным агентом и по умолчанию субагентами).',
        providers: cloudProviders,
      },
      {
        id: 'compatible',
        title: 'Совместимые провайдеры (COMPATIBLE)',
        description: 'Ключи доступа к сторонним OpenAI-compatible серверам.',
        providers: compatibleProviders,
      },
      {
        id: 'local',
        title: 'Локальные рантаймы (LOCAL / LLAMASERVER)',
        description: 'Локальные серверы моделей (обычно работают без API-ключа).',
        providers: localProviders,
      },
      {
        id: 'subagent-overrides',
        title: 'Отдельные ключи субагентов и ролей',
        description: 'Переопределённые ключи, заданные отдельно от основных провайдеров.',
        providers: overrideProviders,
      },
    ].filter((group) => group.providers.length > 0);
  }, [status.providers]);

  const save = async (provider: ProviderSecret) => {
    const providerId = provider.id;
    const valueKey = credentialId(provider);
    const apiKey = values[valueKey]?.trim() ?? '';
    if (!apiKey) return;
    setBusy(valueKey);
    setError('');
    setNotice('');
    try {
      const query =
        provider.scope === 'subagent'
          ? `?scope=subagent${provider.roleId ? `&roleId=${encodeURIComponent(provider.roleId)}` : ''}`
          : '';
      const response = await apiFetch(`/api/security/providers/${encodeURIComponent(providerId)}/key${query}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось сохранить ключ');
      setValues((current) => ({ ...current, [valueKey]: '' }));
      await refresh();
      await useOneCoreStore.getState().refreshSettings();
      setNotice('Ключ сохранён в защищённом хранилище.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setBusy(null);
    }
  };

  const clear = async (provider: ProviderSecret) => {
    const confirmed = await requestDeleteWarning({
      variant: 'confirmation',
      title: 'Удалить ключ доступа?',
      description:
        'Сохранённый ключ будет удалён из защищённого хранилища. Для работы провайдера потребуется добавить его снова.',
      itemName: provider.name,
      confirmLabel: 'Удалить ключ',
    });
    if (!confirmed) return;
    const providerId = provider.id;
    setBusy(credentialId(provider));
    setError('');
    setNotice('');
    try {
      const query =
        provider.scope === 'subagent'
          ? `?scope=subagent${provider.roleId ? `&roleId=${encodeURIComponent(provider.roleId)}` : ''}`
          : '';
      const response = await apiFetch(`/api/security/providers/${encodeURIComponent(providerId)}/key${query}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось удалить ключ');
      await refresh();
      await useOneCoreStore.getState().refreshSettings();
      setNotice('Ключ удалён.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    } finally {
      setBusy(null);
    }
  };

  const saveIntegration = async (item: IntegrationSecret) => {
    const key = `${item.kind}:${item.id}`;
    const secret = integrationValues[key]?.trim() ?? '';
    if (!secret) return;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`/api/security/integrations/${item.kind}/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось сохранить секрет');
      setIntegrationValues((current) => ({ ...current, [key]: '' }));
      await refresh();
      await useOneCoreStore.getState().refreshSettings();
      setNotice('Секрет сохранён в защищённом хранилище.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setBusy(null);
    }
  };

  const clearIntegration = async (item: IntegrationSecret) => {
    const confirmed = await requestDeleteWarning({
      variant: 'confirmation',
      title: 'Удалить секрет интеграции?',
      description: 'Секрет будет удалён из защищённого хранилища. Интеграцию потребуется настроить повторно.',
      itemName: item.label,
      confirmLabel: 'Удалить секрет',
    });
    if (!confirmed) return;
    const key = `${item.kind}:${item.id}`;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`/api/security/integrations/${item.kind}/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось удалить секрет');
      await refresh();
      await useOneCoreStore.getState().refreshSettings();
      setNotice('Секрет удалён.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl font-semibold">Безопасность</h1>
          </div>
        </div>
      </PageHeader>
      <PageContent>
        <div className="space-y-6 py-6">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              {notice}
            </p>
          )}

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Хранилище секретов</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Используется системное хранилище учётных данных ОС с зашифрованным локальным Vault в качестве резервного механизма.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <span className="text-zinc-500">Состояние</span>
              <span
                className={
                  statusError
                    ? 'font-medium text-rose-700 dark:text-rose-300'
                    : status.vault?.configured
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : 'font-medium text-zinc-500'
                }
              >
                {loadingStatus ? 'Проверка…' : statusError ? 'Ошибка проверки' : status.vault?.configured ? 'Доступно' : 'Недоступно'}
              </span>
            </div>
            {statusError && (
              <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                {statusError}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">OneCore Designer</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Создайте одноразовый код для подключения отдельного desktop-приложения Designer к этому экземпляру OneCoreAI.
            </p>
            <button
              type="button"
              disabled={designerPairingBusy}
              onClick={() => void createDesignerPairing()}
              className="mt-4 h-9 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
            >
              {designerPairingBusy ? 'Создание кода…' : 'Создать код подключения'}
            </button>
            {designerPairing && (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Одноразовый код подключения</div>
                <div className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em] text-zinc-900 dark:text-zinc-100">
                  {designerPairing.code}
                </div>
                <div className="mt-3 break-all text-xs text-zinc-500 dark:text-zinc-400">
                  API: {designerPairing.apiBaseUrl}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Действует до {new Date(designerPairing.expiresAt).toLocaleTimeString('ru-RU')}. Использовать можно один раз.
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">API-ключи AI-провайдеров</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Дублирующие профили ролей и субагентов объединены: общие ключи наследуются автоматически. Нажмите на группу, чтобы раскрыть список провайдеров.
              </p>
            </div>
            <div className="space-y-2">
              {providerGroups.map((group) => {
                const expanded = expandedProviderGroups[group.id] === true;
                const contentId = `security-provider-group-${group.id}`;
                const requiresKeyCount = group.providers.filter((p) => p.requiresKey).length;
                const configuredCount = group.providers.filter((p) => p.configured).length;

                return (
                  <div
                    key={group.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={contentId}
                      onClick={() =>
                        setExpandedProviderGroups((current) => ({
                          ...current,
                          [group.id]: !current[group.id],
                        }))
                      }
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{group.title}</h3>
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                            {requiresKeyCount > 0
                              ? `Настроено: ${configuredCount} / ${requiresKeyCount}`
                              : `Провайдеров: ${group.providers.length}`}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>
                      </div>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                      )}
                    </button>

                    <div
                      id={contentId}
                      hidden={!expanded}
                      className="space-y-2 border-t border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/30"
                    >
                      {group.providers.map((provider) => (
                        <article
                          key={credentialId(provider)}
                          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {provider.name}
                                {provider.scope === 'subagent' && provider.roleId ? ` · ${provider.roleId}` : ''}
                              </h4>
                              <p className="mt-0.5 text-xs text-zinc-500">{provider.id}</p>
                            </div>
                            <span
                              className={
                                provider.configured
                                  ? 'text-xs font-medium text-emerald-700 dark:text-emerald-400'
                                  : 'text-xs text-zinc-500'
                              }
                            >
                              {provider.configured
                                ? 'Ключ настроен'
                                : provider.requiresKey
                                  ? 'Ключ не задан'
                                  : 'Ключ не требуется'}
                            </span>
                          </div>
                          {provider.requiresKey && (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <input
                                type="password"
                                autoComplete="new-password"
                                value={values[credentialId(provider)] ?? ''}
                                onChange={(e) =>
                                  setValues((current) => ({ ...current, [credentialId(provider)]: e.target.value }))
                                }
                                placeholder={provider.configured ? 'Новый ключ для замены' : 'Введите API-ключ'}
                                className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                              />
                              <button
                                type="button"
                                disabled={busy === credentialId(provider) || !(values[credentialId(provider)] ?? '').trim()}
                                onClick={() => void save(provider)}
                                className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
                              >
                                {busy === credentialId(provider) ? 'Сохранение…' : 'Сохранить ключ'}
                              </button>
                              {provider.configured && (
                                <button
                                  type="button"
                                  disabled={busy === credentialId(provider)}
                                  onClick={() => void clear(provider)}
                                  className="h-9 rounded-lg border border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30 whitespace-nowrap"
                                >
                                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                                  Удалить
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {providerGroups.length === 0 && !loadingStatus && (
              <p className="text-sm text-zinc-500">Сначала добавьте провайдера в разделе AI Инструменты → Провайдеры.</p>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ключи интеграций</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                GitHub, cloud fallback и токены подключённых шлюзов.
              </p>
            </div>
            {(status.integrations ?? []).map((item) => {
              const key = `${item.kind}:${item.id}`;
              return (
                <article
                  key={key}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.label}</h3>
                    <span className="text-xs text-zinc-500">{item.configured ? 'Секрет настроен' : 'Не задан'}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={integrationValues[key] ?? ''}
                      onChange={(e) => setIntegrationValues((current) => ({ ...current, [key]: e.target.value }))}
                      placeholder={item.configured ? 'Новое значение для замены' : 'Введите секрет'}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      disabled={busy === key || !(integrationValues[key] ?? '').trim()}
                      onClick={() => void saveIntegration(item)}
                      className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
                    >
                      Сохранить
                    </button>
                    {item.configured && (
                      <button
                        type="button"
                        disabled={busy === key}
                        onClick={() => void clearIntegration(item)}
                        className="h-9 rounded-lg border border-rose-300 px-3 text-xs text-rose-700 dark:border-rose-900 dark:text-rose-300 whitespace-nowrap"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Realtime Server API</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Управление клиентскими ключами требует серверного контракта аутентификации: выпуск, хеширование, scopes, срок действия, отзыв и аудит должны выполняться realtime-сервером.
            </p>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={loadingStatus}
              onClick={() => void refresh().catch(() => undefined)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
              {loadingStatus ? 'Обновление…' : 'Обновить статус'}
            </button>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

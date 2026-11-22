import React, { useEffect, useState } from 'react';
import { KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { requestDeleteWarning } from '../../utils/deleteWarning';

interface ProviderSecret {
  id: string;
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

  const credentialId = (provider: ProviderSecret) =>
    `${provider.scope ?? 'primary'}:${provider.roleId ?? ''}:${provider.id}`;
  const primaryProviders = (status.providers ?? []).filter((provider) => (provider.scope ?? 'primary') === 'primary');
  const sharedSubagentProviders = (status.providers ?? []).filter(
    (provider) => provider.scope === 'subagent' && !provider.roleId,
  );
  const roleProviderGroups = Object.entries(
    (status.providers ?? [])
      .filter((provider) => provider.scope === 'subagent' && provider.roleId)
      .reduce<Record<string, ProviderSecret[]>>((groups, provider) => {
        const roleId = provider.roleId ?? 'unknown';
        (groups[roleId] ??= []).push(provider);
        return groups;
      }, {}),
  );

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

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">API-ключи AI-провайдеров</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Ключ показывается только при вводе. Для замены введите новое значение; для удаления используйте отдельную команду.
              </p>
            </div>
            {[
              { title: 'Основные провайдеры', description: 'Ключи используются основным AI-агентом.', providers: primaryProviders },
              {
                title: 'Общие провайдеры субагентов',
                description: 'Ключи доступны субагентам, если роль не переопределяет собственный профиль.',
                providers: sharedSubagentProviders,
              },
              ...roleProviderGroups.map(([roleId, providers]) => ({
                title: `Профиль роли: ${roleId}`,
                description: 'Ключи изолированы в конфигурации этой роли и не заменяют общий ключ субагентов.',
                providers,
              })),
            ]
              .filter((group) => group.providers.length > 0)
              .map((group) => (
                <div key={group.title} className="space-y-2">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{group.title}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>
                  </div>
                  {group.providers.map((provider) => (
                    <article
                      key={credentialId(provider)}
                      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{provider.name}</h4>
                          <p className="mt-0.5 text-xs text-zinc-500">{provider.id}</p>
                        </div>
                        <span
                          className={
                            provider.configured ? 'text-xs text-emerald-700 dark:text-emerald-400' : 'text-xs text-zinc-500'
                          }
                        >
                          {provider.configured ? 'Ключ настроен' : provider.requiresKey ? 'Ключ не задан' : 'Ключ не требуется'}
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
              ))}
            {status.providers?.length === 0 && (
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

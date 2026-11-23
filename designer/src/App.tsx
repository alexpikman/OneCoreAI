import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppearanceEditor } from './AppearanceEditor';
import { NavigationEditor } from './NavigationEditor';
import type { AppearanceTokens, ComponentRegistry, NavigationLayoutConfig } from './types';

interface ConfigurationDocument {
  schemaVersion: number;
  revision: number;
  scope: { type: 'global' | 'project'; projectId?: string };
  config: Record<string, unknown>;
}

interface Connection {
  apiBaseUrl: string;
  token: string;
}

interface ApiError {
  ok?: boolean;
  error?: string;
}

async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`OneCoreAI API вернул пустой ответ (HTTP ${response.status})`);
  }
  try {
    return JSON.parse(body);
  } catch {
    const preview = body.slice(0, 180).replace(/\s+/g, ' ');
    throw new Error(`OneCoreAI API вернул некорректный JSON (HTTP ${response.status}): ${preview}`);
  }
}

function normalizeApiUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Разрешено подключение только к локальному OneCoreAI API');
  }
  return parsed.origin;
}

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://127.0.0.1:3000');
  const [pairingCode, setPairingCode] = useState('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [configuration, setConfiguration] = useState<ConfigurationDocument | null>(null);
  const [history, setHistory] = useState<ConfigurationDocument[]>([]);
  const [registry, setRegistry] = useState<ComponentRegistry | null>(null);
  const [navigationIcons, setNavigationIcons] = useState<string[]>([]);
  const [navigationLayout, setNavigationLayout] = useState<NavigationLayoutConfig | null>(null);
  const [navigationLayoutDirty, setNavigationLayoutDirty] = useState(false);
  const [appearanceTokens, setAppearanceTokens] = useState<AppearanceTokens | null>(null);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [appearancePreviewing, setAppearancePreviewing] = useState(false);
  const previewLinkRef = useRef<HTMLLinkElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const clearAppearancePreview = () => {
    previewLinkRef.current?.remove();
    previewLinkRef.current = null;
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
    setAppearancePreviewing(false);
  };

  useEffect(() => () => {
    previewLinkRef.current?.remove();
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
  }, []);

  const loadConfiguration = async (activeConnection: Connection) => {
    clearAppearancePreview();
    const headers = { Authorization: `Bearer ${activeConnection.token}` };
    const [configurationResponse, historyResponse, registryResponse] = await Promise.all([
      fetch(new URL('/api/designer/configuration?scope=global', activeConnection.apiBaseUrl), { headers }),
      fetch(new URL('/api/designer/configuration/history?scope=global', activeConnection.apiBaseUrl), { headers }),
      fetch(new URL('/api/designer/registry', activeConnection.apiBaseUrl), { headers }),
    ]);
    const configurationData = await readApiResponse(configurationResponse);
    const historyData = await readApiResponse(historyResponse);
    const registryData = await readApiResponse(registryResponse);
    if (!configurationResponse.ok || !configurationData.ok) {
      throw new Error(configurationData.error || 'Не удалось загрузить конфигурацию');
    }
    if (!historyResponse.ok || !historyData.ok) {
      throw new Error(historyData.error || 'Не удалось загрузить историю конфигураций');
    }
    if (!registryResponse.ok || !registryData.ok || !registryData.registry || !registryData.navigationIcons || !registryData.defaultNavigationLayout || !registryData.defaultAppearanceTokens) {
      throw new Error(registryData.error || 'Не удалось загрузить реестр компонентов');
    }
    setConfiguration(configurationData.configuration ?? null);
    setHistory(historyData.revisions ?? []);
    setRegistry(registryData.registry);
    setNavigationIcons(registryData.navigationIcons);
    const savedNavigationLayout = configurationData.configuration?.config.navigation;
    setNavigationLayout(
      savedNavigationLayout && typeof savedNavigationLayout === 'object' && !Array.isArray(savedNavigationLayout)
        ? savedNavigationLayout as NavigationLayoutConfig
        : registryData.defaultNavigationLayout,
    );
    setNavigationLayoutDirty(false);
    const savedAppearance = configurationData.configuration?.config.appearance;
    setAppearanceTokens(
      savedAppearance && typeof savedAppearance === 'object' && !Array.isArray(savedAppearance)
        ? savedAppearance as AppearanceTokens
        : registryData.defaultAppearanceTokens,
    );
    setAppearanceDirty(false);
  };

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const normalizedUrl = normalizeApiUrl(apiBaseUrl);
      if (!/^\d{8}$/.test(pairingCode.trim())) {
        throw new Error('Введите восьмизначный код подключения');
      }
      const response = await fetch(new URL('/api/designer/session', normalizedUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairingCode.trim() }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !data.ok || !data.token) {
        throw new Error(data.error || 'Не удалось связать Designer с OneCoreAI');
      }
      const nextConnection = { apiBaseUrl: normalizedUrl, token: data.token };
      await loadConfiguration(nextConnection);
      setConnection(nextConnection);
      setPairingCode('');
      setNotice('Designer подключён к OneCoreAI. Сессия хранится только в памяти приложения.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подключения');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!connection) return;
    if ((navigationLayoutDirty || appearanceDirty) && !window.confirm('Отменить несохранённые изменения и загрузить сохранённую версию?')) return;
    setBusy(true);
    setError('');
    try {
      await loadConfiguration(connection);
      setNotice('Конфигурация и история обновлены.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить конфигурацию');
    } finally {
      setBusy(false);
    }
  };

  const saveConfigurationChanges = async (
    changes: Record<string, unknown>,
    confirmation: string,
    successNotice: string,
  ) => {
    if (!connection) return;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    setError('');
    setNotice('');
    const headers = {
      Authorization: `Bearer ${connection.token}`,
      'Content-Type': 'application/json',
    };

    try {
      if (changes.navigation !== undefined) {
        const validationResponse = await fetch(new URL('/api/designer/navigation/validate', connection.apiBaseUrl), {
          method: 'POST',
          headers,
          body: JSON.stringify({ layout: changes.navigation }),
        });
        const validationData = await readApiResponse(validationResponse);
        if (!validationResponse.ok || !validationData.validation?.valid) {
          throw new Error(validationData.validation?.diagnostics.map((item: { message: string }) => item.message).join('; ') || validationData.error || 'Макет навигации не прошёл проверку');
        }
      }

      if (changes.appearance !== undefined) {
        const validationResponse = await fetch(new URL('/api/designer/appearance/validate', connection.apiBaseUrl), {
          method: 'POST',
          headers,
          body: JSON.stringify({ appearance: changes.appearance }),
        });
        const validationData = await readApiResponse(validationResponse);
        if (!validationResponse.ok || !validationData.validation?.valid) {
          throw new Error(validationData.validation?.diagnostics.join('; ') || validationData.error || 'Настройки оформления не прошли проверку');
        }
      }

      const draftResponse = await fetch(new URL('/api/designer/configuration/drafts', connection.apiBaseUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify({ scope: { type: 'global' }, changes }),
      });
      const draftData = await readApiResponse(draftResponse);
      if (
        !draftResponse.ok ||
        !draftData.ok ||
        !draftData.draft ||
        draftData.analysis?.canApply === false ||
        draftData.navigationValidation?.valid === false ||
        draftData.appearanceValidation?.valid === false
      ) {
        const diagnostics = [
          ...(draftData.analysis?.diagnostics.map((item: { message: string }) => item.message) ?? []),
          ...(draftData.navigationValidation?.diagnostics.map((item: { message: string }) => item.message) ?? []),
          ...(draftData.appearanceValidation?.diagnostics ?? []),
        ];
        throw new Error(diagnostics.join('; ') || draftData.error || 'Не удалось подготовить конфигурацию');
      }

      const applyResponse = await fetch(new URL('/api/designer/configuration/apply', connection.apiBaseUrl), {
        method: 'POST',
        headers: { ...headers, 'X-OneCore-Approval': 'user-confirmed' },
        body: JSON.stringify({ draft: draftData.draft }),
      });
      const applyData = await readApiResponse(applyResponse);
      if (!applyResponse.ok || !applyData.ok) {
        throw new Error(applyData.error || 'Не удалось сохранить конфигурацию');
      }

      setNavigationLayoutDirty(false);
      setAppearanceDirty(false);
      await loadConfiguration(connection);
      setNotice(successNotice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения конфигурации');
    } finally {
      setBusy(false);
    }
  };

  const saveDirtyConfiguration = (confirmation: string, successNotice: string) => {
    const changes: Record<string, unknown> = {};
    if (navigationLayoutDirty && navigationLayout) changes.navigation = navigationLayout;
    if (appearanceDirty && appearanceTokens) changes.appearance = appearanceTokens;
    void saveConfigurationChanges(changes, confirmation, successNotice);
  };

  const saveNavigationLayout = () => {
    saveDirtyConfiguration(
      'Сохранить все изменённые настройки Designer?',
      'Конфигурация Designer сохранена. OneCoreAI обновит её при возврате в окно приложения или при следующем запуске.',
    );
  };

  const saveAppearance = () => {
    saveDirtyConfiguration(
      'Сохранить все изменённые настройки Designer?',
      'Конфигурация Designer сохранена. OneCoreAI обновит её при возврате в окно приложения или при следующем запуске.',
    );
  };

  const previewAppearance = async () => {
    if (!connection || !appearanceTokens) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(new URL('/api/designer/appearance/validate', connection.apiBaseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appearance: appearanceTokens }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !data.validation?.valid || !data.css) {
        throw new Error(data.validation?.diagnostics.join('; ') || data.error || 'Не удалось построить предпросмотр оформления');
      }

      const nextUrl = URL.createObjectURL(new Blob([data.css], { type: 'text/css' }));
      const nextLink = document.createElement('link');
      nextLink.rel = 'stylesheet';
      nextLink.href = nextUrl;
      nextLink.dataset.onecoreDesignerPreview = 'true';
      document.head.appendChild(nextLink);

      previewLinkRef.current?.remove();
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
      previewLinkRef.current = nextLink;
      previewObjectUrlRef.current = nextUrl;
      setAppearancePreviewing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка предпросмотра оформления');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (revision: number) => {
    if (!connection || !configuration) return;
    const confirmation = navigationLayoutDirty || appearanceDirty
      ? `Отменить несохранённые изменения и восстановить версию ${revision}?`
      : `Создать новую ревизию на основе версии ${revision}?`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(new URL('/api/designer/configuration/restore', connection.apiBaseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.token}`,
          'Content-Type': 'application/json',
          'X-OneCore-Approval': 'user-confirmed',
        },
        body: JSON.stringify({
          scope: { type: 'global' },
          targetRevision: revision,
          expectedCurrentRevision: configuration.revision,
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось восстановить ревизию');
      await loadConfiguration(connection);
      setNotice(`Создана новая ревизия на основе версии ${revision}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка восстановления');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    if ((navigationLayoutDirty || appearanceDirty) && !window.confirm('Отключить Designer и отменить несохранённые изменения?')) return;
    clearAppearancePreview();
    setConnection(null);
    setConfiguration(null);
    setHistory([]);
    setRegistry(null);
    setNavigationIcons([]);
    setNavigationLayout(null);
    setNavigationLayoutDirty(false);
    setAppearanceTokens(null);
    setAppearanceDirty(false);
    setNotice('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">OneCoreAI / Desktop tools</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">OneCore Designer</h1>
          </div>
          <div className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {connection ? 'CONNECTED' : 'NOT CONNECTED'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && (
          <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {!connection ? (
          <section className="max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Подключение к OneCoreAI</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              В OneCoreAI откройте «Безопасность» → «OneCore Designer» и создайте одноразовый код. Код действует две минуты и используется один раз.
            </p>
            <form className="mt-6 space-y-4" onSubmit={connect}>
              <label className="block space-y-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Локальный API OneCoreAI</span>
                <input
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
                  value={apiBaseUrl}
                  onChange={(event) => setApiBaseUrl(event.target.value)}
                  autoComplete="url"
                  spellCheck={false}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Одноразовый код</span>
                <input
                  className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 font-mono text-xl tracking-[0.3em] outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
                  value={pairingCode}
                  onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="00000000"
                  maxLength={8}
                />
              </label>
              <button
                type="submit"
                disabled={busy || pairingCode.length !== 8}
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Подключение…' : 'Подключить Designer'}
              </button>
            </form>
            <p className="mt-5 border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
              Подключение разрешено только к локальному API. Токен сессии не записывается на диск и действует 12 часов.
            </p>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Глобальная конфигурация</h2>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{connection.apiBaseUrl}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void refresh()} disabled={busy} className="h-9 rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    Обновить
                  </button>
                  <button type="button" onClick={disconnect} className="h-9 rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    Отключить
                  </button>
                </div>
              </div>

              {configuration ? (
                <>
                  <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Schema v{configuration.schemaVersion}</span>
                    <span>Revision {configuration.revision}</span>
                    <span>Global scope</span>
                  </div>
                  <pre className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-6 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    {JSON.stringify(configuration.config, null, 2)}
                  </pre>
                </>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center dark:border-zinc-700">
                  <p className="text-sm font-medium">Глобальная конфигурация ещё не создана</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Хранилище готово. Runtime OneCoreAI пока не использует Designer-конфигурации.</p>
                </div>
              )}

              {navigationLayout && (
                <NavigationEditor
                  layout={navigationLayout}
                  dirty={navigationLayoutDirty}
                  saving={busy}
                  icons={navigationIcons}
                  onChange={(nextLayout) => {
                    setNavigationLayout(nextLayout);
                    setNavigationLayoutDirty(true);
                  }}
                  onSave={() => void saveNavigationLayout()}
                />
              )}
              {appearanceTokens && (
                <AppearanceEditor
                  tokens={appearanceTokens}
                  dirty={appearanceDirty}
                  saving={busy}
                  previewing={appearancePreviewing}
                  onPreview={() => void previewAppearance()}
                  onClearPreview={clearAppearancePreview}
                  onChange={(nextTokens) => {
                    clearAppearancePreview();
                    setAppearanceTokens(nextTokens);
                    setAppearanceDirty(true);
                  }}
                  onSave={saveAppearance}
                />
              )}
              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                Изменения навигации проверяются и сохраняются как отдельная версия Designer. Runtime OneCoreAI загружает проверенный макет при запуске и возврате в окно приложения. Перестановка внутренних блоков страниц остаётся заблокированной до описания их контрактов и зависимостей.
              </div>
            </section>

            <aside className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">История изменений</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Восстановление создаёт новую ревизию, не удаляя историю.</p>
              <div className="mt-4 space-y-2">
                {history.length > 0 ? history.map((item) => (
                  <div key={item.revision} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">Revision {item.revision}</span>
                      {configuration?.revision === item.revision && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">CURRENT</span>}
                    </div>
                    <button
                      type="button"
                      disabled={busy || !configuration || configuration.revision === item.revision}
                      onClick={() => void restore(item.revision)}
                      className="mt-2 h-8 w-full rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      Восстановить
                    </button>
                  </div>
                )) : (
                  <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-5 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    История пока пуста
                  </p>
                )}
              </div>
              <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Реестр компонентов</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {registry?.components.length ?? 0} страниц · {registry?.navigation.length ?? 0} пунктов навигации
                </p>
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {registry?.components.map((component) => (
                    <div key={component.id} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium">{component.label}</span>
                        {component.protected && (
                          <span className="shrink-0 text-[10px] font-medium text-amber-700 dark:text-amber-400">LOCKED</span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-500">{component.renderer}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Реестр отмечает пункты навигации как переносимые. Применение изменений и перестановка страниц как блоков пока отключены.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

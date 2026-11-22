import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, Download, Keyboard, RefreshCw, Server, Shield, Sliders } from 'lucide-react';
import { AIResourcePageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageTransition } from '../../components/layout/PageTransition';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { LlamaServerApiConsoleView } from '../../components/settings/LlamaServerApiConsoleView';
import { LlamaServerBenchmarkView } from '../../components/settings/LlamaServerBenchmarkView';
import { LlamaServerTelemetryView } from '../../components/settings/LlamaServerTelemetryView';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { GpuBackend, SettingsSectionId } from '../../types/onecore';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

type LlamaSubSection = 'engine-paths' | 'llama-paged-attention' | 'llama-openai-api' | 'llama-benchmark';

const LLAMA_SECTIONS: Array<{ id: LlamaSubSection; label: string }> = [
  { id: 'engine-paths', label: 'Настройки' },
  { id: 'llama-paged-attention', label: 'PagedAttention' },
  { id: 'llama-openai-api', label: 'API Console' },
  { id: 'llama-benchmark', label: 'Бенчмарк' },
];

interface LlamaCppChecks {
  installed: boolean;
  downloaded: boolean;
  running: boolean;
  version: string | null;
  executablePath: string | null;
}

export const LlamaServerSettingsPage: React.FC = () => {
  const {
    uiStyle,
    settingsSection,
    setSettingsSection,
    appSettings,
    updateAppSettings,
    saveSettings,
    inferenceSettings,
    updateInferenceSettings,
    freeProviders,
    updateFreeProvider,
  } = useOneCoreStore();

  const activeSection: LlamaSubSection =
    settingsSection === 'llama-paged-attention' ||
    settingsSection === 'llama-openai-api' ||
    settingsSection === 'llama-benchmark'
      ? settingsSection
      : 'engine-paths';

  const tokens = getPageUiTokens(uiStyle);
  const llamaProvider = freeProviders.find((provider) => provider.kind === 'llama-cpp');
  const llamaPort = (() => {
    try {
      return Number(new URL(llamaProvider?.baseUrl || 'http://127.0.0.1:8080/v1').port) || 8080;
    } catch {
      return 8080;
    }
  })();

  const [llamaPortInput, setLlamaPortInput] = useState(String(llamaPort));
  const [llamaPortError, setLlamaPortError] = useState<string | null>(null);
  const [llamaPortSaving, setLlamaPortSaving] = useState(false);

  const [llamaActionRunning, setLlamaActionRunning] = useState<string | null>(null);
  const [llamaOperation, setLlamaOperation] = useState<{
    active: boolean;
    action: string | null;
    phase: string;
    message: string;
    sourcePath: string | null;
    targetPath: string | null;
    fileName: string | null;
    downloadedBytes: number;
    totalBytes: number;
    speedBytesPerSecond: number;
    percent: number | null;
  } | null>(null);
  const [llamaInstallMessage, setLlamaInstallMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [llamaChecks, setLlamaChecks] = useState<LlamaCppChecks | null>(null);
  const [llamaChecksLoading, setLlamaChecksLoading] = useState(false);
  const [llamaOperationHistory, setLlamaOperationHistory] = useState<
    Array<{
      action: string;
      phase: 'completed' | 'error';
      message: string;
      sourcePath: string | null;
      targetPath: string | null;
      fileName: string | null;
      completedAt: number;
    }>
  >([]);
  const [llamaChecksError, setLlamaChecksError] = useState<string | null>(null);

  useEffect(() => {
    setLlamaPortInput(String(llamaPort));
  }, [llamaPort]);

  const refreshLlamaChecks = useCallback(async () => {
    setLlamaChecksLoading(true);
    setLlamaChecksError(null);
    try {
      const response = await fetch('/api/models/llama-cpp/checks', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const responseText = await response.text();
      let data: {
        ok?: boolean;
        installed?: boolean;
        downloaded?: boolean;
        running?: boolean;
        version?: string | null;
        executablePath?: string | null;
        error?: string;
      };
      try {
        data = JSON.parse(responseText) as typeof data;
      } catch {
        const contentType = response.headers.get('content-type') || 'не указан';
        throw new Error(
          `API проверки llama.cpp вернул не JSON (HTTP ${response.status}, ${contentType}). Проверьте сервер и маршрут /api/models/llama-cpp/checks.`,
        );
      }
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setLlamaChecks({
        installed: Boolean(data.installed),
        downloaded: Boolean(data.downloaded),
        running: Boolean(data.running),
        version: data.version ?? null,
        executablePath: data.executablePath ?? null,
      });
    } catch (error) {
      setLlamaChecksError(error instanceof Error ? error.message : 'Не удалось проверить llama-server.');
    } finally {
      setLlamaChecksLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLlamaChecks();
  }, [refreshLlamaChecks]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const response = await fetch('/api/models/llama-cpp/operation', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          operation?: typeof llamaOperation;
          history?: typeof llamaOperationHistory;
        };
        if (mounted && data.operation) setLlamaOperation(data.operation);
        if (mounted && data.history) setLlamaOperationHistory(data.history);
      } catch {
        // Polling is best-effort.
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 400);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const saveLlamaPort = async () => {
    const port = Number(llamaPortInput);
    if (!llamaProvider || !Number.isInteger(port) || port < 1 || port > 65535) {
      setLlamaPortError('Порт должен быть целым числом от 1 до 65535.');
      return;
    }
    setLlamaPortSaving(true);
    setLlamaPortError(null);
    try {
      updateFreeProvider(llamaProvider.id, { baseUrl: `http://127.0.0.1:${port}/v1` });
      const saved = await saveSettings();
      if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить порт llama-server.');
    } catch (cause) {
      setLlamaPortError(cause instanceof Error ? cause.message : 'Не удалось сохранить порт.');
    } finally {
      setLlamaPortSaving(false);
    }
  };

  const runLlamaAction = async (endpoint: string, action: string) => {
    setLlamaActionRunning(endpoint);
    setLlamaInstallMessage(null);
    try {
      const response = await fetch(`/api/models/llama-cpp/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const responseText = await response.text();
      let data: {
        ok?: boolean;
        executablePath?: string;
        version?: string;
        variant?: string;
        selected?: boolean;
        error?: string;
      };
      try {
        data = JSON.parse(responseText) as typeof data;
      } catch {
        const contentType = response.headers.get('content-type') || 'не указан';
        throw new Error(
          `API llama.cpp вернул не JSON (HTTP ${response.status}, ${contentType}). Маршрут: /api/models/llama-cpp/${endpoint}.`,
        );
      }
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (endpoint === 'install' && data.executablePath && data.selected) {
        updateAppSettings({ llamaServerPath: data.executablePath });
        const saved = await saveSettings();
        if (!saved.ok) throw new Error(saved.error || 'Не удалось сохранить путь к llama-server.');
      }
      const successText =
        endpoint === 'download'
          ? `Скачан архив llama.cpp: ${data.version || data.variant || 'релиз'}.`
          : endpoint === 'download/remove'
            ? 'Скачанный архив llama.cpp удалён.'
            : endpoint === 'install'
              ? data.selected
                ? `Установлено: ${data.version || data.variant}. Путь к llama-server сохранён.`
                : `Установлено: ${data.version || data.variant}. Ручной путь сохранён без изменений.`
              : endpoint === 'uninstall'
                ? 'Установленный runtime удалён. Архив сохранён.'
                : endpoint === 'start'
                  ? 'llama-server запущен.'
                  : endpoint === 'stop'
                    ? 'llama-server остановлен.'
                    : 'Операция выполнена.';
      setLlamaInstallMessage({ kind: 'success', text: successText });
    } catch (error) {
      setLlamaInstallMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : `Не удалось выполнить действие: ${action}.`,
      });
    } finally {
      setLlamaActionRunning(null);
      await refreshLlamaChecks();
    }
  };

  return (
    <PageTransition mode="page" className="flex w-full min-h-0 flex-1 flex-col overflow-hidden">
      <AIResourcePageLayout>
        <PageHeader showSave={activeSection === 'engine-paths'}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl font-semibold">LlamaServer</h1>
            </div>
          </div>
        </PageHeader>
        <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
          <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
            <SecondaryTabBar
              ariaLabel="Разделы LlamaServer"
              className="px-5 pt-4"
              items={LLAMA_SECTIONS}
              selectedId={activeSection}
              onSelect={(id) => setSettingsSection(id as SettingsSectionId)}
              footer={
                <div className="mt-2 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>
                    Сервер:{' '}
                    <strong
                      className={cn(
                        'font-medium',
                        llamaChecks?.running
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : llamaChecks?.installed
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-700 dark:text-zinc-200',
                      )}
                    >
                      {llamaChecks?.running ? 'Запущен' : llamaChecks?.installed ? 'Остановлен' : 'Не установлен'}
                    </strong>
                  </span>
                  <span>
                    Endpoint:{' '}
                    <strong className="font-mono font-medium text-zinc-700 dark:text-zinc-200">
                      http://127.0.0.1:{llamaPort}/v1
                    </strong>
                  </span>
                  {llamaChecks?.version && (
                    <span>
                      Версия:{' '}
                      <strong className="font-medium text-zinc-700 dark:text-zinc-200">{llamaChecks.version}</strong>
                    </span>
                  )}
                </div>
              }
            />

            <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              {activeSection === 'llama-paged-attention' ? (
                <LlamaServerTelemetryView embedded />
              ) : activeSection === 'llama-openai-api' ? (
                <LlamaServerApiConsoleView embedded />
              ) : activeSection === 'llama-benchmark' ? (
                <LlamaServerBenchmarkView embedded />
              ) : (
                <div className={cn('p-5 border space-y-6', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Параметры llama.cpp runtime
            </h2>
          </div>

          <div
            className={cn(
              'rounded-xl border-4 bg-white/70 p-3 dark:bg-zinc-950/50',
              !llamaChecks?.downloaded
                ? 'border-rose-500 dark:border-rose-500'
                : !llamaChecks.installed
                  ? 'border-orange-500 dark:border-orange-500'
                  : !llamaChecks.running
                    ? 'border-amber-400 dark:border-amber-400'
                    : 'border-emerald-500 dark:border-emerald-500',
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Состояние llama-server</div>
              <button
                type="button"
                onClick={() => void refreshLlamaChecks()}
                disabled={llamaChecksLoading || Boolean(llamaOperation?.active) || Boolean(llamaActionRunning)}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 px-2 text-[11px] text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                <RefreshCw className={cn('h-3 w-3', llamaChecksLoading && 'animate-spin')} />
                Обновить
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { key: 'downloaded', label: 'Скачан', icon: Download },
                  { key: 'installed', label: 'Установлен', icon: Cpu },
                  { key: 'running', label: 'Запущен', icon: Server },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const value = llamaChecks?.[item.key] ?? false;
                const endpoint =
                  item.key === 'downloaded'
                    ? value
                      ? 'download/remove'
                      : 'download'
                    : item.key === 'installed'
                      ? value
                        ? 'uninstall'
                        : 'install'
                      : value
                        ? 'stop'
                        : 'start';
                const actionLabel =
                  item.key === 'downloaded'
                    ? value
                      ? 'Удалить'
                      : 'Скачать'
                    : item.key === 'installed'
                      ? value
                        ? 'Отключить'
                        : 'Установить'
                      : value
                        ? 'Остановить'
                        : 'Запустить';
                const actionDisabled =
                  Boolean(llamaOperation?.active) ||
                  Boolean(llamaActionRunning) ||
                  llamaChecksLoading ||
                  (item.key === 'installed' && !value && !llamaChecks?.downloaded) ||
                  (item.key === 'running' && !llamaChecks?.installed);
                return (
                  <div
                    key={item.key}
                    className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <Icon className="h-3.5 w-3.5 text-zinc-500" />
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-bold',
                          value ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {llamaChecksLoading && !llamaChecks ? '…' : value ? 'ДА' : 'НЕТ'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void runLlamaAction(endpoint, actionLabel)}
                      disabled={actionDisabled}
                      className={cn(
                        'h-8 w-full rounded-lg border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap',
                        value
                          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950'
                          : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950',
                      )}
                    >
                      {llamaActionRunning === endpoint ||
                      (llamaOperation?.active &&
                        llamaOperation.action ===
                          (endpoint === 'download'
                            ? 'download'
                            : endpoint === 'install'
                              ? 'install'
                              : endpoint === 'download/remove'
                                ? 'remove-download'
                                : endpoint === 'uninstall'
                                  ? 'uninstall'
                                  : endpoint))
                        ? 'Выполняется…'
                        : actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            {llamaOperation && (llamaOperation.active || ['completed', 'error'].includes(llamaOperation.phase)) && (
              <div
                className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/70 dark:bg-blue-950/20"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  {llamaOperation.active && <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />}
                  {llamaOperation.message}
                </div>
                {llamaOperation.action === 'download' && llamaOperation.totalBytes > 0 && (
                  <>
                    <div className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-zinc-800">
                      <progress
                        value={llamaOperation.percent ?? 0}
                        max={100}
                        className="h-2 w-full overflow-hidden rounded-full accent-blue-600"
                      />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
                      <span>
                        {llamaOperation.percent ?? 0}% · {(llamaOperation.downloadedBytes / 1024 / 1024).toFixed(1)} /{' '}
                        {(llamaOperation.totalBytes / 1024 / 1024).toFixed(1)} МБ
                      </span>
                      <span>{(llamaOperation.speedBytesPerSecond / 1024 / 1024).toFixed(2)} МБ/с</span>
                    </div>
                  </>
                )}
                {llamaOperation.fileName && (
                  <p className="break-all text-[11px] text-zinc-600 dark:text-zinc-300">Файл: {llamaOperation.fileName}</p>
                )}
                {llamaOperation.sourcePath && (
                  <p className="break-all text-[11px] text-zinc-600 dark:text-zinc-300">Источник: {llamaOperation.sourcePath}</p>
                )}
                {llamaOperation.targetPath && (
                  <p className="break-all text-[11px] text-zinc-600 dark:text-zinc-300">
                    Путь назначения: {llamaOperation.targetPath}
                  </p>
                )}
              </div>
            )}

            {llamaOperationHistory.length > 0 && (
              <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <div className="mb-2 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Последние операции</div>
                <div className="space-y-2">
                  {llamaOperationHistory.slice(0, 4).map((entry, index) => (
                    <div key={`${entry.completedAt}-${index}`} className="rounded-md bg-zinc-50 px-2.5 py-2 dark:bg-zinc-900/70">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                        <span
                          className={
                            entry.phase === 'error'
                              ? 'font-semibold text-rose-600 dark:text-rose-400'
                              : 'font-semibold text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          {entry.phase === 'error' ? 'Ошибка' : 'Завершено'} ·{' '}
                          {{
                            download: 'Скачивание',
                            install: 'Установка',
                            'remove-download': 'Удаление архива',
                            uninstall: 'Удаление runtime',
                            start: 'Запуск',
                            stop: 'Остановка',
                          }[entry.action] || entry.action}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {new Date(entry.completedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-700 dark:text-zinc-300">{entry.message}</p>
                      {entry.sourcePath && (
                        <p className="mt-1 break-all text-[10px] text-zinc-500 dark:text-zinc-400">
                          Источник: {entry.sourcePath}
                        </p>
                      )}
                      {entry.targetPath && (
                        <p className="break-all text-[10px] text-zinc-500 dark:text-zinc-400">
                          Результат: {entry.targetPath}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {llamaChecks?.version && (
              <p
                className="mt-2 truncate text-[10px] text-zinc-500 dark:text-zinc-400"
                title={llamaChecks.executablePath || undefined}
              >
                Версия: {llamaChecks.version}
              </p>
            )}
            {llamaChecksError && (
              <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                {llamaChecksError}
              </p>
            )}
            {llamaInstallMessage && (
              <p
                role="status"
                className={cn(
                  'mt-2 text-xs',
                  llamaInstallMessage.kind === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400',
                )}
              >
                {llamaInstallMessage.text}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-500" />
              Пути хранения и бинарники
            </div>

            <div>
              <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                Путь к llama-server.exe (или команда из PATH)
              </label>
              <input
                type="text"
                value={appSettings.llamaServerPath}
                onChange={(e) => updateAppSettings({ llamaServerPath: e.target.value })}
                className={cn(
                  'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                  tokens.inputRadius,
                )}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Порт llama-server</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  step={1}
                  value={llamaPortInput}
                  onChange={(event) => setLlamaPortInput(event.target.value)}
                  className={cn(
                    'h-9 w-full border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 tabular-nums',
                    tokens.inputRadius,
                  )}
                />
                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  Локальный endpoint: http://127.0.0.1:{llamaPortInput || '—'}/v1. После изменения перезапустите сервер.
                </p>
                {llamaPortError && (
                  <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {llamaPortError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void saveLlamaPort()}
                disabled={llamaPortSaving || !llamaProvider}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                {llamaPortSaving ? 'Сохранение…' : 'Сохранить порт'}
              </button>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={appSettings.autoCheckSha256}
                onChange={(e) => updateAppSettings({ autoCheckSha256: e.target.checked })}
                className="accent-blue-600 rounded"
              />
              <span>Автоматически проверять SHA256 после завершения загрузки GGUF</span>
            </label>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              Аппаратный профиль (для расчёта совместимости VRAM/RAM)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Бэкенд GPU</label>
                <select
                  value={inferenceSettings.gpuBackend}
                  onChange={(e) => updateInferenceSettings({ gpuBackend: e.target.value as GpuBackend })}
                  className={cn(
                    'w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100',
                    tokens.inputRadius,
                  )}
                >
                  <option value="auto">Авто (CUDA / Vulkan → CPU)</option>
                  <option value="cuda">NVIDIA CUDA</option>
                  <option value="vulkan">Vulkan 1.3</option>
                  <option value="cpu">CPU AVX2</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Доступно VRAM (GB)</label>
                <input
                  type="number"
                  min={2}
                  max={96}
                  step={2}
                  value={inferenceSettings.maxVramGb}
                  onChange={(e) =>
                    updateInferenceSettings({ maxVramGb: Math.max(2, Number(e.target.value) || 8) })
                  }
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 tabular-nums',
                    tokens.inputRadius,
                  )}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Системная RAM (GB)</label>
                <input
                  type="number"
                  min={8}
                  max={256}
                  step={4}
                  value={inferenceSettings.maxRamGb}
                  onChange={(e) =>
                    updateInferenceSettings({ maxRamGb: Math.max(8, Number(e.target.value) || 32) })
                  }
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 tabular-nums',
                    tokens.inputRadius,
                  )}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              Облачный fallback (опционально)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={appSettings.cloudFallbackProvider}
                onChange={(e) =>
                  updateAppSettings({
                    cloudFallbackProvider: e.target.value as typeof appSettings.cloudFallbackProvider,
                  })
                }
                className={cn(
                  'h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100',
                  tokens.inputRadius,
                )}
              >
                <option value="none">Отключён (100% локально)</option>
                <option value="openai">OpenAI Compatible</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
              <input
                type="password"
                disabled={appSettings.cloudFallbackProvider === 'none'}
                value={appSettings.cloudFallbackKey}
                onChange={(e) => updateAppSettings({ cloudFallbackKey: e.target.value })}
                placeholder="Сохраняется в локальном зашифрованном хранилище..."
                className={cn(
                  'sm:col-span-2 h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 disabled:opacity-45',
                  tokens.inputRadius,
                )}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mb-2.5">
              <Keyboard className="w-3.5 h-3.5 text-zinc-500" />
              Горячие клавиши Windows
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: 'Ctrl + Enter', desc: 'Отправить промпт агенту' },
                { key: 'Ctrl + K', desc: 'Открыть поиск моделей GGUF' },
                { key: 'Ctrl + Alt + Z', desc: 'Откат к последнему Checkpoint' },
              ].map((hk) => (
                <div
                  key={hk.key}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40',
                    tokens.cardRadius,
                  )}
                >
                  <span className="text-zinc-600 dark:text-zinc-300">{hk.desc}</span>
                  <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                    {hk.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
                </div>
              )}
            </main>
          </div>
        </PageContent>
      </AIResourcePageLayout>
    </PageTransition>
  );
};

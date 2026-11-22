import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, RotateCcw } from 'lucide-react';
import { DEFAULT_SYSTEM_CONFIG, type SystemConfig } from '../../data/systemConfig';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';

interface ModelMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  averageLatencyMs: number | null;
  maxLatencyMs: number | null;
  lastRequestAt: string | null;
  lastError: string | null;
  startedAt: string;
}

const fields: { key: keyof SystemConfig; label: string; description: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'providerRequestTimeoutMs', label: 'Тайм-аут ответа модели', description: 'Максимальное ожидание ответа от API до завершения запроса.', min: 1000, max: 300000, step: 1000, unit: 'мс' },
  { key: 'providerStreamIdleTimeoutMs', label: 'Тайм-аут потока', description: 'Максимальная пауза между фрагментами потокового ответа.', min: 1000, max: 300000, step: 1000, unit: 'мс' },
  { key: 'agentOperationTimeoutMs', label: 'Лимит времени операции агента', description: 'Общее время выполнения одной агентской операции.', min: 5000, max: 600000, step: 1000, unit: 'мс' },
  { key: 'modelFallbackAttempts', label: 'Попытки переключения модели', description: 'Максимум моделей одного провайдера в одной цепочке запроса, включая исходную.', min: 1, max: 10, step: 1, unit: 'мод.' },
  { key: 'maxToolRounds', label: 'Максимум циклов инструментов', description: 'Сколько раз агент может запросить новый цикл инструментов.', min: 1, max: 20, step: 1, unit: 'циклов' },
  { key: 'maxToolCalls', label: 'Максимум вызовов инструментов', description: 'Общий предел инструментальных вызовов за одну операцию.', min: 1, max: 100, step: 1, unit: 'вызовов' },
];

const Metric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
  </div>
);

export const SystemConfigView: React.FC = () => {
  const systemConfig = useOneCoreStore((state) => state.systemConfig);
  const updateSystemConfig = useOneCoreStore((state) => state.updateSystemConfig);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [metricsError, setMetricsError] = useState('');
  const [metricsLoading, setMetricsLoading] = useState(false);

  const refreshMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError('');
    try {
      const response = await apiFetch('/api/system/metrics');
      const data = await response.json() as { ok?: boolean; metrics?: ModelMetrics; error?: string };
      if (!response.ok || !data.ok || !data.metrics) throw new Error(data.error || `HTTP ${response.status}`);
      setMetrics(data.metrics);
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : 'Не удалось загрузить метрики');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => { void refreshMetrics(); }, [refreshMetrics]);

  const resetDefaults = () => {
    if (!window.confirm('Вернуть системные параметры к значениям по умолчанию? Остальные настройки не изменятся.')) return;
    updateSystemConfig({ ...DEFAULT_SYSTEM_CONFIG });
  };

  const updateNumber = (key: keyof SystemConfig, raw: string) => {
    const field = fields.find((item) => item.key === key);
    if (!field) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    updateSystemConfig({ [key]: Math.max(field.min, Math.min(field.max, Math.round(value / field.step) * field.step)) });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Параметры AI-системы</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Общие ограничения запросов и агентского цикла. Изменения сохраняются общей кнопкой в шапке.</p>
          </div>
          <button type="button" onClick={resetDefaults} className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <RotateCcw className="h-3.5 w-3.5" />
            По умолчанию
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block min-w-0">
              <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{field.label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{field.description}</span>
              <span className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={systemConfig[field.key]}
                  onChange={(event) => updateNumber(field.key, event.target.value)}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm tabular-nums text-zinc-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-950"
                />
                <span className="w-14 shrink-0 text-xs text-zinc-500">{field.unit}</span>
              </span>
              <span className="mt-1 block text-[10px] text-zinc-400">Диапазон: {field.min.toLocaleString('ru-RU')}–{field.max.toLocaleString('ru-RU')}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Мониторинг запросов моделей</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">С момента запуска сервера</span>
          </div>
          <button type="button" onClick={() => void refreshMetrics()} disabled={metricsLoading} className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <RefreshCw className={`h-3.5 w-3.5 ${metricsLoading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
        {metricsError ? <p role="alert" className="mt-4 text-xs text-rose-600 dark:text-rose-400">{metricsError}</p> : null}
        {metrics ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Всего запросов" value={metrics.totalRequests} />
              <Metric label="Успешных" value={metrics.successfulRequests} />
              <Metric label="Ошибок" value={metrics.failedRequests} />
              <Metric label="Переключений модели" value={metrics.fallbackRequests} />
              <Metric label="Среднее время" value={metrics.averageLatencyMs === null ? 'Нет данных' : `${metrics.averageLatencyMs} мс`} />
              <Metric label="Максимальное время" value={metrics.maxLatencyMs === null ? 'Нет данных' : `${metrics.maxLatencyMs} мс`} />
              <Metric label="Входные токены" value={metrics.totalPromptTokens.toLocaleString('ru-RU')} />
              <Metric label="Выходные токены" value={metrics.totalCompletionTokens.toLocaleString('ru-RU')} />
            </div>
            <div className="mt-4 grid gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
              <p>Последний запрос: {metrics.lastRequestAt ? new Date(metrics.lastRequestAt).toLocaleString('ru-RU') : 'Нет данных'}</p>
              <p>Сбор метрик начат: {new Date(metrics.startedAt).toLocaleString('ru-RU')}</p>
              {metrics.lastError ? <p className="sm:col-span-2 text-rose-600 dark:text-rose-400">Последняя ошибка: {metrics.lastError}</p> : null}
            </div>
          </>
        ) : !metricsError ? <p className="mt-4 text-xs text-zinc-500">Загрузка метрик…</p> : null}
        <p className="mt-4 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400 dark:border-zinc-800">Содержимое запросов и секреты не записываются. Счётчики хранятся в памяти и обнуляются при перезапуске сервера. TTFT и скорость токенов пока не доступны для всех провайдеров.</p>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { Play, Pause, SkipForward, RefreshCw, Bug, Shield, Cpu, CheckCircle2, Clock, Terminal, FileText, ArrowRight, Layers, Eye } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageContent } from '../../components/layout/PageContent';

export const DebugFlowPage: React.FC = () => {
  const {
    debugMode,
    toggleDebugMode,
    debugSteps,
    clearDebugSteps,
    setActiveTab,
  } = useOneCoreStore();

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const selectedStep = debugSteps.find((s) => s.id === selectedStepId) || debugSteps[0];

  return (
    <PageLayout>
      <PageHeader showSave={false}>
        <div className="flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Bug className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Живой отладчик запросов (Debug Flow)</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Пошаговый разбор выполнения запросов от А до Я: роутинг, правила, системные указания, вызовы инструментов и верификация.</p>
          </div>
        </div>
      </PageHeader>
      <PageContent>
        <div className="space-y-6">
          {/* Control Panel / Пульт управления движением */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${debugMode ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800'}`}>
                <Bug className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {debugMode ? 'Режим DEBUG (Пошаговый контроль)' : 'Режим PROD (Стандартный поток)'}
                  </h3>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${debugMode ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
                    {debugMode ? 'DEBUG ACTIVE' : 'PROD MODE'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {debugMode ? 'Выполнение приостанавливается на каждом шаге для инспекции payload и правил.' : 'Автоматическое выполнение с проверками безопасности.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDebugMode}
                className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold shadow-sm transition ${debugMode ? 'bg-purple-600 text-white hover:bg-purple-500' : 'border border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'}`}
              >
                <Bug className="h-4 w-4" />
                <span>{debugMode ? 'Отключить DEBUG' : 'Включить DEBUG'}</span>
              </button>

              <button
                type="button"
                onClick={clearDebugSteps}
                title="Очистить лог шагов"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Сбросить</span>
              </button>
            </div>
          </div>

          {/* Main Debug Content: Step List & Deep Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Step Sequence Timeline */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Шаги выполнения запроса ({debugSteps.length})
                </h4>
                <span className="text-[10px] text-zinc-400">В режиме реального времени</span>
              </div>

              {debugSteps.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                  <Clock className="h-8 w-8 text-zinc-400 mb-2" />
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Лог шагов пуст</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Отправьте сообщение в чат или выполните запрос к агенту, чтобы увидеть детальный разбор от А до Я.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('workstation')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500"
                  >
                    <span>Перейти в Чат / Workstation</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {debugSteps.map((step) => {
                    const isSelected = (selectedStep?.id === step.id);
                    return (
                      <div
                        key={step.id}
                        onClick={() => setSelectedStepId(step.id)}
                        className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm dark:border-blue-500/60 dark:bg-blue-950/20' : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'}`}
                      >
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${step.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : step.status === 'paused' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}`}>
                          {step.stepNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{step.title}</span>
                            <span className="text-[10px] font-mono text-zinc-400">{step.timestamp.split('T')[1]?.slice(0, 8)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{step.sender}</span>
                            <ArrowRight className="h-3 w-3 text-zinc-400" />
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{step.receiver}</span>
                          </div>
                          <div className="mt-1.5 text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded px-2 py-0.5 inline-block">
                            {step.guidanceOrRule}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Detailed Deep Inspector (Полный разбор шага) */}
            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Детальный разбор шага (Инспектор от А до Я)
              </h4>

              {selectedStep ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                          {selectedStep.stepNumber}
                        </span>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedStep.title}</h3>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Отправитель: <strong className="text-zinc-700 dark:text-zinc-300">{selectedStep.sender}</strong> → Получатель: <strong className="text-zinc-700 dark:text-zinc-300">{selectedStep.receiver}</strong>
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${selectedStep.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                      {selectedStep.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Руководящее правило / Регламент / Директива
                      </label>
                      <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs font-mono text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        {selectedStep.guidanceOrRule}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Входной Payload (Запрос / Контекст)
                      </label>
                      <pre className="mt-1 max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-zinc-950 p-3 text-xs font-mono text-zinc-200 dark:border-zinc-800">
                        {JSON.stringify(selectedStep.payload, null, 2)}
                      </pre>
                    </div>

                    {selectedStep.result && (
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Выходной Результат / Ответ инструмента
                        </label>
                        <pre className="mt-1 max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-zinc-950 p-3 text-xs font-mono text-emerald-400 dark:border-zinc-800">
                          {JSON.stringify(selectedStep.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                  <Eye className="h-8 w-8 text-zinc-400 mb-2" />
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Выберите шаг слева</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Здесь появится подробный анализ параметров, контекста и результатов шага.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

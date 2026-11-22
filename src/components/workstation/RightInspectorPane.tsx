import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, Archive, MessageSquarePlus, Search, Bell, Bot, ChevronDown, CheckCircle2, Cpu, Download, FileText, FilePenLine, Monitor, MonitorDown, Moon, Pause, Power, RefreshCw, RotateCcw, ShieldCheck, SlidersHorizontal, Sun, Trash2, TerminalSquare, GitBranch, Server, Github, History, Layers, Play, X, XCircle } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import type { GpuBackend } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { requestDeleteWarning } from '../../utils/deleteWarning';

const BACKEND_OPTIONS: { value: GpuBackend; label: string }[] = [
  { value: 'auto', label: 'Авто (CUDA / Vulkan → CPU)' },
  { value: 'cuda', label: 'NVIDIA CUDA 12.4' },
  { value: 'vulkan', label: 'Vulkan 1.3 (Любой GPU)' },
  { value: 'cpu', label: 'Только CPU AVX2' },
];

export const RightInspectorPane: React.FC = () => {
  const {
    files,
    checkpoints,
    rollbackToCheckpoint,
    sshHosts,
    sshSettings,
    toggleFileContext,
    includeProjectTree,
    setIncludeProjectTree,
    includeTerminalOutput,
    setIncludeTerminalOutput,
    inferenceSettings,
    updateInferenceSettings,
    localModels,
    activeModelId,
    serverStatus,
    toggleServerPower,
    tokensPerSec,
    vramUsedGb,
    ramUsedGb,
    chatVisibility,
    navigationVisibility,
    uiStyle,
    freeProviders,
    modelCategory,
    providerSelectionByCategory,
    subagentRuns,
    subagentConfig,
    launchSubagent,
    clearCompletedSubagents,
    hardwareProfile,
    projects,
    activeProjectId,
    projectWorkspace,
    activeProviderId,
    modelSource,
    modelCapabilityReport,
    modelCapabilityStatus,
    checkModelCapabilities,
    lastTokenUsage,
    sessions,
    activeSessionId,
    setActiveSession,
    createNewSession,
    archiveSession,
    restoreSession,
    deleteSession,
    latestUpdate,
    openSettingsSection,
    setActiveTab,
    theme,
    toggleTheme,
    trayOpen,
    setTrayOpen,
    markAllNotificationsRead,
    togglePauseDownload,
    notifications,
  } = useOneCoreStore();

  const { isInstallable, isInstalled, install } = usePWAInstall();
  const trayRef = useRef<HTMLDivElement>(null);

  const [quickSubagentPrompt, setQuickSubagentPrompt] = useState('');
  const [sessionQuery, setSessionQuery] = useState('');
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false);
  const [archivedChatsOpen, setArchivedChatsOpen] = useState(false);
  const [previewArchivedChatId, setPreviewArchivedChatId] = useState<string | null>(null);
  const tokens = getUiTokens(uiStyle);
  const showRight = (key: string) => navigationVisibility[key] !== false;
  const activeModel = localModels.find((m) => m.id === activeModelId);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const activeProvider = freeProviders.find((provider) => provider.id === activeProviderId);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const sessionUsageMessages = activeSession?.messages.filter((message) => typeof message.tokenUsage?.totalTokens === 'number') ?? [];
  const sessionTokenTotal = sessionUsageMessages.reduce((total, message) => total + (message.tokenUsage?.totalTokens ?? 0), 0);
  const runtimeProvider = freeProviders.find(
    (provider) => provider.id === providerSelectionByCategory['llama-server'],
  );
  const runtimeConnected =
    modelCategory === 'llama-server' &&
    runtimeProvider?.kind === 'llama-cpp' &&
    runtimeProvider.status === 'connected';

  useEffect(() => {
    const currentReportMatches =
      modelCapabilityReport?.projectId === activeProjectId &&
      modelCapabilityReport?.providerId === activeProvider?.id &&
      modelCapabilityReport?.modelId === (modelSource === 'llama-server' ? activeModel?.filename : activeProvider?.selectedModel);
    if (
      activeProvider &&
      !currentReportMatches &&
      modelCapabilityStatus !== 'checking' &&
      modelCapabilityStatus !== 'error'
    ) {
      void checkModelCapabilities();
    }
  }, [
    activeProvider?.id,
    activeProvider?.selectedModel,
    activeModel?.filename,
    modelSource,
    activeProjectId,
    modelCapabilityReport?.providerId,
    modelCapabilityReport?.modelId,
    modelCapabilityStatus,
    checkModelCapabilities,
  ]);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (trayOpen && trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setTrayOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [trayOpen, setTrayOpen]);

  const includedTokens =
    files.filter((f) => f.inContext).reduce((acc, f) => acc + f.tokensEstimate, 0) +
    (includeProjectTree ? 180 : 0) +
    (includeTerminalOutput ? 120 : 0);

  const vramPct =
    inferenceSettings.maxVramGb > 0
      ? Math.min(100, Math.round((vramUsedGb / inferenceSettings.maxVramGb) * 100))
      : 0;
  const ramPct =
    inferenceSettings.maxRamGb > 0
      ? Math.min(100, Math.round((ramUsedGb / inferenceSettings.maxRamGb) * 100))
      : 0;

  const statusLabel =
    serverStatus === 'generating'
      ? 'Генерация'
      : serverStatus === 'loading'
        ? 'Загрузка в память'
        : serverStatus === 'error'
          ? 'Ошибка'
          : serverStatus === 'stopped'
            ? 'Остановлен'
            : 'Модель выбрана';

  const activeDownloads = localModels.filter((m) => m.status === 'downloading');
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLaunchQuickSubagent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSubagentPrompt.trim()) return;
    launchSubagent({ prompt: quickSubagentPrompt });
    setQuickSubagentPrompt('');
  };

  return (
    <aside className={cn('w-full lg:w-[288px] xl:w-[312px] shrink-0 min-h-0 border flex flex-col overflow-y-auto rounded-2xl shadow-[0_4px_20px_-2px_rgba(30,41,59,0.06)]', uiStyle === 'mica-windows' && 'mica-panel', tokens.sidebarBg, 'border-slate-200/80 dark:border-zinc-800')}>
      {showRight('right.checkpoints') && <div className="relative flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">{showRight('right.checkpoints.title') && showRight('right.checkpoints.title.label') && <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">Checkpoints <span className="font-mono text-zinc-400">({checkpoints.length})</span></span>}{showRight('right.checkpoints.open') && <button type="button" onClick={() => setCheckpointMenuOpen((value) => !value)} aria-expanded={checkpointMenuOpen} title="История контрольных точек" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">{showRight('right.checkpoints.icon') && showRight('right.checkpoints.icon.icon') && <History className="h-4 w-4" />}</button>}{checkpointMenuOpen && <div className={cn('absolute right-3 top-full z-40 mt-1 w-80 border p-3 shadow-xl', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}><div className="mb-2 flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800"><span className="text-xs font-semibold">Контрольные точки</span><button type="button" onClick={() => setCheckpointMenuOpen(false)} aria-label="Закрыть"><X className="h-3.5 w-3.5" /></button></div><div className="max-h-64 space-y-1.5 overflow-y-auto">{checkpoints.length === 0 ? <p className="py-2 text-xs text-zinc-500">Контрольные точки появятся после изменений проекта.</p> : checkpoints.map((checkpoint, index) => <div key={checkpoint.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-2 text-xs dark:border-zinc-800"><div className="min-w-0"><div className="truncate font-medium">{checkpoint.label}</div><div className="font-mono text-[10px] text-zinc-500">{checkpoint.id} · {checkpoint.timestamp}</div></div><button type="button" onClick={() => { void rollbackToCheckpoint(checkpoint.id); setCheckpointMenuOpen(false); }} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[10px] hover:bg-blue-600 hover:text-white dark:bg-zinc-800"><RotateCcw className="h-3 w-3" />{index === 0 ? 'Откат' : 'Восст.'}</button></div>)}</div></div>}</div>
      }
      <details open className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100"><History className="h-3.5 w-3.5 text-zinc-500" />Чаты <span className="font-mono text-[10px] text-zinc-400">({sessions.filter((session) => !session.archivedAt).length})</span></span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3">
          <button type="button" onClick={createNewSession} title="Новый чат" aria-label="Новый чат" className="mb-2 inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"><MessageSquarePlus className="h-3.5 w-3.5" />Новый чат</button>
          <div className="relative mb-2"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" /><input value={sessionQuery} onChange={(event) => setSessionQuery(event.target.value)} placeholder="Поиск по чатам..." className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200" /></div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {sessions.filter((session) => !session.archivedAt && (!sessionQuery.trim() || session.title.toLowerCase().includes(sessionQuery.trim().toLowerCase()) || session.messages.some((message) => message.content.toLowerCase().includes(sessionQuery.trim().toLowerCase())))).map((session) => {
              const active = session.id === activeSessionId;
              return <div key={session.id} className={cn('flex items-center gap-1 rounded-lg border px-1.5 transition-colors', active ? 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900' : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60')}><button type="button" onClick={() => setActiveSession(session.id)} aria-current={active ? 'true' : undefined} className="min-w-0 flex-1 py-2 text-left"><span className="block truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">{session.title}</span><span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">{session.updatedAt} · {session.messages.length} сообщ.</span></button><button type="button" onClick={() => void archiveSession(session.id)} title="Переместить в архив" aria-label={`Архивировать чат: ${session.title}`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"><Archive className="h-3.5 w-3.5" /></button></div>;
            })}
            {sessions.filter((session) => !session.archivedAt && (!sessionQuery.trim() || session.title.toLowerCase().includes(sessionQuery.trim().toLowerCase()) || session.messages.some((message) => message.content.toLowerCase().includes(sessionQuery.trim().toLowerCase())))).length === 0 && <p className="py-3 text-center text-[11px] text-zinc-500">Чатов не найдено</p>}
          </div>
        </div>
      </details>
      <div className="border-b border-zinc-200 dark:border-zinc-800/90">
        <button type="button" onClick={() => setArchivedChatsOpen((open) => !open)} aria-expanded={archivedChatsOpen} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            <Archive className="h-3.5 w-3.5 text-zinc-500" />
            Архив чатов
            <span className="font-mono text-[10px] text-zinc-400">({sessions.filter((session) => Boolean(session.archivedAt)).length})</span>
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-500 transition-transform', archivedChatsOpen && 'rotate-180')} />
        </button>
        {archivedChatsOpen && (
          <div className="px-3 pb-3 space-y-2">
            {sessions.filter((session) => Boolean(session.archivedAt)).length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-zinc-500 dark:text-zinc-400">Архив пока пуст.</p>
            ) : sessions.filter((session) => Boolean(session.archivedAt)).map((session) => {
              const previewOpen = previewArchivedChatId === session.id;
              return (
                <div key={session.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 overflow-hidden">
                  <div className="flex items-center gap-2 p-2">
                    <button type="button" onClick={() => setPreviewArchivedChatId(previewOpen ? null : session.id)} aria-expanded={previewOpen} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">{session.title}</span>
                      <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">{session.messages.length} сообщ. · {session.archivedAt ? new Date(session.archivedAt).toLocaleDateString('ru-RU') : ''}</span>
                    </button>
                    <button type="button" onClick={() => void restoreSession(session.id)} title="Восстановить чат" aria-label={`Восстановить чат: ${session.title}`} className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"><RotateCcw className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={async () => { const confirmed = await requestDeleteWarning({ variant: 'simple', title: 'Удалить архивный чат?', description: 'Переписка будет удалена без возможности восстановления.', itemName: session.title }); if (confirmed) void deleteSession(session.id); }} title="Удалить архивный чат" aria-label={`Удалить архивный чат: ${session.title}`} className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {previewOpen && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 space-y-2">
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {session.messages.map((message) => (
                          <div key={message.id} className="rounded-lg bg-zinc-50 dark:bg-zinc-950/70 p-2">
                            <div className="mb-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{message.role === 'user' ? 'Вы' : message.role === 'assistant' ? 'ONE CORE AI' : message.role}</div>
                            <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">{message.content}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-400">Просмотр архива — без возобновления диалога.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Быстрые действия</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
      {/* Section 1.5: Быстрые действия (перенесено из верхней шапки) */}
      {showRight('right.quick-actions') && <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {showRight('right.quick-actions.title') && <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
            {showRight('right.quick-actions.title.icon') && <Bot className="w-3.5 h-3.5 text-blue-500" />}
            {showRight('right.quick-actions.title.label') && <span>Быстрые действия</span>}
          </span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {showRight('right.quick-actions.update') && latestUpdate?.isNewer && (
            <button
              type="button"
              onClick={() => openSettingsSection('updates')}
              title={`Доступна версия ${latestUpdate.version}`}
              className="flex-1 min-w-[120px] h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-medium whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Обновление {latestUpdate.version}</span>
            </button>
          )}
          {showRight('right.quick-actions.install') && isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={install}
              className="flex-1 min-w-[120px] h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <MonitorDown className="w-3.5 h-3.5" />
              <span>Установить</span>
            </button>
          )}
          {showRight('right.quick-actions.chat') && <button
            type="button"
            onClick={() => setActiveTab('workstation')}
            title="Открыть чат агента"
            aria-label="Открыть чат агента"
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
          >
            <Bot className="w-4 h-4" />
          </button>}

          {/* Кнопка переключения темы */}
          {showRight('right.quick-actions.theme') && <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            aria-label="Переключить тему оформления"
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>}

          {/* Кнопка системного трея с выпадающим меню */}
          {showRight('right.quick-actions.tray') && <div className="relative shrink-0" ref={trayRef}>
            <button
              type="button"
              onClick={() => setTrayOpen(!trayOpen)}
              title="Системный трей Windows"
              aria-label="Открыть системный трей"
              className={cn(
                'h-9 px-3 inline-flex items-center gap-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                trayOpen
                  ? 'border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
              )}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Трей</span>
              {unreadCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-blue-600 dark:text-blue-400">
                  ({unreadCount})
                </span>
              )}
            </button>

            <AnimatePresence>
              {trayOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#141418]/95 mica-panel shadow-2xl p-4 z-50"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 px-1 mb-1">
                      <span className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        <Server className="w-3.5 h-3.5 text-zinc-500" />
                        Сервер OneCore AI
                      </span>
                      <button
                        type="button"
                        onClick={toggleServerPower}
                        className={cn(
                          'px-2 py-1 rounded border text-[10px] font-medium transition-colors',
                          serverStatus === 'stopped'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                            : 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800/70',
                        )}
                      >
                        {serverStatus === 'stopped' ? 'Запустить' : 'Остановить'}
                      </button>
                    </div>

                    <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-300">Модель</span>
                        <span className="font-mono tabular-nums">
                          {activeModel?.name || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-300">Провайдер</span>
                        <span className="font-mono tabular-nums">
                          {activeProvider?.name || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          Уведомления ({unreadCount})
                        </span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={markAllNotificationsRead}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Прочитать всё
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {notifications.slice(0, 5).map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              'p-1.5 rounded text-xs',
                              n.read
                                ? 'border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-50/40 dark:bg-zinc-900/30'
                                : 'border-blue-500/20 bg-blue-500/10 border-l-2 border-l-blue-500',
                            )}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 leading-none">
                                {n.title}
                              </span>
                              <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{n.timestamp}</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">{n.detail}</p>
                          </div>
                        ))}
                        {notifications.length === 0 && (
                          <p className="text-[10px] text-zinc-400 italic">Новых уведомлений нет</p>
                        )}
                      </div>
                    </div>

                    {activeDownloads.length > 0 && (
                      <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60">
                        <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Активные загрузки GGUF
                        </div>
                        {activeDownloads.map((dl) => (
                          <div key={dl.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-zinc-800 dark:text-zinc-200">{dl.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="font-mono text-[10px] text-zinc-500 tabular-nums">{dl.progressPct}%</span>
                              <button
                                type="button"
                                onClick={() => togglePauseDownload(dl.id)}
                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
                                title="Пауза"
                              >
                                <Pause className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                      {latestUpdate?.isNewer && (
                        <button
                          type="button"
                          onClick={() => openSettingsSection('updates')}
                          title={`Доступна версия ${latestUpdate.version}`}
                          className="w-full py-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                          <Download className="w-3 h-3 shrink-0 mr-1.5" />
                          Обновление {latestUpdate.version}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>}
        </div>
      </div>}

      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Субагенты</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
        </div>
      </details>
      {/* Section 2.5: OneCore Subagents Parallel Runner */}
      {chatVisibility.showSubagentsPanel && showRight('right.subagents') && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            {showRight('right.subagents.title') && <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
              {showRight('right.subagents.title.icon') && <Bot className="w-3.5 h-3.5 text-blue-500" />}
              {showRight('right.subagents.title.label') && <span>Субагенты</span>}
              <span className="font-mono tabular-nums text-[11px] text-zinc-500">
                ({subagentRuns.length})
              </span>
            </span>}
            {showRight('right.subagents.clear') && subagentRuns.some((r) => r.status === 'completed') && (
              <button
                type="button"
                onClick={clearCompletedSubagents}
                className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Очистить
              </button>
            )}
          </div>

          {showRight('right.subagents.launch') && <form onSubmit={handleLaunchQuickSubagent} className="flex gap-1.5">
            <input
              type="text"
              value={quickSubagentPrompt}
              onChange={(e) => setQuickSubagentPrompt(e.target.value)}
              placeholder={subagentConfig.enabled ? 'Параллельная подзадача...' : 'Субагенты отключены в настройках'}
              className={cn(
                'flex-1 min-w-0 h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                tokens.inputRadius,
              )}
            />
            <button
              type="submit"
              disabled={!subagentConfig.enabled || !quickSubagentPrompt.trim()}
              title="Запустить субагента"
              className={cn(
                'h-8 px-2.5 disabled:opacity-45 text-[11px] font-medium inline-flex items-center gap-1 shrink-0',
                tokens.inputRadius,
                tokens.accentButton,
              )}
            >
              <Play className="w-3 h-3" />
            </button>
          </form>}

          {showRight('right.subagents.runs') && subagentRuns.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {subagentRuns.slice(0, 4).map((run) => (
                <div
                  key={run.id}
                  className={cn('p-2 border text-[11px] space-y-1', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {run.title}
                    </span>
                    <span
                      className={cn(
                        'font-mono tabular-nums shrink-0',
                        run.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400',
                      )}
                    >
                      {run.progressPct}%
                    </span>
                  </div>
                  <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
                    {run.roleName} · {run.modelName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Проект и доступы</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
        </div>
      </details>
      {/* Project workspace and effective application permissions */}
      {showRight('right.project') && <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {showRight('right.project.title') && <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
            {showRight('right.project.title.icon') && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
            {showRight('right.project.title.label') && 'Проект и доступы'}
          </span>}
          {showRight('right.project.status') && <span className={cn('text-[10px] px-1.5 py-0.5 rounded', activeProject ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800')}>
            {activeProject ? 'Подключён' : 'Не выбран'}
          </span>}
        </div>
        {activeProject ? (
          <>
            {showRight('right.project.details') && <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{activeProject.name}</div>
              <div className="text-[10.5px] text-zinc-500 truncate" title={activeProject.folderPath}>{activeProject.folderPath}</div>
            </div>}
            {showRight('right.project.details') && <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                <div className="text-zinc-500">Задачи</div>
                <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{projectWorkspace.tasks.length}</div>
              </div>
              <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                <div className="text-zinc-500">Прогресс плана</div>
                <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{projectWorkspace.plan?.progress ?? 0}%</div>
              </div>
            </div>}
            {showRight('right.project.tools') && <div className="grid grid-cols-7 gap-2">
              {([
                { label: 'Чтение файлов', icon: FileText, available: true, connected: activeProject.allowedTools?.includes('read_file') ?? true },
                { label: 'Изменение файлов', icon: FilePenLine, available: true, connected: activeProject.allowedTools?.includes('write_file') ?? true },
                { label: 'Удаление файлов', icon: Trash2, available: false, connected: false },
                { label: 'Терминал', icon: TerminalSquare, available: true, connected: activeProject.allowedTools?.includes('run_command') ?? true },
                { label: 'Git', icon: GitBranch, available: true, connected: activeProject.allowedTools?.includes('git') ?? true },
                { label: 'SSH', icon: Server, available: Boolean(sshSettings.windowsOpenSshPath || sshHosts.length), connected: Boolean(activeProject.sshConfig && sshHosts.some((host) => host.hostName === activeProject.sshConfig?.host && host.status === 'connected')) },
                { label: 'GitHub', icon: Github, available: Boolean(activeProject.githubConfig), connected: false },
              ] as Array<{ label: string; icon: React.ComponentType<{ className?: string }>; available: boolean; connected: boolean }>).map(({ label, icon: Icon, available, connected }) => (
                <div key={label} className="flex justify-center">
                  <span title={`${label}: ${!available ? 'не поддерживается' : connected ? 'подключено и разрешено' : 'поддерживается, но не подключено'}`} aria-label={`${label}: ${!available ? 'не поддерживается' : connected ? 'подключено и разрешено' : 'поддерживается, но не подключено'}`} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors', connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : available ? 'border-zinc-200 bg-zinc-100/70 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500' : 'border-transparent text-zinc-300 opacity-40 dark:text-zinc-700')}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
              ))}
            </div>}
            {showRight('right.project.hint') && <p className="text-[10px] text-zinc-500 leading-relaxed">
              Серые SVG — функция поддерживается, но не подключена. Подсвеченные — подключена и разрешена. Удаление файлов пока не реализовано.
            </p>}
          </>
        ) : (
          <p className="text-[11px] text-zinc-500">Выберите проект, чтобы агент получил его задачи, план, файлы и разрешения.</p>
        )}
      </div>

      }
      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Возможности модели</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
        </div>
      </details>
      {/* Model self-report is not an application permission grant */}
      {showRight('right.capabilities') && <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {showRight('right.capabilities.title') && <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
            {showRight('right.capabilities.title.icon') && <Bot className="w-3.5 h-3.5 text-blue-500" />}
            {showRight('right.capabilities.title.label') && 'Возможности модели'}
          </span>}
          {showRight('right.capabilities.refresh') && <button type="button" onClick={() => void checkModelCapabilities()} disabled={modelCapabilityStatus === 'checking' || !activeProvider} className="inline-flex items-center gap-1 text-[10.5px] text-blue-600 dark:text-blue-400 disabled:opacity-40">
            <RefreshCw className={cn('w-3 h-3', modelCapabilityStatus === 'checking' && 'animate-spin')} />
            Проверить
          </button>}
        </div>
        {showRight('right.capabilities.report') && <>
        <div className="text-[10.5px] text-zinc-500 truncate">{activeProvider?.name ?? 'Провайдер не выбран'} · {modelSource === 'llama-server' ? activeModel?.filename ?? 'Runtime-модель' : activeProvider?.selectedModel ?? 'Модель не выбрана'}</div>
        {modelCapabilityReport ? (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Окно контекста по самооценке</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">{modelCapabilityReport.contextWindowTokens?.toLocaleString('ru-RU') ?? 'Неизвестно'} tok</span>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">Заявлено самой моделью · не гарантия</div>
            {([
              ['Чтение файлов', 'readFiles'],
              ['Изменение файлов', 'writeFiles'],
              ['Удаление файлов', 'deleteFiles'],
              ['Выполнение команд', 'runCommands'],
              ['Git', 'git'],
              ['SSH', 'ssh'],
              ['GitHub', 'github'],
              ['Веб-доступ', 'web'],
              ['Function calling', 'functionCalling'],
              ['Vision', 'vision'],
            ] as const).map(([label, key]) => {
              const claim = modelCapabilityReport.selfReported[key];
              const appTool = modelCapabilityReport.application[key];
              return (
                <div key={key} className="py-1 border-b border-zinc-100 dark:border-zinc-800/70 space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
                    <span className={cn('font-medium', claim === true ? 'text-emerald-600 dark:text-emerald-400' : claim === false ? 'text-rose-500' : 'text-zinc-400')}>
                      {claim === true ? 'Модель: да' : claim === false ? 'Модель: нет' : 'Модель: ?'}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    OneCoreAI: {appTool.available ? 'доступно' : 'недоступно'} · {appTool.reason}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-zinc-500 leading-relaxed">{modelCapabilityReport.notes}</p>
            <p className="text-[10px] text-zinc-500">Проверено: {new Date(modelCapabilityReport.checkedAt).toLocaleString('ru-RU')}</p>
          </>
        ) : (
          <p className="text-[10.5px] text-zinc-500">
            {modelCapabilityStatus === 'checking' ? 'Модель отвечает на проверочный запрос…' : modelCapabilityStatus === 'error' ? 'Проверка не удалась. Возможности модели неизвестны.' : 'Самооценка ещё не запрашивалась.'}
          </p>
        )}
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Самооценка не выдаёт разрешений. Реальные доступы определяются инструментами OneCoreAI и политикой проекта.
        </p>
        </>}
      </div>

      }
      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Токены и память</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
        </div>
      </details>
      {/* Token usage and memory telemetry */}
      {showRight('right.tokens') && <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
        {showRight('right.tokens.title') && <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
          {showRight('right.tokens.title.icon') && <Layers className="w-3.5 h-3.5 text-zinc-500" />}
          {showRight('right.tokens.title.label') && 'Токены и память'}
        </div>}
        {showRight('right.tokens.usage') && <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
            <div className="text-zinc-500">{lastTokenUsage?.promptTokens === null ? 'Вход (оценка)' : 'Вход'}</div>
            <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{lastTokenUsage ? (lastTokenUsage.promptTokens?.toLocaleString('ru-RU') ?? `~${lastTokenUsage.estimatedPromptTokens.toLocaleString('ru-RU')}`) : '—'}</div>
          </div>
          <div className={cn('p-2 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
            <div className="text-zinc-500">Выход</div>
            <div className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{lastTokenUsage?.completionTokens?.toLocaleString('ru-RU') ?? '—'}</div>
          </div>
        </div>}
        {showRight('right.tokens.context') && <>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Последний запрос</span>
          <span className="font-mono tabular-nums">{lastTokenUsage?.totalTokens?.toLocaleString('ru-RU') ?? 'нет данных'} tok</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">За текущую сессию</span>
          <span className="font-mono tabular-nums">{sessionUsageMessages.length ? sessionTokenTotal.toLocaleString('ru-RU') : 'нет данных'} tok</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Оценка файлового контекста</span>
          <span className="font-mono tabular-nums">~{includedTokens.toLocaleString('ru-RU')} tok</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Настроенное окно</span>
          <span className="font-mono tabular-nums">{inferenceSettings.contextSize.toLocaleString('ru-RU')} tok</span>
        </div>
        <div className="text-[10px] text-zinc-500">Точный usage зависит от ответа провайдера; оценка файлового контекста приблизительная.</div>
        </>
        }
        {showRight('right.tokens.memory') && (runtimeConnected ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Оценка VRAM модели</span>
              <span className="font-mono tabular-nums">~{serverStatus === 'stopped' ? '0.0' : vramUsedGb} GB</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Занято RAM системы (ОС)</span>
              <span className="font-mono tabular-nums">{ramUsedGb} GB</span>
            </div>
            <div className="text-[10px] text-zinc-500">Фактическая память процесса модели пока не измеряется: VRAM — оценка по профилю модели, RAM — общий расход ОС.</div>
          </div>
        ) : (
          <div className="text-[10px] text-zinc-500">Память облачной модели приложению не видна.</div>
        ))}
      </div>

      }
      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Локальный рантайм</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
        </div>
      </details>
      {/* Local runtime telemetry */}
      {chatVisibility.showTelemetry && showRight('right.runtime') && runtimeConnected && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-3">
          <div className="flex items-center justify-between gap-2">
                {showRight('right.runtime.title') && <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                  {showRight('right.runtime.title.icon') && <Activity className="w-3.5 h-3.5 text-zinc-500" />}
                  {showRight('right.runtime.title.label') && 'Локальный рантайм'}
                </span>}
                {showRight('right.runtime.power') && <button
                  type="button"
                  onClick={toggleServerPower}
                  className={cn(
                    'px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors',
                    serverStatus === 'stopped'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-rose-500',
                  )}
                >
                  <Power className="w-3 h-3" />
                  <span>{serverStatus === 'stopped' ? 'Запуск' : 'Стоп'}</span>
                </button>}
          </div>

          {showRight('right.runtime.model') && <div className={cn('p-3 border space-y-2.5', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {activeModel?.name ?? 'Модель не выбрана'}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium shrink-0',
                      serverStatus === 'stopped'
                        ? 'text-zinc-500'
                        : serverStatus === 'error'
                          ? 'text-rose-500'
                          : serverStatus === 'generating'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  {inferenceSettings.detectedBackend} · {activeModel?.quant ?? '—'} ·{' '}
                  <span className="tabular-nums">
                    {tokensPerSec > 0 ? `${tokensPerSec} tok/s` : hardwareProfile ? `${hardwareProfile.cpu.cores} ядер` : 'ожидание'}
                  </span>
                </div>

                {showRight('right.runtime.telemetry') && <>
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-500 dark:text-zinc-400">Оценка VRAM модели</span>
                    <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                      {inferenceSettings.maxVramGb > 0
                        ? `~${serverStatus === 'stopped' ? '0.0' : vramUsedGb} / ${inferenceSettings.maxVramGb} GB`
                        : 'GPU не обнаружен'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        vramPct > 90 ? 'bg-amber-500' : 'bg-blue-600',
                      )}
                      style={{ width: `${serverStatus === 'stopped' ? 0 : vramPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-500 dark:text-zinc-400">System RAM (ОС)</span>
                    <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                      {ramUsedGb} / {inferenceSettings.maxRamGb} GB
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-zinc-500 dark:bg-zinc-400 transition-all duration-300"
                      style={{ width: `${ramPct}%` }}
                    />
                  </div>
                </div>
                </>}
          </div>}
        </div>
      )}

      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Параметры инференса</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
        </div>
      </details>
      {/* Section 2: Quick Inference Settings */}
      {chatVisibility.showInferenceControls && showRight('right.inference') && runtimeConnected && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-3">
          {showRight('right.inference.title') && <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {showRight('right.inference.title.icon') && <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />}
            {showRight('right.inference.title.label') && <span>Параметры инференса</span>}
          </div>}

          {showRight('right.inference.gpu') && <div>
            <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
              Ускорение GPU (Windows)
            </label>
            <select
              value={inferenceSettings.gpuBackend}
              onChange={(e) =>
                updateInferenceSettings({ gpuBackend: e.target.value as GpuBackend })
              }
              className={cn('w-full h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500', tokens.inputRadius)}
            >
              {BACKEND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>}

          {showRight('right.inference.temperature') && <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-zinc-500 dark:text-zinc-400">Temperature</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {inferenceSettings.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={inferenceSettings.temperature}
              onChange={(e) =>
                updateInferenceSettings({ temperature: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-600"
            />
          </div>}

          {showRight('right.inference.context') && <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-zinc-500 dark:text-zinc-400">Контекстное окно (n_ctx)</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {inferenceSettings.contextSize.toLocaleString('ru-RU')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[4096, 8192, 16384, 32768].map((ctx) => (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => updateInferenceSettings({ contextSize: ctx })}
                  className={cn(
                    'py-1 rounded text-[11px] font-mono tabular-nums border transition-colors',
                    inferenceSettings.contextSize === ctx
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {ctx / 1024}K
                </button>
              ))}
            </div>
          </div>}

          {showRight('right.inference.layers') && <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 dark:text-zinc-400">GPU Layers (-ngl)</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {inferenceSettings.gpuBackend === 'cpu' ? 0 : inferenceSettings.gpuLayers ?? 'Авто'}
              </span>
            </div>
            <select
              value={inferenceSettings.gpuLayers === null ? 'auto' : 'manual'}
              onChange={(e) =>
                updateInferenceSettings({
                  gpuLayers: e.target.value === 'auto' ? null : 20,
                })
              }
              className={cn('mb-2 h-8 w-full border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100', tokens.inputRadius)}
            >
              <option value="auto">Авто — подбор llama-server</option>
              <option value="manual">Вручную</option>
            </select>
            <input
              type="range"
              min={0}
              max={99}
              step={1}
              disabled={inferenceSettings.gpuBackend === 'cpu' || inferenceSettings.gpuLayers === null}
              value={inferenceSettings.gpuBackend === 'cpu' ? 0 : inferenceSettings.gpuLayers ?? 20}
              onChange={(e) =>
                updateInferenceSettings({ gpuLayers: parseInt(e.target.value, 10) })
              }
              className="w-full accent-blue-600 disabled:opacity-40"
            />
          </div>}
        </div>
      )}

      <details className="border-b border-zinc-200 dark:border-zinc-800/90 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100/70 dark:text-zinc-100 dark:hover:bg-zinc-800/50"><span>Файлы контекста</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" /></summary>
        <div className="min-h-0">
        </div>
      </details>
      {/* Section 3: Active Context */}
      {chatVisibility.showActiveContext && showRight('right.active-context') && (
        <div className="p-4 flex-1">
          <div className="flex items-center justify-between mb-2.5">
            {showRight('right.active-context.title') && <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
              {showRight('right.active-context.title.icon') && <Layers className="w-3.5 h-3.5 text-zinc-500" />}
              {showRight('right.active-context.title.label') && 'Файлы контекста'}
            </span>}
            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
              ~{includedTokens} / {inferenceSettings.contextSize} tok
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            {showRight('right.active-context.tree') && <label className={cn('flex items-center justify-between gap-2 px-2 py-1.5 border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900/50 text-xs cursor-pointer', tokens.cardRadius)}>
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeProjectTree}
                  onChange={(e) => setIncludeProjectTree(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span>Дерево проекта</span>
              </span>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">180</span>
            </label>}

            {showRight('right.active-context.terminal') && <label className={cn('flex items-center justify-between gap-2 px-2 py-1.5 border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900/50 text-xs cursor-pointer', tokens.cardRadius)}>
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeTerminalOutput}
                  onChange={(e) => setIncludeTerminalOutput(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span>Вывод терминала</span>
              </span>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">120</span>
            </label>}
          </div>

          {showRight('right.active-context.files') && <>
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
            Открытые файлы в промпте
          </div>
          <div className="space-y-1">
            {files.map((file) => (
              <label
                key={file.path}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={file.inContext}
                    onChange={() => toggleFileContext(file.path)}
                    className="accent-blue-600 rounded shrink-0"
                  />
                  <span className="font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300 truncate">
                    {file.name}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0">
                  {file.tokensEstimate}
                </span>
              </label>
            ))}
          </div>
          </>}

          {showRight('right.active-context.hardware') && <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{inferenceSettings.detectedGpuName}</span>
          </div>}
        </div>
      )}
        </div>
      </details>
    </aside>
  );
};

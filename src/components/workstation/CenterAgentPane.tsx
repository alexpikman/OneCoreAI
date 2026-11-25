import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUp,
  BookmarkPlus,
  Bot,
  CheckCircle2,
  Check,
  Copy,
  ChevronDown,
  Eye,
  FileText,
  FolderOpen,
  Globe,
  History,
  Radio,
  RotateCcw,
  Square,
  Save,
  ShieldCheck,
  Terminal,
  UserCheck,
} from 'lucide-react';
import { ONECORE_SLASH_COMMANDS } from '../../data/oneCoreSeed';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { GitDiffViewer } from '../agent/GitDiffViewer';
import { MarkdownLite } from '../agent/MarkdownLite';
import { TerminalBlock } from '../agent/TerminalBlock';
import { ModelMascot } from '../agent/ModelMascot';
import type { AgentJournalEvent } from '../../types/onecore';

const QUICK_PROMPTS = [
  '/search function',
  '/git status',
  '/run ls -la',
  '/web документация TypeScript',
  '/undo',
];

export const CenterAgentPane: React.FC = () => {
  const {
    projects,
    activeProjectId,
    createOrWriteProjectFile,
    sessions,
    activeSessionId,
    centerPaneMode,
    setCenterPaneMode,
    agentMode,
    files,
    selectedFilePath,
    projectFileLoading,
    projectFileError,
    checkpoints,
    sendPrompt,
    cancelActiveChat,
    canCancelActiveChat,
    applyDiff,
    rejectDiff,
    runCommand,
    skipCommand,
    diagnoseCommandError,
    rollbackToCheckpoint,
    localModels,
    activeModelId,
    serverStatus,
    inferenceSettings,
    includeProjectTree,
    includeTerminalOutput,
    chatVisibility,
    uiStyle,
    freeProviders,
    activeProviderId,
    roles,
    activeRoleId,
    enabledRoleIds,
    agentActivity,
    modelSource,
    tokensPerSec,
    learnSkillFromMessage,
  } = useOneCoreStore();

  const tokens = getUiTokens(uiStyle);
  const [input, setInput] = useState('');
  const [editingFile, setEditingFile] = useState(false);
  const [fileDraft, setFileDraft] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [fileSaveMsg, setFileSaveMsg] = useState<string | null>(null);
  const [journalEvents, setJournalEvents] = useState<AgentJournalEvent[]>([]);

  const streamEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatNavigatorRef = useRef<HTMLElement>(null);
  const [activeChatMessageIndex, setActiveChatMessageIndex] = useState(0);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const chatMessages = activeSession?.messages ?? [];
  const selectedFile = files.find((f) => f.path === selectedFilePath);
  const activeModel = localModels.find((m) => m.id === activeModelId);
  const activeProvider =
    freeProviders.find((p) => p.id === activeProviderId) ?? freeProviders[0];
  const activeRole = enabledRoleIds.length > 0 ? roles.find((role) => role.id === activeRoleId) : undefined;
  const activeModelName =
    modelSource === 'llama-server' && activeModel ? activeModel.filename : activeProvider.selectedModel;
  const latestCheckpoint = checkpoints[0];
  const includedTokens =
    files.filter((f) => f.inContext).reduce((acc, f) => acc + f.tokensEstimate, 0) +
    (includeProjectTree ? 180 : 0) +
    (includeTerminalOutput ? 120 : 0);
  const ctxPct = Math.min(100, Math.round((includedTokens / inferenceSettings.contextSize) * 100));

  const showSlashPopup = input.startsWith('/') && !input.includes(' ');
  const matchingSlash = ONECORE_SLASH_COMMANDS.filter((c) =>
    c.command.startsWith(input.toLowerCase()),
  );

  const updateActiveChatMessage = () => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    const top = scrollElement.getBoundingClientRect().top + 24;
    const visibleMessage = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('[data-chat-message-index]'),
    ).find((element) => element.getBoundingClientRect().bottom > top);
    if (visibleMessage) {
      setActiveChatMessageIndex(Number(visibleMessage.dataset.chatMessageIndex));
    }
  };

  const navigateToChatMessage = (index: number) => {
    const scrollElement = chatScrollRef.current;
    const messageElement = scrollElement?.querySelector<HTMLElement>(
      `[data-chat-message-index="${index}"]`,
    );
    if (!scrollElement || !messageElement) return;
    const top =
      messageElement.getBoundingClientRect().top -
      scrollElement.getBoundingClientRect().top +
      scrollElement.scrollTop;
    scrollElement.scrollTo({ top, behavior: 'smooth' });
    setActiveChatMessageIndex(index);
  };

  useEffect(() => {
    let active = true;
    const mergeEvent = (event: AgentJournalEvent) => {
      setJournalEvents((current) => {
        const merged = new Map(current.map((item) => [item.id, item]));
        merged.set(event.id, event);
        return [...merged.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      });
    };

    const controller = new AbortController();

    void apiFetch('/api/agent-journal', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ ok?: boolean; events?: AgentJournalEvent[] }>;
      })
      .then((data) => {
        if (!active || !data.ok || !Array.isArray(data.events)) return;
        setJournalEvents((current) => {
          const merged = new Map(data.events!.map((event) => [event.id, event]));
          current.forEach((event) => merged.set(event.id, event));
          return [...merged.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        });
      })
      .catch(() => undefined);

    void apiFetch('/api/agent-journal/stream', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            const line = block.split(/\r?\n/).find((entry) => entry.startsWith('data:'));
            if (!line) continue;
            try {
              mergeEvent(JSON.parse(line.slice(5).trim()) as AgentJournalEvent);
            } catch {
              // Ignore malformed journal events and keep the stream alive.
            }
          }
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    setEditingFile(false);
    setFileSaveMsg(null);
    if (selectedFile) {
      setFileDraft(selectedFile.content);
    }
  }, [selectedFilePath, selectedFile?.content]);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSessionId, activeSession?.messages.length, activeSession?.messages.at(-1)?.content]);

  useEffect(() => {
    setActiveChatMessageIndex(Math.max(0, chatMessages.length - 1));
  }, [activeSessionId, chatMessages.length]);

  useEffect(() => {
    chatNavigatorRef.current
      ?.querySelector('[aria-current="location"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeChatMessageIndex]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || serverStatus === 'generating') return;
    void sendPrompt(input);
    setInput('');
  };

  const handleSaveEditedFile = async () => {
    if (!selectedFile) return;
    const res = await createOrWriteProjectFile(
      selectedFile.path,
      fileDraft,
      `Ручное редактирование ${selectedFile.path}`,
    );
    if (res.ok) {
      setEditingFile(false);
      setFileSaveMsg('Сохранено на диск');
    } else {
      setFileSaveMsg(res.error || 'Ошибка записи');
    }
  };

  return (
    <section className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      {/* Task Banner */}
      {chatVisibility.showTaskBanner && centerPaneMode === 'chat' && (
        <div className={cn('px-4 py-2 border-b text-xs flex flex-wrap items-center justify-between gap-2', tokens.taskBannerBg)}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
              {uiStyle === 'cyber-terminal' ? '> PROJECT:' : 'Проект:'}
            </span>
            {activeProject ? (
              <div className="min-w-0 inline-flex items-center gap-1.5">
                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {activeProject.name}
                </span>
                <button
                  type="button"
                  title={activeProject.folderPath}
                  aria-label={`Путь проекта: ${activeProject.folderPath}`}
                  className="shrink-0 inline-flex items-center justify-center text-[#4C5159] hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  <svg
                    viewBox="0 0 64 64"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14.2 48.3l1.7-9.2c-1-2.2-1.5-4.6-1.5-7.1 0-9.6 7.8-17.4 17.4-17.4s17.4 7.8 17.4 17.4-7.8 17.4-17.4 17.4c-3.4 0-6.6-1-9.2-2.7l-9.4 1.2z" />
                    <path d="M47.4 16.6c3.9 3.9 6.4 9.4 6.4 15.4s-2.4 11.4-6.4 15.4c-3.9 3.9-9.4 6.4-15.4 6.4" strokeDasharray="1.9857 1.9857" />
                    <path d="M10.3 32c0-6 2.4-11.4 6.4-15.4 3.9-3.9 9.4-6.4 15.4-6.4s11.4 2.4 15.4 6.4" />
                    <path d="M30.5 27.1c-.4-.4-.6-.9-.6-1.5 0-.6.2-1.1.6-1.5.4-.4.9-.6 1.5-.6s1.1.2 1.5.6c.4.4.6.9.6 1.5s-.2 1.1-.6 1.5c-.4.4-.9.6-1.5.6s-1.1-.2-1.5-.6zM33.5 40.5h-3.1c-.1 0-.2-.1-.2-.2v-9.4c0-.1.1-.2.2-.2h3.1c.1 0 .2.1.2.2v9.4c0 .1-.1.2-.2.2z" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('onecore:open-project-modal'))}
                className="text-amber-600 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Не подключена папка — выбрать проект</span>
              </button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums text-right">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('onecore:open-model-switcher'))}
              className="hover:text-blue-500 transition-colors truncate max-w-[220px]"
              title="Переключить модель"
            >
              {activeModelName || 'Модель не выбрана'}
            </button>
            <span>·</span>
            <span>{tokensPerSec} tok/s</span>
            <span>·</span>
            <span>
              {includedTokens} / {inferenceSettings.contextSize} ({ctxPct}%)
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area: Chat OR Real File Preview/Editor */}
      {centerPaneMode === 'file' ? (selectedFile ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                {selectedFile.path}
              </span>
              <span className="text-zinc-400">·</span>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                ~{selectedFile.tokensEstimate} tok
              </span>
              {fileSaveMsg && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  · {fileSaveMsg}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {editingFile ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFile(false);
                      setFileDraft(selectedFile.content);
                    }}
                    className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveEditedFile()}
                    className="px-2.5 py-1 rounded bg-blue-600 text-white font-medium inline-flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    <span>Сохранить на диск</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFileDraft(selectedFile.content);
                    setEditingFile(true);
                  }}
                  className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-blue-500"
                >
                  Редактировать
                </button>
              )}
              <button
                type="button"
                onClick={() => setCenterPaneMode('chat')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Вернуться в чат
              </button>
            </div>
          </div>

          {editingFile ? (
            <textarea
              value={fileDraft}
              onChange={(e) => setFileDraft(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-xs leading-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none"
            />
          ) : (
            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-6">
              {selectedFile.content.split('\n').map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-10 pr-3 text-right select-none text-zinc-400 dark:text-zinc-600 tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <pre className="whitespace-pre text-zinc-800 dark:text-zinc-200">{line}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
          {projectFileLoading ? 'Открываю файл…' : projectFileError || 'Файл не выбран'}
        </div>
      )) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {chatMessages.length > 0 && (
            <nav
              ref={chatNavigatorRef}
              aria-label="Навигация по сообщениям чата"
              className="w-7 shrink-0 border-r border-slate-200/80 bg-transparent dark:border-zinc-800/70 flex flex-col items-center gap-1 overflow-y-auto py-4"
            >
              {chatMessages.map((message, index) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => navigateToChatMessage(index)}
                  aria-label={`Перейти к сообщению ${index + 1}`}
                  aria-current={activeChatMessageIndex === index ? 'location' : undefined}
                  title={`Сообщение ${index + 1} · ${message.role === 'user' ? 'Вы' : 'Агент'}`}
                  className="w-6 h-3 shrink-0 inline-flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                >
                  <span
                    className={cn(
                      'h-1 rounded-full transition-all',
                      activeChatMessageIndex === index
                        ? 'w-5 bg-zinc-900 dark:bg-zinc-100'
                        : message.role === 'user'
                          ? 'w-2.5 bg-zinc-400 dark:bg-zinc-600'
                          : 'w-4 bg-zinc-300 dark:bg-zinc-700',
                    )}
                  />
                </button>
              ))}
            </nav>
          )}
          <div
            ref={chatScrollRef}
            onScroll={updateActiveChatMessage}
            className="flex-1 min-w-0 overflow-y-auto bg-transparent px-4 py-6 space-y-5 sm:px-6 lg:px-8"
          >
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className={cn('max-w-2xl mx-auto my-8 p-6 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>ONE CORE AI · Реальная работа с файлами, Git и терминалом</span>
              </div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {activeProject
                  ? `Проект «${activeProject.name}»`
                  : 'Общий чат — проект не обязателен'}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                {activeProject
                  ? 'Все команды и правки выполняются непосредственно в подключённой папке проекта с журналированием и поддержкой /undo.'
                  : 'Можно просто общаться с выбранной моделью. Если запрос потребует браузера, терминала или работы с файлами, агент автоматически переключится на нужный инструмент.'}
              </p>

              {!activeProject ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('onecore:open-project-modal'))}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Подключить проект для задач с файлами</span>
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendPrompt(q)}
                      disabled={serverStatus === 'generating'}
                      className={cn('text-left px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-500/50 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors', tokens.cardRadius)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSession?.messages.map((msg, index) => {
            const messageRole = roles.find((role) => role.id === msg.roleId) ?? activeRole;
            const messageRoleName = msg.roleName ?? messageRole?.name ?? 'Общий агент';
            const legacyModelName = msg.providerLabel?.includes(' · ')
              ? msg.providerLabel.slice(msg.providerLabel.indexOf(' · ') + 3)
              : undefined;
            const messageModelName =
              msg.modelName ?? legacyModelName ?? activeModelName ?? 'Агент проекта';
            const messageActivityEvents = msg.role === 'assistant'
              ? journalEvents.filter((event) =>
                  event.messageId === msg.id ||
                  (Boolean(msg.operationId) &&
                    (event.operationId === msg.operationId || event.parentOperationId === msg.operationId)),
                )
              : [];
            const activeOperationEvent = [...messageActivityEvents].reverse().find((event) =>
              event.status === 'running' &&
              ['tool', 'terminal', 'git', 'project', 'subagent'].includes(event.category),
            );
            const activityLabel = activeOperationEvent
              ? activeOperationEvent.summary || activeOperationEvent.title
              : msg.content.trim()
                ? 'Формирует ответ'
                : agentActivity === 'reading'
                  ? 'Изучает проект и читает файлы'
                  : agentActivity === 'editing'
                    ? 'Подготавливает изменения'
                    : agentActivity === 'writing'
                      ? 'Записывает изменения'
                      : agentActivity === 'terminal'
                        ? 'Выполняет команду в терминале'
                        : 'Обдумывает задачу';
            const isMessageActive = Boolean(
              msg.isStreaming ||
                (agentActivity !== 'idle' &&
                  (msg.diff?.status === 'pending' || msg.command?.status === 'running')),
            );
            return (
              <div
                key={msg.id}
                data-chat-message-index={index}
                aria-label={msg.role === 'user' ? 'Сообщение пользователя' : 'Ответ агента'}
                className={cn(
                  'max-w-4xl mx-auto border border-l-[3px] p-4 shadow-[0_2px_10px_-5px_rgba(45,65,95,0.18)] transition-[background-color,border-color,box-shadow] duration-200',
                  tokens.cardRadius,
                  msg.role === 'user' ? tokens.userBubbleBg : tokens.assistantBubbleBg,
                  msg.role === 'user'
                    ? 'ml-auto mr-0 max-w-3xl border-blue-200/80 border-l-blue-500 shadow-[0_3px_14px_-8px_rgba(37,99,235,0.28)] dark:border-blue-900/60'
                    : 'mx-auto border-l-violet-500',
                  isMessageActive && 'ring-1 ring-blue-300/50 dark:ring-blue-500/20',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex flex-wrap items-center gap-2">
                    {msg.role === 'user' ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                        <UserCheck className="w-3.5 h-3.5" />
                        Вы
                      </span>
                    ) : chatVisibility.showMessageHeaders ? (
                      <div className="inline-flex min-w-0 flex-wrap items-center gap-2">
                        <ModelMascot
                          compact
                          avatarOnly
                          status={isMessageActive ? serverStatus : 'ready'}
                          activity={isMessageActive ? agentActivity : 'idle'}
                          persona={messageRole?.persona ?? 'custom'}
                          roleName={messageRoleName}
                        />
                        <span className="font-semibold text-violet-700 dark:text-violet-300">
                          ONE CORE AI · {messageRoleName}
                        </span>
                        <span className="text-zinc-500">—</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-300">
                          {messageModelName}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300">
                        <Bot className="w-3.5 h-3.5" />
                        ONE CORE AI
                      </span>
                    )}
                    {chatVisibility.showMessageHeaders &&
                      msg.role === 'assistant' &&
                      chatVisibility.showCheckpointBadges &&
                      msg.checkpointId && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            {msg.checkpointId}
                          </span>
                        </>
                      )}
                    <div className="flex items-center gap-2 shrink-0">
                      {chatVisibility.showTimestamps && (
                        <span className="font-mono tabular-nums text-[11px]">{msg.timestamp}</span>
                      )}
                      {!msg.isStreaming && msg.content && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(msg.content);
                            setCopiedMessageId(msg.id);
                            window.setTimeout(() => {
                              setCopiedMessageId((current) => current === msg.id ? null : current);
                            }, 1600);
                          }}
                          aria-label={copiedMessageId === msg.id ? 'Сообщение скопировано' : 'Копировать сообщение'}
                          title={copiedMessageId === msg.id ? 'Скопировано' : 'Копировать сообщение'}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        >
                          {copiedMessageId === msg.id
                            ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                </div>
                </div>

                {messageActivityEvents.length > 0 && (
                  <details open={msg.isStreaming} className="mb-3 overflow-hidden rounded-lg border border-blue-100 bg-blue-50/55 dark:border-blue-900/40 dark:bg-blue-950/15">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                      <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold">Действия агента</span>
                      <span className="text-zinc-500">{messageActivityEvents.length}</span>
                      {messageActivityEvents.some((event) => event.status === 'running') && (
                        <span className="ml-auto inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <Radio className="h-3 w-3 animate-pulse" />
                          Выполняется
                        </span>
                      )}
                      {messageActivityEvents.some((event) => event.status === 'failed') && (
                        <span className="ml-auto inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          Есть ошибка
                        </span>
                      )}
                      {messageActivityEvents.some((event) => event.status === 'cancelled') && (
                        <span className="ml-auto inline-flex items-center gap-1 text-zinc-500">
                          <Square className="h-3 w-3" />
                          Отменено
                        </span>
                      )}
                    </summary>
                    <div className="space-y-2 border-t border-blue-100/80 px-3 py-2 dark:border-blue-900/30">
                      {messageActivityEvents.map((event) => (
                        <div key={event.id} className="flex min-w-0 items-start gap-2 text-[11px]">
                          <span className="mt-0.5 shrink-0">
                            {event.status === 'running'
                              ? <Radio className="h-3 w-3 animate-pulse text-blue-500" />
                              : event.status === 'failed'
                                ? <AlertCircle className="h-3 w-3 text-red-500" />
                                : event.status === 'cancelled'
                                  ? <Square className="h-3 w-3 text-zinc-500" />
                                  : <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{event.title}</span>
                            <span className="ml-2 text-zinc-500">{event.summary}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                            {new Date(event.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {chatVisibility.showReadFilesChips && msg.readFiles && msg.readFiles.length > 0 && (
                  <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    <Eye className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="font-mono text-[11px]">read_file:</span>
                    {msg.readFiles.map((rf, i) => (
                      <React.Fragment key={rf}>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">{rf}</span>
                        {i < msg.readFiles!.length - 1 && <span>·</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <MarkdownLite content={msg.content} />

                {msg.webSources && msg.webSources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
                    <div className="mb-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Источники
                    </div>
                    <div className="flex flex-col gap-1">
                      {msg.webSources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {source.title || source.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {msg.subagentRun && chatVisibility.showSubagentsPanel && (
                  <div className={cn('mt-3 p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 space-y-1.5', tokens.cardRadius)}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-blue-500" />
                        <span>{msg.subagentRun.title}</span>
                      </span>
                      <span
                        className={cn(
                          'font-mono tabular-nums text-[11px]',
                          msg.subagentRun.status === 'failed'
                            ? 'text-rose-500'
                            : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {msg.subagentRun.status === 'completed'
                          ? 'Завершён 100%'
                          : msg.subagentRun.status === 'failed'
                            ? 'Ошибка'
                            : `Выполняется ${msg.subagentRun.progressPct}%`}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-300',
                          msg.subagentRun.status === 'completed'
                            ? 'bg-emerald-500'
                            : msg.subagentRun.status === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-blue-600',
                        )}
                        style={{ width: `${msg.subagentRun.progressPct}%` }}
                      />
                    </div>
                    <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {msg.subagentRun.resultSummary}
                    </p>
                  </div>
                )}

                {msg.isStreaming && (
                  <div
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/75 px-3 py-2 text-xs text-blue-700 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="inline-flex items-center gap-1" aria-hidden="true">
                      <span className="h-1 w-1 rounded-full bg-current animate-bounce" />
                      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:120ms]" />
                      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:240ms]" />
                    </span>
                    {activityLabel}
                  </div>
                )}

                {chatVisibility.showDiffBlocks && msg.diff && (
                  <GitDiffViewer
                    diff={msg.diff}
                    onApply={() => void applyDiff(msg.id)}
                    onReject={() => rejectDiff(msg.id)}
                    onRollback={(cpId) => void rollbackToCheckpoint(cpId)}
                  />
                )}

                {chatVisibility.showTerminalBlocks && msg.command && (
                  <TerminalBlock
                    command={msg.command}
                    onRun={() => void runCommand(msg.id)}
                    onSkip={() => skipCommand(msg.id)}
                    onDiagnose={() => diagnoseCommandError(msg.id)}
                  />
                )}

                {msg.role === 'assistant' && !msg.isStreaming && !msg.subagentRun && (
                  <div className="mt-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={msg.skillLearned}
                      onClick={() => learnSkillFromMessage(msg.id)}
                      className={cn(
                        'text-[11px] font-medium inline-flex items-center gap-1 transition-colors',
                        msg.skillLearned
                          ? 'text-emerald-600 dark:text-emerald-400 cursor-default'
                          : 'text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400',
                      )}
                    >
                      {msg.skillLearned ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Сохранено в SKILL.md</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3 h-3" />
                          <span>Сохранить как навык</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={streamEndRef} />
          </div>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-zinc-200 bg-transparent p-3.5 relative dark:border-zinc-800"
      >
        <div className="max-w-4xl mx-auto relative">
          {showSlashPopup && matchingSlash.length > 0 && (
            <div className={cn('absolute bottom-full left-0 right-0 mb-2 border shadow-xl p-2 z-30 space-y-1', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="px-2 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Команды проекта и OneCore (нажмите для подстановки)
              </div>
              {matchingSlash.map((item) => (
                <button
                  key={item.command}
                  type="button"
                  onClick={() => setInput(`${item.command} `)}
                  className={cn('w-full text-left px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between gap-3 text-xs transition-colors', tokens.inputRadius)}
                >
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                    {item.syntax}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400 truncate">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {chatVisibility.showComposerStatusRow && latestCheckpoint && (
            <div className="flex justify-end mb-2">
              <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap tabular-nums">
                {includedTokens} tok · {latestCheckpoint.id}
              </span>
            </div>
          )}

          {chatVisibility.showQuickPrompts && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2 overflow-x-auto">
              {QUICK_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void sendPrompt(q)}
                  className={cn('px-2.5 py-1 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 hover:border-blue-500/50 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors', tokens.inputRadius)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className={cn('flex items-end gap-2 border border-zinc-200 bg-white p-2 transition-colors focus-within:border-blue-500 dark:border-zinc-700/80 dark:bg-zinc-950', tokens.cardRadius)}>
            <div className="flex shrink-0 items-center gap-1 pb-1"><button type="button" onClick={() => setInput((value) => value.startsWith('/web ') ? value : `/web ${value}`)} title="Браузер: поиск и чтение веб-страниц" aria-label="Браузер" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:hover:bg-blue-500/10"><Globe className="h-4 w-4" /></button><button type="button" onClick={() => setInput((value) => value.startsWith('/run ') ? value : `/run ${value}`)} title="Терминал: подготовить команду проекта" aria-label="Терминал" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-emerald-50 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 dark:hover:bg-emerald-500/10"><Terminal className="h-4 w-4" /></button></div>
            <textarea
              rows={2}
              disabled={serverStatus === 'generating'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                activeProject
                  ? 'Спросите что угодно или поручите задачу проекту...'
                  : 'Напишите сообщение или задачу — проект нужен только для работы с файлами...'
              }
              className="flex-1 resize-none bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none px-1.5 py-1"
            />
            {canCancelActiveChat ? (
              <button
                type="button"
                onClick={cancelActiveChat}
                className={cn('h-9 px-3.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50', tokens.inputRadius)}
              >
                <Square className="w-3.5 h-3.5" />
                <span>Остановить</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || serverStatus === 'generating'}
                className={cn('h-9 px-3.5 disabled:opacity-45 disabled:pointer-events-none text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap', tokens.inputRadius, tokens.accentButton)}
              >
                <span>Отправить</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
};

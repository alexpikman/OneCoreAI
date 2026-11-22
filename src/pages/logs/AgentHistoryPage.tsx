import React, { useMemo, useState } from 'react';
import { Bot, Clock3, MessageSquare, Search, UserRound } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentMessage, ChatSession } from '../../types/onecore';
import { cn } from '../../utils/cn';

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Время неизвестно' : date.toLocaleString('ru-RU');
}

function getSessionDuration(session: ChatSession): string {
  const timestamps = session.messages
    .map((message) => new Date(message.timestamp).getTime())
    .filter(Number.isFinite);
  if (timestamps.length < 2) return 'Одна точка истории';
  const elapsedMinutes = Math.max(0, Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 60000));
  if (elapsedMinutes < 1) return 'Менее минуты';
  if (elapsedMinutes < 60) return `${elapsedMinutes} мин.`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return minutes ? `${hours} ч. ${minutes} мин.` : `${hours} ч.`;
}

function getSessionTokens(session: ChatSession): number {
  return session.messages.reduce((total, message) => total + (message.tokenUsage?.totalTokens ?? 0), 0);
}

function MessageDetails({ message }: { message: AgentMessage }) {
  const assistant = message.role === 'assistant';
  return (
    <article
      className={cn(
        'rounded-xl border p-3',
        assistant
          ? 'border-blue-200/80 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {assistant ? (
          <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <UserRound className="h-3.5 w-3.5 text-zinc-500" />
        )}
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
          {assistant ? message.roleName || 'Ассистент' : 'Пользователь'}
        </span>
        {assistant && message.providerLabel && <span className="text-zinc-500">{message.providerLabel}</span>}
        {assistant && message.modelName && <span className="text-zinc-500">{message.modelName}</span>}
        <span className="ml-auto text-zinc-400">{formatTimestamp(message.timestamp)}</span>
      </div>
      <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-700 dark:text-zinc-300">
        {message.content || (message.isStreaming ? 'Ответ формируется…' : 'Пустое сообщение')}
      </div>
      {assistant && (message.tokenUsage || message.subagentRun) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-200/70 pt-2 text-[10px] text-zinc-500 dark:border-zinc-800">
          {message.tokenUsage?.totalTokens != null && (
            <span>Токены: {message.tokenUsage.totalTokens.toLocaleString('ru-RU')}</span>
          )}
          {message.tokenUsage?.source && (
            <span>Источник учёта: {message.tokenUsage.source === 'provider' ? 'провайдер' : 'оценка'}</span>
          )}
          {message.subagentRun && (
            <span>
              Субагент: {message.subagentRun.roleName} · {message.subagentRun.modelName} · {message.subagentRun.status}
            </span>
          )}
        </div>
      )}
      {assistant && message.readFiles && message.readFiles.length > 0 && (
        <div className="mt-2 text-[10px] text-zinc-500">Прочитано файлов: {message.readFiles.length}</div>
      )}
    </article>
  );
}

export const AgentHistoryPage: React.FC = () => {
  const sessions = useOneCoreStore((state) => state.sessions);
  const activeSessionId = useOneCoreStore((state) => state.activeSessionId);
  const [query, setQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const visibleSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...sessions]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .filter(
        (session) =>
          !normalizedQuery ||
          [
            session.title,
            ...session.messages.map((message) => message.content),
            ...session.messages.map((message) => message.roleName || ''),
            ...session.messages.map((message) => message.modelName || ''),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
      );
  }, [sessions, query]);

  const selectedSession =
    visibleSessions.find((session) => session.id === selectedSessionId) ??
    visibleSessions.find((session) => session.id === activeSessionId) ??
    visibleSessions[0] ??
    null;

  const totalTokens = selectedSession ? getSessionTokens(selectedSession) : 0;

  return (
    <PageLayout>
      <PageHeader showSave={false}>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">История агентов</h1>
        </div>
      </PageHeader>
      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 gap-4 py-5">
        <section className="flex w-72 min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Сессии</span>
              <span className="text-[10px] text-zinc-400">{visibleSessions.length}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по истории..."
                aria-label="Поиск по истории агентов"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {visibleSessions.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-zinc-500">
                {sessions.length === 0 ? 'История пока пуста' : 'Ничего не найдено'}
              </p>
            ) : (
              visibleSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  aria-pressed={selectedSession?.id === session.id}
                  className={cn(
                    'mb-1 w-full rounded-lg border p-2.5 text-left transition-colors',
                    selectedSession?.id === session.id
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40'
                      : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900',
                  )}
                >
                  <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    {session.title || 'Новый чат'}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                    <span>{session.messages.length} сообщений</span>
                    <span>{session.archivedAt ? 'Архив' : session.mode.toUpperCase()}</span>
                  </span>
                  <span className="mt-1 block text-[10px] text-zinc-400">{formatTimestamp(session.updatedAt)}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selectedSession ? (
            <>
              <div className="shrink-0 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedSession.title || 'Новый чат'}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {selectedSession.messages.length} сообщений
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" /> {getSessionDuration(selectedSession)}
                  </span>
                  <span>Токены: {totalTokens.toLocaleString('ru-RU')}</span>
                  <span>{selectedSession.archivedAt ? 'Архивная сессия' : 'Активная сессия'}</span>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3">
                {selectedSession.messages.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-500">В этой сессии пока нет сообщений</p>
                ) : (
                  selectedSession.messages.map((message) => <MessageDetails key={message.id} message={message} />)
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
              Выберите сессию из списка
            </div>
          )}
        </section>
      </PageContent>
    </PageLayout>
  );
};

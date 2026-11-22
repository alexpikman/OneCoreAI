import React, { useState } from 'react';
import { CheckCircle2, Loader2, Plug, Plus, RefreshCw, Trash2, Wrench, XCircle } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { getPageUiTokens } from '../../utils/uiStyle';

export const McpPage: React.FC = () => {
  const {
    uiStyle,
    mcpServers,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    inspectMcpServer,
  } = useOneCoreStore();

  const tokens = getPageUiTokens(uiStyle);
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<'http' | 'stdio'>('http');
  const [endpoint, setEndpoint] = useState('http://127.0.0.1:8787/mcp');
  const [command, setCommand] = useState('');
  const [argsText, setArgsText] = useState('');
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (transport === 'http' && !endpoint.trim()) return;
    if (transport === 'stdio' && !command.trim()) return;

    addMcpServer({
      name: name.trim(),
      transport,
      endpoint: transport === 'http' ? endpoint.trim() : '',
      command: transport === 'stdio' ? command.trim() : undefined,
      args:
        transport === 'stdio' && argsText.trim()
          ? argsText
              .split(/\s+/)
              .map((part) => part.trim())
              .filter(Boolean)
          : undefined,
      enabled: true,
    });

    setName('');
    setEndpoint('http://127.0.0.1:8787/mcp');
    setCommand('');
    setArgsText('');
  };

  const handleInspect = async (serverId: string) => {
    setInspectingId(serverId);
    setInspectError(null);
    try {
      const result = await inspectMcpServer(serverId);
      if (!result.ok && result.error) setInspectError(result.error);
    } finally {
      setInspectingId(null);
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Plug className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">Серверы MCP (Model Context Protocol)</h1>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-5 py-6">
        <div className="mx-auto w-full max-w-5xl space-y-5">
          <form
            onSubmit={handleAdd}
            className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}
          >
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-500" />
                <span>Подключить MCP-сервер</span>
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                HTTP-серверы проверяются реальным JSON-RPC запросом initialize + tools/list; stdio — проверкой доступности бинарника.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block text-[11px] text-zinc-500 mb-1">Название</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Local Knowledge MCP"
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] text-zinc-500 mb-1">Транспорт</label>
                <select
                  value={transport}
                  onChange={(e) => setTransport(e.target.value as 'http' | 'stdio')}
                  className={cn(
                    'w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs',
                    tokens.inputRadius,
                  )}
                >
                  <option value="http">HTTP JSON-RPC</option>
                  <option value="stdio">Local stdio command</option>
                </select>
              </div>
              {transport === 'http' ? (
                <div className="md:col-span-5">
                  <label className="block text-[11px] text-zinc-500 mb-1">Endpoint URL</label>
                  <input
                    type="url"
                    required
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="http://127.0.0.1:8787/mcp"
                    className={cn(
                      'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                      tokens.inputRadius,
                    )}
                  />
                </div>
              ) : (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-zinc-500 mb-1">Команда</label>
                    <input
                      type="text"
                      required
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="npx"
                      className={cn(
                        'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                        tokens.inputRadius,
                      )}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] text-zinc-500 mb-1">Аргументы</label>
                    <input
                      type="text"
                      value={argsText}
                      onChange={(e) => setArgsText(e.target.value)}
                      placeholder="-y @modelcontextprotocol/server-filesystem"
                      className={cn(
                        'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                        tokens.inputRadius,
                      )}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className={cn('h-9 px-4 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap', tokens.inputRadius, tokens.accentButton)}
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить MCP-сервер
              </button>
            </div>
          </form>

          {inspectError && (
            <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {inspectError}
            </p>
          )}

          {mcpServers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-xs text-zinc-500 dark:border-zinc-700">
              MCP-серверы пока не добавлены. Добавьте HTTP или stdio сервер выше и нажмите «Проверить».
            </div>
          ) : (
            <div className="space-y-3">
              {mcpServers.map((server) => (
                <article
                  key={server.id}
                  className={cn('p-4 border space-y-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{server.name}</span>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {server.transport.toUpperCase()}
                        </span>
                        {server.lastStatus === 'ok' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Доступен
                          </span>
                        )}
                        {server.lastStatus === 'error' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            <XCircle className="h-3.5 w-3.5" /> Ошибка
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500 break-all">
                        {server.transport === 'http'
                          ? server.endpoint
                          : `${server.command || ''} ${(server.args ?? []).join(' ')}`.trim()}
                      </div>
                      {server.lastMessage && (
                        <div className="text-xs text-zinc-600 dark:text-zinc-300">
                          {server.lastMessage}
                          {server.lastCheckedAt && (
                            <span className="ml-2 font-mono text-[10px] text-zinc-400">
                              ({new Date(server.lastCheckedAt).toLocaleString('ru-RU')})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={server.enabled}
                          onChange={(e) => updateMcpServer(server.id, { enabled: e.target.checked })}
                          className="accent-blue-600"
                        />
                        Вкл.
                      </label>
                      <button
                        type="button"
                        disabled={inspectingId === server.id}
                        onClick={() => void handleInspect(server.id)}
                        className="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {inspectingId === server.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Проверить MCP
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await requestDeleteWarning({
                            variant: 'simple',
                            title: 'Удалить MCP-сервер?',
                            description: 'Конфигурация MCP-сервера будет удалена.',
                            itemName: server.name,
                          });
                          if (confirmed) deleteMcpServer(server.id);
                        }}
                        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-rose-500/10 hover:text-rose-500 text-zinc-400 inline-flex items-center justify-center"
                        title="Удалить сервер"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {server.discoveredTools && server.discoveredTools.length > 0 && (
                    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800 space-y-2">
                      <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-blue-500" />
                        Обнаруженные инструменты ({server.discoveredTools.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {server.discoveredTools.map((tool) => (
                          <div
                            key={tool.name}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60"
                          >
                            <div className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {tool.name}
                            </div>
                            {tool.description && (
                              <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {tool.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
};

import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface McpInspectResult {
  ok: boolean;
  transport: 'http' | 'stdio';
  tools: Array<{ name: string; description?: string }>;
  serverInfo?: { name?: string; version?: string };
  message: string;
}

export async function inspectMcpServer(input: {
  transport: 'http' | 'stdio';
  endpoint?: string;
  command?: string;
  signal?: AbortSignal;
}): Promise<McpInspectResult> {
  if (input.transport === 'stdio') {
    const cmd = (input.command ?? '').trim().split(/\s+/)[0];
    if (!cmd) {
      return { ok: false, transport: 'stdio', tools: [], message: 'Не указана команда stdio-сервера MCP.' };
    }
    try {
      const locator = os.platform() === 'win32' ? 'where' : 'which';
      const { stdout } = await execFileAsync(locator, [cmd], { timeout: 5000 });
      const resolvedPath = stdout.trim().split(/\r?\n/)[0] || cmd;
      return {
        ok: true,
        transport: 'stdio',
        tools: [],
        message: `Исполняемый файл "${cmd}" найден (${resolvedPath}). Для перечисления инструментов stdio-сервер запускается клиентом MCP.`,
      };
    } catch {
      return {
        ok: false,
        transport: 'stdio',
        tools: [],
        message: `Исполняемый файл "${cmd}" не найден в PATH.`,
      };
    }
  }

  const endpoint = (input.endpoint ?? '').trim();
  if (!endpoint) {
    return { ok: false, transport: 'http', tools: [], message: 'Не указан URL HTTP MCP-сервера.' };
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(endpoint);
  } catch {
    return { ok: false, transport: 'http', tools: [], message: `Некорректный URL MCP-сервера: ${endpoint}` };
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { ok: false, transport: 'http', tools: [], message: 'Поддерживаются только протоколы http и https.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Таймаут опроса MCP-сервера')), 8000);
  const signal = input.signal ? AbortSignal.any([controller.signal, input.signal]) : controller.signal;

  try {
    const initResponse = await fetch(parsedUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'ONE CORE AI', version: '1.0.0' },
        },
      }),
      signal,
    });
    if (!initResponse.ok) {
      return {
        ok: false,
        transport: 'http',
        tools: [],
        message: `MCP initialize вернул HTTP ${initResponse.status}`,
      };
    }
    const initJson = (await initResponse.json()) as {
      result?: { serverInfo?: { name?: string; version?: string } };
      error?: { message?: string };
    };
    if (initJson.error) {
      return {
        ok: false,
        transport: 'http',
        tools: [],
        message: initJson.error.message || 'MCP-сервер вернул ошибку initialize.',
      };
    }

    const listResponse = await fetch(parsedUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
      signal,
    });
    if (!listResponse.ok) {
      return {
        ok: true,
        transport: 'http',
        serverInfo: initJson.result?.serverInfo,
        tools: [],
        message: `MCP initialize успешен, но tools/list вернул HTTP ${listResponse.status}.`,
      };
    }
    const listJson = (await listResponse.json()) as {
      result?: { tools?: Array<{ name?: unknown; description?: unknown }> };
      error?: { message?: string };
    };
    const tools = Array.isArray(listJson.result?.tools)
      ? listJson.result!.tools
          .filter((item): item is { name: string; description?: string } => typeof item?.name === 'string' && item.name.trim().length > 0)
          .map((item) => ({
            name: item.name.trim(),
            ...(typeof item.description === 'string' && item.description.trim() ? { description: item.description.trim() } : {}),
          }))
      : [];

    return {
      ok: true,
      transport: 'http',
      serverInfo: initJson.result?.serverInfo,
      tools,
      message: tools.length > 0
        ? `Подключено к MCP (${initJson.result?.serverInfo?.name ?? parsedUrl.host}): найдено инструментов ${tools.length}.`
        : `Подключено к MCP (${initJson.result?.serverInfo?.name ?? parsedUrl.host}): сервер не вернул инструментов.`,
    };
  } catch (error) {
    return {
      ok: false,
      transport: 'http',
      tools: [],
      message: error instanceof Error ? error.message : 'Ошибка соединения с MCP-сервером.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

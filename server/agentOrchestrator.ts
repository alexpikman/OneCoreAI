import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listProjectFiles,
  readProjectFile,
  runProjectGit,
  safeResolveInside,
  searchProjectCode,
  writeProjectFile,
  execProjectCommand,
} from './projectAgent';
import { assertProjectToolAllowed, isProjectToolAllowed } from './permissionManager';
import { listKnowledgeDocuments, readApprovedKnowledgeDocument } from './knowledgeManager';
import { readAppSettings } from './settingsManager';
import { normalizeSystemConfig } from '../src/data/systemConfig';
import { recordAgentEvent, type AgentTraceMetadata } from './agentJournal';
import {
  extractLineFragment,
  MAX_TOOL_READ_CHARS,
  workerFragmentDeduplicationCache,
  type ProvisionedWorkerContext,
} from './orchestration/contextBuilder';
import {
  createPendingCriticalConfirmation,
  evaluateCriticalActionRisk,
} from './orchestration/godModeGuard';
import { getProjectById } from './projectsManager';
import { verifyFileRemoved } from './verificationGate';
import type {
  CriticalActionConfirmationRequest,
  CustomSubagentBlueprint,
  GeneralAgentAuthorityMode,
} from '../src/types/onecore';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

type AgentProvider = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
};

type ToolSchemaProperty = {
  type: 'string' | 'integer' | 'boolean' | 'array';
  description: string;
  items?: { type: 'string' };
};

type AgentTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolSchemaProperty>;
      required: string[];
      additionalProperties: false;
    };
  };
};

const MAX_FILE_CONTENT_CHARS = 24000;

function buildTools(options: {
  projectId: string;
  knowledgeRoot?: string;
  mode: 'plan' | 'act';
  authorityMode: GeneralAgentAuthorityMode;
}): AgentTool[] {
  const { projectId, knowledgeRoot, mode, authorityMode } = options;
  const tools: AgentTool[] = [];
  const hasProject = Boolean(projectId);
  const canReadProject = hasProject && (authorityMode === 'god' || authorityMode === 'god-pro' || isProjectToolAllowed(projectId, 'read_file'));
  const canSearchProject = hasProject && canReadProject && (authorityMode === 'god' || authorityMode === 'god-pro' || isProjectToolAllowed(projectId, 'search_code'));
  const isGodOrPro = authorityMode === 'god' || authorityMode === 'god-pro';

  if (canReadProject) {
    tools.push(
      {
        type: 'function',
        function: {
          name: 'list_project_files',
          description: 'List files in the connected project. Use this to discover real project paths.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'read_project_file',
          description: 'Read the actual contents of one file inside the connected project.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Project-relative file path' },
              startLine: { type: 'integer', description: 'Optional 1-based first line of the fragment' },
              endLine: { type: 'integer', description: 'Optional 1-based last line of the fragment' },
            },
            required: ['path'],
            additionalProperties: false,
          },
        },
      },
    );
  }

  if (canSearchProject) {
    tools.push({
      type: 'function',
      function: {
        name: 'search_project_code',
        description: 'Search actual project files for a literal text fragment.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text to search for' },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
    });
  }

  if (knowledgeRoot) {
    tools.push(
      {
        type: 'function',
        function: {
          name: 'list_knowledge_documents',
          description: 'List approved role contracts, procedures, and protocols in the ONE CORE AI knowledge base.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'read_knowledge_document',
          description: 'Read one approved knowledge document by its stable ID. Draft and review documents are not available for automatic use.',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Stable knowledge document ID from list_knowledge_documents' },
            },
            required: ['id'],
            additionalProperties: false,
          },
        },
      },
    );
  }

  // Standard PLAN callers expect strictly the 5 base read/knowledge tools above.
  if (!isGodOrPro && mode !== 'act') {
    return tools;
  }

  if (canReadProject) {
    tools.push({
      type: 'function',
      function: {
        name: 'open_project_file',
        description: 'Open and inspect a project file in the workspace editor while returning its content to you.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Project-relative file path to open and read' },
          },
          required: ['path'],
          additionalProperties: false,
        },
      },
    });
  }

  if (isGodOrPro) {
    if (hasProject) {
      tools.push(
        {
          type: 'function',
          function: {
            name: 'write_project_file',
            description: 'Create or update a file inside the connected project. In GOD mode, sensitive config or secret files pause for user confirmation.',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Project-relative file path' },
                content: { type: 'string', description: 'Full new file content' },
                summary: { type: 'string', description: 'Short change summary' },
              },
              required: ['path', 'content'],
              additionalProperties: false,
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'delete_project_file',
            description: 'Delete a project file. In GOD mode, ALWAYS pauses for explicit user confirmation.',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Project-relative file path to delete' },
              },
              required: ['path'],
              additionalProperties: false,
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'run_project_command',
            description: 'Execute a terminal command inside the project folder. In GOD mode, ALWAYS pauses for user confirmation before running.',
            parameters: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'Shell command to execute' },
              },
              required: ['command'],
              additionalProperties: false,
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'run_project_git',
            description: 'Run Git action in project (status, diff, log, commit, fetch, push, init). Mutating Git actions pause for user confirmation in GOD mode.',
            parameters: {
              type: 'object',
              properties: {
                action: { type: 'string', description: 'status | diff | log | commit | fetch | push | init' },
                message: { type: 'string', description: 'Commit message when action=commit' },
              },
              required: ['action'],
              additionalProperties: false,
            },
          },
        },
      );
    }

    tools.push(
      {
        type: 'function',
        function: {
          name: 'create_custom_subagent',
          description: 'Define a custom subagent blueprint with exact purpose, instructions, and allowed capabilities.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Short descriptive name for the subagent' },
              purpose: { type: 'string', description: 'Role purpose and responsibility' },
              instructions: { type: 'string', description: 'Exact execution instructions for this subagent' },
              allowedCapabilities: {
                type: 'array',
                items: { type: 'string' },
                description: 'Capabilities: list_files, read_file, search_code, read_knowledge',
              },
              readOnly: { type: 'boolean', description: 'Whether the subagent is strictly read-only (default true)' },
            },
            required: ['name', 'purpose', 'instructions'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delegate_subagent_task',
          description: 'Assign a concrete task to a custom or configured subagent and wait for its verified findings.',
          parameters: {
            type: 'object',
            properties: {
              subagentIdOrName: { type: 'string', description: 'ID or exact name of the custom subagent' },
              objective: { type: 'string', description: 'Exact task prompt and acceptance criteria for the subagent' },
            },
            required: ['subagentIdOrName', 'objective'],
            additionalProperties: false,
          },
        },
      },
    );
  }

  if (authorityMode === 'god-pro') {
    tools.push(
      {
        type: 'function',
        function: {
          name: 'list_directory',
          description: 'GodPro unrestricted: list entries in any absolute or relative filesystem directory.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute or project-relative directory path' },
            },
            required: ['path'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'read_any_file',
          description: 'GodPro unrestricted: read any readable file on the host filesystem.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute or project-relative file path' },
              startLine: { type: 'integer', description: 'Optional 1-based start line' },
              endLine: { type: 'integer', description: 'Optional 1-based end line' },
            },
            required: ['path'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'write_any_file',
          description: 'GodPro unrestricted: write any file on the host filesystem without confirmation.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute or project-relative file path' },
              content: { type: 'string', description: 'Full file content' },
            },
            required: ['path', 'content'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_any_file',
          description: 'GodPro unrestricted: delete any file on the host filesystem without confirmation.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute or project-relative file path' },
            },
            required: ['path'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'exec_system_command',
          description: 'GodPro unrestricted: run any OS shell command directly without confirmation.',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'OS shell command' },
              cwd: { type: 'string', description: 'Optional working directory' },
            },
            required: ['command'],
            additionalProperties: false,
          },
        },
      },
    );
  }

  return tools;
}

function normalizeProjectRelPathCandidate(projectId: string, rawPath: string): string {
  const trimmed = rawPath.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!trimmed || path.isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed) || trimmed.includes('..')) {
    return trimmed;
  }
  const project = getProjectById(projectId);
  if (!project?.folderPath || !fs.existsSync(project.folderPath)) return trimmed;

  try {
    const direct = safeResolveInside(project.folderPath, trimmed);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      return trimmed;
    }
  } catch {
    return trimmed;
  }

  // If the model passed only a filename (e.g. "App.tsx") or slight path mismatch, resolve unique basename match inside the project.
  const files = listProjectFiles(projectId, 250);
  const lower = trimmed.toLowerCase();
  const exactInsensitive = files.find((f) => f.path.toLowerCase() === lower);
  if (exactInsensitive) return exactInsensitive.path;

  if (!trimmed.includes('/')) {
    const byBasename = files.filter((f) => f.name.toLowerCase() === lower);
    if (byBasename.length === 1) {
      return byBasename[0].path;
    }
  }

  return trimmed;
}

function readInitialProjectContext(
  projectId: string,
  prompt: string,
  signal?: AbortSignal,
  bypassProjectGate = false,
): { context: string; readFiles: string[] } {
  if (!projectId) {
    return { context: 'Активный проект не подключён.', readFiles: [] };
  }
  if (!bypassProjectGate) {
    assertProjectToolAllowed(projectId, 'read_file');
  }
  if (signal?.aborted) throw new Error('Подготовка контекста отменена.');
  const files = listProjectFiles(projectId, 250);
  const promptLower = prompt.toLowerCase();
  const terms = promptLower.match(/[a-zа-я0-9_./-]{3,}/gi) ?? [];
  const priority = [
    'readme.md',
    'package.json',
    'tsconfig.json',
    'src/app.tsx',
    'server/app.ts',
    'src/store/useonecorestore.ts',
  ];
  const ranked = [...files].sort((left, right) => {
    const score = (filePath: string) => {
      const normalized = filePath.toLowerCase();
      const baseName = path.posix.basename(normalized);
      const exactMention = promptLower.includes(normalized) ? 120 : promptLower.includes(baseName) && baseName.includes('.') ? 70 : 0;
      const keywordScore = terms.reduce(
        (total, term) => total + (normalized.includes(term) ? Math.min(term.length, 8) : 0),
        0,
      );
      const priorityIndex = priority.indexOf(normalized);
      return exactMention + keywordScore + (priorityIndex >= 0 ? 20 - priorityIndex : 0);
    };
    return score(right.path) - score(left.path) || left.path.localeCompare(right.path);
  });

  const blocks: string[] = [];
  const readFiles: string[] = [];
  let remainingChars = 24000;
  for (const file of ranked) {
    if (blocks.length >= 6 || remainingChars <= 0) break;
    if (signal?.aborted) throw new Error('Подготовка контекста отменена.');
    if (file.sizeBytes > 2 * 1024 * 1024) continue;
    try {
      const result = bypassProjectGate
        ? readProjectFileWithoutGate(projectId, file.path, signal)
        : readProjectFile(projectId, file.path, signal);
      if (signal?.aborted) throw new Error('Подготовка контекста отменена.');
      const excerpt = result.content.slice(0, Math.min(6000, remainingChars));
      blocks.push(`### ${result.path}${excerpt.length < result.content.length ? ' (содержимое сокращено)' : ''}\n\`\`\`\n${excerpt}\n\`\`\``);
      readFiles.push(result.path);
      remainingChars -= excerpt.length;
    } catch (error) {
      if (signal?.aborted) throw new Error('Подготовка контекста отменена.');
      // A file is listed only after its contents have been read successfully.
    }
  }

  return {
    context: blocks.length > 0 ? blocks.join('\n\n') : 'Файлы проекта пока отсутствуют или пусты.',
    readFiles,
  };
}

function readProjectFileWithoutGate(
  projectId: string,
  relPath: string,
  signal?: AbortSignal,
): { path: string; content: string; sizeBytes: number } {
  if (signal?.aborted) throw new Error('Запрос отменён до завершения чтения файла.');
  const project = getProjectById(projectId);
  if (!project || !project.folderPath || !fs.existsSync(project.folderPath)) {
    throw new Error(`Папка проекта недоступна: ${projectId}`);
  }
  const full = safeResolveInside(project.folderPath, relPath);
  const stat = fs.statSync(full);
  if (!stat.isFile()) throw new Error(`Указанный путь не является файлом проекта: ${relPath}`);
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`Файл слишком большой для чтения в контекст (${stat.size} байт)`);
  }
  const content = fs.readFileSync(full, 'utf-8');
  const normalizedPath = path.relative(project.folderPath, full).split(path.sep).join('/');
  return { path: normalizedPath, content, sizeBytes: stat.size };
}

function parseArguments(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Аргументы инструмента должны быть JSON-объектом.');
  }
  return parsed as Record<string, unknown>;
}

async function execSystemCommandDirect(
  command: string,
  cwdInput?: string,
  timeoutMs = 30000,
  signal?: AbortSignal,
): Promise<{ command: string; cwd: string; stdout: string; stderr: string; exitCode: number }> {
  const raw = command.trim();
  if (!raw) throw new Error('Пустая команда для выполнения.');
  const cwd = cwdInput?.trim() ? path.resolve(cwdInput.trim()) : os.homedir();
  if (!fs.existsSync(cwd)) throw new Error(`Рабочий каталог не существует: ${cwd}`);

  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const shellBin = isWin ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWin ? ['-NoProfile', '-Command', raw] : ['-c', raw];

    const child = spawn(shellBin, shellArgs, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let finished = false;
    const finish = (exitCode: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve({ command: raw, cwd, stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode });
    };
    const onAbort = () => {
      try { child.kill(); } catch { /* ignore */ }
      finish(130);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
      stderr = `${stderr}\nТаймаут выполнения (${timeoutMs} мс)`.trim();
      finish(124);
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < 128 * 1024) stdout += chunk.toString('utf-8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 128 * 1024) stderr += chunk.toString('utf-8');
    });
    child.on('error', (err) => {
      stderr = `${stderr}\n${err.message}`.trim();
      finish(127);
    });
    child.on('close', (code) => {
      finish(code ?? 1);
    });
  });
}

async function runScopedSubagentTurn(input: {
  blueprint: CustomSubagentBlueprint;
  objective: string;
  projectId: string;
  knowledgeRoot?: string;
  provider: AgentProvider;
  authorityMode: GeneralAgentAuthorityMode;
  signal?: AbortSignal;
}): Promise<{ summary: string; readFiles: string[]; searchedFiles: string[]; status: 'completed' | 'failed' }> {
  const { blueprint, objective, projectId, knowledgeRoot, provider, authorityMode, signal } = input;
  const subOpId = `subagent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  recordAgentEvent({
    category: 'subagent',
    level: 'info',
    status: 'running',
    title: `Субагент: ${blueprint.name}`,
    summary: `Выполнение задачи: ${objective.slice(0, 180)}`,
    source: 'general-agent-orchestrator',
    projectId: projectId || undefined,
    operationId: subOpId,
    details: {
      subagentId: blueprint.id,
      readOnly: blueprint.readOnly,
      capabilities: blueprint.allowedCapabilities.join(', '),
    },
  });

  try {
    const allowedSet = new Set(blueprint.allowedCapabilities);
    const subTools = buildTools({
      projectId,
      knowledgeRoot,
      mode: 'plan',
      authorityMode: 'standard',
    }).filter((tool) => {
      const n = tool.function.name;
      if (n === 'list_project_files') return allowedSet.has('list_files') || allowedSet.has('read_file');
      if (n === 'read_project_file') return allowedSet.has('read_file');
      if (n === 'search_project_code') return allowedSet.has('search_code');
      if (n === 'list_knowledge_documents' || n === 'read_knowledge_document') return allowedSet.has('read_knowledge');
      return false;
    });

    const baseUrl = provider.baseUrl.trim().replace(/\/+$/, '');
    const subMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `Ты — специализированный субагент «${blueprint.name}», созданный Общим агентом.\n` +
          `Назначение: ${blueprint.purpose}\n` +
          `Твои права (capabilities): ${blueprint.allowedCapabilities.join(', ') || 'read-only анализ'}\n` +
          `Режим: ${blueprint.readOnly ? 'строго read-only' : 'исполнительный (изменения передавай в отчёте)'}\n` +
          `Точные инструкции:\n${blueprint.instructions}\n\n` +
          'Выполняй только порученную задачу. Опирайся исключительно на реальные результаты инструментов.',
      },
      { role: 'user', content: objective },
    ];

    const subReadFiles = new Set<string>();
    const subSearchedFiles = new Set<string>();

    for (let round = 0; round <= 4; round += 1) {
      if (signal?.aborted) throw new Error('Задача субагента отменена.');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (provider.apiKey?.trim()) headers.Authorization = `Bearer ${provider.apiKey.trim()}`;

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model,
          temperature: provider.temperature ?? 0.2,
          messages: subMessages,
          ...(round < 4 && subTools.length > 0 ? { tools: subTools, tool_choice: 'auto' } : {}),
          stream: false,
        }),
        signal,
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} при запуске субагента ${blueprint.name}`);
      }
      const payload = (await resp.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
          };
        }>;
      };
      const msg = payload.choices?.[0]?.message;
      const calls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
      if (calls.length === 0 || round === 4) {
        const finalSummary = (typeof msg?.content === 'string' && msg.content.trim())
          ? msg.content.trim()
          : `Субагент «${blueprint.name}» завершил проверку (прочитано файлов: ${subReadFiles.size}).`;
        recordAgentEvent({
          category: 'subagent',
          level: 'info',
          status: 'completed',
          title: `Субагент завершил: ${blueprint.name}`,
          summary: finalSummary.slice(0, 200),
          source: 'general-agent-orchestrator',
          projectId: projectId || undefined,
          operationId: subOpId,
          details: { readFilesCount: subReadFiles.size },
        });
        return {
          summary: finalSummary,
          readFiles: [...subReadFiles],
          searchedFiles: [...subSearchedFiles],
          status: 'completed',
        };
      }

      subMessages.push({
        role: 'assistant',
        content: typeof msg?.content === 'string' ? msg.content : null,
        tool_calls: calls.map((c, idx) => ({
          id: c.id || `subcall-${round}-${idx}`,
          type: 'function',
          function: { name: c.function?.name ?? '', arguments: c.function?.arguments ?? '{}' },
        })),
      });

      for (let idx = 0; idx < calls.length; idx += 1) {
        const c = calls[idx];
        const callId = c.id || `subcall-${round}-${idx}`;
        const toolName = c.function?.name ?? '';
        const args = parseArguments(c.function?.arguments ?? '{}');
        try {
          if (toolName === 'list_project_files' && projectId) {
            const files = listProjectFiles(projectId, 200);
            subMessages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify(files.map(({ path: p, language, sizeBytes }) => ({ path: p, language, sizeBytes }))),
            });
          } else if (toolName === 'read_project_file' && projectId) {
            const rawPath = typeof args.path === 'string' ? args.path : '';
            const norm = normalizeProjectRelPathCandidate(projectId, rawPath);
            const file = authorityMode === 'god' || authorityMode === 'god-pro'
              ? readProjectFileWithoutGate(projectId, norm, signal)
              : readProjectFile(projectId, norm, signal);
            subReadFiles.add(file.path);
            subMessages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify({ path: file.path, content: file.content.slice(0, MAX_FILE_CONTENT_CHARS) }),
            });
          } else if (toolName === 'search_project_code' && projectId) {
            const q = typeof args.query === 'string' ? args.query.trim() : '';
            const matches = searchProjectCode(projectId, q, signal);
            matches.forEach((m) => subSearchedFiles.add(m.path));
            subMessages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify({ count: matches.length, matches }),
            });
          } else if (toolName === 'list_knowledge_documents' && knowledgeRoot) {
            const docs = listKnowledgeDocuments(knowledgeRoot).filter((d) => d.status === 'approved');
            subMessages.push({ role: 'tool', tool_call_id: callId, content: JSON.stringify({ documents: docs }) });
          } else if (toolName === 'read_knowledge_document' && knowledgeRoot) {
            const doc = readApprovedKnowledgeDocument(knowledgeRoot, typeof args.id === 'string' ? args.id.trim() : '');
            subMessages.push({ role: 'tool', tool_call_id: callId, content: JSON.stringify({ id: doc.id, content: doc.content }) });
          } else {
            subMessages.push({ role: 'tool', tool_call_id: callId, content: JSON.stringify({ ok: false, error: `Инструмент ${toolName} недоступен субагенту.` }) });
          }
        } catch (err) {
          subMessages.push({
            role: 'tool',
            tool_call_id: callId,
            content: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Ошибка субагента' }),
          });
        }
      }
    }

    return {
      summary: `Субагент «${blueprint.name}» завершил работу.`,
      readFiles: [...subReadFiles],
      searchedFiles: [...subSearchedFiles],
      status: 'completed',
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Ошибка субагента';
    recordAgentEvent({
      category: 'subagent',
      level: 'error',
      status: 'failed',
      title: `Ошибка субагента: ${blueprint.name}`,
      summary: errMsg.slice(0, 200),
      source: 'general-agent-orchestrator',
      projectId: projectId || undefined,
      operationId: subOpId,
    });
    return {
      summary: `Ошибка субагента «${blueprint.name}»: ${errMsg}`,
      readFiles: [],
      searchedFiles: [],
      status: 'failed',
    };
  }
}

async function executeTool(options: {
  projectId: string;
  name: string;
  rawArguments: string;
  knowledgeRoot?: string;
  contextBudget?: { remainingChars: number };
  taskId?: string;
  signal?: AbortSignal;
  authorityMode: GeneralAgentAuthorityMode;
  provider: AgentProvider;
  subagentsPool: CustomSubagentBlueprint[];
  createdSubagents: CustomSubagentBlueprint[];
  pendingConfirmations: CriticalActionConfirmationRequest[];
  operationId?: string;
}): Promise<{ content: string; readFiles: string[]; openedFiles: string[]; searchedFiles: string[] }> {
  const {
    projectId,
    name,
    rawArguments,
    knowledgeRoot,
    contextBudget,
    taskId,
    signal,
    authorityMode,
    provider,
    subagentsPool,
    createdSubagents,
    pendingConfirmations,
    operationId,
  } = options;

  if (signal?.aborted) throw new Error('Запрос отменён.');
  const args = parseArguments(rawArguments);
  const bypassProjectGate = authorityMode === 'god' || authorityMode === 'god-pro';

  if (name === 'list_knowledge_documents') {
    if (!knowledgeRoot) throw new Error('Справочник знаний недоступен.');
    const documents = listKnowledgeDocuments(knowledgeRoot)
      .filter((document) => document.status === 'approved')
      .map(({ id, version, ownerRole, triggers, category, relativePath, title }) => ({
        id, version, ownerRole, triggers, category, relativePath, title,
      }));
    return { content: JSON.stringify({ count: documents.length, documents }), readFiles: [], openedFiles: [], searchedFiles: [] };
  }

  if (name === 'read_knowledge_document') {
    if (!knowledgeRoot) throw new Error('Справочник знаний недоступен.');
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    const document = readApprovedKnowledgeDocument(knowledgeRoot, id);
    return {
      content: JSON.stringify({
        id: document.id,
        version: document.version,
        category: document.category,
        relativePath: document.relativePath,
        title: document.title,
        content: document.content,
      }),
      readFiles: [],
      openedFiles: [],
      searchedFiles: [],
    };
  }

  if (name === 'list_project_files') {
    if (!projectId) throw new Error('Проект не подключён.');
    if (!bypassProjectGate) assertProjectToolAllowed(projectId, 'read_file');
    const files = listProjectFiles(projectId, 250);
    return {
      content: JSON.stringify(files.map(({ path: p, language, sizeBytes }) => ({ path: p, language, sizeBytes }))),
      readFiles: [],
      openedFiles: [],
      searchedFiles: [],
    };
  }

  if (name === 'read_project_file' || name === 'open_project_file') {
    if (!projectId) throw new Error('Проект не подключён.');
    if (!bypassProjectGate) assertProjectToolAllowed(projectId, 'read_file');
    const rawPath = typeof args.path === 'string' ? args.path.trim() : '';
    if (!rawPath || rawPath.length > 1024) throw new Error('Не задан корректный относительный путь файла.');

    if (authorityMode === 'god') {
      const risk = evaluateCriticalActionRisk({ toolName: name, args: { ...args, path: rawPath }, authorityMode });
      if (risk.critical && risk.rule) {
        const req = createPendingCriticalConfirmation({
          projectId,
          toolName: name,
          toolArgs: { ...args, path: rawPath },
          rule: risk.rule,
          targetSummary: risk.targetSummary,
          operationId,
        });
        pendingConfirmations.push(req);
        return {
          content: JSON.stringify({
            ok: false,
            requiresConfirmation: true,
            confirmationId: req.id,
            ruleId: req.ruleId,
            message: `GOD-ограничение: ${risk.rule.titleRu}. Требуется подтверждение пользователя.`,
          }),
          readFiles: [],
          openedFiles: [],
          searchedFiles: [],
        };
      }
    }

    const normalizedCandidate = normalizeProjectRelPathCandidate(projectId, rawPath);
    const file = bypassProjectGate
      ? readProjectFileWithoutGate(projectId, normalizedCandidate, signal)
      : readProjectFile(projectId, normalizedCandidate, signal);
    if (signal?.aborted) throw new Error('Запрос отменён после чтения файла.');
    const startLine = args.startLine === undefined ? undefined : Number(args.startLine);
    const endLine = args.endLine === undefined ? undefined : Number(args.endLine);
    const fragment = extractLineFragment(file.content, startLine, endLine);
    const budgetLimit = contextBudget ? Math.max(0, contextBudget.remainingChars) : MAX_TOOL_READ_CHARS;
    const contentLimit = Math.min(MAX_FILE_CONTENT_CHARS, MAX_TOOL_READ_CHARS, budgetLimit);
    if (contentLimit <= 0) throw new Error('Исчерпан общий бюджет контекста Worker (40 000 символов).');
    const boundedContent = fragment.content.slice(0, contentLimit);
    const cachedFragment = workerFragmentDeduplicationCache.getFragment({
      taskId: taskId ?? `direct:${projectId}`,
      normalizedPath: file.path,
      startLine: fragment.startLine,
      endLine: fragment.endLine,
      content: boundedContent,
      contentHash: createHash('sha256').update(fragment.content, 'utf-8').digest('hex'),
    });
    if (contextBudget) contextBudget.remainingChars -= cachedFragment.content.length;
    return {
      content: JSON.stringify({
        path: file.path,
        opened: name === 'open_project_file',
        sizeBytes: file.sizeBytes,
        startLine: fragment.startLine,
        endLine: fragment.endLine,
        content: cachedFragment.content,
        contentHash: cachedFragment.contentHash,
        cacheHit: cachedFragment.cacheHit,
        truncated: cachedFragment.content.length < fragment.content.length,
      }),
      readFiles: cachedFragment.content.length > 0 ? [file.path] : [],
      openedFiles: name === 'open_project_file' ? [file.path] : [],
      searchedFiles: [],
    };
  }

  if (name === 'search_project_code') {
    if (!projectId) throw new Error('Проект не подключён.');
    if (!bypassProjectGate) {
      assertProjectToolAllowed(projectId, 'search_code');
      assertProjectToolAllowed(projectId, 'read_file');
    }
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query || query.length > 300) throw new Error('Поисковый запрос должен содержать от 1 до 300 символов.');
    const matches = searchProjectCode(projectId, query, signal);
    return {
      content: JSON.stringify({ count: matches.length, matches }),
      readFiles: [],
      openedFiles: [],
      searchedFiles: [...new Set(matches.map((match) => match.path))],
    };
  }

  if (name === 'write_project_file' && bypassProjectGate) {
    if (!projectId) throw new Error('Проект не подключён.');
    const rawPath = typeof args.path === 'string' ? args.path.trim() : '';
    const content = typeof args.content === 'string' ? args.content : '';
    const summary = typeof args.summary === 'string' && args.summary.trim() ? args.summary.trim() : 'GOD/GodPro правка файла';
    const normPath = normalizeProjectRelPathCandidate(projectId, rawPath);

    if (authorityMode === 'god') {
      const risk = evaluateCriticalActionRisk({
        toolName: 'write_project_file',
        args: { path: normPath, content, summary },
        authorityMode,
      });
      if (risk.critical && risk.rule) {
        const req = createPendingCriticalConfirmation({
          projectId,
          toolName: 'write_project_file',
          toolArgs: { path: normPath, content, summary },
          rule: risk.rule,
          targetSummary: risk.targetSummary,
          operationId,
        });
        pendingConfirmations.push(req);
        return {
          content: JSON.stringify({
            ok: false,
            requiresConfirmation: true,
            confirmationId: req.id,
            ruleId: req.ruleId,
            message: `Режим GOD: запись критического файла «${normPath}» (${risk.rule.titleRu}) поставлена на паузу до подтверждения пользователем.`,
          }),
          readFiles: [],
          openedFiles: [],
          searchedFiles: [],
        };
      }
    }

    const res = writeProjectFile(projectId, normPath, content, summary);
    return {
      content: JSON.stringify({ ok: true, path: res.path, existedBefore: res.existedBefore, verified: res.verification.verified }),
      readFiles: [res.path],
      openedFiles: [res.path],
      searchedFiles: [],
    };
  }

  if (name === 'delete_project_file' && bypassProjectGate) {
    if (!projectId) throw new Error('Проект не подключён.');
    const rawPath = typeof args.path === 'string' ? args.path.trim() : '';
    const normPath = normalizeProjectRelPathCandidate(projectId, rawPath);

    if (authorityMode === 'god') {
      const risk = evaluateCriticalActionRisk({
        toolName: 'delete_project_file',
        args: { path: normPath },
        authorityMode,
      });
      const req = createPendingCriticalConfirmation({
        projectId,
        toolName: 'delete_project_file',
        toolArgs: { path: normPath },
        rule: risk.rule!,
        targetSummary: normPath,
        operationId,
      });
      pendingConfirmations.push(req);
      return {
        content: JSON.stringify({
          ok: false,
          requiresConfirmation: true,
          confirmationId: req.id,
          ruleId: req.ruleId,
          message: `Режим GOD: удаление файла «${normPath}» заблокировано до подтверждения пользователем.`,
        }),
        readFiles: [],
        openedFiles: [],
        searchedFiles: [],
      };
    }

    const project = getProjectById(projectId);
    if (!project) throw new Error('Проект не найден');
    const full = safeResolveInside(project.folderPath, normPath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    const verification = verifyFileRemoved(full);
    return {
      content: JSON.stringify({ ok: verification.verified, path: normPath, deleted: verification.verified }),
      readFiles: [],
      openedFiles: [],
      searchedFiles: [],
    };
  }

  if (name === 'run_project_command' && bypassProjectGate) {
    if (!projectId) throw new Error('Проект не подключён.');
    const command = typeof args.command === 'string' ? args.command.trim() : '';
    if (!command) throw new Error('Не указана команда терминала.');

    if (authorityMode === 'god') {
      const risk = evaluateCriticalActionRisk({
        toolName: 'run_project_command',
        args: { command },
        authorityMode,
      });
      const req = createPendingCriticalConfirmation({
        projectId,
        toolName: 'run_project_command',
        toolArgs: { command },
        rule: risk.rule!,
        targetSummary: command,
        operationId,
      });
      pendingConfirmations.push(req);
      return {
        content: JSON.stringify({
          ok: false,
          requiresConfirmation: true,
          confirmationId: req.id,
          ruleId: req.ruleId,
          message: `Режим GOD: команда «${command}» ожидает явного подтверждения пользователя перед запуском.`,
        }),
        readFiles: [],
        openedFiles: [],
        searchedFiles: [],
      };
    }

    const res = await execProjectCommand(projectId, command, 30000, signal);
    return {
      content: JSON.stringify({
        ok: res.exitCode === 0,
        command: res.command,
        exitCode: res.exitCode,
        stdout: res.stdout.slice(0, 12000),
        stderr: res.stderr.slice(0, 6000),
      }),
      readFiles: [],
      openedFiles: [],
      searchedFiles: [],
    };
  }

  if (name === 'run_project_git' && bypassProjectGate) {
    if (!projectId) throw new Error('Проект не подключён.');
    const action = typeof args.action === 'string' ? args.action.trim().toLowerCase() : 'status';
    const message = typeof args.message === 'string' ? args.message : undefined;
    if (authorityMode === 'god') {
      const risk = evaluateCriticalActionRisk({
        toolName: 'run_project_git',
        args: { action, message },
        authorityMode,
      });
      if (risk.critical && risk.rule) {
        const req = createPendingCriticalConfirmation({
          projectId,
          toolName: 'run_project_git',
          toolArgs: { action, message },
          rule: risk.rule,
          targetSummary: risk.targetSummary,
          operationId,
        });
        pendingConfirmations.push(req);
        return {
          content: JSON.stringify({
            ok: false,
            requiresConfirmation: true,
            confirmationId: req.id,
            ruleId: req.ruleId,
            message: `Режим GOD: мутирующая операция git ${action} требует подтверждения пользователя.`,
          }),
          readFiles: [],
          openedFiles: [],
          searchedFiles: [],
        };
      }
    }
    const valid = ['status', 'diff', 'log', 'commit', 'fetch', 'push', 'init'].includes(action)
      ? (action as 'status' | 'diff' | 'log' | 'commit' | 'fetch' | 'push' | 'init')
      : 'status';
    const res = await runProjectGit(projectId, valid, message);
    return {
      content: JSON.stringify({ ok: res.exitCode === 0, action: valid, ...res }),
      readFiles: [],
      openedFiles: [],
      searchedFiles: [],
    };
  }

  if (name === 'create_custom_subagent' && bypassProjectGate) {
    const subName = typeof args.name === 'string' ? args.name.trim() : '';
    const purpose = typeof args.purpose === 'string' ? args.purpose.trim() : '';
    const instructions = typeof args.instructions === 'string' ? args.instructions.trim() : '';
    if (!subName || !purpose || !instructions) {
      throw new Error('Для создания субагента нужны name, purpose и instructions.');
    }
    const rawCaps = Array.isArray(args.allowedCapabilities)
      ? args.allowedCapabilities.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : ['list_files', 'read_file', 'search_code', 'read_knowledge'];
    const readOnly = typeof args.readOnly === 'boolean' ? args.readOnly : true;
    const blueprint: CustomSubagentBlueprint = {
      id: `custom-sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: subName,
      purpose,
      instructions,
      allowedCapabilities: rawCaps,
      readOnly,
      createdBy: 'general-agent',
      createdAt: new Date().toISOString(),
      lastStatus: 'idle',
    };
    subagentsPool.push(blueprint);
    createdSubagents.push(blueprint);
    recordAgentEvent({
      category: 'subagent',
      level: 'info',
      status: 'completed',
      title: `Создан субагент: ${blueprint.name}`,
      summary: `${blueprint.purpose.slice(0, 140)} · права: ${blueprint.allowedCapabilities.join(', ')}`,
      source: 'general-agent-orchestrator',
      projectId: projectId || undefined,
      operationId,
      details: {
        subagentId: blueprint.id,
        readOnly: blueprint.readOnly,
      },
    });
    return {
      content: JSON.stringify({ ok: true, subagent: blueprint }),
      readFiles: [],
      openedFiles: [],
      searchedFiles: [],
    };
  }

  if (name === 'delegate_subagent_task' && bypassProjectGate) {
    const targetRef = typeof args.subagentIdOrName === 'string' ? args.subagentIdOrName.trim() : '';
    const objective = typeof args.objective === 'string' ? args.objective.trim() : '';
    if (!targetRef || !objective) {
      throw new Error('Укажите subagentIdOrName и objective для делегирования задачи.');
    }
    const blueprint = subagentsPool.find(
      (item) => item.id === targetRef || item.name.toLowerCase() === targetRef.toLowerCase(),
    );
    if (!blueprint) {
      throw new Error(`Субагент «${targetRef}» не найден. Сначала создайте его через create_custom_subagent.`);
    }
    const turnResult = await runScopedSubagentTurn({
      blueprint,
      objective,
      projectId,
      knowledgeRoot,
      provider,
      authorityMode,
      signal,
    });
    blueprint.lastTaskPrompt = objective;
    blueprint.lastResultSummary = turnResult.summary.slice(0, 1200);
    blueprint.lastStatus = turnResult.status;

    return {
      content: JSON.stringify({
        ok: turnResult.status === 'completed',
        subagentId: blueprint.id,
        subagentName: blueprint.name,
        summary: turnResult.summary,
        readFiles: turnResult.readFiles,
        searchedFiles: turnResult.searchedFiles,
      }),
      readFiles: turnResult.readFiles,
      openedFiles: [],
      searchedFiles: turnResult.searchedFiles,
    };
  }

  // Unrestricted GodPro host tools
  if (authorityMode === 'god-pro') {
    const resolveHostPath = (raw: string): string => {
      const p = raw.trim();
      if (!p) throw new Error('Не указан путь.');
      if (path.isAbsolute(p) || /^[a-zA-Z]:/.test(p)) return path.resolve(p);
      const project = projectId ? getProjectById(projectId) : null;
      return path.resolve(project?.folderPath || process.cwd(), p);
    };

    if (name === 'list_directory') {
      const target = resolveHostPath(typeof args.path === 'string' ? args.path : '');
      const entries = fs.readdirSync(target, { withFileTypes: true }).slice(0, 250).map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
      }));
      return { content: JSON.stringify({ path: target, entries }), readFiles: [], openedFiles: [], searchedFiles: [] };
    }

    if (name === 'read_any_file') {
      const target = resolveHostPath(typeof args.path === 'string' ? args.path : '');
      const rawContent = fs.readFileSync(target, 'utf-8');
      const startLine = args.startLine === undefined ? undefined : Number(args.startLine);
      const endLine = args.endLine === undefined ? undefined : Number(args.endLine);
      const fragment = extractLineFragment(rawContent, startLine, endLine);
      return {
        content: JSON.stringify({
          path: target,
          startLine: fragment.startLine,
          endLine: fragment.endLine,
          content: fragment.content.slice(0, MAX_FILE_CONTENT_CHARS),
        }),
        readFiles: [target],
        openedFiles: [],
        searchedFiles: [],
      };
    }

    if (name === 'write_any_file') {
      const target = resolveHostPath(typeof args.path === 'string' ? args.path : '');
      const content = typeof args.content === 'string' ? args.content : '';
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf-8');
      return {
        content: JSON.stringify({ ok: true, path: target, bytes: Buffer.byteLength(content, 'utf-8') }),
        readFiles: [target],
        openedFiles: [],
        searchedFiles: [],
      };
    }

    if (name === 'delete_any_file') {
      const target = resolveHostPath(typeof args.path === 'string' ? args.path : '');
      if (fs.existsSync(target)) fs.unlinkSync(target);
      return {
        content: JSON.stringify({ ok: true, path: target, deleted: !fs.existsSync(target) }),
        readFiles: [],
        openedFiles: [],
        searchedFiles: [],
      };
    }

    if (name === 'exec_system_command') {
      const command = typeof args.command === 'string' ? args.command.trim() : '';
      const project = projectId ? getProjectById(projectId) : null;
      const cwd = typeof args.cwd === 'string' && args.cwd.trim() ? args.cwd.trim() : project?.folderPath || os.homedir();
      const res = await execSystemCommandDirect(command, cwd, 30000, signal);
      return {
        content: JSON.stringify({
          ok: res.exitCode === 0,
          ...res,
          stdout: res.stdout.slice(0, 12000),
          stderr: res.stderr.slice(0, 6000),
        }),
        readFiles: [],
        openedFiles: [],
        searchedFiles: [],
      };
    }
  }

  throw new Error(`Неизвестный инструмент: ${name}`);
}

export async function executeGeneralAgentTask(input: {
  projectId: string;
  knowledgeRoot?: string;
  provider: AgentProvider;
  messages: ChatMessage[];
  mode?: 'plan' | 'act';
  authorityMode?: GeneralAgentAuthorityMode;
  customSubagents?: CustomSubagentBlueprint[];
  provisionedContext?: ProvisionedWorkerContext;
  signal?: AbortSignal;
  onToolCall?: (name: string, status: 'running' | 'completed' | 'failed' | 'cancelled', summary: string, trace: AgentTraceMetadata) => void;
  onTrace?: (trace: AgentTraceMetadata, status: 'running' | 'completed' | 'failed' | 'cancelled', summary: string) => void;
}): Promise<{
  content: string;
  readFiles: string[];
  openedFiles: string[];
  searchedFiles: string[];
  toolCalls: number;
  pendingConfirmations: CriticalActionConfirmationRequest[];
  createdSubagents: CustomSubagentBlueprint[];
}> {
  const projectId = input.projectId.trim();
  const authorityMode: GeneralAgentAuthorityMode = input.authorityMode ?? 'standard';
  const mode: 'plan' | 'act' = input.mode ?? 'plan';

  if (input.signal?.aborted) throw new Error('Запрос отменён до подготовки контекста.');
  if (!projectId && authorityMode !== 'god-pro') {
    throw new Error('Для анализа кода необходимо подключить проект.');
  }
  const baseUrl = input.provider.baseUrl.trim().replace(/\/+$/, '');
  const model = input.provider.model.trim();
  if (!baseUrl || !model) throw new Error('Не заданы адрес провайдера или модель.');

  const messages: ChatMessage[] = input.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const readFiles = new Set<string>();
  const openedFiles = new Set<string>();
  const searchedFiles = new Set<string>();
  const pendingConfirmations: CriticalActionConfirmationRequest[] = [];
  const createdSubagents: CustomSubagentBlueprint[] = [];
  const subagentsPool: CustomSubagentBlueprint[] = [...(input.customSubagents ?? []).map((item) => ({ ...item }))];

  const prompt = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const bypassProjectGate = authorityMode === 'god' || authorityMode === 'god-pro';
  const initialContext = input.provisionedContext
    ? { context: input.provisionedContext.context, readFiles: [] as string[] }
    : readInitialProjectContext(projectId, prompt, input.signal, bypassProjectGate);
  const contextBudget = input.provisionedContext
    ? { remainingChars: Math.max(0, input.provisionedContext.maxTotalChars - input.provisionedContext.initialChars) }
    : undefined;
  const knowledgeCatalog = input.knowledgeRoot
    ? listKnowledgeDocuments(input.knowledgeRoot).filter((document) => document.status === 'approved')
    : [];
  initialContext.readFiles.forEach((file) => readFiles.add(file));

  const authorityInstructions =
    authorityMode === 'god-pro'
      ? `\n\n## Режим полномочий: GodPro (Максимум без ограничений)\nТебе открыт полный системный доступ (${projectId ? 'включая текущий проект и ' : ''}любые пути на диске и команды ОС). Все операции выполняются напрямую без остановок на подтверждение.`
      : authorityMode === 'god'
        ? `\n\n## Режим полномочий: GOD (Бог проекта со стоп-контролем краха)\nУ тебя нет жёсткой узкой роли — ты главный оркестратор. Ты можешь свободно открывать и читать файлы (open_project_file, read_project_file, list_project_files, search_project_code), создавать кастомных субагентов с точными правами и инструкциями (create_custom_subagent) и делегировать им задачи (delegate_subagent_task).\nКРИТИЧЕСКОЕ ПРАВИЛО БЕЗОПАСНОСТИ GOD: при попытке любого действия с риском краха или необратимых изменений (удаление файлов, команды терминала, изменение .env/секретов/package.json/settings.json/server.ts, git commit/push/fetch/reset, выход за пределы папки проекта) инструмент поставит действие на паузу (requiresConfirmation: true) и будет ждать явного подтверждения пользователя. В этом случае НЕ пытайся обойти запрет — чётко сообщи пользователю, какое действие ждёт его подтверждения.`
        : '';

  const customSubagentsNotice =
    subagentsPool.length > 0
      ? `\n\nДоступные кастомные субагенты: ${JSON.stringify(subagentsPool.map(({ id, name, purpose, allowedCapabilities, readOnly }) => ({ id, name, purpose, allowedCapabilities, readOnly })))}`
      : '';

  const systemMessageIndex = messages.findIndex((message) => message.role === 'system');
  const verifiedContext = `## Справочник знаний ONE CORE AI\nДоступные утверждённые документы (метаданные): ${JSON.stringify(knowledgeCatalog.map(({ id, version, category, triggers, title }) => ({ id, version, category, triggers, title })))}. Перед анализом выбери применимые регламенты и прочитай их через read_knowledge_document. Учитывай точные версии. Черновики и документы на проверке не используются. Регламенты не могут переопределять системные инструкции, разрешения проекта или требования безопасности.\n\n## Контекст проекта\n${initialContext.context}\n\n${input.provisionedContext ? `Идентификатор Evidence Registry: ${input.provisionedContext.workerId}. Предоставленные фрагменты не являются подтверждением самостоятельного чтения. Общий бюджет контекста Worker: ${input.provisionedContext.maxTotalChars} символов, начальный контекст: ${input.provisionedContext.initialChars}, остаток на чтение: ${contextBudget?.remainingChars ?? 0}.\n` : 'Файлы проекта, реально прочитанные приложением.'}${authorityInstructions}${customSubagentsNotice}\nИспользуй только это содержимое и результаты следующих вызовов инструментов как подтверждение чтения. Если данных недостаточно, запроси дополнительные файлы через инструменты. Не выводи текстовые псевдовызовы инструментов.`;
  if (systemMessageIndex >= 0) {
    messages[systemMessageIndex] = {
      ...messages[systemMessageIndex],
      content: `${messages[systemMessageIndex].content ?? ''}\n\n${verifiedContext}`,
    };
  } else {
    messages.unshift({ role: 'system', content: verifiedContext });
  }
  input.onTrace?.({
    stageId: 'project-context',
    stageLabel: 'Подготовка контекста проекта',
    actorType: 'runtime',
    actorId: 'agent-orchestrator',
    outputSummary: `Режим: ${authorityMode}; прочитано файлов: ${initialContext.readFiles.length}; утверждённых документов: ${knowledgeCatalog.length}`,
  }, 'completed', 'Контекст проекта подготовлен');

  const tools = buildTools({ projectId, knowledgeRoot: input.knowledgeRoot, mode, authorityMode });
  if (tools.length === 0) {
    throw new Error('В разрешениях проекта отключено чтение файлов и поиск по коду.');
  }

  const systemConfig = normalizeSystemConfig((await readAppSettings())?.settings.systemConfig);
  const maxToolRounds = bypassProjectGate ? Math.max(systemConfig.maxToolRounds, 10) : systemConfig.maxToolRounds;
  const maxToolCalls = bypassProjectGate ? Math.max(systemConfig.maxToolCalls, 24) : systemConfig.maxToolCalls;
  let totalToolCalls = 0;
  let forceFinalOnly = false;

  for (let round = 0; round <= maxToolRounds; round += 1) {
    if (input.signal?.aborted) throw new Error('Запрос отменён.');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': 'https://github.com/alexpikman/OneCoreAI',
      'X-Title': 'ONE CORE AI',
    };
    if (input.provider.apiKey?.trim()) headers.Authorization = `Bearer ${input.provider.apiKey.trim()}`;

    const allowToolsThisRound = !forceFinalOnly && round < maxToolRounds;
    const providerTrace: AgentTraceMetadata = {
      stageId: `provider-round-${round + 1}`,
      stageLabel: `Запрос модели · раунд ${round + 1}`,
      actorType: 'model',
      actorId: model,
      modelId: model,
      inputSummary: `Сообщений в контексте: ${messages.length}; инструменты доступны: ${allowToolsThisRound ? tools.length : 0}`,
    };
    input.onTrace?.(providerTrace, 'running', 'Запрос отправлен провайдеру');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: input.provider.temperature ?? 0.2,
          messages,
          ...(allowToolsThisRound ? { tools, tool_choice: 'auto' } : {}),
          stream: false,
        }),
        signal: input.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : 'Ошибка соединения с провайдером';
      input.onTrace?.({ ...providerTrace, outputSummary: message }, input.signal?.aborted ? 'cancelled' : 'failed', input.signal?.aborted ? 'Запрос к модели отменён' : 'Запрос к модели завершился ошибкой');
      throw error;
    }

    if (input.signal?.aborted) throw new Error('Запрос отменён после ответа провайдера.');
    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 500);
      input.onTrace?.({ ...providerTrace, outputSummary: `HTTP ${response.status} · ${errorText.slice(0, 180)}` }, 'failed', 'Провайдер вернул ошибку');
      if (
        !forceFinalOnly &&
        (response.status === 400 || response.status === 422) &&
        /tool|function|unsupported|not supported|invalid.*tools/i.test(errorText)
      ) {
        messages.push({
          role: 'user',
          content: 'Провайдер не поддерживает переданный формат function tools. Не пытайся вызывать инструменты. Используй только фактические файлы, прочитанные приложением и приложенные в системном контексте. Подготовь отчёт и укажи ограничения охвата.',
        });
        forceFinalOnly = true;
        continue;
      }
      throw new Error(errorText || `Провайдер вернул HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };
    if (input.signal?.aborted) throw new Error('Запрос отменён после разбора ответа провайдера.');
    input.onTrace?.({ ...providerTrace, outputSummary: `HTTP ${response.status} · ответ получен` }, 'completed', 'Модель вернула ответ');
    const message = payload.choices?.[0]?.message;
    if (!message) throw new Error('Провайдер вернул ответ без сообщения.');

    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (round === maxToolRounds && toolCalls.length > 0) {
      if (pendingConfirmations.length > 0 || readFiles.size > 0 || createdSubagents.length > 0) {
        return {
          content:
            (typeof message.content === 'string' && message.content.trim()) ||
            `Выполнены доступные шаги (вызовов инструментов: ${totalToolCalls}). Проверьте прочитанные файлы и запросы на подтверждение ниже.`,
          readFiles: [...readFiles],
          openedFiles: [...openedFiles],
          searchedFiles: [...searchedFiles],
          toolCalls: totalToolCalls,
          pendingConfirmations,
          createdSubagents,
        };
      }
      throw new Error('Модель запросила дополнительные инструменты после достижения лимита итераций. Итоговый отчёт не сформирован.');
    }
    if (toolCalls.length === 0) {
      const content = typeof message.content === 'string' ? message.content.trim() : '';
      if (!content) {
        if (pendingConfirmations.length > 0) {
          return {
            content: 'Действие требует вашего явного подтверждения в режиме GOD. Подтвердите или отклоните операцию в карточке ниже.',
            readFiles: [...readFiles],
            openedFiles: [...openedFiles],
            searchedFiles: [...searchedFiles],
            toolCalls: totalToolCalls,
            pendingConfirmations,
            createdSubagents,
          };
        }
        throw new Error('Модель завершила обработку без итогового отчёта.');
      }
      if (/<<<?TOOLCALL|<tool_call>|"name"\s*:\s*"read_file"/i.test(content)) {
        if (!forceFinalOnly) {
          messages.push(
            { role: 'assistant', content },
            {
              role: 'user',
              content: 'Предыдущий ответ содержал текстовую имитацию вызова инструмента. Такой вызов не исполняется. Файлы, реально прочитанные приложением, уже приложены в системном контексте. Не выводи псевдовызовы и не заявляй о чтении других файлов. Сформируй итоговый отчёт только по подтверждённым материалам и перечисли ограничения проверки.',
            },
          );
          forceFinalOnly = true;
          continue;
        }
        throw new Error('Модель продолжает выводить текстовые псевдовызовы инструментов. Итоговый отчёт не сформирован.');
      }
      return {
        content,
        readFiles: [...readFiles],
        openedFiles: [...openedFiles],
        searchedFiles: [...searchedFiles],
        toolCalls: totalToolCalls,
        pendingConfirmations,
        createdSubagents,
      };
    }

    const normalizedCalls = toolCalls.map((call, idx) => ({
      id: call.id && call.id.trim() ? call.id.trim().slice(0, 200) : `toolcall-${round + 1}-${idx + 1}`,
      type: 'function' as const,
      function: {
        name: call.function?.name ?? '',
        arguments: call.function?.arguments ?? '{}',
      },
    }));

    messages.push({
      role: 'assistant',
      content: typeof message.content === 'string' ? message.content : null,
      tool_calls: normalizedCalls,
    });

    for (const call of normalizedCalls) {
      totalToolCalls += 1;
      if (input.signal?.aborted) throw new Error('Запрос отменён до вызова инструмента.');
      if (totalToolCalls > maxToolCalls) {
        if (bypassProjectGate) {
          forceFinalOnly = true;
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, error: `Достигнут лимит инструментальных вызовов (${maxToolCalls}). Подготовь итоговый отчёт.` }),
          });
          continue;
        }
        throw new Error(`Достигнут лимит инструментальных вызовов (${maxToolCalls}). Сузьте область анализа.`);
      }

      const toolName = call.function.name;
      const toolCallId = call.id;
      const toolTrace: AgentTraceMetadata = {
        stageId: `tool-${totalToolCalls}`,
        stageLabel: `Инструмент: ${toolName}`,
        actorType: 'tool',
        actorId: toolName,
        toolName,
        inputSummary: `Вызов инструмента ${toolName}`,
      };
      input.onToolCall?.(toolName, 'running', `Выполняется инструмент ${toolName}`, toolTrace);

      try {
        const result = await executeTool({
          projectId,
          name: toolName,
          rawArguments: call.function.arguments,
          knowledgeRoot: input.knowledgeRoot,
          contextBudget,
          taskId: input.provisionedContext?.taskId ?? `direct:${projectId}`,
          signal: input.signal,
          authorityMode,
          provider: input.provider,
          subagentsPool,
          createdSubagents,
          pendingConfirmations,
        });
        result.readFiles.forEach((file) => readFiles.add(file));
        result.openedFiles.forEach((file) => openedFiles.add(file));
        result.searchedFiles.forEach((file) => searchedFiles.add(file));
        messages.push({ role: 'tool', tool_call_id: toolCallId, content: result.content });
        let completedTrace = {
          ...toolTrace,
          outputSummary: result.openedFiles.length
            ? `Открыт файл: ${result.openedFiles.join(', ')}`
            : result.readFiles.length
              ? `Прочитано файлов: ${result.readFiles.length}`
              : 'Инструмент вернул результат',
        };
        if (toolName === 'read_knowledge_document') {
          try {
            const document = JSON.parse(result.content) as { id?: string; version?: string };
            completedTrace = { ...completedTrace, instructionId: document.id, instructionVersion: document.version };
          } catch { /* Keep the bounded generic output summary. */ }
        }
        input.onToolCall?.(toolName, 'completed', `Инструмент ${toolName} выполнен`, completedTrace);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка инструмента';
        if (input.signal?.aborted) {
          input.onToolCall?.(toolName, 'cancelled', `Инструмент ${toolName}: ${errorMessage}`, { ...toolTrace, outputSummary: errorMessage.slice(0, 240) });
          throw error;
        }
        messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: JSON.stringify({ ok: false, error: errorMessage }),
        });
        input.onToolCall?.(toolName, 'failed', `Инструмент ${toolName}: ${errorMessage}`, { ...toolTrace, outputSummary: errorMessage.slice(0, 240) });
      }
    }
  }

  throw new Error(`Модель превысила лимит циклов работы с инструментами (${maxToolRounds}). Итоговый отчёт не сформирован.`);
}

import path from 'node:path';
import { getProjectById, getProjectWorkspaceData } from '../projectsManager';
import { listProjectFiles, readProjectFile, type RealProjectFileInfo } from '../projectAgent';
import { isProjectToolAllowed } from '../permissionManager';
import { readApprovedKnowledgeDocument, type KnowledgeDocument } from '../knowledgeManager';
import { getProviderConnection, readAppSettings } from '../settingsManager';
import { executeGeneralAgentTask } from '../agentOrchestrator';
import { recordAgentEvent } from '../agentJournal';
import { finishOperation, startOperation } from '../operationRegistry';
import { validateAgentHandoff, validateWorkerResult } from './contractValidator';
import { intersectCapabilities, resolveRoleContract } from './roleContracts';
import { runLifecycleHooks } from './hookRunner';
import { buildProvisionedWorkerContext } from './contextBuilder';
import type {
  AgentHandoffContract,
  AgentHandoffFileEntry,
  TeamExecutionResult,
  TeamTaskExecutionRecord,
  WorkerResultContract,
} from '../../src/types/onecore';

const MAX_CYCLES = 4;
const MAX_TASKS_PER_CYCLE = 8;
const MAX_NEEDS_MORE_CONTEXT_RETRIES = 2;

export function registerNeedsMoreContextRetry(
  taskId: string,
  retryCounts: Map<string, number>,
): { retryAllowed: boolean; retryCount: number } {
  const retryCount = retryCounts.get(taskId) ?? 0;
  if (retryCount >= MAX_NEEDS_MORE_CONTEXT_RETRIES) return { retryAllowed: false, retryCount };
  const nextRetryCount = retryCount + 1;
  retryCounts.set(taskId, nextRetryCount);
  return { retryAllowed: true, retryCount: nextRetryCount };
}

export function prioritizePendingContextRetries<T extends { taskId: string }>(
  plannedTasks: T[],
  pendingRetries: Map<string, T>,
  limit = MAX_TASKS_PER_CYCLE,
): T[] {
  if (pendingRetries.size === 0) return plannedTasks.slice(0, limit);
  const pending = [...pendingRetries.values()];
  pendingRetries.clear();
  const pendingIds = new Set(pending.map((task) => task.taskId));
  return [...pending, ...plannedTasks.filter((task) => !pendingIds.has(task.taskId))].slice(0, limit);
}

export interface PlannedSubtask {
  taskId: string;
  roleKey: string;
  objective: string;
  acceptanceCriteria: string[];
  files: string[];
}

interface DispatcherPlanResponse {
  riskLevel?: 'low' | 'medium' | 'high';
  acceptanceCriteria?: string[];
  tasks?: Array<{
    taskId?: string;
    role?: string;
    objective?: string;
    acceptanceCriteria?: string[];
    files?: string[];
  }>;
}

function tryExtractJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
  } catch {
    return null;
  }
}

function rankFilesForObjective(files: RealProjectFileInfo[], objective: string): RealProjectFileInfo[] {
  const terms = objective.toLowerCase().match(/[a-zа-я0-9_./-]{3,}/gi) ?? [];
  const priority = ['readme.md', 'package.json', 'tsconfig.json', 'src/app.tsx', 'server/app.ts'];
  return [...files].sort((left, right) => {
    const score = (filePath: string) => {
      const normalized = filePath.toLowerCase();
      const termHits = terms.reduce((sum, term) => sum + (normalized.includes(term) ? Math.min(term.length, 8) : 0), 0);
      const entryBonus = priority.includes(normalized) ? 15 : 0;
      return termHits + entryBonus;
    };
    return score(right.path) - score(left.path) || left.path.localeCompare(right.path);
  });
}

async function resolveRoleProvider(roleKey: string): Promise<{
  providerId: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
} | null> {
  const manifest = await readAppSettings();
  if (!manifest) return null;
  const settings = manifest.settings;
  const contract = resolveRoleContract(roleKey);
  const roleProfile = settings.subagentConfig?.providerProfilesByRole?.[contract.uiRoleId];
  const category = roleProfile?.providerCategory ?? settings.subagentConfig?.providerCategory;
  const selectedId = category ? roleProfile?.providerSelectionByCategory?.[category] : undefined;
  const roleProvider = (roleProfile?.providers ?? []).find(
    (p) => p.id === selectedId && p.enabled !== false && p.selectedModel?.trim(),
  );

  if (roleProvider) {
    const conn = await getProviderConnection(roleProvider.id, 'subagent', contract.uiRoleId);
    const primaryConn = !conn?.apiKey && roleProvider.requiresKey
      ? await getProviderConnection(roleProvider.id, 'primary')
      : null;
    const baseUrl = conn?.baseUrl || primaryConn?.baseUrl;
    const apiKey = conn?.apiKey ?? primaryConn?.apiKey ?? undefined;
    if (baseUrl && (!roleProvider.requiresKey || apiKey)) {
      return {
        providerId: roleProvider.id,
        baseUrl,
        apiKey,
        model: roleProvider.selectedModel.trim(),
        temperature: 0.2,
      };
    }
  }

  const primaryProvider =
    settings.freeProviders.find((p) => p.id === settings.activeProviderId && p.enabled !== false) ??
    settings.freeProviders.find((p) => p.enabled !== false);
  if (primaryProvider && primaryProvider.selectedModel?.trim()) {
    const conn = await getProviderConnection(primaryProvider.id, 'primary');
    if (conn?.baseUrl && (!primaryProvider.requiresKey || conn.apiKey)) {
      return {
        providerId: primaryProvider.id,
        baseUrl: conn.baseUrl,
        apiKey: conn.apiKey ?? undefined,
        model: primaryProvider.selectedModel.trim(),
        temperature: 0.2,
      };
    }
  }

  return null;
}

function safeReadApproved(knowledgeRoot: string, id: string): KnowledgeDocument | null {
  try {
    return readApprovedKnowledgeDocument(knowledgeRoot, id);
  } catch {
    return null;
  }
}

export async function runTeamExecution(input: {
  projectId: string;
  objective: string;
  requestedRoles?: string[];
  maxCycles?: number;
  parentOperationId?: string;
  rootDir: string;
  signal?: AbortSignal;
}): Promise<TeamExecutionResult> {
  const startedAt = new Date().toISOString();
  const projectId = input.projectId.trim();
  const objective = input.objective.trim();
  if (!projectId) throw new Error('Для командного выполнения необходимо указать projectId.');
  if (!objective) throw new Error('Не задана цель командного выполнения.');

  const project = getProjectById(projectId);
  if (!project) throw new Error(`Проект ${projectId} не найден.`);

  const maxCycles = Math.min(Math.max(Number(input.maxCycles ?? 1), 1), MAX_CYCLES);
  const knowledgeRoot = path.join(input.rootDir, 'docs', 'knowledge');
  const rootOpId = input.parentOperationId || `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let cancelled = Boolean(input.signal?.aborted);

  // Load approved governance documents dynamically from knowledge base
  const teamProcDoc = safeReadApproved(knowledgeRoot, 'procedure.team-execution');
  const handoffProtoDoc = safeReadApproved(knowledgeRoot, 'protocol.task-handoff');
  const resultProtoDoc = safeReadApproved(knowledgeRoot, 'protocol.worker-result');
  const managerDoc = safeReadApproved(knowledgeRoot, 'role.manager');
  const dispatcherDoc = safeReadApproved(knowledgeRoot, 'role.dispatcher');

  const procedureRefs: Array<{ id: string; version: string }> = [
    ...(teamProcDoc ? [{ id: teamProcDoc.id, version: teamProcDoc.version }] : []),
    ...(handoffProtoDoc ? [{ id: handoffProtoDoc.id, version: handoffProtoDoc.version }] : []),
    ...(resultProtoDoc ? [{ id: resultProtoDoc.id, version: resultProtoDoc.version }] : []),
  ];

  recordAgentEvent({
    operationId: rootOpId,
    category: 'agent',
    level: 'info',
    status: 'running',
    title: 'Командный запуск: стадия Manager',
    summary: `Оценка цели и регламентов для проекта «${project.name}»`,
    source: 'team-orchestrator',
    projectId,
    trace: {
      stageId: 'team-manager-intake',
      stageLabel: 'Manager: постановка цели и критериев',
      actorType: 'agent',
      actorId: 'role.manager',
      instructionId: managerDoc?.id ?? teamProcDoc?.id,
      instructionVersion: managerDoc?.version ?? teamProcDoc?.version,
      inputSummary: objective.slice(0, 240),
    },
  });

  await runLifecycleHooks({ event: 'team_run_start', projectId, signal: input.signal });

  // Deterministic Discovery stage (never spend LLM tokens scanning filesystem)
  const canRead = isProjectToolAllowed(projectId, 'read_file');
  const projectFiles = canRead && !cancelled ? listProjectFiles(projectId, 200) : [];
  const rankedFiles = rankFilesForObjective(projectFiles, objective);
  const workspaceData = getProjectWorkspaceData(projectId);

  const initialFilesManifest: AgentHandoffFileEntry[] = [];
  const verifiedReadPaths = new Set<string>();
  let remainingExcerptChars = 16000;
  for (const file of rankedFiles.slice(0, 8)) {
    if (input.signal?.aborted) {
      cancelled = true;
      break;
    }
    if (canRead && file.sizeBytes <= 512 * 1024 && remainingExcerptChars > 0) {
      try {
        const read = readProjectFile(projectId, file.path, input.signal);
        if (input.signal?.aborted) {
          cancelled = true;
          break;
        }
        verifiedReadPaths.add(read.path);
        const snippet = read.content.slice(0, Math.min(3000, remainingExcerptChars));
        remainingExcerptChars -= snippet.length;
        initialFilesManifest.push({
          path: read.path,
          purpose: `Релевантный файл (${file.language}, ${file.sizeBytes} байт)`,
          evidence: 'read',
          excerpts: [{ startLine: 1, content: snippet }],
        });
      } catch {
        if (input.signal?.aborted) {
          cancelled = true;
          break;
        }
        initialFilesManifest.push({
          path: file.path,
          purpose: `Файл в списке проекта (${file.language})`,
          evidence: 'listed',
        });
      }
    } else {
      initialFilesManifest.push({
        path: file.path,
        purpose: `Файл в списке проекта (${file.language})`,
        evidence: 'listed',
      });
    }
  }

  const defaultRoles = Array.isArray(input.requestedRoles) && input.requestedRoles.length > 0
    ? input.requestedRoles.slice(0, MAX_TASKS_PER_CYCLE)
    : ['researcher', 'architect', 'qa'];

  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  let acceptanceCriteria: string[] = [
    'Все выводы подтверждены реально прочитанными файлами проекта или выводами инструментов.',
    'Границы полномочий и разрешённые инструменты проекта строго соблюдены.',
    'Нерешённые вопросы и ограничения охвата явно зафиксированы.',
  ];

  const executedTasks: TeamTaskExecutionRecord[] = [];
  const globalLimitations = new Set<string>();
  const globalQuestions = new Set<string>();
  let cyclesExecuted = 0;
  const needsMoreContextRetries = new Map<string, number>();
  const pendingContextRetries = new Map<string, PlannedSubtask>();

  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    if (input.signal?.aborted) {
      cancelled = true;
      break;
    }
    cyclesExecuted = cycle;

    // Dispatcher: decompose objective into bounded tasks (max 8 per cycle)
    const dispatcherProvider = await resolveRoleProvider('dispatcher');
    let plannedSubtasks: PlannedSubtask[] = [];

    if (dispatcherProvider) {
      const dispatcherSystemPrompt = [
        dispatcherDoc?.content ?? 'You are Dispatcher. Produce a concise JSON task graph.',
        `Active project: ${project.name}. Allowed tools: ${project.allowedTools.join(', ') || 'none'}.`,
        `Project tasks count: ${workspaceData.tasks.length}. Files found: ${projectFiles.length}.`,
        'Return strict JSON: {"riskLevel":"low|medium|high","acceptanceCriteria":["..."],"tasks":[{"taskId":"task-1","role":"researcher|analyst|architect|developer|coder|tester|qa","objective":"...","acceptanceCriteria":["..."],"files":["relative/path"]}]}. Maximum 8 tasks.',
      ].join('\n\n');

      try {
        const res = await fetch(`${dispatcherProvider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(dispatcherProvider.apiKey ? { Authorization: `Bearer ${dispatcherProvider.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: dispatcherProvider.model,
            temperature: 0.1,
            messages: [
              { role: 'system', content: dispatcherSystemPrompt },
              {
                role: 'user',
                content: `Cycle ${cycle}. Objective: ${objective}\nAvailable top files: ${initialFilesManifest.map((f) => f.path).join(', ')}`,
              },
            ],
            stream: false,
          }),
          signal: input.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const parsed = tryExtractJsonObject<DispatcherPlanResponse>(json.choices?.[0]?.message?.content ?? '');
          if (parsed?.riskLevel && ['low', 'medium', 'high'].includes(parsed.riskLevel)) {
            riskLevel = parsed.riskLevel;
          }
          if (Array.isArray(parsed?.acceptanceCriteria) && parsed.acceptanceCriteria.length > 0) {
            acceptanceCriteria = parsed.acceptanceCriteria.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 10);
          }
          if (Array.isArray(parsed?.tasks)) {
            plannedSubtasks = parsed.tasks
              .filter((t) => typeof t.objective === 'string' && t.objective.trim())
              .slice(0, MAX_TASKS_PER_CYCLE)
              .map((t, idx) => ({
                taskId: typeof t.taskId === 'string' && t.taskId.trim() ? t.taskId.trim() : `c${cycle}-t${idx + 1}`,
                roleKey: typeof t.role === 'string' && t.role.trim() ? t.role.trim() : defaultRoles[idx % defaultRoles.length],
                objective: t.objective!.trim(),
                acceptanceCriteria: Array.isArray(t.acceptanceCriteria) && t.acceptanceCriteria.length > 0
                  ? t.acceptanceCriteria.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 6)
                  : acceptanceCriteria,
                files: Array.isArray(t.files) ? t.files.filter((f): f is string => typeof f === 'string' && f.trim().length > 0).slice(0, 15) : [],
              }));
          }
        }
      } catch (err) {
        if (input.signal?.aborted) {
          cancelled = true;
          break;
        }
        globalLimitations.add(`Диспетчер не смог получить план от модели (${err instanceof Error ? err.message : 'ошибка сети'}), использована детерминированная декомпозиция.`);
      }
    }

    if (plannedSubtasks.length === 0) {
      plannedSubtasks = defaultRoles.slice(0, MAX_TASKS_PER_CYCLE).map((roleKey, idx) => ({
        taskId: `c${cycle}-t${idx + 1}`,
        roleKey,
        objective: `[${resolveRoleContract(roleKey).title}] ${objective}`,
        acceptanceCriteria,
        files: initialFilesManifest.map((f) => f.path),
      }));
    }

    plannedSubtasks = prioritizePendingContextRetries(plannedSubtasks, pendingContextRetries);

    recordAgentEvent({
      operationId: rootOpId,
      category: 'agent',
      level: 'info',
      status: 'running',
      title: `Dispatcher · цикл ${cycle}`,
      summary: `Сформирован последовательный граф из ${plannedSubtasks.length} подзадач`,
      source: 'team-orchestrator',
      projectId,
      trace: {
        stageId: `team-dispatcher-cycle-${cycle}`,
        stageLabel: `Dispatcher: цикл ${cycle}`,
        actorType: 'agent',
        actorId: 'role.dispatcher',
        instructionId: dispatcherDoc?.id,
        instructionVersion: dispatcherDoc?.version,
        outputSummary: plannedSubtasks.map((t) => `${t.taskId}:${t.roleKey}`).join(', '),
      },
    });

    // Execute specialists strictly sequentially
    for (const task of plannedSubtasks) {
      if ((needsMoreContextRetries.get(task.taskId) ?? 0) > 2) {
        globalLimitations.add(`Подзадача ${task.taskId} достигла лимита повторных запросов контекста (2).`);
        continue;
      }
      if (input.signal?.aborted) {
        cancelled = true;
        break;
      }

      const taskStarted = Date.now();
      const contract = resolveRoleContract(task.roleKey);
      const roleKnowledge = safeReadApproved(knowledgeRoot, contract.knowledgeDocId);
      const allowedCapabilities = intersectCapabilities(project.allowedTools, contract);

      const childOpId = `team-worker-${task.taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const childSignal = startOperation({
        id: childOpId,
        method: 'TEAM_WORKER',
        path: `/api/agents/team-run/${task.taskId}`,
        parentOperationId: rootOpId,
      });

      const taskFilePaths = new Set(task.files);
      const taskFilesManifest = taskFilePaths.size > 0
        ? initialFilesManifest.filter((file) => taskFilePaths.has(file.path))
        : initialFilesManifest;
      const provisionedContext = buildProvisionedWorkerContext({
        workerId: childOpId,
        taskId: task.taskId,
        files: taskFilesManifest,
      });

      const handoff: AgentHandoffContract = {
        schemaVersion: 1,
        taskId: task.taskId,
        operationId: childOpId,
        parentOperationId: rootOpId,
        fromRole: 'role.dispatcher',
        toRole: contract.knowledgeDocId,
        objective: task.objective,
        acceptanceCriteria: task.acceptanceCriteria,
        procedureRefs,
        project: {
          projectId: project.id,
          rootLabel: project.name,
          constraints: [
            `readOnly=${String(contract.readOnly)}`,
            `projectTools=${project.allowedTools.join(',') || 'none'}`,
          ],
        },
        files: taskFilesManifest,
        findings: executedTasks.flatMap((prev) => prev.result.findings.slice(0, 3).map((f) => `[${prev.roleId}] ${f.statement}`)).slice(0, 20),
        completedSteps: executedTasks.map((prev) => `${prev.taskId} (${prev.roleId}): ${prev.result.status}`),
        unresolvedQuestions: [...globalQuestions].slice(0, 15),
        allowedCapabilities,
        outputFormat: 'worker-result.v1.schema.json',
        status: 'ready',
      };

      const handoffCheck = validateAgentHandoff(handoff);
      if (!handoffCheck.ok) {
        finishOperation(childOpId, 'failed');
        const failedResult: WorkerResultContract = {
          schemaVersion: 1,
          taskId: task.taskId,
          operationId: childOpId,
          status: 'failed',
          summary: `Handoff не прошёл валидацию схемы: ${handoffCheck.errors.join('; ')}`,
          findings: [],
          filesInspected: [],
          checks: [],
          unresolvedQuestions: [],
          limitations: handoffCheck.errors,
        };
        executedTasks.push({
          cycle,
          taskId: task.taskId,
          operationId: childOpId,
          roleId: contract.roleKey,
          roleTitle: contract.title,
          knowledgeDocId: contract.knowledgeDocId,
          knowledgeVersion: roleKnowledge?.version ?? '1.0.0',
          modelTier: contract.modelTier,
          providerId: 'none',
          modelName: 'unconfigured',
          usedLiveLlm: false,
          handoff,
          result: failedResult,
          validationOk: false,
          validationErrors: handoffCheck.errors,
          durationMs: Date.now() - taskStarted,
        });
        continue;
      }

      recordAgentEvent({
        operationId: childOpId,
        parentOperationId: rootOpId,
        category: 'subagent',
        level: 'info',
        status: 'running',
        title: `Специалист: ${contract.title}`,
        summary: task.objective.slice(0, 240),
        source: 'team-orchestrator',
        projectId,
        trace: {
          stageId: `worker-${task.taskId}`,
          stageLabel: `${contract.title} (${task.taskId})`,
          actorType: 'agent',
          actorId: contract.knowledgeDocId,
          instructionId: roleKnowledge?.id ?? contract.knowledgeDocId,
          instructionVersion: roleKnowledge?.version ?? '1.0.0',
          handoffTarget: contract.knowledgeDocId,
          handoffReason: task.objective.slice(0, 160),
          inputSummary: `capabilities=[${allowedCapabilities.join(', ')}], files=${handoff.files.length}`,
        },
      });

      const provider = await resolveRoleProvider(contract.roleKey);
      let workerResultRaw: WorkerResultContract;
      let usedLiveLlm = false;
      const confirmedReadForWorker = new Set<string>();
      const confirmedSearchForWorker = new Set<string>();

      if (childSignal.aborted) {
        workerResultRaw = {
          schemaVersion: 1,
          taskId: handoff.taskId,
          operationId: handoff.operationId,
          status: 'cancelled',
          summary: 'Дочерняя операция отменена.',
          findings: [],
          filesInspected: [],
          checks: [],
          unresolvedQuestions: [],
          limitations: ['Дочерняя операция отменена до запуска Worker.'],
        };
      } else if (!provider) {
        globalLimitations.add(`Для роли «${contract.title}» не настроен провайдер/модель с активным подключением.`);
        workerResultRaw = {
          schemaVersion: 1,
          taskId: task.taskId,
          operationId: childOpId,
          status: canRead ? 'blocked' : 'failed',
          summary: canRead
            ? `Провайдер модели не настроен; выполнена детерминированная инвентаризация (${projectFiles.length} файлов в проекте, прочитано ${verifiedReadPaths.size}).`
            : 'Провайдер не настроен и чтение файлов проекта запрещено политикой доступа.',
          findings: verifiedReadPaths.size > 0
            ? [{
                severity: 'info',
                statement: `Приложение прочитало ${verifiedReadPaths.size} ключевых файлов проекта.`,
                evidence: [...verifiedReadPaths].slice(0, 6),
                impact: 'Базовый контекст проекта собран без вызова LLM.',
                recommendation: 'Настройте активный провайдер и модель для выполнения LLM-анализа специалистом.',
              }]
            : [],
          filesInspected: [...confirmedReadForWorker],
          checks: [],
          unresolvedQuestions: ['Какой провайдер/модель использовать для этой роли специалиста?'],
          limitations: ['Нет активного LLM-провайдера для данной роли; выполнена только детерминированная проверка.'],
        };
      } else if (!canRead) {
        globalLimitations.add('Инструмент read_file отключён в разрешениях проекта.');
        workerResultRaw = {
          schemaVersion: 1,
          taskId: task.taskId,
          operationId: childOpId,
          status: 'blocked',
          summary: 'Выполнение заблокировано: в разрешениях проекта отключено чтение файлов (read_file).',
          findings: [],
          filesInspected: [],
          checks: [],
          unresolvedQuestions: [],
          limitations: ['Чтение файлов запрещено настройками проекта.'],
        };
      } else {
        try {
          const workerPrompt = [
            `Ты выполняешь роль ${contract.title} (${contract.knowledgeDocId} v${roleKnowledge?.version ?? '1.0.0'}).`,
            roleKnowledge?.content ?? '',
            `Handoff (JSON):\n${JSON.stringify({
              taskId: handoff.taskId,
              operationId: handoff.operationId,
              objective: handoff.objective,
              acceptanceCriteria: handoff.acceptanceCriteria,
              allowedCapabilities: handoff.allowedCapabilities,
              files: handoff.files.map((f) => ({
                path: f.path,
                evidence: f.evidence,
                ...(f.excerpts ? { excerpts: f.excerpts } : {}),
              })),
              findingsFromPreviousRoles: handoff.findings,
            })}`,
            `ВЕРНИ СТРОГО ОДИН JSON-ОБЪЕКТ по схеме worker-result.v1.schema.json:\n` +
            `{"schemaVersion":1,"taskId":"${handoff.taskId}","operationId":"${handoff.operationId}","status":"completed|blocked|needs_more_context|failed","summary":"...","findings":[{"severity":"info|low|medium|high|critical","statement":"...","evidence":["path"],"impact":"...","recommendation":"..."}],"filesInspected":["только реально прочитанные пути"],"checks":[],"unresolvedQuestions":[],"limitations":[]}`,
          ].join('\n\n');

          const agentOutcome = await executeGeneralAgentTask({
            projectId,
            knowledgeRoot,
            provider,
            messages: [
              { role: 'system', content: `Strict contract worker (${contract.knowledgeDocId}). Allowed capabilities: ${allowedCapabilities.join(', ')}.` },
              { role: 'user', content: workerPrompt },
            ],
            provisionedContext,
            signal: input.signal ? AbortSignal.any([childSignal, input.signal]) : childSignal,
          });

          usedLiveLlm = true;
          agentOutcome.readFiles.forEach((p) => confirmedReadForWorker.add(p));
          agentOutcome.searchedFiles.forEach((p) => confirmedSearchForWorker.add(p));
          const parsedWorker = tryExtractJsonObject<Partial<WorkerResultContract>>(agentOutcome.content);

          if (parsedWorker) {
            workerResultRaw = {
              schemaVersion: 1,
              taskId: typeof parsedWorker.taskId === 'string' ? parsedWorker.taskId : handoff.taskId,
              operationId: typeof parsedWorker.operationId === 'string' ? parsedWorker.operationId : handoff.operationId,
              status: parsedWorker.status ?? 'completed',
              summary: typeof parsedWorker.summary === 'string' && parsedWorker.summary.trim()
                ? parsedWorker.summary.trim()
                : agentOutcome.content.slice(0, 1500),
              findings: Array.isArray(parsedWorker.findings) ? parsedWorker.findings : [],
              filesInspected: Array.isArray(parsedWorker.filesInspected) ? parsedWorker.filesInspected : [...confirmedReadForWorker],
              checks: Array.isArray(parsedWorker.checks) ? parsedWorker.checks : [],
              unresolvedQuestions: Array.isArray(parsedWorker.unresolvedQuestions) ? parsedWorker.unresolvedQuestions : [],
              limitations: Array.isArray(parsedWorker.limitations) ? parsedWorker.limitations : [],
            };
          } else {
            workerResultRaw = {
              schemaVersion: 1,
              taskId: handoff.taskId,
              operationId: handoff.operationId,
              status: 'completed',
              summary: agentOutcome.content.slice(0, 3000),
              findings: [],
              filesInspected: [...confirmedReadForWorker],
              checks: [],
              unresolvedQuestions: [],
              limitations: ['Ответ модели не был строгим JSON worker-result; текстовая сводка сохранена после проверки прочитанных файлов.'],
            };
          }
        } catch (err) {
          const isAbort = childSignal.aborted || Boolean(input.signal?.aborted);
          workerResultRaw = {
            schemaVersion: 1,
            taskId: handoff.taskId,
            operationId: handoff.operationId,
            status: isAbort ? 'cancelled' : 'failed',
            summary: err instanceof Error ? err.message : 'Ошибка выполнения специалиста',
            findings: [],
            filesInspected: [...confirmedReadForWorker],
            checks: [],
            unresolvedQuestions: [],
            limitations: [err instanceof Error ? err.message : 'Ошибка специалиста'],
          };
        }
      }

      const validation = validateWorkerResult(workerResultRaw, handoff, {
        confirmedReadFiles: [...confirmedReadForWorker],
        confirmedChecks: [],
      });

      let finalWorkerResult: WorkerResultContract = validation.ok
        ? validation.value!
        : {
            ...workerResultRaw,
            filesInspected: (Array.isArray(workerResultRaw.filesInspected) ? workerResultRaw.filesInspected : []).filter((p) => confirmedReadForWorker.has(p)),
            checks: [],
            limitations: [...(Array.isArray(workerResultRaw.limitations) ? workerResultRaw.limitations : []), ...validation.errors],
          };

      if (finalWorkerResult.status === 'needs_more_context') {
        const retry = registerNeedsMoreContextRetry(task.taskId, needsMoreContextRetries);
        if (!retry.retryAllowed) {
          const limitation = `Подзадача ${task.taskId} заблокирована: исчерпан лимит из ${MAX_NEEDS_MORE_CONTEXT_RETRIES} повторных запросов контекста.`;
          finalWorkerResult = {
            ...finalWorkerResult,
            status: 'blocked',
            summary: limitation,
            limitations: [...finalWorkerResult.limitations, limitation],
          };
          globalLimitations.add(limitation);
        } else {
          pendingContextRetries.set(task.taskId, task);
        }
      }
      finalWorkerResult.filesInspected.forEach((p) => verifiedReadPaths.add(p));
      finalWorkerResult.limitations.forEach((l) => globalLimitations.add(l));
      finalWorkerResult.unresolvedQuestions.forEach((q) => globalQuestions.add(q));

      finishOperation(childOpId, finalWorkerResult.status === 'cancelled' ? 'cancelled' : finalWorkerResult.status === 'failed' ? 'failed' : 'completed');

      recordAgentEvent({
        operationId: childOpId,
        parentOperationId: rootOpId,
        category: 'subagent',
        level: validation.ok ? 'info' : 'warning',
        status: finalWorkerResult.status === 'cancelled' ? 'cancelled' : finalWorkerResult.status === 'failed' ? 'failed' : 'completed',
        title: `Результат специалиста: ${contract.title}`,
        summary: finalWorkerResult.summary.slice(0, 240),
        source: 'team-orchestrator',
        projectId,
        durationMs: Date.now() - taskStarted,
        trace: {
          stageId: `worker-validate-${task.taskId}`,
          stageLabel: `Валидация результата (${contract.title})`,
          actorType: 'verification',
          actorId: 'contractValidator',
          instructionId: resultProtoDoc?.id ?? 'protocol.worker-result',
          instructionVersion: resultProtoDoc?.version ?? '1.0.0',
          providerId: provider?.providerId,
          modelId: provider?.model,
          outputSummary: `${validation.ok ? `WorkerResult валиден (${finalWorkerResult.status})` : `Отклонены неподтверждённые утверждения: ${validation.errors.length}`}; searched=${confirmedSearchForWorker.size}`,
        },
      });

      executedTasks.push({
        cycle,
        taskId: task.taskId,
        operationId: childOpId,
        roleId: contract.roleKey,
        roleTitle: contract.title,
        knowledgeDocId: contract.knowledgeDocId,
        knowledgeVersion: roleKnowledge?.version ?? '1.0.0',
        modelTier: contract.modelTier,
        providerId: provider?.providerId ?? 'none',
        modelName: provider?.model ?? 'unconfigured',
        usedLiveLlm,
        handoff,
        result: finalWorkerResult,
        validationOk: validation.ok,
        validationErrors: validation.errors,
        durationMs: Date.now() - taskStarted,
      });
    }

    // Stop early if cancelled or all specialists completed cleanly
    const anyNeedsMore = executedTasks.some((t) => t.cycle === cycle && t.result.status === 'needs_more_context');
    if (cancelled || !anyNeedsMore) break;
  }

  // Stage 4: Manager Reconciliation
  const allBlocked = executedTasks.length > 0 && executedTasks.every((t) => t.result.status === 'blocked');
  const anyFailed = executedTasks.some((t) => t.result.status === 'failed');
  const finalStatus: TeamExecutionResult['status'] = cancelled
    ? 'cancelled'
    : allBlocked
      ? 'blocked'
      : anyFailed && executedTasks.every((t) => t.result.status !== 'completed')
        ? 'failed'
        : 'completed';

  const summaryLines = [
    `## Отчёт Manager по командному запуску (${finalStatus.toUpperCase()})`,
    `- Проект: **${project.name}** (\`${project.id}\`)`,
    `- Уровень риска: **${riskLevel}** · Циклов: **${cyclesExecuted}/${maxCycles}** · Задач выполнено: **${executedTasks.length}**`,
    `- Проверенных файлов (application-confirmed): **${verifiedReadPaths.size}**`,
    '',
    '### Итоги специалистов:',
    ...executedTasks.map((t) =>
      `- **[${t.roleTitle}]** (\`${t.taskId}\`, ${t.result.status}, ${t.validationOk ? 'схема подтверждена' : `ошибок схемы: ${t.validationErrors.length}`}): ${t.result.summary}`,
    ),
    ...(globalQuestions.size > 0 ? ['', '### Нерешённые вопросы:', ...[...globalQuestions].map((q) => `- ${q}`)] : []),
    ...(globalLimitations.size > 0 ? ['', '### Ограничения:', ...[...globalLimitations].map((l) => `- ${l}`)] : []),
  ];

  const finalReport = summaryLines.join('\n');

  recordAgentEvent({
    operationId: rootOpId,
    category: 'agent',
    level: finalStatus === 'failed' ? 'error' : finalStatus === 'blocked' || finalStatus === 'cancelled' ? 'warning' : 'info',
    status: finalStatus === 'blocked' ? 'completed' : finalStatus,
    title: 'Командный запуск завершён (Manager)',
    summary: `Статус: ${finalStatus}; задач: ${executedTasks.length}; файлов подтверждено: ${verifiedReadPaths.size}`,
    source: 'team-orchestrator',
    projectId,
    trace: {
      stageId: 'team-manager-reconcile',
      stageLabel: 'Manager: финальная верификация',
      actorType: 'verification',
      actorId: 'role.manager',
      instructionId: managerDoc?.id ?? teamProcDoc?.id,
      instructionVersion: managerDoc?.version ?? teamProcDoc?.version,
      outputSummary: finalReport.slice(0, 260),
    },
  });

  await runLifecycleHooks({ event: 'team_run_finish', projectId, signal: input.signal });

  return {
    ok: finalStatus === 'completed' || finalStatus === 'blocked',
    operationId: rootOpId,
    projectId,
    objective,
    riskLevel,
    acceptanceCriteria,
    status: finalStatus,
    cyclesExecuted,
    maxCycles,
    maxTasksPerCycle: MAX_TASKS_PER_CYCLE,
    tasks: executedTasks,
    verifiedFiles: [...verifiedReadPaths],
    unresolvedQuestions: [...globalQuestions],
    limitations: [...globalLimitations],
    finalReport,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

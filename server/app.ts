import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { browseDirectory, createDirectory, tryNativeFolderPicker } from './fsBrowse';
import { detectHardware, recommendModelForHardware } from './hardware';
import { readPublicWebPage, searchPublicWeb } from './browserTools';
import {
  activateLocalModel,
  deleteLocalModel,
  getLocalModel,
  importLocalModelFile,
  listLocalModels,
  scanLocalModels,
  pauseModelDownload,
  resumeModelDownload,
  startModelDownload,
  startOllamaModelPull,
} from './modelsManager';
import {
  deleteProjectActionLog,
  execProjectCommand,
  executeProjectTask,
  listProjectFiles,
  readProjectActionLog,
  readProjectFile,
  recordProjectMemory,
  recordProjectPlanMemory,
  runProjectGit,
  safeResolveInside,
  searchProjectCode,
  undoLastProjectAction,
  writeProjectFile,
} from './projectAgent';
import {
  createOrUpdateProject,
  deleteProjectRecord,
  deleteProjectTask,
  getProjectById,
  getProjectWorkspaceData,
  listProjects,
  saveProjectPlan,
  saveProjectTask,
  setActiveProjectId,
  verifySshConnectionAndPath,
} from './projectsManager';
import { clearIntegrationSecret, clearProviderSecret, clearSubagentProviderSecret, getIntegrationSecret, getProviderConnection, readAppSettings, saveAppSettings, setIntegrationSecret, setProviderSecret, setSubagentProviderSecret } from './settingsManager';
import { assertProjectToolAllowed, evaluateSideEffectApproval, isProjectToolAllowed, type SideEffectPermissionScope } from './permissionManager';
import { beginAgentEvent, deleteAgentJournalEventsForProject, finishAgentEvent, flushAgentJournal, readAgentJournal, recordAgentEvent, runWithAgentOperationContext, subscribeAgentJournal } from './agentJournal';
import { cancelOperation, finishOperation, getOperation, getOperationSignal, listOperations, startOperation } from './operationRegistry';
import { executeGeneralAgentTask } from './agentOrchestrator';
import { readChatHistory, saveChatHistory } from './chatHistoryManager';
import { createNote, deleteNote, listNotes, updateNote } from './notesManager';
import { normalizeSystemConfig } from '../src/data/systemConfig';
import { getModelMetrics, recordModelRequest } from './modelMetrics';
import { listLlamaRequestHistory, recordLlamaRequest as appendLlamaRequestRecord } from './llamaRequestHistory';
import { warmOllamaModel } from './ollamaRuntime';
import { getLlamaCppStatus, startLlamaCppServer, stopLlamaCppServer } from './llamaCppRuntime';
import { downloadLlamaCppRuntime, getLlamaCppInstallationStatus, getLlamaCppOperationHistory, getLlamaCppOperationProgress, installLlamaCppArchive, installLlamaCppRuntime, removeDownloadedLlamaCppRuntime, uninstallLlamaCppRuntime, updateLlamaCppOperationProgress } from './llamaCppInstaller';
import { deleteExternalReference, listExternalReferences, saveExternalReference } from './externalReferences';
import { listKnowledgeDocuments, readApprovedKnowledgeDocument } from './knowledgeManager';
import { loadKnowledgeSchemas } from './orchestration/contractValidator';
import { runTeamExecution } from './orchestration/teamOrchestrator';
import { inspectMcpServer } from './orchestration/mcpInspector';
import { runLifecycleHooks } from './orchestration/hookRunner';
import { getOneCoreHome } from './paths';
import { BUILTIN_NAVIGATION_ICON_IDS, getBuiltInComponentRegistry, validateBuiltInComponentRegistry } from '../src/data/componentRegistry';
import { createDefaultNavigationLayout, validateNavigationLayout } from '../src/data/navigationLayout';
import { validateDashboardLayout } from '../src/data/dashboardLayout';
import { createAppearanceStylesheet, DEFAULT_APPEARANCE_TOKENS, validateAppearanceTokens } from '../src/data/appearanceTokens';
import {
  analyzeConfigurationDraft,
  createConfigurationDocument,
  createConfigurationDraft,
  type ConfigurationDraft,
  type ConfigurationScope,
} from './configurationEngine';
import {
  applyConfigurationDraft,
  ConfigurationRevisionConflictError,
  listConfigurationHistory,
  readConfigurationDocument,
  restoreConfigurationRevision,
} from './configurationManager';
import {
  checkRepoSyncDiff,
  getRepoSyncConfig,
  pullFromGitHub,
  pushToGitHub,
  saveRepoSyncConfig,
  type RepoPullStrategy,
  type RepoSyncAuthMethod,
  type RepoSyncTargetType,
} from './githubRepoSync';

interface HFModelRaw {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  lastModified?: string;
}

interface HFSiblingRaw {
  rfilename: string;
  size?: number;
  lfs?: {
    sha256?: string;
    size?: number;
  };
}

interface HFModelDetailRaw extends HFModelRaw {
  siblings?: HFSiblingRaw[];
  cardData?: {
    license?: string | string[];
  };
}

const searchCache = new Map<string, { ts: number; data: unknown }>();
const detailCache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 1000 * 60 * 3;

function extractLicense(tags: string[] = [], cardLicense?: string | string[]): string {
  if (typeof cardLicense === 'string' && cardLicense.trim()) {
    return cardLicense;
  }
  if (Array.isArray(cardLicense) && cardLicense.length > 0) {
    return cardLicense[0];
  }
  const licenseTag = tags.find((t) => t.startsWith('license:'));
  return licenseTag ? licenseTag.replace('license:', '') : 'open-weights';
}

function inferQuantizations(tags: string[] = [], id: string): string[] {
  const known = ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0', 'IQ4_XS'];
  const upperId = id.toUpperCase();
  const matched = known.filter((q) => upperId.includes(q) || tags.some((t) => t.toUpperCase().includes(q)));
  return matched.length > 0 ? matched : ['Q4_K_M', 'Q5_K_M'];
}

function estimateParamsBillions(id: string): number {
  const match = id.match(/(\d+(?:\.\d+)?)\s*[bB](?![a-zA-Z])/);
  if (match) {
    const val = parseFloat(match[1]);
    if (!Number.isNaN(val) && val > 0 && val <= 200) return val;
  }
  return 7;
}

export function createApiApp(rootDir: string = process.cwd()): express.Express {
  const app = express();
  recordAgentEvent({
    category: 'system',
    level: 'info',
    status: 'info',
    title: 'Инициализация серверного API',
    summary: 'Серверный API OneCoreAI инициализирован',
    source: 'server',
  });
  const tauriOrigins = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);
  const designerDevOrigins = new Set(['http://127.0.0.1:4174']);
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const apiSessions = new Map<string, { expiresAt: number; scope: 'full' | 'designer' }>();
  const designerPairingCodes = new Map<string, number>();
  const designerPairingAttempts = new Map<string, { count: number; resetAt: number }>();
  const API_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
  const DESIGNER_PAIRING_TTL_MS = 2 * 60 * 1000;
  const DESIGNER_PAIRING_MAX_ATTEMPTS = 5;
  const configuredApiToken = process.env.ONECORE_API_TOKEN?.trim() || undefined;
  const requireSideEffectApproval = (
    req: express.Request,
    res: express.Response,
    scope: SideEffectPermissionScope,
    resource: string,
  ): boolean => {
    const decision = evaluateSideEffectApproval({
      approved: req.body?.approved === true || req.header('X-OneCore-Approval') === 'user-confirmed',
      scope,
      resource,
    });
    recordAgentEvent({
      category: 'tool',
      level: decision.allowed ? 'info' : 'warning',
      status: decision.allowed ? 'completed' : 'failed',
      title: 'Permission Manager',
      summary: decision.allowed ? 'Побочное действие подтверждено пользователем' : 'Побочное действие отклонено: нет явного подтверждения',
      source: 'permission-manager',
      details: {
        actor: decision.actor,
        scope: decision.scope,
        resource: decision.resource,
        decision: decision.allowed ? 'approved' : 'denied',
        decidedAt: decision.decidedAt,
      },
    });
    if (!decision.allowed) {
      res.status(403).json({ ok: false, error: 'Требуется явное подтверждение действия пользователем.', permission: decision });
      return false;
    }
    return true;
  };
  const hashApiSession = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

  app.use((req, res, next) => {
    const requestHost = req.hostname.toLowerCase();
    const strictLoopback = process.env.ONECORE_STRICT_LOOPBACK === 'true';
    if (strictLoopback && !loopbackHosts.has(requestHost)) {
      res.status(403).json({ ok: false, error: 'The local OneCore API only accepts loopback hosts' });
      return;
    }

    const effectiveHostHeader = (req.header('x-forwarded-host') || req.header('host') || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const origin = req.header('Origin');
    const fetchSite = req.header('Sec-Fetch-Site');
    const isTauriOrigin = origin ? tauriOrigins.has(origin) : false;
    const isDesignerDevOrigin = process.env.NODE_ENV !== 'production' && Boolean(origin && designerDevOrigins.has(origin));
    let isAllowedOrigin = isTauriOrigin || isDesignerDevOrigin;

    const matchesRequestAuthority = (parsed: URL): boolean => {
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      if (parsed.username || parsed.password) return false;
      if (effectiveHostHeader && parsed.host.toLowerCase() === effectiveHostHeader) {
        return true;
      }
      const authorityPort = parsed.port
        ? Number(parsed.port)
        : parsed.protocol === 'https:'
          ? 443
          : 80;
      return parsed.hostname.toLowerCase() === requestHost && authorityPort === req.socket.localPort;
    };

    if (origin && !isTauriOrigin && !isDesignerDevOrigin) {
      try {
        isAllowedOrigin = matchesRequestAuthority(new URL(origin));
      } catch {
        isAllowedOrigin = false;
      }
    }

    if (origin && !isAllowedOrigin) {
      res.status(403).json({ ok: false, error: 'Origin is not allowed to access the local OneCore API' });
      return;
    }

    let isTrustedClient = Boolean(origin && isAllowedOrigin);
    if (!origin) {
      const referer = req.header('Referer');
      if (referer) {
        try {
          const parsedReferer = new URL(referer);
          isTrustedClient =
            tauriOrigins.has(parsedReferer.origin) || matchesRequestAuthority(parsedReferer);
        } catch {
          isTrustedClient = false;
        }
      } else if (fetchSite === 'same-origin') {
        isTrustedClient = true;
      }
    }
    res.locals.oneCoreTrustedClient = isTrustedClient;

    if (
      req.path.startsWith('/api') &&
      fetchSite &&
      fetchSite !== 'same-origin' &&
      fetchSite !== 'none' &&
      !isTauriOrigin &&
      !isDesignerDevOrigin
    ) {
      res.status(403).json({ ok: false, error: 'Cross-site requests are not allowed' });
      return;
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OneCore-Approval');
      if (req.header('Access-Control-Request-Private-Network') === 'true') {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', (req, res, next) => {
    if (req.path === '/auth/session' || req.path === '/designer/session' || req.path === '/health') {
      next();
      return;
    }

    const authorization = req.header('Authorization') ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const tokenMatchesConfiguredSecret = Boolean(
      configuredApiToken &&
      token.length === configuredApiToken.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(configuredApiToken)),
    );
    const tokenHash = token ? hashApiSession(token) : '';
    const apiSession = tokenHash ? apiSessions.get(tokenHash) : undefined;
    const sessionIsValid = Boolean(apiSession && apiSession.expiresAt > Date.now());

    if (configuredApiToken && tokenMatchesConfiguredSecret) {
      next();
      return;
    }

    if (!sessionIsValid || !apiSession) {
      if (tokenHash && apiSession) apiSessions.delete(tokenHash);
      res.status(401).json({ ok: false, error: 'Требуется действующая сессия OneCoreAI' });
      return;
    }

    const isDesignerConfigurationRoute =
      req.path === '/designer/registry' ||
      req.path === '/designer/navigation/validate' ||
      req.path === '/designer/appearance/validate' ||
      req.path === '/designer/theme.css' ||
      req.path === '/designer/configuration' ||
      req.path.startsWith('/designer/configuration/');
    if (apiSession.scope === 'designer' && !isDesignerConfigurationRoute) {
      res.status(403).json({ ok: false, error: 'Сессия Designer не имеет доступа к этому API-разделу' });
      return;
    }
    next();
  });

  app.post('/api/designer/session', (req, res) => {
    const origin = req.header('Origin');
    if (!origin || (!tauriOrigins.has(origin) && !(process.env.NODE_ENV !== 'production' && designerDevOrigins.has(origin))) || res.locals.oneCoreTrustedClient !== true) {
      res.status(403).json({ ok: false, error: 'Связать Designer можно только из доверенного desktop-приложения' });
      return;
    }

    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = designerPairingAttempts.get(clientKey);
    if (attempts && attempts.resetAt > now && attempts.count >= DESIGNER_PAIRING_MAX_ATTEMPTS) {
      res.status(429).json({ ok: false, error: 'Превышен лимит попыток подключения Designer' });
      return;
    }

    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const codeHash = /^\d{8}$/.test(code) ? hashApiSession(code) : '';
    const expiresAt = codeHash ? designerPairingCodes.get(codeHash) : undefined;
    if (!expiresAt || expiresAt <= now) {
      if (codeHash) designerPairingCodes.delete(codeHash);
      const nextAttempts = attempts && attempts.resetAt > now
        ? { count: attempts.count + 1, resetAt: attempts.resetAt }
        : { count: 1, resetAt: now + DESIGNER_PAIRING_TTL_MS };
      designerPairingAttempts.set(clientKey, nextAttempts);
      res.status(401).json({ ok: false, error: 'Код подключения недействителен или истёк' });
      return;
    }

    designerPairingCodes.delete(codeHash);
    designerPairingAttempts.delete(clientKey);
    const token = crypto.randomBytes(32).toString('base64url');
    const sessionExpiresAt = now + API_SESSION_TTL_MS;
    apiSessions.set(hashApiSession(token), { expiresAt: sessionExpiresAt, scope: 'designer' });
    while (apiSessions.size > 256) {
      const oldest = apiSessions.keys().next().value;
      if (!oldest) break;
      apiSessions.delete(oldest);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, token, expiresAt: new Date(sessionExpiresAt).toISOString() });
  });

  app.get('/api/auth/session', (_req, res) => {
    if (configuredApiToken) {
      res.status(403).json({ ok: false, error: 'Выпуск сессий выполняется через нативный интерфейс приложения' });
      return;
    }
    if (res.locals.oneCoreTrustedClient !== true) {
      res.status(403).json({ ok: false, error: 'Сессия доступна только доверенному приложению OneCoreAI' });
      return;
    }

    const now = Date.now();
    for (const [sessionHash, session] of apiSessions) {
      if (session.expiresAt <= now) apiSessions.delete(sessionHash);
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = now + API_SESSION_TTL_MS;
    apiSessions.set(hashApiSession(token), { expiresAt, scope: 'full' });
    while (apiSessions.size > 256) {
      const oldest = apiSessions.keys().next().value;
      if (!oldest) break;
      apiSessions.delete(oldest);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, token, expiresAt: new Date(expiresAt).toISOString() });
  });

  app.use('/api', (req, res, next) => {
    if (req.path === '/agent-journal' || req.path === '/agent-journal/stream' || req.path === '/agent-journal/events' || req.path === '/chats' || req.path === '/health') {
      next();
      return;
    }

    const startedAt = Date.now();
    const route = req.route?.path || req.path;
    const category = req.path.includes('/git')
      ? 'git'
      : req.path.includes('/exec')
        ? 'terminal'
        : req.path.includes('/projects/')
          ? 'project'
          : req.path.includes('/providers/') || req.path.includes('/models')
            ? 'model'
            : req.path.includes('/browser/') || req.path.includes('/github/') || req.path.includes('/ssh/')
              ? 'tool'
              : 'api';
    const projectIdMatch = req.path.match(/^\/projects\/([^/]+)/);
    const projectId = projectIdMatch ? decodeURIComponent(projectIdMatch[1]) : undefined;
    const operationIdPattern = /^[a-zA-Z0-9._:-]{1,120}$/;
    const parentOperationIdHeader = req.headers['x-onecore-operation-id'];
    const messageIdHeader = req.headers['x-onecore-message-id'];
    const sessionIdHeader = req.headers['x-onecore-session-id'];
    const parentOperationId = typeof parentOperationIdHeader === 'string' && operationIdPattern.test(parentOperationIdHeader)
      ? parentOperationIdHeader
      : undefined;
    const messageId = typeof messageIdHeader === 'string' && operationIdPattern.test(messageIdHeader)
      ? messageIdHeader
      : undefined;
    const sessionId = typeof sessionIdHeader === 'string' && operationIdPattern.test(sessionIdHeader)
      ? sessionIdHeader
      : undefined;
    const operationId = beginAgentEvent({
      category,
      level: 'info',
      title: `${req.method} ${route}`,
      summary: 'API-операция выполняется',
      source: 'server',
      projectId,
      parentOperationId,
      sessionId,
      messageId,
      details: {
        method: req.method,
        path: req.path,
        ...(typeof req.body?.model === 'string' ? { model: req.body.model } : {}),
      },
    });

    startOperation({
      id: operationId,
      parentOperationId,
      sessionId,
      messageId,
      method: req.method,
      path: req.path,
    });
    res.locals.operationSignal = getOperationSignal(operationId);
    let operationFinalized = false;
    res.on('finish', () => {
      operationFinalized = true;
      const failed = res.statusCode >= 400;
      finishOperation(operationId, failed ? 'failed' : 'completed');
      const finalStatus = getOperation(operationId)?.status;
      const cancelled = finalStatus === 'cancelled';
      finishAgentEvent(operationId, {
        status: cancelled ? 'cancelled' : failed ? 'failed' : 'completed',
        level: cancelled ? 'warning' : failed ? 'error' : 'info',
        summary: cancelled
          ? 'Операция отменена до завершения'
          : failed
            ? `HTTP ${res.statusCode}`
            : `HTTP ${res.statusCode} · выполнено`,
        durationMs: Date.now() - startedAt,
        details: { method: req.method, path: req.path, statusCode: res.statusCode },
      });
    });
    res.on('close', () => {
      if (operationFinalized || res.writableEnded) return;
      operationFinalized = true;
      finishOperation(operationId, 'cancelled');
      finishAgentEvent(operationId, {
        status: 'cancelled',
        level: 'warning',
        summary: 'Клиент отменил запрос или закрыл соединение',
        durationMs: Date.now() - startedAt,
        details: { method: req.method, path: req.path, statusCode: res.statusCode },
      });
    });
    runWithAgentOperationContext({
      operationId: parentOperationId ?? operationId,
      sessionId,
      messageId,
    }, next);
  });

  app.get('/api/system-map', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      operations: listOperations(500),
      events: readAgentJournal(1000),
      coverage: {
        projectAgent: 'instrumented',
        providerChat: 'instrumented',
        managerDispatcher: 'implemented',
        instructionBinding: 'runtime-enforced',
      },
    });
  });

  app.get('/api/knowledge', (_req, res) => {
    try {
      const knowledgeRoot = path.join(rootDir, 'docs', 'knowledge');
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, documents: listKnowledgeDocuments(knowledgeRoot) });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось прочитать справочник знаний.' });
    }
  });

  app.get('/api/knowledge/schemas', (_req, res) => {
    try {
      const knowledgeRoot = path.join(rootDir, 'docs', 'knowledge');
      const schemas = loadKnowledgeSchemas(knowledgeRoot);
      const documents = listKnowledgeDocuments(knowledgeRoot);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        schemas,
        enforcement: {
          handoffSchemaLoaded: Boolean(schemas.agentHandoff),
          workerResultSchemaLoaded: Boolean(schemas.workerResult),
          approvedDocumentsCount: documents.filter((d) => d.status === 'approved').length,
          totalDocumentsCount: documents.length,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось загрузить JSON-схемы регламентов.' });
    }
  });

  app.get('/api/knowledge/documents/:id', (req, res) => {
    try {
      const knowledgeRoot = path.join(rootDir, 'docs', 'knowledge');
      const document = readApprovedKnowledgeDocument(knowledgeRoot, String(req.params.id ?? ''));
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, document });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось прочитать документ знаний.';
      const status = message.includes('не найден') ? 404 : message.includes('не утверждён') ? 403 : 400;
      res.status(status).json({ ok: false, error: message });
    }
  });

  app.get('/api/external-references', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, references: listExternalReferences() });
  });

  app.post('/api/external-references', (req, res) => {
    try {
      const reference = saveExternalReference(req.body ?? {});
      res.status(201).json({ ok: true, reference });
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось сохранить внешний материал.' });
    }
  });

  app.put('/api/external-references/:id', (req, res) => {
    try {
      const reference = saveExternalReference(req.body ?? {}, req.params.id);
      res.json({ ok: true, reference });
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось обновить внешний материал.' });
    }
  });

  app.delete('/api/external-references/:id', (req, res) => {
    if (!deleteExternalReference(req.params.id)) {
      res.status(404).json({ ok: false, error: 'Внешний материал не найден.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/operations', (_req, res) => {
    res.json({ ok: true, operations: listOperations() });
  });

  app.get('/api/operations/:id', (req, res) => {
    const operation = getOperation(req.params.id);
    if (!operation) {
      res.status(404).json({ ok: false, error: 'Операция не найдена' });
      return;
    }
    res.json({ ok: true, operation });
  });

  app.post('/api/operations/:id/cancel', (req, res) => {
    const operation = getOperation(req.params.id);
    if (!operation) {
      res.status(404).json({ ok: false, error: 'Операция не найдена' });
      return;
    }
    if (operation.status !== 'running') {
      res.status(409).json({ ok: false, error: 'Операция уже завершена', operation });
      return;
    }
    const cancelled = cancelOperation(req.params.id, 'Отмена запрошена через API.');
    res.json({ ok: cancelled, operation: getOperation(req.params.id) });
  });

  app.get('/api/agent-journal', (_req, res) => {
    const events = readAgentJournal(5000);
    const knownProjectLogIds = new Set(
      events.map((event) => event.details?.projectLogId).filter((id): id is string => typeof id === 'string'),
    );
    const legacyEvents = listProjects().projects.flatMap((project) =>
      readProjectActionLog(project.id)
        .filter((log) => !knownProjectLogIds.has(log.id))
        .map((log) => ({
          id: `legacy-${log.id}`,
          operationId: log.id,
          timestamp: log.timestamp,
          category: log.kind === 'command' ? 'terminal' as const : log.kind === 'git' ? 'git' as const : 'project' as const,
          level: typeof log.exitCode === 'number' && log.exitCode !== 0 ? 'error' as const : 'info' as const,
          status: typeof log.exitCode === 'number' && log.exitCode !== 0 ? 'failed' as const : 'completed' as const,
          title: log.kind === 'file_write'
            ? 'Изменение файла проекта'
            : log.kind === 'command'
              ? 'Команда проекта'
              : log.kind === 'git'
                ? 'Операция Git'
                : log.kind === 'undo'
                  ? 'Откат изменения'
                  : 'Событие проекта',
          summary: log.kind === 'command'
            ? `Команда завершена с кодом ${log.exitCode ?? '—'}`
            : log.kind === 'git'
              ? `Операция Git завершена с кодом ${log.exitCode ?? '—'}`
              : log.kind === 'file_write'
                ? 'Файл проекта записан'
                : log.kind === 'undo'
                  ? 'Изменение проекта отменено'
                  : 'Обновлено состояние проекта',
          source: 'project-action-log',
          projectId: project.id,
          details: {
            kind: log.kind,
            ...(log.filePath ? { filePath: log.filePath } : {}),
            ...(typeof log.exitCode === 'number' ? { exitCode: log.exitCode } : {}),
          },
        })),
    );
    res.json({
      ok: true,
      events: [...events, ...legacyEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500),
    });
  });

  app.get('/api/agent-journal/stream', (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(': connected\n\n');
    const unsubscribe = subscribeAgentJournal(res);
    res.on('close', unsubscribe);
  });

  app.post('/api/agent-journal/events', (req, res) => {
    const category = req.body?.category;
    const status = req.body?.status;
    const level = req.body?.level;
    const operationId = typeof req.body?.operationId === 'string' ? req.body.operationId.trim() : '';
    const parentOperationId = typeof req.body?.parentOperationId === 'string' ? req.body.parentOperationId.trim() : undefined;
    const messageId = typeof req.body?.messageId === 'string' ? req.body.messageId.trim() : undefined;
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : undefined;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
    const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim().slice(0, 240) : '';

    if (
      (category !== 'agent' && category !== 'subagent') ||
      !['running', 'completed', 'failed', 'cancelled', 'info'].includes(status) ||
      !['info', 'warning', 'error'].includes(level) ||
      !/^[a-zA-Z0-9._:-]{1,120}$/.test(operationId) ||
      (parentOperationId !== undefined && !/^[a-zA-Z0-9._:-]{1,120}$/.test(parentOperationId)) ||
      (messageId !== undefined && !/^[a-zA-Z0-9._:-]{1,120}$/.test(messageId)) ||
      (sessionId !== undefined && !/^[a-zA-Z0-9._:-]{1,120}$/.test(sessionId)) ||
      !title ||
      !summary
    ) {
      res.status(400).json({ ok: false, error: 'Некорректные данные события журнала' });
      return;
    }

    const details: Record<string, string | number | boolean | null> = {};
    for (const key of ['model', 'provider', 'role']) {
      const value = req.body?.details?.[key];
      if (typeof value === 'string') details[key] = value.slice(0, 160);
    }

    recordAgentEvent({
      id: `client-${operationId}`,
      operationId,
      category,
      status,
      level,
      title,
      summary,
      source: category === 'subagent' ? 'subagent-runner' : 'agent-client',
      projectId: typeof req.body?.projectId === 'string' ? req.body.projectId.slice(0, 120) : undefined,
      parentOperationId,
      sessionId,
      messageId,
      durationMs: typeof req.body?.durationMs === 'number' && req.body.durationMs >= 0 ? req.body.durationMs : undefined,
      details,
    });
    res.json({ ok: true });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'onecore-ai-backend', timestamp: Date.now() });
  });

  app.get('/api/chats', (_req, res) => {
    try {
      const history = readChatHistory();
      res.json({
        ok: true,
        sessions: history?.sessions ?? [],
        activeSessionId: history?.activeSessionId ?? '',
        savedAt: history?.savedAt ?? null,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Не удалось загрузить историю чатов',
      });
    }
  });

  app.put('/api/chats', (req, res) => {
    try {
      const history = saveChatHistory({
        activeSessionId: req.body?.activeSessionId,
        sessions: req.body?.sessions,
      });
      res.json({
        ok: true,
        activeSessionId: history.activeSessionId,
        savedAt: history.savedAt,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Не удалось сохранить историю чатов',
      });
    }
  });

  app.get('/api/notes', (_req, res) => {
    try {
      res.json({ ok: true, notes: listNotes() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось загрузить заметки' });
    }
  });

  app.post('/api/notes', (req, res) => {
    try {
      const note = createNote({ title: req.body?.title, content: req.body?.content });
      res.status(201).json({ ok: true, note });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось создать заметку' });
    }
  });

  app.put('/api/notes/:id', (req, res) => {
    try {
      const note = updateNote(req.params.id, { title: req.body?.title, content: req.body?.content });
      if (!note) {
        res.status(404).json({ ok: false, error: 'Заметка не найдена' });
        return;
      }
      res.json({ ok: true, note });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить заметку' });
    }
  });

  app.delete('/api/notes/:id', (req, res) => {
    try {
      if (!deleteNote(req.params.id)) {
        res.status(404).json({ ok: false, error: 'Заметка не найдена' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось удалить заметку' });
    }
  });

  app.get('/api/system/metrics', (_req, res) => {
    res.json({ ok: true, metrics: getModelMetrics() });
  });

  const parseDesignerScope = (scopeValue: unknown, projectIdValue: unknown): ConfigurationScope => {
    if (scopeValue === 'global' && projectIdValue === undefined) return { type: 'global' };
    if (scopeValue === 'project' && typeof projectIdValue === 'string' && projectIdValue.trim()) {
      return { type: 'project', projectId: projectIdValue.trim() };
    }
    throw new Error('Укажите область global либо project с projectId');
  };

  app.post('/api/designer/pairing', (req, res) => {
    if (!requireSideEffectApproval(req, res, 'configuration.pair', 'designer-pairing')) return;
    const now = Date.now();
    for (const [codeHash, expiresAt] of designerPairingCodes) {
      if (expiresAt <= now) designerPairingCodes.delete(codeHash);
    }

    let code = '';
    let codeHash = '';
    do {
      code = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
      codeHash = hashApiSession(code);
    } while (designerPairingCodes.has(codeHash));

    const expiresAt = now + DESIGNER_PAIRING_TTL_MS;
    designerPairingCodes.set(codeHash, expiresAt);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      code,
      apiBaseUrl: `http://127.0.0.1:${req.socket.localPort}`,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  });

  app.get('/api/designer/registry', (_req, res) => {
    const registryValidation = validateBuiltInComponentRegistry();
    const defaultNavigationLayout = createDefaultNavigationLayout();
    const navigationValidation = validateNavigationLayout(defaultNavigationLayout);
    if (!registryValidation.valid || !navigationValidation.valid) {
      res.status(500).json({
        ok: false,
        error: 'Реестр встроенных компонентов или макет навигации некорректен',
        diagnostics: [...registryValidation.diagnostics, ...navigationValidation.diagnostics.map((item) => item.message)],
      });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      registry: getBuiltInComponentRegistry(),
      navigationIcons: BUILTIN_NAVIGATION_ICON_IDS,
      defaultNavigationLayout,
      defaultAppearanceTokens: DEFAULT_APPEARANCE_TOKENS,
    });
  });

  app.post('/api/designer/navigation/validate', (req, res) => {
    const validation = validateNavigationLayout(req.body?.layout);
    res.json({ ok: true, validation });
  });

  app.post('/api/designer/appearance/validate', (req, res) => {
    const validation = validateAppearanceTokens(req.body?.appearance);
    res.json({
      ok: true,
      validation,
      ...(validation.valid ? { css: createAppearanceStylesheet(req.body.appearance) } : {}),
    });
  });

  app.get('/api/designer/theme.css', (_req, res) => {
    try {
      const configuration = readConfigurationDocument({ type: 'global' });
      const appearance = configuration?.config.appearance;
      res.setHeader('Cache-Control', 'no-store');
      if (appearance === undefined) {
        res.status(204).end();
        return;
      }
      res.type('text/css').send(createAppearanceStylesheet(appearance));
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Не удалось загрузить тему Designer',
      });
    }
  });

  app.get('/api/designer/configuration', (req, res) => {
    try {
      const scope = parseDesignerScope(req.query.scope, req.query.projectId);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, configuration: readConfigurationDocument(scope) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось прочитать конфигурацию' });
    }
  });

  app.get('/api/designer/configuration/history', (req, res) => {
    try {
      const scope = parseDesignerScope(req.query.scope, req.query.projectId);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, revisions: listConfigurationHistory(scope) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось прочитать историю конфигурации' });
    }
  });

  app.post('/api/designer/configuration/drafts', (req, res) => {
    try {
      const scope = parseDesignerScope(req.body?.scope?.type, req.body?.scope?.projectId);
      const current = readConfigurationDocument(scope);
      const base = current ?? createConfigurationDocument(scope, {});
      const draft = createConfigurationDraft(base, req.body?.changes);
      const analysis = analyzeConfigurationDraft(draft);
      const navigationValidation = draft.config.navigation === undefined
        ? null
        : validateNavigationLayout(draft.config.navigation);
      const appearanceValidation = draft.config.appearance === undefined
        ? null
        : validateAppearanceTokens(draft.config.appearance);
      const layoutValidation = draft.config.layout === undefined
        ? null
        : validateDashboardLayout(draft.config.layout);
      res.json({ ok: true, draft, analysis, navigationValidation, appearanceValidation, layoutValidation });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось создать черновик' });
    }
  });

  app.post('/api/designer/configuration/apply', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'configuration.apply', 'designer-configuration')) return;
    try {
      const draft = req.body?.draft as ConfigurationDraft;
      if (draft?.config?.layout !== undefined) {
        const layoutValidation = validateDashboardLayout(draft.config.layout);
        if (!layoutValidation.valid) {
          res.status(400).json({ ok: false, error: layoutValidation.diagnostics.join('; ') });
          return;
        }
      }
      const document = await applyConfigurationDraft(draft);
      recordAgentEvent({
        category: 'system',
        level: 'info',
        status: 'completed',
        title: 'Конфигурация Designer сохранена',
        summary: `Сохранена ревизия конфигурации ${document.revision}`,
        source: 'configuration-manager',
        details: { revision: document.revision, scopeType: document.scope.type, projectId: document.scope.projectId ?? null },
      });
      res.json({ ok: true, configuration: document });
    } catch (err) {
      const status = err instanceof ConfigurationRevisionConflictError ? 409 : 400;
      res.status(status).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить конфигурацию' });
    }
  });

  app.post('/api/designer/configuration/restore', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'configuration.apply', 'designer-configuration-restore')) return;
    try {
      const scope = parseDesignerScope(req.body?.scope?.type, req.body?.scope?.projectId);
      const document = await restoreConfigurationRevision(
        scope,
        req.body?.targetRevision,
        req.body?.expectedCurrentRevision,
      );
      recordAgentEvent({
        category: 'system',
        level: 'warning',
        status: 'completed',
        title: 'Конфигурация Designer восстановлена',
        summary: `Создана ревизия ${document.revision} на основе предыдущей конфигурации`,
        source: 'configuration-manager',
        details: { revision: document.revision, scopeType: document.scope.type, projectId: document.scope.projectId ?? null },
      });
      res.json({ ok: true, configuration: document });
    } catch (err) {
      const status = err instanceof ConfigurationRevisionConflictError ? 409 : 400;
      res.status(status).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось восстановить конфигурацию' });
    }
  });

  app.get('/api/settings', async (_req, res) => {
    try {
      res.json({ ok: true, ...(await readAppSettings()) });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Ошибка чтения настроек',
      });
    }
  });

  app.get('/api/security/secrets', async (_req, res) => {
    try {
      const manifest = await readAppSettings();
      const settings = manifest?.settings;
      res.json({ ok: true, vault: { configured: Boolean(manifest), backend: 'os-keychain-with-encrypted-vault-fallback' }, integrations: [
        { kind: 'github', id: 'default', label: 'GitHub Personal Access Token', configured: Boolean((settings as typeof settings & { security?: { githubTokenConfigured?: boolean } })?.security?.githubTokenConfigured) },
        { kind: 'cloud-fallback', id: 'default', label: 'Cloud fallback API key', configured: Boolean((settings as typeof settings & { security?: { cloudFallbackConfigured?: boolean } })?.security?.cloudFallbackConfigured) },
        ...(settings?.gateways ?? []).map((g) => ({ kind: 'gateway', id: g.id, label: `${g.name} bot token`, configured: Boolean((g as typeof g & { secretConfigured?: boolean }).secretConfigured) })),
      ], providers: [
        ...(settings?.freeProviders ?? []).map((p) => ({ id: p.id, kind: p.kind, name: p.name, requiresKey: p.requiresKey, configured: Boolean((p as typeof p & { secretConfigured?: boolean }).secretConfigured), scope: 'primary' })),
        ...(settings?.subagentConfig?.providers ?? []).map((p) => ({ id: p.id, kind: p.kind, name: p.name, requiresKey: p.requiresKey, configured: Boolean((p as typeof p & { secretConfigured?: boolean }).secretConfigured), scope: 'subagent' })),
        ...Object.entries(settings?.subagentConfig?.providerProfilesByRole ?? {}).flatMap(([roleId, profile]) => profile.providers.map((p) => ({ id: p.id, kind: p.kind, name: p.name, requiresKey: p.requiresKey, configured: Boolean((p as typeof p & { secretConfigured?: boolean }).secretConfigured), scope: 'subagent', roleId }))),
      ] });
    } catch (err) { res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось прочитать статус секретов' }); }
  });
  app.put('/api/security/integrations/:kind/:id', async (req, res) => {
    try { const kind = req.params.kind; if (kind !== 'github' && kind !== 'cloud-fallback' && kind !== 'gateway') { res.status(400).json({ ok: false, error: 'Неизвестный тип секрета' }); return; } await setIntegrationSecret(kind, req.params.id, typeof req.body?.secret === 'string' ? req.body.secret : ''); res.json({ ok: true, configured: true }); }
    catch (err) { res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить секрет' }); }
  });
  app.delete('/api/security/integrations/:kind/:id', async (req, res) => {
    try { const kind = req.params.kind; if (kind !== 'github' && kind !== 'cloud-fallback' && kind !== 'gateway') { res.status(400).json({ ok: false, error: 'Неизвестный тип секрета' }); return; } await clearIntegrationSecret(kind, req.params.id); res.json({ ok: true, configured: false }); }
    catch (err) { res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось удалить секрет' }); }
  });

  app.put('/api/security/providers/:providerId/key', async (req, res) => {
    try { if (req.query.scope === 'subagent') await setSubagentProviderSecret(req.params.providerId, typeof req.body?.apiKey === 'string' ? req.body.apiKey : '', typeof req.query.roleId === 'string' ? req.query.roleId : undefined); else await setProviderSecret(req.params.providerId, typeof req.body?.apiKey === 'string' ? req.body.apiKey : ''); res.json({ ok: true, configured: true }); }
    catch (err) { res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить ключ' }); }
  });
  app.delete('/api/security/providers/:providerId/key', async (req, res) => {
    try { if (req.query.scope === 'subagent') await clearSubagentProviderSecret(req.params.providerId, typeof req.query.roleId === 'string' ? req.query.roleId : undefined); else await clearProviderSecret(req.params.providerId); res.json({ ok: true, configured: false }); }
    catch (err) { res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось удалить ключ' }); }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const saved = await saveAppSettings(req.body?.settings);
      const activeProvider = saved.settings.freeProviders.find(
        (provider) => provider.id === saved.settings.activeProviderId,
      );
      const ollamaProvider = activeProvider?.kind === 'ollama' && activeProvider.selectedModel?.trim()
        ? activeProvider
        : undefined;
      if (ollamaProvider) {
        void warmOllamaModel(ollamaProvider).then(() => {
          recordAgentEvent({
            category: 'model',
            level: 'info',
            status: 'completed',
            title: 'Модель Ollama прогрета',
            summary: `Модель ${ollamaProvider.selectedModel} загружена и удерживается в памяти 30 минут`,
            source: 'ollama-runtime',
          });
        }).catch((error) => {
          recordAgentEvent({
            category: 'model',
            level: 'warning',
            status: 'failed',
            title: 'Не удалось прогреть Ollama',
            summary: error instanceof Error ? error.message.slice(0, 240) : 'Ошибка прогрева модели',
            source: 'ollama-runtime',
          });
        });
      }
      recordAgentEvent({
        category: 'system',
        level: 'info',
        status: 'completed',
        title: 'Настройки сохранены',
        summary: `Настройки приложения сохранены · ${new Date(saved.savedAt).toLocaleString('ru-RU')}`,
        source: 'settings',
        details: { savedAt: saved.savedAt },
      });
      res.json({ ok: true, ...saved });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Ошибка сохранения настроек',
      });
    }
  });

  // =========================================================================
  // 1. Hardware Detection & Model Recommendation (§1)
  // =========================================================================
  app.get('/api/hardware', async (req, res) => {
    try {
      const targetDir = typeof req.query.dir === 'string' ? req.query.dir : undefined;
      const profile = await detectHardware(targetDir);
      res.json({ ok: true, hardware: profile });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка детекта железа' });
    }
  });

  app.post('/api/hardware/recommend', async (req, res) => {
    try {
      const models = Array.isArray(req.body?.models) ? req.body.models : [];
      const hw = req.body?.hardware ?? (await detectHardware());
      const recommendations = models.map((m: {
        id: string;
        name: string;
        quant?: string;
        sizeGb: number;
        minVramGb?: number;
        minRamGb?: number;
      }) =>
        recommendModelForHardware(
          {
            id: m.id,
            name: m.name,
            quant: m.quant || 'Q4_K_M',
            sizeGb: Number(m.sizeGb) || 4,
            minVramGb: m.minVramGb,
            minRamGb: m.minRamGb,
          },
          hw,
        ),
      );
      res.json({ ok: true, hardware: hw, recommendations });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка подбора моделей' });
    }
  });

  // =========================================================================
  // 2. Real Local Model Manager & Resumable Streaming Downloads (§2)
  // =========================================================================
  app.get('/api/models/local', async (_req, res) => {
    try {
      const state = await scanLocalModels();
      res.json({ ok: true, ...state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка сканирования папки моделей' });
    }
  });

  const getLocalLlamaApiBaseUrl = (): string => {
    const runtime = getLlamaCppStatus();
    if (runtime.status !== 'ready') throw new Error('llama-server не запущен или ещё не подтвердил готовность.');
    const parsed = new URL(runtime.baseUrl);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' ||
      parsed.pathname.replace(/\/+$/, '') !== '/v1' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('Разрешён только локальный llama-server endpoint на 127.0.0.1 с путём /v1.');
    }
    return parsed.origin + '/v1';
  };
  const benchmarkHistoryPath = path.join(getOneCoreHome(), 'benchmarks', 'llama-server.json');
  const readBenchmarkHistory = (): Array<Record<string, unknown>> => {
    try {
      if (!fs.existsSync(benchmarkHistoryPath)) return [];
      const parsed = JSON.parse(fs.readFileSync(benchmarkHistoryPath, 'utf8')) as unknown;
      return Array.isArray(parsed) ? parsed.slice(-20) as Array<Record<string, unknown>> : [];
    } catch {
      return [];
    }
  };
  const writeBenchmarkHistory = (history: Array<Record<string, unknown>>): void => {
    fs.mkdirSync(path.dirname(benchmarkHistoryPath), { recursive: true });
    const temporaryPath = `${benchmarkHistoryPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(history.slice(-20), null, 2), 'utf8');
    fs.renameSync(temporaryPath, benchmarkHistoryPath);
  };
  const sampleLlamaRuntimeUsage = async (): Promise<{
    activeSlots: number;
    totalSlots: number;
    usedContextTokens: number;
    totalContextTokens: number;
  } | null> => {
    try {
      const baseUrl = getLocalLlamaApiBaseUrl();
      const response = await fetch(`${new URL(baseUrl).origin}/slots`, {
        signal: AbortSignal.timeout(1500),
        redirect: 'error',
      });
      if (!response.ok) return null;
      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) return null;
      const slots = payload.map((entry: unknown) => {
        const slot = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const params = slot.params && typeof slot.params === 'object' ? slot.params as Record<string, unknown> : {};
        const nCtx = typeof slot.n_ctx === 'number' ? slot.n_ctx : typeof params.n_ctx === 'number' ? params.n_ctx : null;
        const nPast = typeof slot.n_past === 'number' ? slot.n_past : typeof slot.n_past_tokens === 'number' ? slot.n_past_tokens : null;
        return {
          active: slot.is_processing === true || slot.isProcessing === true,
          nCtx: nCtx !== null && Number.isFinite(nCtx) && nCtx >= 0 ? nCtx : null,
          nPast: nPast !== null && Number.isFinite(nPast) && nPast >= 0 ? nPast : null,
        };
      });
      return {
        activeSlots: slots.filter((slot) => slot.active).length,
        totalSlots: slots.length,
        usedContextTokens: slots.reduce((sum, slot) => sum + (slot.nPast ?? 0), 0),
        totalContextTokens: slots.reduce((sum, slot) => sum + (slot.nCtx ?? 0), 0),
      };
    } catch {
      return null;
    }
  };

  app.get('/api/models/llama-cpp/telemetry', async (_req, res) => {
    try {
      const baseUrl = getLocalLlamaApiBaseUrl();
      const response = await fetch(`${new URL(baseUrl).origin}/slots`, { signal: AbortSignal.timeout(2500), redirect: 'error' });
      if (!response.ok) {
        res.status(502).json({ ok: false, error: `llama-server /slots вернул HTTP ${response.status}.` });
        return;
      }
      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) {
        res.status(502).json({ ok: false, error: 'llama-server /slots вернул неожиданный формат.' });
        return;
      }
      const slots = payload.map((entry: unknown, index: number) => {
        const slot = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const params = slot.params && typeof slot.params === 'object' ? slot.params as Record<string, unknown> : {};
        const numeric = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
        return {
          id: numeric(slot.id) || index,
          isProcessing: slot.is_processing === true || slot.isProcessing === true,
          state: typeof slot.state === 'string' ? slot.state : null,
          nCtx: typeof slot.n_ctx === 'number' ? numeric(slot.n_ctx) : typeof params.n_ctx === 'number' ? numeric(params.n_ctx) : null,
          nPast: typeof slot.n_past === 'number' ? numeric(slot.n_past) : typeof slot.n_past_tokens === 'number' ? numeric(slot.n_past_tokens) : null,
          nTokens: typeof slot.n_tokens === 'number' ? numeric(slot.n_tokens) : null,
        };
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, baseUrl, slots, sampledAt: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось получить телеметрию llama-server.';
      res.status(message.includes('не запущен') ? 409 : 502).json({ ok: false, error: message });
    }
  });

  app.get('/api/models/llama-cpp/requests', (req, res) => {
    const parsedLimit = Number(req.query.limit ?? 100);
    const limit = Number.isInteger(parsedLimit) ? Math.min(500, Math.max(1, parsedLimit)) : 100;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, history: listLlamaRequestHistory(limit) });
  });

  app.get('/api/models/llama-cpp/benchmark/history', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, history: readBenchmarkHistory() });
  });

  app.post('/api/models/llama-cpp/benchmark/history', (req, res) => {
    const candidate = req.body?.run;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      res.status(400).json({ ok: false, error: 'Не передан результат benchmark.' });
      return;
    }
    const item = candidate as Record<string, unknown>;
    const results = Array.isArray(item.results) ? item.results : [];
    const validNumber = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (
      typeof item.id !== 'string' || item.id.length > 100 ||
      typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
      typeof item.model !== 'string' || item.model.length > 200 ||
      !Number.isInteger(item.requestCount) || Number(item.requestCount) < 1 || Number(item.requestCount) > 6 ||
      !Number.isInteger(item.successful) || !Number.isInteger(item.failed) ||
      Number(item.successful) + Number(item.failed) !== Number(item.requestCount) ||
      !(item.totalTokens === null || validNumber(item.totalTokens)) || !validNumber(item.totalDurationMs) ||
      !(item.aggregateTokensPerSecond === null || validNumber(item.aggregateTokensPerSecond)) || results.length !== Number(item.requestCount)
    ) {
      res.status(400).json({ ok: false, error: 'Результат benchmark содержит некорректные поля.' });
      return;
    }
    const validResults = results.every((entry: unknown, index: number) => {
      const result = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      return result.index === index + 1 &&
        typeof result.prompt === 'string' && result.prompt.length <= 3000 &&
        validNumber(result.latencyMs) && (result.completionTokens === null || validNumber(result.completionTokens)) &&
        (result.tokensPerSecond === null || validNumber(result.tokensPerSecond)) &&
        (result.error === undefined || (typeof result.error === 'string' && result.error.length <= 500));
    });
    if (!validResults) {
      res.status(400).json({ ok: false, error: 'Строка benchmark содержит некорректные поля.' });
      return;
    }
    const safeResults = results.map((entry: unknown) => {
      const result = entry as Record<string, unknown>;
      return {
        index: result.index, prompt: result.prompt, latencyMs: result.latencyMs,
        completionTokens: result.completionTokens, tokensPerSecond: result.tokensPerSecond,
        ...(typeof result.error === 'string' ? { error: result.error } : {}),
      };
    });
    const run = {
      id: item.id, createdAt: item.createdAt, model: item.model,
      requestCount: item.requestCount, successful: item.successful, failed: item.failed,
      totalTokens: item.totalTokens, totalDurationMs: item.totalDurationMs,
      aggregateTokensPerSecond: item.aggregateTokensPerSecond, results: safeResults,
    };
    const history = [...readBenchmarkHistory(), run as unknown as Record<string, unknown>].slice(-20);
    writeBenchmarkHistory(history);
    res.json({ ok: true, history });
  });

  app.get('/api/models/llama-cpp/status', (_req, res) => {
    res.json({ ok: true, ...getLlamaCppStatus() });
  });

  app.get('/api/models/llama-cpp/operation', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, operation: getLlamaCppOperationProgress(), history: getLlamaCppOperationHistory() });
  });

  app.get('/api/models/llama-cpp/checks', async (_req, res) => {
    try {
      const manifest = await readAppSettings();
      const settings = manifest?.settings;
      const executablePath = settings?.appSettings?.llamaServerPath || 'llama-server';
      const installation = await getLlamaCppInstallationStatus(executablePath);
      const provider = settings?.freeProviders?.find((item) => item.kind === 'llama-cpp');
      const baseUrl = provider?.baseUrl || getLlamaCppStatus().baseUrl || 'http://127.0.0.1:8080/v1';
      let healthUrl: string;
      try {
        const parsed = new URL(baseUrl);
        healthUrl = `http://127.0.0.1:${parsed.port || '80'}/health`;
      } catch {
        healthUrl = 'http://127.0.0.1:8080/health';
      }
      let running = false;
      try {
        const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500) });
        running = response.ok;
        await response.body?.cancel().catch(() => undefined);
      } catch {
        running = false;
      }
      res.json({ ok: true, ...installation, running });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось проверить llama-server.' });
    }
  });

  app.get('/api/models/llama-cpp/diagnostics', async (_req, res) => {
    try {
      const manifest = await readAppSettings();
      const settings = manifest?.settings;
      const configuredPath = settings?.appSettings?.llamaServerPath || 'llama-server';
      const [installation, hardware] = await Promise.all([
        getLlamaCppInstallationStatus(configuredPath),
        detectHardware(),
      ]);
      const runtime = getLlamaCppStatus();
      const report = {
        generatedAt: new Date().toISOString(),
        application: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
        },
        llamaServer: installation,
        runtime: {
          status: runtime.status,
          pid: runtime.pid,
          modelId: runtime.modelId,
          modelPath: runtime.modelPath,
          baseUrl: runtime.baseUrl,
          error: runtime.error,
          output: runtime.output,
        },
        hardware,
        operation: getLlamaCppOperationProgress(),
        operationHistory: getLlamaCppOperationHistory(),
      };
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', 'attachment; filename="onecoreai-llama-server-diagnostics.json"');
      res.type('application/json').send(JSON.stringify(report, null, 2));
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Не удалось собрать диагностику llama-server.',
      });
    }
  });

  app.post('/api/models/llama-cpp/archive', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', 'llama-cpp-runtime-archive-install')) return;
    if (['ready', 'loading'].includes(getLlamaCppStatus().status)) {
      res.status(409).json({ ok: false, error: 'Остановите llama-server перед установкой архива.' });
      return;
    }

    const rawName = req.header('X-Archive-Name') || '';
    const fileName = path.basename(rawName);
    if (!/\.(zip|tar\.gz)$/i.test(fileName) || fileName !== rawName) {
      res.status(400).json({ ok: false, error: 'Передайте имя архива с расширением .zip или .tar.gz в заголовке X-Archive-Name.' });
      return;
    }
    const contentLength = Number(req.header('Content-Length') || 0);
    if (contentLength > 2 * 1024 * 1024 * 1024) {
      res.status(413).json({ ok: false, error: 'Размер архива превышает 2 GB.' });
      return;
    }

    const tempBase = process.env.TMPDIR || process.env.TEMP || process.cwd();
    const uploadDir = fs.mkdtempSync(path.join(tempBase, 'onecore-llama-archive-'));
    const archivePath = path.join(uploadDir, fileName);
    const output = fs.createWriteStream(archivePath, { flags: 'wx' });
    let receivedBytes = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const onData = (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (receivedBytes > 2 * 1024 * 1024 * 1024) {
            req.pause();
            req.unpipe(output);
            output.destroy();
            reject(new Error('Размер архива превышает 2 GB.'));
          }
        };
        req.on('data', onData);
        req.once('error', reject);
        output.once('error', reject);
        output.once('finish', resolve);
        req.pipe(output);
      });
      if (receivedBytes === 0) throw new Error('Получен пустой архив.');
      const result = await installLlamaCppArchive(archivePath);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Не удалось загрузить или установить архив llama-server.',
      });
    } finally {
      output.destroy();
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
  });

  app.post('/api/models/llama-cpp/start', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', 'llama-cpp-server')) return;
    updateLlamaCppOperationProgress({ active: true, action: 'start', phase: 'starting', message: 'Запускаю llama-server…', sourcePath: null, targetPath: null, percent: null });
    try {
      const state = await startLlamaCppServer();
      updateLlamaCppOperationProgress({ active: false, action: null, phase: 'completed', message: 'llama-server запущен и отвечает на проверку готовности.' });
      res.json({ ok: true, ...state });
    } catch (err) {
      const state = getLlamaCppStatus();
      updateLlamaCppOperationProgress({ active: false, action: null, phase: 'error', message: err instanceof Error ? err.message : 'Не удалось запустить llama-server.' });
      res.status(400).json({
        ok: false,
        ...state,
        error: err instanceof Error ? err.message : 'Не удалось запустить llama-server.',
      });
    }
  });

  app.post('/api/models/llama-cpp/stop', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', 'llama-cpp-server')) return;
    updateLlamaCppOperationProgress({ active: true, action: 'stop', phase: 'stopping', message: 'Останавливаю llama-server…', percent: null });
    try {
      const state = await stopLlamaCppServer();
      updateLlamaCppOperationProgress({ active: false, action: null, phase: 'completed', message: 'llama-server остановлен.' });
      res.json({ ok: true, ...state });
    } catch (err) {
      updateLlamaCppOperationProgress({ active: false, action: null, phase: 'error', message: err instanceof Error ? err.message : 'Не удалось остановить llama-server.' });
      res.status(500).json({
        ok: false,
        ...getLlamaCppStatus(),
        error: err instanceof Error ? err.message : 'Не удалось остановить llama-server.',
      });
    }
  });

  app.post('/api/models/llama-cpp/download', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', 'llama-cpp-runtime-download')) return;
    if (['ready', 'loading'].includes(getLlamaCppStatus().status)) {
      res.status(409).json({ ok: false, error: 'Остановите llama-server перед заменой архива llama.cpp.' });
      return;
    }
    try {
      const hardware = await detectHardware();
      const result = await downloadLlamaCppRuntime(hardware.gpus.some((gpu) => gpu.vendor === 'nvidia'));
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось скачать llama.cpp.' });
    }
  });

  app.post('/api/models/llama-cpp/download/remove', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', 'llama-cpp-runtime-download-remove')) return;
    try {
      removeDownloadedLlamaCppRuntime();
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось удалить архив llama.cpp.' });
    }
  });

  app.post('/api/models/llama-cpp/uninstall', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', 'llama-cpp-runtime-uninstall')) return;
    if (['ready', 'loading'].includes(getLlamaCppStatus().status)) {
      res.status(409).json({ ok: false, error: 'Сначала остановите llama-server.' });
      return;
    }
    try {
      await uninstallLlamaCppRuntime();
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось удалить установленный runtime.' });
    }
  });

  app.post('/api/models/llama-cpp/install', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', 'llama-cpp-runtime-install')) return;
    if (['ready', 'loading'].includes(getLlamaCppStatus().status)) {
      res.status(409).json({ ok: false, error: 'Остановите llama-server перед установкой runtime.' });
      return;
    }
    try {
      const result = await installLlamaCppRuntime();
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось установить llama.cpp.' });
    }
  });

  app.post('/api/models/download', (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.download', String(req.body?.repoId || req.body?.filename || 'model-download'))) return;
    try {
      const {
        repoId,
        name,
        quant,
        filename,
        downloadUrl,
        sizeGb,
        totalBytes,
        minVramGb,
        minRamGb,
        license,
        expectedSha256,
        targetDir,
      } = req.body ?? {};

      if (!downloadUrl || typeof downloadUrl !== 'string') {
        res.status(400).json({ ok: false, error: 'Не указан downloadUrl для скачивания модели' });
        return;
      }

      const record = startModelDownload({
        repoId: typeof repoId === 'string' && repoId ? repoId : `direct/${filename || 'model.gguf'}`,
        name: typeof name === 'string' && name ? name : filename || 'GGUF Model',
        quant: typeof quant === 'string' ? quant : 'GGUF',
        filename: typeof filename === 'string' && filename ? filename : 'model.gguf',
        downloadUrl,
        sizeGb: typeof sizeGb === 'number' ? sizeGb : undefined,
        totalBytes: typeof totalBytes === 'number' ? totalBytes : undefined,
        minVramGb: typeof minVramGb === 'number' ? minVramGb : undefined,
        minRamGb: typeof minRamGb === 'number' ? minRamGb : undefined,
        license: typeof license === 'string' ? license : 'open-weights',
        expectedSha256: typeof expectedSha256 === 'string' ? expectedSha256 : null,
        targetDir: typeof targetDir === 'string' ? targetDir : undefined,
      });

      res.status(202).json({ ok: true, model: record });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка запуска загрузки' });
    }
  });

  app.post('/api/models/download/:id/pause', (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', req.params.id)) return;
    const model = pauseModelDownload(req.params.id);
    if (!model) {
      res.status(404).json({ ok: false, error: 'Загрузка не найдена' });
      return;
    }
    res.json({ ok: true, model });
  });

  app.post('/api/models/download/:id/resume', (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', req.params.id)) return;
    const model = resumeModelDownload(req.params.id);
    if (!model) {
      res.status(404).json({ ok: false, error: 'Модель не найдена' });
      return;
    }
    res.json({ ok: true, model });
  });

  app.post('/api/models/ollama/pull', (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.download', String(req.body?.modelName || 'ollama-pull'))) return;
    try {
      const modelName = typeof req.body?.modelName === 'string' ? req.body.modelName : '';
      const ollamaUrl = typeof req.body?.ollamaUrl === 'string' ? req.body.ollamaUrl : undefined;
      const model = startOllamaModelPull({ modelName, ollamaUrl });
      res.status(202).json({ ok: true, model });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка Ollama pull' });
    }
  });

  app.post('/api/models/import', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', String(req.body?.filePath || 'model-import'))) return;
    try {
      const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath : '';
      const model = await importLocalModelFile(filePath);
      res.json({ ok: true, model });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка импорта файла' });
    }
  });

  app.post('/api/models/local/:id/activate', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', req.params.id)) return;
    const previousActiveModelId = listLocalModels().activeModelId;
    const result = activateLocalModel(req.params.id);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    const runtime = getLlamaCppStatus();
    if (runtime.modelId && runtime.modelId !== req.params.id && runtime.status !== 'stopped') {
      try {
        await stopLlamaCppServer();
      } catch (error) {
        if (previousActiveModelId) activateLocalModel(previousActiveModelId);
        res.status(500).json({
          ok: false,
          error: error instanceof Error ? error.message : 'Не удалось остановить текущий llama-server.',
        });
        return;
      }
    }
    res.json(result);
  });

  app.delete('/api/models/local/:id', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'model.manage', req.params.id)) return;
    const runtime = getLlamaCppStatus();
    if (runtime.modelId === req.params.id && runtime.status !== 'stopped') {
      try {
        await stopLlamaCppServer();
      } catch (error) {
        res.status(500).json({
          ok: false,
          error: error instanceof Error ? error.message : 'Не удалось остановить текущий llama-server.',
        });
        return;
      }
    }
    try {
      const result = deleteLocalModel(req.params.id);
      res.json({ ok: result.deleted, ...result });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Не удалось удалить модель.',
      });
    }
  });

  // =========================================================================
  // 3. Hugging Face Search & Model File Blobs Proxy (§1 & §2)
  // =========================================================================
  app.get('/api/hf/models', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filterMode = typeof req.query.mode === 'string' ? req.query.mode : 'llama.cpp';
    const rawSort = typeof req.query.sort === 'string' ? req.query.sort : 'downloads';
    const sortBy = ['downloads', 'likes', 'lastModified'].includes(rawSort) ? rawSort : 'downloads';
    const cacheKey = `${filterMode}::${sortBy}::${q.toLowerCase()}`;

    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      res.json(cached.data);
      return;
    }

    try {
      const url = new URL('https://huggingface.co/api/models');
      if (filterMode === 'llama.cpp') {
        url.searchParams.set('apps', 'llama.cpp');
      } else {
        url.searchParams.set('filter', 'gguf');
      }
      url.searchParams.set('sort', sortBy);
      url.searchParams.set('direction', '-1');
      url.searchParams.set('limit', '24');
      url.searchParams.set('search', q || 'coder gguf');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'ONECOREAI/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Hugging Face API returned ${response.status}`);
      }

      const rawModels = (await response.json()) as HFModelRaw[];
      const normalized = rawModels
        .filter((m) => m.id)
        .slice(0, 24)
        .map((m) => {
          const paramsB = estimateParamsBillions(m.id);
          const estQ4SizeGb = Number((paramsB * 0.62 + 0.4).toFixed(1));
          const estVramGb = Number((estQ4SizeGb + 1.1).toFixed(1));
          const estRamGb = Number((estVramGb + 2.0).toFixed(1));
          const author = m.author || m.id.split('/')[0] || 'community';
          const name = m.id.includes('/') ? m.id.split('/')[1] : m.id;

          return {
            id: m.id,
            repoId: m.id,
            name,
            author,
            downloads: m.downloads ?? 0,
            likes: m.likes ?? 0,
            license: extractLicense(m.tags),
            lastModified: m.lastModified ?? new Date().toISOString(),
            tags: (m.tags ?? []).slice(0, 8),
            quantizations: inferQuantizations(m.tags, m.id),
            defaultQuant: 'Q4_K_M',
            sizeGb: estQ4SizeGb,
            minVramGb: estVramGb,
            minRamGb: estRamGb,
            source: 'huggingface' as const,
            url: `https://huggingface.co/${m.id}`,
          };
        });

      const payload = {
        source: 'huggingface-live',
        query: q,
        count: normalized.length,
        models: normalized,
      };
      searchCache.set(cacheKey, { ts: Date.now(), data: payload });
      res.json(payload);
    } catch (err) {
      res.status(502).json({
        source: 'huggingface-error',
        error: err instanceof Error ? err.message : 'Network error',
        models: [],
      });
    }
  });

  app.get('/api/hf/model', async (req, res) => {
    const repoId = typeof req.query.repoId === 'string' ? req.query.repoId.trim() : '';
    if (!repoId || !repoId.includes('/')) {
      res.status(400).json({ error: 'Valid repoId (owner/model) is required' });
      return;
    }

    const cached = detailCache.get(repoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      res.json(cached.data);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const encodedRepo = repoId.split('/').map((s) => encodeURIComponent(s)).join('/');

      const response = await fetch(`https://huggingface.co/api/models/${encodedRepo}?blobs=true`, {
        headers: { Accept: 'application/json', 'User-Agent': 'ONECOREAI/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Hugging Face model API returned ${response.status}`);
      }

      const raw = (await response.json()) as HFModelDetailRaw;
      const ggufFiles = (raw.siblings ?? [])
        .filter((s) => s.rfilename.toLowerCase().endsWith('.gguf'))
        .map((s) => {
          const bytes = s.lfs?.size ?? s.size ?? 0;
          const sizeGb = Number((bytes / (1024 * 1024 * 1024)).toFixed(2));
          const quantMatch = s.rfilename.match(/(Q\d_[A-Z0-9_]+|IQ\d_[A-Z0-9_]+|F16|BF16)/i);
          return {
            filename: s.rfilename,
            quant: quantMatch ? quantMatch[1].toUpperCase() : 'GGUF',
            sizeBytes: bytes,
            sizeGb,
            sha256: s.lfs?.sha256 ?? null,
            downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${s.rfilename}`,
          };
        })
        .sort((a, b) => a.sizeBytes - b.sizeBytes);

      const payload = {
        repoId: raw.id,
        license: extractLicense(raw.tags, raw.cardData?.license),
        downloads: raw.downloads ?? 0,
        likes: raw.likes ?? 0,
        files: ggufFiles,
      };
      detailCache.set(repoId, { ts: Date.now(), data: payload });
      res.json(payload);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Network error', files: [] });
    }
  });

  // =========================================================================
  // 4. Filesystem Directory Browser & Native Folder Picker (§4.2)
  // =========================================================================
  app.get('/api/fs/browse', async (req, res) => {
    try {
      const dir = typeof req.query.path === 'string' ? req.query.path : undefined;
      const result = await browseDirectory(dir);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка обзора папок' });
    }
  });

  app.post('/api/fs/mkdir', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'filesystem.create-directory', String(req.body?.parentDir || '') + '/' + String(req.body?.name || ''))) return;
    try {
      const parentDir = typeof req.body?.parentDir === 'string' ? req.body.parentDir : '';
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      const created = await createDirectory(parentDir, name);
      res.json({ ok: true, ...created });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка создания папки' });
    }
  });

  app.post('/api/fs/pick-native', async (_req, res) => {
    const result = await tryNativeFolderPicker();
    res.json(result);
  });

  // =========================================================================
  // 5. Real Projects CRUD & Real Workspace Operations (§3 & §4)
  // =========================================================================
  app.get('/api/projects', (_req, res) => {
    res.json({ ok: true, ...listProjects() });
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const project = await createOrUpdateProject(req.body ?? {});
      recordProjectMemory(project.id, 'Проект создан');
      res.status(201).json({ ok: true, project });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка сохранения проекта' });
    }
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const project = await createOrUpdateProject({ ...(req.body ?? {}), id: req.params.id });
      recordProjectMemory(project.id, 'Настройки проекта обновлены');
      res.json({ ok: true, project });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка обновления проекта' });
    }
  });

  app.post('/api/projects/activate', (req, res) => {
    try {
      const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : '';
      const result = setActiveProjectId(projectId);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка выбора проекта' });
    }
  });

  app.post('/api/projects/:id/activate', (req, res) => {
    try {
      const result = setActiveProjectId(req.params.id);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(404).json({ ok: false, error: err instanceof Error ? err.message : 'Проект не найден' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'project.delete', req.params.id)) return;
    const result = await deleteProjectRecord(req.params.id);
    if (result.deleted) {
      deleteProjectActionLog(req.params.id);
      deleteAgentJournalEventsForProject(req.params.id);
      await flushAgentJournal();
    }
    res.json({ ok: result.deleted, ...result });
  });

  app.get('/api/projects/:id/workspace', (req, res) => {
    try {
      res.json({ ok: true, workspace: getProjectWorkspaceData(req.params.id) });
    } catch (err) {
      res.status(404).json({ ok: false, error: err instanceof Error ? err.message : 'Проект не найден' });
    }
  });

  app.get('/api/tasks', (_req, res) => {
    try {
      const projects = listProjects().projects;
      const tasks = projects.flatMap((project) =>
        getProjectWorkspaceData(project.id).tasks.map((task) => ({
          ...task,
          projectId: project.id,
          projectName: project.name,
        })),
      );
      res.json({ ok: true, tasks });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения задач' });
    }
  });

  app.get('/api/project-history', (_req, res) => {
    try {
      const projects = listProjects().projects;
      const entries = projects.flatMap((project) =>
        readProjectActionLog(project.id).map((entry) => ({ ...entry, projectName: project.name })),
      ).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
      res.json({ ok: true, entries });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения истории проектов' });
    }
  });

  app.post('/api/projects/:id/tasks', (req, res) => {
    try {
      const task = saveProjectTask(req.params.id, req.body ?? {});
      recordProjectMemory(req.params.id, `Добавлена задача: ${task.title}`);
      res.status(201).json({ ok: true, task, workspace: getProjectWorkspaceData(req.params.id) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка сохранения задачи' });
    }
  });

  app.put('/api/projects/:id/tasks/:taskId', (req, res) => {
    try {
      const task = saveProjectTask(req.params.id, { ...(req.body ?? {}), id: req.params.taskId });
      recordProjectMemory(req.params.id, `Изменена задача: ${task.title}`);
      res.json({ ok: true, task, workspace: getProjectWorkspaceData(req.params.id) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка обновления задачи' });
    }
  });

  app.delete('/api/projects/:id/tasks/:taskId', (req, res) => {
    try {
      const currentTask = getProjectWorkspaceData(req.params.id).tasks.find(
        (task) => task.id === req.params.taskId,
      );
      if (!currentTask) throw new Error('Задача проекта не найдена');
      const workspace = deleteProjectTask(req.params.id, req.params.taskId);
      recordProjectMemory(req.params.id, `Удалена задача: ${currentTask.title}`);
      res.json({ ok: true, workspace });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка удаления задачи' });
    }
  });

  app.put('/api/projects/:id/plan', (req, res) => {
    try {
      const hadPlan = Boolean(getProjectWorkspaceData(req.params.id).plan);
      const workspace = saveProjectPlan(req.params.id, req.body ?? {});
      recordProjectPlanMemory(req.params.id, `${hadPlan ? 'План проекта обновлён' : 'План проекта создан'} (${workspace.plan?.progress ?? 0}% выполнено)`);
      res.json({ ok: true, workspace });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка сохранения плана' });
    }
  });

  app.delete('/api/projects/:id/plan', (req, res) => {
    try {
      const workspace = saveProjectPlan(req.params.id, null);
      recordProjectPlanMemory(req.params.id, 'План проекта удалён');
      res.json({ ok: true, workspace });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка удаления плана' });
    }
  });

  app.get('/api/projects/:id/files', (req, res) => {
    if (!isProjectToolAllowed(req.params.id, 'read_file')) {
      res.status(403).json({ ok: false, error: 'Чтение файлов отключено в разрешениях проекта' });
      return;
    }
    try {
      const files = listProjectFiles(req.params.id);
      res.json({ ok: true, files });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка списка файлов' });
    }
  });

  app.get('/api/projects/:id/file', (req, res) => {
    if (!isProjectToolAllowed(req.params.id, 'read_file')) {
      res.status(403).json({ ok: false, error: 'Чтение файлов отключено в разрешениях проекта' });
      return;
    }
    try {
      const relPath = typeof req.query.path === 'string' ? req.query.path : '';
      const file = readProjectFile(req.params.id, relPath);
      res.json({ ok: true, ...file });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения файла' });
    }
  });

  app.put('/api/projects/:id/file', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'project.file.write', req.params.id)) return;
    if (!isProjectToolAllowed(req.params.id, 'write_file')) {
      res.status(403).json({ ok: false, error: 'Запись файлов отключена в разрешениях проекта' });
      return;
    }
    try {
      assertProjectToolAllowed(req.params.id, 'write_file');
      const filePath = typeof req.body?.path === 'string' ? req.body.path : '';
      const content = typeof req.body?.content === 'string' ? req.body.content : '';
      const summary = typeof req.body?.summary === 'string' ? req.body.summary : undefined;
      await runLifecycleHooks({ event: 'pre_file_write', projectId: req.params.id, signal: res.locals.operationSignal as AbortSignal | undefined });
      const result = writeProjectFile(req.params.id, filePath, content, summary);
      const hookOutcomes = await runLifecycleHooks({ event: 'post_file_write', projectId: req.params.id, signal: res.locals.operationSignal as AbortSignal | undefined });
      res.json({ ok: true, ...result, ...(hookOutcomes.length > 0 ? { hookOutcomes } : {}) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка записи файла' });
    }
  });

  app.get('/api/projects/:id/models/memory', (req, res) => {
    try {
      const project = getProjectById(req.params.id);
      if (!project || !project.folderPath || !fs.existsSync(project.folderPath)) {
        res.status(404).json({ ok: false, error: 'Проект или его папка не найдены' });
        return;
      }
      const memoryFullPath = safeResolveInside(project.folderPath, 'MEMORY.md');
      if (!fs.existsSync(memoryFullPath) || !fs.statSync(memoryFullPath).isFile()) {
        res.json({ ok: true, memoryExists: false, registeredPaths: [] });
        return;
      }
      const content = fs.readFileSync(memoryFullPath, 'utf-8');
      const registeredPaths: string[] = [];
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim().startsWith('- ')) continue;
        const match = line.match(/`([^`]+\.(?:gguf|safetensors))`/i);
        if (match?.[1]) registeredPaths.push(match[1]);
      }
      res.json({ ok: true, memoryExists: true, registeredPaths });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения памяти проекта' });
    }
  });

  app.post('/api/projects/:id/models/memory', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'project.file.write', req.params.id)) return;
    if (!isProjectToolAllowed(req.params.id, 'write_file')) {
      res.status(403).json({ ok: false, error: 'Запись файлов отключена в разрешениях проекта' });
      return;
    }
    try {
      assertProjectToolAllowed(req.params.id, 'write_file');
      const project = getProjectById(req.params.id);
      if (!project || !project.folderPath || !fs.existsSync(project.folderPath)) {
        res.status(404).json({ ok: false, error: 'Проект или его папка не найдены' });
        return;
      }

      const modelId = typeof req.body?.modelId === 'string' ? req.body.modelId.trim() : '';
      const model = modelId ? getLocalModel(modelId) : null;
      if (!model) {
        res.status(404).json({ ok: false, error: 'Модель не найдена в локальной библиотеке' });
        return;
      }
      if (model.status !== 'ready') {
        res.status(400).json({ ok: false, error: 'В память проекта можно добавить только полностью готовую модель' });
        return;
      }

      const memoryFullPath = safeResolveInside(project.folderPath, 'MEMORY.md');
      const existingContent = fs.existsSync(memoryFullPath) && fs.statSync(memoryFullPath).isFile()
        ? fs.readFileSync(memoryFullPath, 'utf-8')
        : `# Память проекта ${project.name}\n`;

      const dateTag = new Date().toISOString().slice(0, 10);
      const shaLabel = model.computedSha256 ? ` · SHA256 ${model.computedSha256.slice(0, 12)}` : '';
      const entryLine = `- **${model.name}** (${model.quant}, ${model.sizeGb} GB) — \`${model.localPath}\` · VRAM ≥ ${model.minVramGb} GB · RAM ≥ ${model.minRamGb} GB${shaLabel} · добавлена ${dateTag}`;
      const sectionHeader = '## Установленные GGUF модели';

      const lines = existingContent.split(/\r?\n/);
      const filteredLines = lines.filter((line) => !line.includes(`\`${model.localPath}\``));
      const headerIdx = filteredLines.findIndex((line) => line.trim() === sectionHeader);

      let nextContent: string;
      if (headerIdx >= 0) {
        let insertAt = headerIdx + 1;
        while (insertAt < filteredLines.length && !filteredLines[insertAt].startsWith('## ')) {
          insertAt += 1;
        }
        while (insertAt > headerIdx + 1 && filteredLines[insertAt - 1].trim() === '') {
          insertAt -= 1;
        }
        filteredLines.splice(insertAt, 0, entryLine);
        nextContent = `${filteredLines.join('\n').trimEnd()}\n`;
      } else {
        const base = filteredLines.join('\n').trimEnd();
        nextContent = `${base ? `${base}\n\n` : ''}${sectionHeader}\n\n${entryLine}\n`;
      }

      await runLifecycleHooks({ event: 'pre_file_write', projectId: req.params.id, signal: res.locals.operationSignal as AbortSignal | undefined });
      const result = writeProjectFile(
        req.params.id,
        'MEMORY.md',
        nextContent,
        `Установка GGUF модели в память проекта: ${model.name} (${model.quant})`,
      );
      recordProjectMemory(req.params.id, `Модель ${model.name} (${model.quant}) записана в MEMORY.md`);
      await runLifecycleHooks({ event: 'post_file_write', projectId: req.params.id, signal: res.locals.operationSignal as AbortSignal | undefined });

      const registeredPaths: string[] = [];
      for (const line of nextContent.split(/\r?\n/)) {
        if (!line.trim().startsWith('- ')) continue;
        const match = line.match(/`([^`]+\.(?:gguf|safetensors))`/i);
        if (match?.[1]) registeredPaths.push(match[1]);
      }

      res.json({ ok: true, ...result, registeredPaths });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка записи модели в память проекта' });
    }
  });

  app.delete('/api/projects/:id/models/memory', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'project.file.write', req.params.id)) return;
    if (!isProjectToolAllowed(req.params.id, 'write_file')) {
      res.status(403).json({ ok: false, error: 'Запись файлов отключена в разрешениях проекта' });
      return;
    }
    try {
      assertProjectToolAllowed(req.params.id, 'write_file');
      const project = getProjectById(req.params.id);
      if (!project || !project.folderPath || !fs.existsSync(project.folderPath)) {
        res.status(404).json({ ok: false, error: 'Проект или его папка не найдены' });
        return;
      }
      const localPath = typeof req.body?.localPath === 'string' ? req.body.localPath.trim() : '';
      if (!localPath) {
        res.status(400).json({ ok: false, error: 'Укажите localPath модели для удаления из памяти проекта' });
        return;
      }
      const memoryFullPath = safeResolveInside(project.folderPath, 'MEMORY.md');
      if (!fs.existsSync(memoryFullPath)) {
        res.json({ ok: true, registeredPaths: [] });
        return;
      }
      const current = fs.readFileSync(memoryFullPath, 'utf-8');
      const nextLines = current.split(/\r?\n/).filter((line) => !line.includes(`\`${localPath}\``));
      const nextContent = `${nextLines.join('\n').trimEnd()}\n`;
      writeProjectFile(req.params.id, 'MEMORY.md', nextContent, `Удаление модели из памяти проекта: ${path.basename(localPath)}`);
      const registeredPaths: string[] = [];
      for (const line of nextContent.split(/\r?\n/)) {
        if (!line.trim().startsWith('- ')) continue;
        const match = line.match(/`([^`]+\.(?:gguf|safetensors))`/i);
        if (match?.[1]) registeredPaths.push(match[1]);
      }
      res.json({ ok: true, registeredPaths });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка обновления памяти проекта' });
    }
  });

  app.get('/api/projects/:id/search', (req, res) => {
    if (!isProjectToolAllowed(req.params.id, 'search_code')) {
      res.status(403).json({ ok: false, error: 'Поиск по коду отключён в разрешениях проекта' });
      return;
    }
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const matches = searchProjectCode(req.params.id, q);
      res.json({ ok: true, matches });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка поиска по коду' });
    }
  });

  app.post('/api/projects/:id/exec', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'project.terminal', req.params.id)) return;
    if (!isProjectToolAllowed(req.params.id, 'run_command')) {
      res.status(403).json({ ok: false, error: 'Выполнение команд отключено в разрешениях проекта' });
      return;
    }
    try {
      assertProjectToolAllowed(req.params.id, 'run_command');
      const command = typeof req.body?.command === 'string' ? req.body.command : '';
      const timeoutMs = typeof req.body?.timeoutMs === 'number' ? req.body.timeoutMs : 30000;
      const signal = res.locals.operationSignal as AbortSignal | undefined;
      await runLifecycleHooks({ event: 'pre_command', projectId: req.params.id, signal });
      const result = await execProjectCommand(req.params.id, command, timeoutMs, signal);
      const hookOutcomes = await runLifecycleHooks({ event: 'post_command', projectId: req.params.id, signal });
      res.json({ ok: result.exitCode === 0, ...result, ...(hookOutcomes.length > 0 ? { hookOutcomes } : {}) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка выполнения команды' });
    }
  });

  app.post('/api/projects/:id/git', async (req, res) => {
    try {
      const action = req.body?.action;
      const allowedActions = ['status', 'diff', 'log', 'commit', 'fetch', 'push', 'init'];
      if (typeof action !== 'string' || !allowedActions.includes(action)) {
        res.status(400).json({ ok: false, error: 'Неизвестная операция Git' });
        return;
      }
      if (!isProjectToolAllowed(req.params.id, 'git')) {
        res.status(403).json({ ok: false, error: 'Git отключён в разрешениях проекта' });
        return;
      }
      if (['commit', 'fetch', 'push', 'init'].includes(action) && !requireSideEffectApproval(req, res, 'project.git.mutate', req.params.id)) return;
      assertProjectToolAllowed(req.params.id, 'git');
      const commitMessage = typeof req.body?.message === 'string' ? req.body.message : undefined;
      const result = await runProjectGit(req.params.id, action as 'status' | 'diff' | 'log' | 'commit' | 'fetch' | 'push' | 'init', commitMessage);
      res.json({ ok: result.exitCode === 0, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка git' });
    }
  });

  app.get('/api/projects/:id/logs', (req, res) => {
    try {
      const logs = readProjectActionLog(req.params.id);
      res.json({ ok: true, logs });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения лога' });
    }
  });

  app.post('/api/projects/:id/undo', (req, res) => {
    if (!requireSideEffectApproval(req, res, 'project.undo', req.params.id)) return;
    if (!isProjectToolAllowed(req.params.id, 'write_file')) {
      res.status(403).json({ ok: false, error: 'Откат файлов отключён в разрешениях проекта' });
      return;
    }
    try {
      const result = undoLastProjectAction(req.params.id);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(400).json({ ok: false, message: err instanceof Error ? err.message : 'Ошибка отката' });
    }
  });

  app.post('/api/projects/:id/task', async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (prompt === '/undo' && !requireSideEffectApproval(req, res, 'project.undo', req.params.id)) return;
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
      const mode = req.body?.mode === 'plan' ? 'plan' : 'act';
      const provider = req.body?.provider;
      const providerConnection = provider && typeof provider.providerId === 'string'
        ? await getProviderConnection(provider.providerId, provider.credentialScope === 'subagent' ? 'subagent' : 'primary', typeof provider.roleId === 'string' ? provider.roleId : undefined)
        : null;
      if (mode === 'plan' && provider && providerConnection && typeof provider.model === 'string') {
        const systemConfig = normalizeSystemConfig((await readAppSettings())?.settings.systemConfig);
        const controller = new AbortController();
        const operationSignal = res.locals.operationSignal as AbortSignal | undefined;
        const requestSignal = operationSignal ? AbortSignal.any([controller.signal, operationSignal]) : controller.signal;
        const timeout = setTimeout(
          () => controller.abort(new Error('Превышено время анализа проекта.')),
          systemConfig.agentOperationTimeoutMs,
        );
        res.on('close', () => {
          if (!res.writableEnded) controller.abort(new Error('Клиент отменил анализ проекта.'));
        });
        try {
          const agentResult = await executeGeneralAgentTask({
            projectId: req.params.id,
            knowledgeRoot: path.join(rootDir, 'docs', 'knowledge'),
            provider: {
              baseUrl: providerConnection.baseUrl,
              apiKey: providerConnection.apiKey ?? undefined,
              model: provider.model,
              temperature: typeof provider.temperature === 'number' ? provider.temperature : 0.2,
            },
            messages: [
              {
                role: 'system',
                content: typeof provider.systemPrompt === 'string'
                  ? provider.systemPrompt
                  : 'Ты инженерный агент ONE CORE AI. Выполни read-only анализ проекта и подготовь структурированный отчёт.',
              },
              { role: 'user', content: prompt },
            ],
            signal: requestSignal,
            onToolCall: (name, status, summary, trace) => {
              recordAgentEvent({
                category: 'tool',
                level: status === 'failed' ? 'error' : status === 'cancelled' ? 'warning' : 'info',
                status: status === 'running' ? 'running' : status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'completed',
                title: name,
                summary,
                source: 'project-agent-orchestrator',
                projectId: req.params.id,
                details: { tool: name },
                trace,
              });
            },
            onTrace: (trace, status, summary) => {
              recordAgentEvent({
                category: trace.actorType === 'model' ? 'model' : 'agent',
                level: status === 'failed' ? 'error' : status === 'cancelled' ? 'warning' : 'info',
                status: status === 'running' ? 'running' : status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'completed',
                title: trace.stageLabel,
                summary,
                source: 'project-agent-orchestrator',
                projectId: req.params.id,
                trace,
              });
            },
          });
          if (!res.destroyed) {
            res.json({
              ok: true,
              replyText: agentResult.content,
              readFiles: agentResult.readFiles,
              usedLiveLlm: true,
            });
          }
        } catch (err) {
          if (res.destroyed) return;
          const errorMessage = requestSignal.aborted && requestSignal.reason instanceof Error
            ? requestSignal.reason.message
            : err instanceof Error
              ? err.message
              : 'Ошибка анализа проекта';
          res.status(requestSignal.aborted ? 504 : 502).json({ ok: false, error: errorMessage });
        } finally {
          clearTimeout(timeout);
        }
        return;
      }

      const result = await executeProjectTask({
        projectId: req.params.id,
        prompt,
        mode,
        provider,
        signal: res.locals.operationSignal as AbortSignal | undefined,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка выполнения задачи' });
    }
  });

  app.get('/api/browser/search', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'browser.network', String(req.query.q || 'web-search'))) return;
    try {
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await searchPublicWeb(query);
      res.json({ ok: true, results });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Ошибка поиска в интернете',
      });
    }
  });

  app.get('/api/browser/read', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'browser.network', String(req.query.url || 'web-read'))) return;
    try {
      const url = typeof req.query.url === 'string' ? req.query.url : '';
      const page = await readPublicWebPage(url);
      res.json({ ok: true, page });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Ошибка чтения веб-страницы',
      });
    }
  });

  // =========================================================================
  // 6. Real SSH Host Test (§4.2) & GitHub Verification
  // =========================================================================
  app.post('/api/ssh/test', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'ssh.connect', String(req.body?.hostName || req.body?.host || 'ssh-host'))) return;
    const result = await verifySshConnectionAndPath({
      host: String(req.body?.hostName || req.body?.host || ''),
      port: Number(req.body?.port || 22),
      user: String(req.body?.user || ''),
      remotePath: String(req.body?.remotePath || '/tmp'),
      authType: req.body?.authType || 'key',
      keyPath: typeof req.body?.identityFile === 'string' ? req.body.identityFile : undefined,
    });
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.get('/install.ps1', async (_req, res) => {
    try {
      const scriptPath = path.resolve(rootDir, 'scripts', 'install.ps1');
      const content = fs.readFileSync(scriptPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="install-onecore-ai.ps1"');
      res.send(content);
    } catch {
      res.status(404).send('# install.ps1 not found');
    }
  });

  app.post('/api/github/verify', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'github.verify', String(req.body?.repo || 'github-repository'))) return;
    const rawRepo = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
    const token = await getIntegrationSecret('github') ?? '';

    const cleanRepo = rawRepo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    if (!cleanRepo || !cleanRepo.includes('/')) {
      res.status(400).json({ ok: false, error: 'Укажите репозиторий в формате owner/repo' });
      return;
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ONECOREAI/1.0',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);

      let authUser: string | null = null;
      let grantedScopes: string[] = [];

      if (token) {
        const userResp = await fetch('https://api.github.com/user', { headers, signal: controller.signal });
        if (!userResp.ok) {
          clearTimeout(timeout);
          res.status(userResp.status).json({
            ok: false,
            error: `Токен отклонён GitHub API (HTTP ${userResp.status})`,
          });
          return;
        }
        const userData = (await userResp.json()) as { login?: string };
        authUser = userData.login ?? null;
        const rawScopes = userResp.headers.get('x-oauth-scopes') || '';
        grantedScopes = rawScopes.split(',').map((s) => s.trim()).filter(Boolean);
      }

      const [owner, repoName] = cleanRepo.split('/');
      const repoResp = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
        { headers, signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!repoResp.ok) {
        res.status(repoResp.status).json({
          ok: false,
          authUser,
          grantedScopes,
          error:
            repoResp.status === 404
              ? `Репозиторий ${cleanRepo} не найден или приватный (нужен токен / SSH)`
              : `GitHub API вернул HTTP ${repoResp.status}`,
        });
        return;
      }

      const repoData = (await repoResp.json()) as {
        full_name?: string;
        private?: boolean;
        default_branch?: string;
        stargazers_count?: number;
      };

      res.json({
        ok: true,
        authUser,
        grantedScopes,
        repo: {
          fullName: repoData.full_name ?? cleanRepo,
          isPrivate: Boolean(repoData.private),
          defaultBranch: repoData.default_branch ?? 'main',
          stars: repoData.stargazers_count ?? 0,
        },
      });
    } catch (err) {
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  });

  app.get('/api/repo-sync/config', async (req, res) => {
    try {
      const targetType: RepoSyncTargetType = req.query.targetType === 'project' ? 'project' : 'app';
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      const config = await getRepoSyncConfig(rootDir, { targetType, projectId });
      res.json({ ok: true, config });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось прочитать настройки синхронизации' });
    }
  });

  app.put('/api/repo-sync/config', async (req, res) => {
    try {
      const targetType: RepoSyncTargetType = req.body?.targetType === 'project' ? 'project' : 'app';
      const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
      const repo = typeof req.body?.repo === 'string' ? req.body.repo : '';
      const branch = typeof req.body?.branch === 'string' ? req.body.branch : 'main';
      const authMethod: RepoSyncAuthMethod =
        req.body?.authMethod === 'ssh' || req.body?.authMethod === 'public' || req.body?.authMethod === 'pat'
          ? req.body.authMethod
          : 'pat';
      const config = await saveRepoSyncConfig(rootDir, {
        targetType,
        projectId,
        repo,
        branch,
        authMethod,
        gitUserName: typeof req.body?.gitUserName === 'string' ? req.body.gitUserName : undefined,
        gitUserEmail: typeof req.body?.gitUserEmail === 'string' ? req.body.gitUserEmail : undefined,
        token: typeof req.body?.token === 'string' ? req.body.token : undefined,
        clearToken: req.body?.clearToken === true,
      });
      res.json({ ok: true, config });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить настройки синхронизации' });
    }
  });

  app.post('/api/repo-sync/check', async (req, res) => {
    const targetType: RepoSyncTargetType = req.body?.targetType === 'project' ? 'project' : 'app';
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
    if (!requireSideEffectApproval(req, res, 'github.verify', projectId || 'app-repo-sync')) return;
    try {
      const diff = await checkRepoSyncDiff(rootDir, {
        targetType,
        projectId,
        repo: typeof req.body?.repo === 'string' ? req.body.repo : undefined,
        branch: typeof req.body?.branch === 'string' ? req.body.branch : undefined,
        authMethod:
          req.body?.authMethod === 'ssh' || req.body?.authMethod === 'public' || req.body?.authMethod === 'pat'
            ? req.body.authMethod
            : undefined,
      });
      res.json({ ok: true, diff });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка проверки различий с GitHub' });
    }
  });

  app.post('/api/repo-sync/pull', async (req, res) => {
    const targetType: RepoSyncTargetType = req.body?.targetType === 'project' ? 'project' : 'app';
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
    if (!requireSideEffectApproval(req, res, 'project.git.mutate', projectId || 'app-repo-sync')) return;
    try {
      const strategy: RepoPullStrategy =
        req.body?.strategy === 'rebase-stash' || req.body?.strategy === 'overwrite-from-remote'
          ? req.body.strategy
          : 'ff-only';
      const result = await pullFromGitHub(rootDir, {
        targetType,
        projectId,
        repo: typeof req.body?.repo === 'string' ? req.body.repo : undefined,
        branch: typeof req.body?.branch === 'string' ? req.body.branch : undefined,
        authMethod:
          req.body?.authMethod === 'ssh' || req.body?.authMethod === 'public' || req.body?.authMethod === 'pat'
            ? req.body.authMethod
            : undefined,
        strategy,
        gitUserName: typeof req.body?.gitUserName === 'string' ? req.body.gitUserName : undefined,
        gitUserEmail: typeof req.body?.gitUserEmail === 'string' ? req.body.gitUserEmail : undefined,
      });
      res.status(result.ok ? 200 : 409).json(result);
    } catch (err) {
      res.status(400).json({ ok: false, action: 'pull', message: err instanceof Error ? err.message : 'Ошибка обновления с GitHub' });
    }
  });

  app.post('/api/repo-sync/push', async (req, res) => {
    const targetType: RepoSyncTargetType = req.body?.targetType === 'project' ? 'project' : 'app';
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
    if (!requireSideEffectApproval(req, res, 'project.git.mutate', projectId || 'app-repo-sync')) return;
    try {
      const result = await pushToGitHub(rootDir, {
        targetType,
        projectId,
        repo: typeof req.body?.repo === 'string' ? req.body.repo : undefined,
        branch: typeof req.body?.branch === 'string' ? req.body.branch : undefined,
        authMethod:
          req.body?.authMethod === 'ssh' || req.body?.authMethod === 'public' || req.body?.authMethod === 'pat'
            ? req.body.authMethod
            : undefined,
        gitUserName: typeof req.body?.gitUserName === 'string' ? req.body.gitUserName : undefined,
        gitUserEmail: typeof req.body?.gitUserEmail === 'string' ? req.body.gitUserEmail : undefined,
        commitMessage: typeof req.body?.commitMessage === 'string' ? req.body.commitMessage : undefined,
        forcePush: req.body?.forcePush === true,
      });
      res.status(result.ok ? 200 : 409).json(result);
    } catch (err) {
      res.status(400).json({ ok: false, action: 'push', message: err instanceof Error ? err.message : 'Ошибка выгрузки на GitHub' });
    }
  });

  // =========================================================================
  // 7. Free AI Providers Proxy & Telegram Bot Verify
  // =========================================================================
  app.post('/api/providers/models', async (req, res) => {
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : 'custom';

    if (kind === 'llama-cpp') {
      try {
        const state = await scanLocalModels();
        const models = state.models
          .filter((model) => {
            if (model.status !== 'ready' || path.extname(model.localPath).toLowerCase() !== '.gguf') return false;
            const relativePath = path.relative(state.modelsDir, model.localPath);
            if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(model.localPath)) return false;
            const fd = fs.openSync(model.localPath, 'r');
            const magic = Buffer.alloc(4);
            try {
              return fs.readSync(fd, magic, 0, magic.length, 0) === magic.length
                && magic.toString('ascii') === 'GGUF';
            } finally {
              fs.closeSync(fd);
            }
          })
          .map((model) => path.relative(state.modelsDir, model.localPath).split(path.sep).join('/'))
          .sort((left, right) => left.localeCompare(right));
        res.json({ ok: true, count: models.length, models });
      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Не удалось прочитать каталог GGUF-моделей',
          models: [],
        });
      }
      return;
    }
    const providerConnection = await getProviderConnection(typeof req.body?.providerId === 'string' ? req.body.providerId : '', 'primary');
    const rawBaseUrl = providerConnection?.baseUrl ?? '';
    const apiKey = providerConnection?.apiKey ?? '';

    if (!rawBaseUrl) {
      res.status(400).json({ ok: false, error: 'Не указан baseUrl провайдера', models: [] });
      return;
    }

    const cleanBase = rawBaseUrl.replace(/\/+$/, '');
    const modelsEndpoint = `${cleanBase}/models`;
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'ONECOREAI/1.0' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(modelsEndpoint, { headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          error: `Провайдер вернул HTTP ${response.status} на ${modelsEndpoint}`,
          models: [],
        });
        return;
      }

      const data = (await response.json()) as {
        data?: Array<{ id?: string; pricing?: { prompt?: string; completion?: string } }>;
      };
      let list = (data.data ?? []).filter((m) => Boolean(m.id));
      if (kind === 'openrouter-free') {
        list = list.filter(
          (m) => m.id?.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0'),
        );
      }
      const modelIds = list.map((m) => m.id as string).filter(Boolean).slice(0, 60);
      res.json({ ok: true, count: modelIds.length, models: modelIds });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Сервер провайдера недоступен';
      res.status(502).json({
        ok: false,
        error:
          msg.includes('fetch failed') || msg.includes('ECONNREFUSED')
            ? `Локальный сервер ${cleanBase} сейчас не запущен на этом хосте`
            : msg,
        models: [],
      });
    }
  });

  app.post('/api/providers/capabilities', async (req, res) => {
    const providerConnection = await getProviderConnection(typeof req.body?.providerId === 'string' ? req.body.providerId : '', 'primary');
    const baseUrl = providerConnection?.baseUrl ?? '';
    const apiKey = providerConnection?.apiKey ?? '';
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : '';
    if (!baseUrl || !model) {
      res.status(400).json({ ok: false, error: 'Не заданы провайдер или модель' });
      return;
    }

    const project = projectId ? getProjectById(projectId) : null;
    const projectWorkspaceReady = Boolean(project?.folderPath && fs.existsSync(project.folderPath));
    const canUse = (tool: 'read_file' | 'write_file' | 'run_command' | 'git') =>
      Boolean(projectWorkspaceReady && project && isProjectToolAllowed(project.id, tool));
    const application = {
      readFiles: { available: canUse('read_file'), reason: project ? (canUse('read_file') ? 'Разрешено политикой проекта' : 'Отключено в разрешениях проекта') : 'Нет активного проекта' },
      writeFiles: { available: canUse('write_file'), reason: project ? (canUse('write_file') ? 'Доступно через diff и подтверждение пользователя' : 'Отключено в разрешениях проекта') : 'Нет активного проекта' },
      deleteFiles: { available: false, reason: 'Отдельный инструмент удаления файлов не реализован' },
      runCommands: { available: canUse('run_command'), reason: project ? (canUse('run_command') ? 'Команды требуют явного подтверждения' : 'Отключено в разрешениях проекта') : 'Нет активного проекта' },
      git: { available: canUse('git'), reason: project ? (canUse('git') ? 'Git доступен; изменяющие операции требуют подтверждения' : 'Git отключён в разрешениях проекта') : 'Нет активного проекта' },
      ssh: { available: false, reason: 'SSH ещё не подключён к инструментам проектного агента' },
      github: { available: false, reason: 'Прямые GitHub-действия проектного агента ещё не реализованы' },
      web: { available: true, reason: 'Встроенный браузер публичных страниц доступен' },
      functionCalling: { available: false, reason: 'Native function calling не подключён; используется JSON-протокол' },
      vision: { available: false, reason: 'Визуальный ввод не проверяется этим endpoint' },
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: 'Проведи самооценку только собственных возможностей модели. Не учитывай инструменты, плагины, API или права приложения. Верни только JSON: {"contextWindowTokens": число или null, "capabilities": {"readFiles": boolean или null, "writeFiles": boolean или null, "deleteFiles": boolean или null, "runCommands": boolean или null, "git": boolean или null, "ssh": boolean или null, "github": boolean или null, "web": boolean или null, "functionCalling": boolean или null, "vision": boolean или null}, "notes": "коротко"}. Если не знаешь точного ответа, используй null. Не выдумывай лимиты.',
            },
            { role: 'user', content: `Укажи возможности модели ${model}. Отвечай строго JSON.` },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const detail = await response.text();
        res.status(response.status).json({ ok: false, error: detail.slice(0, 300) || `HTTP ${response.status}` });
        return;
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = payload.choices?.[0]?.message?.content ?? '';
      const candidate = raw.match(/\{[\s\S]*\}/)?.[0];
      let parsed: { contextWindowTokens?: number | null; capabilities?: Record<string, unknown>; notes?: string } = {};
      if (candidate) {
        try { parsed = JSON.parse(candidate) as typeof parsed; } catch { /* unknown self-report */ }
      }
      const keys = ['readFiles', 'writeFiles', 'deleteFiles', 'runCommands', 'git', 'ssh', 'github', 'web', 'functionCalling', 'vision'] as const;
      const selfReported = Object.fromEntries(keys.map((key) => [
        key,
        typeof parsed.capabilities?.[key] === 'boolean' ? parsed.capabilities[key] as boolean : null,
      ]));
      res.json({
        ok: true,
        report: {
          providerId: typeof req.body?.providerId === 'string' ? req.body.providerId : '',
          projectId,
          modelId: model,
          checkedAt: new Date().toISOString(),
          contextWindowTokens: Number.isSafeInteger(parsed.contextWindowTokens) && Number(parsed.contextWindowTokens) > 0 ? Number(parsed.contextWindowTokens) : null,
          selfReported,
          application,
          notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 500) : 'Модель не вернула пояснение.',
        },
      });
    } catch (err) {
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : 'Не удалось проверить возможности модели' });
    }
  });

  app.post('/api/agents/chat', async (req, res) => {
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    const provider = req.body?.provider;
    const providerConnection = provider && typeof provider.providerId === 'string'
      ? await getProviderConnection(provider.providerId, provider.credentialScope === 'subagent' ? 'subagent' : 'primary', typeof provider.roleId === 'string' ? provider.roleId : undefined)
      : null;
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!projectId || !provider || !providerConnection || typeof provider.model !== 'string' || rawMessages.length === 0) {
      res.status(400).json({ ok: false, error: 'Не заданы projectId, provider или messages' });
      return;
    }

    if (rawMessages.length > 32 || rawMessages.some((message: unknown) => {
      const item = message && typeof message === 'object' ? message as Record<string, unknown> : {};
      return (
        (item.role !== 'system' && item.role !== 'user' && item.role !== 'assistant') ||
        typeof item.content !== 'string'
      );
    })) {
      res.status(400).json({ ok: false, error: 'Некорректная история сообщений агента.' });
      return;
    }
    const messages = rawMessages.map((message: unknown) => {
      const item = message as { role: 'system' | 'user' | 'assistant'; content: string };
      return { role: item.role, content: item.content.slice(0, 100000) };
    });

    const systemConfig = normalizeSystemConfig((await readAppSettings())?.settings.systemConfig);
    const controller = new AbortController();
    const operationSignal = res.locals.operationSignal as AbortSignal | undefined;
    const requestSignal = operationSignal ? AbortSignal.any([controller.signal, operationSignal]) : controller.signal;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Превышено общее время выполнения агентской операции.'));
    }, systemConfig.agentOperationTimeoutMs);
    res.on('close', () => {
      if (!res.writableEnded) controller.abort(new Error('Клиент отменил агентскую операцию.'));
    });

    try {
      const result = await executeGeneralAgentTask({
        projectId,
        knowledgeRoot: path.join(rootDir, 'docs', 'knowledge'),
        provider: {
          baseUrl: providerConnection.baseUrl,
          apiKey: providerConnection.apiKey ?? undefined,
          model: provider.model,
          temperature: typeof provider.temperature === 'number' ? provider.temperature : 0.2,
        },
        messages,
        signal: requestSignal,
        onToolCall: (name, status, summary, trace) => {
          recordAgentEvent({
            category: 'tool',
            level: status === 'failed' ? 'error' : status === 'cancelled' ? 'warning' : 'info',
            status: status === 'running' ? 'running' : status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'completed',
            title: name,
            summary,
            source: 'agent-orchestrator',
            projectId,
            details: { tool: name },
            trace,
          });
        },
        onTrace: (trace, status, summary) => {
          recordAgentEvent({
            category: trace.actorType === 'model' ? 'model' : 'agent',
            level: status === 'failed' ? 'error' : status === 'cancelled' ? 'warning' : 'info',
            status: status === 'running' ? 'running' : status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'completed',
            title: trace.stageLabel,
            summary,
            source: 'agent-orchestrator',
            projectId,
            trace,
          });
        },
      });
      if (!res.destroyed) res.json({ ok: true, ...result });
    } catch (err) {
      if (res.destroyed) return;
      const message = requestSignal.aborted && requestSignal.reason instanceof Error
        ? requestSignal.reason.message
        : err instanceof Error
          ? err.message
          : 'Ошибка выполнения агентской задачи';
      res.status(timedOut ? 504 : 502).json({ ok: false, error: message });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post('/api/agents/team-run', async (req, res) => {
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    const objective = typeof req.body?.objective === 'string' ? req.body.objective.trim() : '';
    if (!requireSideEffectApproval(req, res, 'agent.team-run', projectId || 'team-execution')) return;
    const requestedRoles = Array.isArray(req.body?.requestedRoles)
      ? req.body.requestedRoles.filter((r: unknown): r is string => typeof r === 'string' && r.trim().length > 0)
      : undefined;
    const maxCycles = typeof req.body?.maxCycles === 'number' ? req.body.maxCycles : undefined;
    if (!projectId || !objective) {
      res.status(400).json({ ok: false, error: 'Не заданы projectId или objective для командного запуска.' });
      return;
    }

    const systemConfig = normalizeSystemConfig((await readAppSettings())?.settings.systemConfig);
    const controller = new AbortController();
    const operationSignal = res.locals.operationSignal as AbortSignal | undefined;
    const requestSignal = operationSignal ? AbortSignal.any([controller.signal, operationSignal]) : controller.signal;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Превышено время командного выполнения.'));
    }, systemConfig.agentOperationTimeoutMs);
    res.on('close', () => {
      if (!res.writableEnded) controller.abort(new Error('Клиент отменил командный запуск.'));
    });

    try {
      const result = await runTeamExecution({
        projectId,
        objective,
        requestedRoles,
        maxCycles,
        parentOperationId: res.locals.operationId as string | undefined,
        rootDir,
        signal: requestSignal,
      });
      if (!res.destroyed) res.json(result);
    } catch (err) {
      if (res.destroyed) return;
      const message = err instanceof Error ? err.message : 'Ошибка командного оркестратора';
      res.status(timedOut ? 504 : 400).json({ ok: false, error: message });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post('/api/mcp/inspect', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'browser.network', String(req.body?.endpoint || req.body?.command || 'mcp-server'))) return;
    const transport = req.body?.transport === 'stdio' ? 'stdio' : 'http';
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
    const command = typeof req.body?.command === 'string' ? req.body.command : '';
    const result = await inspectMcpServer({
      transport,
      endpoint,
      command,
      signal: res.locals.operationSignal as AbortSignal | undefined,
    });
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/providers/chat', async (req, res) => {
    const providerId = typeof req.body?.providerId === 'string' ? req.body.providerId : '';
    const credentialScope = req.body?.credentialScope === 'subagent' ? 'subagent' : 'primary';
    const roleId = typeof req.body?.roleId === 'string' ? req.body.roleId : undefined;
    const providerConnection = await getProviderConnection(providerId, credentialScope, roleId);
    const settingsManifest = await readAppSettings();
    const systemConfig = normalizeSystemConfig(settingsManifest?.settings.systemConfig);
    const isLlamaCppRequest = credentialScope === 'primary' &&
      settingsManifest?.settings.freeProviders.some((provider) => provider.id === providerId && provider.kind === 'llama-cpp') === true;
    const ollamaProvider = credentialScope === 'primary'
      ? settingsManifest?.settings.freeProviders.find((provider) => provider.id === providerId && provider.kind === 'ollama')
      : undefined;
    const refreshOllamaKeepAlive = () => {
      if (!ollamaProvider) return;
      void warmOllamaModel(ollamaProvider).catch((error) => {
        recordAgentEvent({
          category: 'model',
          level: 'warning',
          status: 'failed',
          title: 'Не удалось продлить время жизни модели Ollama',
          summary: error instanceof Error ? error.message.slice(0, 240) : 'Ошибка удержания модели',
          source: 'ollama-runtime',
        });
      });
    };
    const requestStartedAt = Date.now();
    const runtimeUsageAtStartPromise = isLlamaCppRequest ? sampleLlamaRuntimeUsage() : Promise.resolve(null);
    const recordLlamaHistory = async (input: {
      status: 'success' | 'error' | 'cancelled';
      usedModel: string;
      ttftMs: number | null;
      promptTokens: number | null;
      completionTokens: number | null;
      error?: string;
    }) => {
      if (!isLlamaCppRequest) return;
      const finishedAt = new Date().toISOString();
      const durationMs = Math.max(0, Date.now() - requestStartedAt);
      const completionTokens = input.completionTokens;
      const generationMs = input.ttftMs === null ? durationMs : Math.max(0, durationMs - input.ttftMs);
      const [runtimeUsageAtStart, runtimeUsageAtEnd] = await Promise.all([
        runtimeUsageAtStartPromise,
        sampleLlamaRuntimeUsage(),
      ]);
      appendLlamaRequestRecord({
        startedAt: new Date(requestStartedAt).toISOString(),
        finishedAt,
        providerId,
        requestedModel: model,
        usedModel: input.usedModel,
        stream,
        status: input.status,
        durationMs,
        ttftMs: input.ttftMs,
        promptTokens: input.promptTokens,
        completionTokens,
        totalTokens: input.promptTokens !== null && completionTokens !== null
          ? input.promptTokens + completionTokens
          : null,
        tokensPerSecond: completionTokens !== null && generationMs > 0
          ? Number((completionTokens * 1000 / generationMs).toFixed(2))
          : null,
        runtimeUsageAtStart,
        runtimeUsageAtEnd,
        ...(input.error ? { error: input.error.slice(0, 500) } : {}),
      });
    };
    const rawBaseUrl = providerConnection?.baseUrl ?? '';
    const apiKey = providerConnection?.apiKey ?? '';
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const temperature = typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2;
    const stream = req.body?.stream === true;

    if (!rawBaseUrl || !model || messages.length === 0) {
      res.status(400).json({ ok: false, error: 'Не заданы baseUrl, model или messages' });
      return;
    }

    const cleanBase = rawBaseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: stream ? 'text/event-stream' : 'application/json',
      'HTTP-Referer': 'https://github.com/alexpikman/OneCoreAI',
      'X-Title': 'ONE CORE AI',
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const operationSignal = res.locals.operationSignal as AbortSignal | undefined;
    const requestSignal = operationSignal ? AbortSignal.any([controller.signal, operationSignal]) : controller.signal;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timeoutMessage = 'Тайм-аут ожидания ответа провайдера';

    const armTimeout = (message: string, delayMs: number) => {
      if (timeout) clearTimeout(timeout);
      timeoutMessage = message;
      timeout = setTimeout(() => {
        controller.abort(new Error(message));
      }, delayMs);
    };
    const clearRequestTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = undefined;
    };

    res.on('close', () => {
      if (!res.writableEnded) {
        clearRequestTimeout();
        controller.abort(new Error('Клиент закрыл соединение'));
      }
    });

    recordAgentEvent({
      category: 'model',
      level: 'info',
      status: 'running',
      title: 'Запрос к провайдеру чата',
      summary: `Модель ${model} (${credentialScope}${roleId ? `:${roleId}` : ''})`,
      source: 'provider-chat',
      details: { providerId, model, stream },
      trace: {
        stageId: 'provider-chat',
        stageLabel: 'Provider Chat',
        actorType: 'model',
        actorId: model,
        providerId,
        modelId: model,
        inputSummary: `Сообщений: ${messages.length}; stream=${String(stream)}`,
      },
    });

    try {
      armTimeout('Провайдер не ответил за установленное время', systemConfig.providerRequestTimeoutMs);
      let activeModel = model;
      let response: Response;
      let responseErrorText = '';
      let fallbackReason = '';
      const attemptedModels = new Set([model]);
      while (true) {
        armTimeout('Провайдер не ответил за установленное время', systemConfig.providerRequestTimeoutMs);
        response = await fetch(`${cleanBase}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: activeModel, messages, temperature, stream }),
          signal: requestSignal,
        });
        if (response.ok || response.status !== 429) break;

        armTimeout('Провайдер не завершил тело ошибки за установленное время', systemConfig.providerRequestTimeoutMs);
        responseErrorText = await response.text();
        clearRequestTimeout();

        const settingsManifest = await readAppSettings();
        const providerProfiles = credentialScope === 'subagent'
          ? roleId
            ? settingsManifest?.settings.subagentConfig?.providerProfilesByRole?.[roleId]?.providers ?? []
            : settingsManifest?.settings.subagentConfig?.providers ?? []
          : settingsManifest?.settings.freeProviders ?? [];
        const providerProfile = providerProfiles.find((item) => item.id === providerId);
        let parsedRateLimit: {
          error?: string | { message?: string; metadata?: { provider_code?: string; limit_source?: string; error_type?: string } };
          message?: string;
        } = {};
        try {
          parsedRateLimit = JSON.parse(responseErrorText) as typeof parsedRateLimit;
        } catch {
          // Some OpenAI-compatible providers return plain-text errors.
        }
        const rateLimitMessage = typeof parsedRateLimit.error === 'string'
          ? parsedRateLimit.error
          : parsedRateLimit.error?.message ?? parsedRateLimit.message ?? responseErrorText;
        const rateLimitMetadata = typeof parsedRateLimit.error === 'object' ? parsedRateLimit.error?.metadata : undefined;
        const isOpenRouterFree = providerProfile?.kind === 'openrouter-free';
        const isSharedFreeQuota = /free-models-per-(day|min)|openrouter_free_tier_(daily|per_minute)/i.test(
          `${rateLimitMessage} ${rateLimitMetadata?.limit_source ?? ''}`,
        );
        const isProviderSpecificLimit = response.headers.get('x-openrouter-error-origin') === 'provider' ||
          rateLimitMetadata?.limit_source === 'upstream_provider_shared_pool' ||
          Boolean(rateLimitMetadata?.provider_code);
        if (isOpenRouterFree && (isSharedFreeQuota || !isProviderSpecificLimit)) break;

        const configuredModels = Array.isArray(providerProfile?.availableModels)
          ? providerProfile.availableModels.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        const nextModel = configuredModels.find((candidate) =>
          !attemptedModels.has(candidate) &&
          (!isOpenRouterFree || candidate.endsWith(':free')),
        );
        if (!nextModel || attemptedModels.size >= systemConfig.modelFallbackAttempts) break;

        attemptedModels.add(nextModel);
        fallbackReason = 'Провайдер вернул HTTP 429: лимит запросов выбранной модели исчерпан.';
        activeModel = nextModel;
      }

      if (!response.ok) {
        armTimeout('Провайдер не завершил тело ошибки за установленное время', systemConfig.providerRequestTimeoutMs);
        const text = responseErrorText || await response.text();
        clearRequestTimeout();
        let upstreamMessage = '';
        try {
          const payload = JSON.parse(text) as { error?: string | { message?: string }; message?: string };
          upstreamMessage = typeof payload.error === 'string'
            ? payload.error
            : payload.error?.message ?? payload.message ?? '';
        } catch {
          upstreamMessage = text;
        }
        const isOpenRouterDailyLimit = /free-models-per-day|openrouter_free_tier_daily/i.test(text);
        const error = isOpenRouterDailyLimit
          ? 'Дневной лимит OpenRouter для всех бесплатных моделей (:free) исчерпан. Переключение на другую бесплатную модель не поможет. Дождитесь сброса квоты или вручную выберите платную модель.'
          : response.status === 429
            ? `Провайдер ограничил запросы для доступных моделей. ${upstreamMessage || 'Попробуйте позже или выберите другую модель.'}`
            : upstreamMessage || `HTTP ${response.status}`;
        recordModelRequest({ success: false, latencyMs: Date.now() - requestStartedAt, fallback: attemptedModels.size > 1, error });
        await recordLlamaHistory({
          status: 'error', usedModel: activeModel, ttftMs: null,
          promptTokens: null, completionTokens: null, error,
        });
        if (!res.destroyed) {
          res.status(response.status).json({
            ok: false,
            error: error.slice(0, 500),
            code: isOpenRouterDailyLimit ? 'openrouter_free_daily_limit' : response.status === 429 ? 'provider_rate_limit' : 'provider_error',
            requestedModel: model,
          });
        }
        return;
      }

      if (stream) {
        res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        if (activeModel !== model) {
          res.write(`data: ${JSON.stringify({ oneCore: { requestedModel: model, usedModel: activeModel, reason: fallbackReason } })}\n\n`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
          clearRequestTimeout();
          await recordLlamaHistory({
            status: 'error', usedModel: activeModel, ttftMs: null,
            promptTokens: null, completionTokens: null, error: 'Провайдер не вернул тело потокового ответа.',
          });
          res.end();
          return;
        }
        let firstTokenAt: number | null = null;
        let promptTokens: number | null = null;
        let completionTokens: number | null = null;
        let streamBuffer = '';
        const decoder = new TextDecoder('utf-8');
        const inspectStreamText = (text: string) => {
          streamBuffer += text;
          const lines = streamBuffer.split(/\r?\n/);
          streamBuffer = lines.pop() ?? '';
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const event = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: unknown } }>;
                usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
              };
              const delta = event.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0 && firstTokenAt === null) firstTokenAt = Date.now();
              if (typeof event.usage?.prompt_tokens === 'number' && Number.isFinite(event.usage.prompt_tokens)) promptTokens = event.usage.prompt_tokens;
              if (typeof event.usage?.completion_tokens === 'number' && Number.isFinite(event.usage.completion_tokens)) completionTokens = event.usage.completion_tokens;
            } catch {
              // Ignore non-JSON SSE lines; the original stream is forwarded unchanged.
            }
          }
        };
        try {
          while (true) {
            armTimeout('Поток провайдера не прислал следующий фрагмент за установленное время', systemConfig.providerStreamIdleTimeoutMs);
            const { done, value } = await reader.read();
            if (done) break;
            if (res.destroyed) {
              controller.abort(new Error('Клиент закрыл соединение'));
              break;
            }
            inspectStreamText(decoder.decode(value, { stream: true }));
            res.write(Buffer.from(value));
          }
          inspectStreamText(decoder.decode());
        } catch (err) {
          if (!res.destroyed) res.destroy();
          throw err;
        } finally {
          clearRequestTimeout();
          reader.releaseLock();
          if (!res.writableEnded && !res.destroyed && !controller.signal.aborted) res.end();
        }
        const streamStatus = controller.signal.aborted ? 'cancelled' : 'success';
        const ttftMs = firstTokenAt === null ? null : Math.max(0, firstTokenAt - requestStartedAt);
        await recordLlamaHistory({
          status: streamStatus, usedModel: activeModel, ttftMs,
          promptTokens, completionTokens,
          ...(streamStatus === 'cancelled' ? { error: 'Поток прерван клиентом.' } : {}),
        });
        recordModelRequest({ success: !controller.signal.aborted, latencyMs: Date.now() - requestStartedAt, fallback: activeModel !== model });
        refreshOllamaKeepAlive();
        return;
      }

      armTimeout('Провайдер не завершил ответ за установленное время', systemConfig.providerRequestTimeoutMs);
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      clearRequestTimeout();
      if (res.destroyed) return;
      recordModelRequest({
        success: true,
        latencyMs: Date.now() - requestStartedAt,
        fallback: activeModel !== model,
        promptTokens: json.usage?.prompt_tokens ?? null,
        completionTokens: json.usage?.completion_tokens ?? null,
      });
      await recordLlamaHistory({
        status: 'success', usedModel: json.model ?? activeModel, ttftMs: null,
        promptTokens: json.usage?.prompt_tokens ?? null,
        completionTokens: json.usage?.completion_tokens ?? null,
      });
      res.json({
        ok: true,
        content: json.choices?.[0]?.message?.content ?? '',
        model: json.model ?? activeModel,
        requestedModel: model,
        ...(activeModel !== model ? { fallback: { requestedModel: model, usedModel: json.model ?? activeModel, reason: fallbackReason } } : {}),
        promptTokens: json.usage?.prompt_tokens ?? null,
        completionTokens: json.usage?.completion_tokens ?? null,
        totalTokens: json.usage?.total_tokens ?? null,
      });
      refreshOllamaKeepAlive();
    } catch (err) {
      clearRequestTimeout();
      if (res.headersSent) {
        await recordLlamaHistory({
          status: requestSignal.aborted ? 'cancelled' : 'error', usedModel: model, ttftMs: null,
          promptTokens: null, completionTokens: null,
          error: err instanceof Error ? err.message : 'Ошибка потокового ответа.',
        });
        if (!res.destroyed && !res.writableEnded) res.end();
        return;
      }
      if (res.destroyed || res.writableEnded) return;
      const errorMessage = requestSignal.aborted
        ? (requestSignal.reason instanceof Error ? requestSignal.reason.message : timeoutMessage)
        : err instanceof Error
          ? err.message
          : 'Network error';
      recordModelRequest({ success: false, latencyMs: Date.now() - requestStartedAt, error: errorMessage });
      await recordLlamaHistory({
        status: requestSignal.aborted ? 'cancelled' : 'error', usedModel: model, ttftMs: null,
        promptTokens: null, completionTokens: null, error: errorMessage,
      });
      res.status(502).json({
        ok: false,
        localOffline: true,
        error: errorMessage,
      });
    }
  });

  app.post('/api/gateway/telegram/verify', async (req, res) => {
    if (!requireSideEffectApproval(req, res, 'gateway.verify', 'telegram')) return;
    const token = await getIntegrationSecret('gateway', 'telegram') ?? '';
    if (!token || !token.includes(':')) {
      res.status(400).json({ ok: false, error: 'Укажите корректный Telegram Bot Token вида 123456:ABC...' });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = (await response.json()) as {
        ok?: boolean;
        description?: string;
        result?: { id?: number; username?: string; first_name?: string };
      };

      if (!response.ok || !json.ok || !json.result) {
        res.status(400).json({
          ok: false,
          error: json.description || `Telegram API вернул HTTP ${response.status}`,
        });
        return;
      }

      res.json({
        ok: true,
        botId: json.result.id,
        username: json.result.username,
        firstName: json.result.first_name,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Ошибка соединения с api.telegram.org',
      });
    }
  });

  return app;
}

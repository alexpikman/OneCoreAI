import fs from 'node:fs';
import path from 'node:path';
import { readAgentJournal, type AgentJournalEvent } from '../agentJournal';
import { listKnowledgeDocuments } from '../knowledgeManager';
import { listOperations, type OperationRecord } from '../operationRegistry';
import { listProjects } from '../projectsManager';
import { readAppSettings } from '../settingsManager';
import { ROLE_CONTRACTS } from './roleContracts';
import { buildAgentToolsRegistry } from './toolsRegistry';

export type WorkflowLayerId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export type WorkflowNodeKind =
  | 'trigger'
  | 'gateway'
  | 'router'
  | 'orchestrator'
  | 'subagent'
  | 'tool'
  | 'provider'
  | 'state'
  | 'guard'
  | 'dead-end';

export type WorkflowNodeStatus =
  | 'live-active'
  | 'implemented'
  | 'partial'
  | 'planned-draft'
  | 'dead-end';

export type WorkflowEdgeKind =
  | 'normal'
  | 'conditional'
  | 'retry'
  | 'approval'
  | 'telemetry'
  | 'dead-end'
  | 'planned';

export interface ScannedDocEntry {
  id?: string;
  title: string;
  path: string;
  category: 'architecture' | 'intelligence' | 'knowledge' | 'schema' | 'governance' | 'project' | 'root';
  status: string;
  version?: string;
  ownerRole?: string;
  triggers: string[];
  headings: string[];
  referencedPaths: string[];
  lineCount: number;
  sizeBytes: number;
  linkedNodeIds: string[];
}

export interface ScannedApiRoute {
  method: string;
  path: string;
  line: number;
  hasExplicitApproval: boolean;
  hasProjectToolGuard: boolean;
  recordsOperation: boolean;
  recordsJournal: boolean;
}

export interface WorkflowDocBinding {
  path: string;
  title: string;
  section: string;
  status: string;
  verifiedOnDisk: boolean;
}

export interface WorkflowNode {
  id: string;
  layerId: WorkflowLayerId;
  macroId: string;
  kind: WorkflowNodeKind;
  title: string;
  subtitle: string;
  status: WorkflowNodeStatus;
  isDeadEnd: boolean;
  deadEndReason?: string;
  x: number;
  y: number;
  eventTrigger: string;
  emittedEvents: string[];
  microFeatures: string[];
  sourceFiles: string[];
  apiRoutes: string[];
  docRefs: WorkflowDocBinding[];
  liveMetrics: {
    journalHits: number;
    activeOps: number;
    completedOps: number;
    failedOps: number;
    cancelledOps: number;
    lastSeenAt: string | null;
  };
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  eventName: string;
  kind: WorkflowEdgeKind;
  condition?: string;
  isLiveActive: boolean;
}

export interface MacroWorkflowLayerStep {
  layer: string;
  stateName: string;
  actor: string;
  summary: string;
  nodeIds: string[];
  deadEnds: string[];
}

export interface MacroWorkflowSpec {
  id: string;
  title: string;
  subtitle: string;
  status: 'implemented' | 'partial' | 'planned-draft';
  entryEvent: string;
  terminalStates: string[];
  layers: MacroWorkflowLayerStep[];
  docRefs: WorkflowDocBinding[];
  sourceFiles: string[];
}

export interface WorkflowLayerMeta {
  id: WorkflowLayerId;
  index: number;
  title: string;
  shortTitle: string;
  description: string;
  x: number;
}

export interface SystemWorkflowGraphPayload {
  generatedAt: string;
  scanSummary: {
    totalDocs: number;
    totalApiRoutes: number;
    totalServerModules: number;
    totalUiPages: number;
    totalUiComponents: number;
    totalTauriCommands: number;
    totalDesignerModules: number;
    totalKnowledgeDocs: number;
    approvedKnowledgeDocs: number;
    totalRoles: number;
    totalTools: number;
    sysToolsCount: number;
    totalNodes: number;
    totalEdges: number;
    deadEndCount: number;
    liveActiveNodes: number;
    observedJournalEvents: number;
    inMemoryOperations: number;
    activeOperationsCount: number;
    connectedProjectsCount: number;
    configuredProvidersCount: number;
    activeProviderId: string | null;
  };
  layers: WorkflowLayerMeta[];
  macros: MacroWorkflowSpec[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  documentsCatalog: ScannedDocEntry[];
  apiRoutes: ScannedApiRoute[];
  tauriCommands: Array<{ name: string; file: string; line: number }>;
}

function toPosix(relPath: string): string {
  return relPath.replace(/\\/g, '/');
}

function walkFiles(dirPath: string, extensions: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target' || entry.name === '.git') continue;
      walkFiles(full, extensions, out);
    } else if (extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function parseFrontmatter(content: string): {
  id?: string;
  version?: string;
  status?: string;
  owner_role?: string;
  triggers: string[];
  body: string;
} {
  const normalized = content.replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { triggers: [], body: normalized };
  const rawYaml = match[1];
  const body = match[2];
  const lines = rawYaml.split(/\r?\n/);
  const result: { id?: string; version?: string; status?: string; owner_role?: string; triggers: string[]; body: string } = {
    triggers: [],
    body,
  };
  let inTriggers = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('- ') && inTriggers) {
      result.triggers.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }
    inTriggers = false;
    const kv = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim().replace(/^['"]|['"]$/g, '');
    if (key === 'triggers') {
      inTriggers = true;
      if (value.startsWith('[') && value.endsWith(']')) {
        result.triggers.push(
          ...value
            .slice(1, -1)
            .split(',')
            .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean),
        );
      }
    } else if (key === 'id') result.id = value;
    else if (key === 'version') result.version = value;
    else if (key === 'status') result.status = value;
    else if (key === 'owner_role') result.owner_role = value;
  }
  return result;
}

function inferDocCategory(relPath: string): ScannedDocEntry['category'] {
  if (relPath.startsWith('docs/architecture/')) return 'architecture';
  if (relPath.startsWith('docs/intelligence-architecture/')) return 'intelligence';
  if (relPath.startsWith('docs/knowledge/schemas/')) return 'schema';
  if (relPath.startsWith('docs/knowledge/')) return 'knowledge';
  if (relPath.startsWith('docs/governance/')) return 'governance';
  if (relPath.startsWith('docs/project/')) return 'project';
  return 'root';
}

function inferDocStatus(relPath: string, frontmatterStatus: string | undefined, content: string): string {
  if (frontmatterStatus) return frontmatterStatus;
  if (relPath.endsWith('.schema.json')) return 'active-schema';
  if (/\*\*Status:?\s*partially implemented/i.test(content)) return 'partial';
  if (/Статус:\s*\*\*Draft/i.test(content) || /status:\s*draft/i.test(content)) return 'draft';
  if (/\*\*Status:?\*\*?\s*normative/i.test(content)) return 'normative';
  if (relPath.startsWith('docs/governance/')) return 'normative';
  return 'documented';
}

function scanDocumentationCatalog(rootDir: string): ScannedDocEntry[] {
  const candidates: string[] = [];
  const docsDir = path.join(rootDir, 'docs');
  walkFiles(docsDir, ['.md', '.json'], candidates);
  for (const extra of ['README.md', 'GO/ContinueDevProject.md']) {
    const abs = path.join(rootDir, extra);
    if (fs.existsSync(abs)) candidates.push(abs);
  }

  const entries: ScannedDocEntry[] = [];
  for (const absPath of candidates.sort()) {
    const relPath = toPosix(path.relative(rootDir, absPath));
    const raw = fs.readFileSync(absPath, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const stat = fs.statSync(absPath);
    const fm = relPath.endsWith('.md') ? parseFrontmatter(raw) : { triggers: [], body: raw };
    const headings = fm.body
      .split(/\r?\n/)
      .filter((line) => /^#{1,3}\s+/.test(line))
      .map((line) => line.replace(/^#{1,3}\s+/, '').trim())
      .slice(0, 12);

    let title = path.basename(relPath);
    if (relPath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(raw) as { title?: string; $id?: string };
        title = parsed.title || parsed.$id || title;
      } catch {
        // Keep filename fallback
      }
    } else if (headings.length > 0) {
      title = headings[0];
    }

    const refMatches = new Set<string>();
    for (const match of raw.matchAll(/(?:docs|server|src)\/[a-zA-Z0-9_./-]+\.(?:md|ts|tsx|json)/g)) {
      refMatches.add(match[0]);
    }

    entries.push({
      id: fm.id,
      title,
      path: relPath,
      category: inferDocCategory(relPath),
      status: inferDocStatus(relPath, fm.status, raw),
      version: fm.version,
      ownerRole: fm.owner_role,
      triggers: fm.triggers,
      headings,
      referencedPaths: [...refMatches].slice(0, 16),
      lineCount: lines.length,
      sizeBytes: stat.size,
      linkedNodeIds: [],
    });
  }
  return entries;
}

function scanApiRoutes(rootDir: string): ScannedApiRoute[] {
  const appPath = path.join(rootDir, 'server', 'app.ts');
  if (!fs.existsSync(appPath)) return [];
  const raw = fs.readFileSync(appPath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const routes: ScannedApiRoute[] = [];

  for (let idx = 0; idx < lines.length; idx += 1) {
    const match = lines[idx].match(/^\s*app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/);
    if (!match) continue;
    const windowText = lines.slice(idx, Math.min(lines.length, idx + 45)).join('\n');
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      line: idx + 1,
      hasExplicitApproval: /evaluateSideEffectApproval|hasExplicitApproval|X-OneCore-Approval|approved === true/.test(windowText),
      hasProjectToolGuard: /assertProjectToolAllowed|isProjectToolAllowed/.test(windowText),
      recordsOperation: /startOperation|finishOperation|cancelOperation/.test(windowText),
      recordsJournal: /recordAgentEvent/.test(windowText),
    });
  }
  return routes;
}

function scanTauriCommands(rootDir: string): Array<{ name: string; file: string; line: number }> {
  const tauriSrc = path.join(rootDir, 'src-tauri', 'src');
  const rustFiles = walkFiles(tauriSrc, ['.rs']);
  const commands: Array<{ name: string; file: string; line: number }> = [];
  for (const file of rustFiles) {
    const raw = fs.readFileSync(file, 'utf-8');
    const lines = raw.split(/\r?\n/);
    for (let idx = 0; idx < lines.length; idx += 1) {
      if (lines[idx].includes('#[tauri::command]')) {
        const nextLine = lines[idx + 1] ?? '';
        const fnMatch = nextLine.match(/fn\s+([a-zA-Z0-9_]+)/);
        if (fnMatch) {
          commands.push({
            name: fnMatch[1],
            file: toPosix(path.relative(rootDir, file)),
            line: idx + 2,
          });
        }
      }
    }
  }
  return commands;
}

export function resolveSafeRepoDocumentPath(rootDir: string, requestedPath: string): string {
  const normalized = toPosix(requestedPath.trim()).replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) {
    throw new Error('Недопустимый путь к документу.');
  }
  const allowedPrefixes = ['docs/', 'server/', 'src/', 'src-tauri/', 'designer/'];
  const allowedExact = new Set(['README.md', 'GO/ContinueDevProject.md', 'package.json', 'metadata.json']);
  if (!allowedExact.has(normalized) && !allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error('Чтение разрешено только для документации и исходных файлов проекта.');
  }

  const rootResolved = path.resolve(rootDir);
  const targetResolved = path.resolve(rootResolved, normalized);
  if (!targetResolved.startsWith(rootResolved + path.sep) && targetResolved !== rootResolved) {
    throw new Error('Выход за пределы каталога проекта запрещён.');
  }
  if (!fs.existsSync(targetResolved)) {
    throw new Error(`Файл «${normalized}» не найден.`);
  }
  const stat = fs.lstatSync(targetResolved);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`«${normalized}» не является обычным файлом.`);
  }
  return targetResolved;
}

export function readSystemGraphDocument(rootDir: string, requestedPath: string): {
  path: string;
  title: string;
  format: 'markdown' | 'json' | 'code';
  content: string;
  lineCount: number;
  sizeBytes: number;
  truncated: boolean;
} {
  const absPath = resolveSafeRepoDocumentPath(rootDir, requestedPath);
  const relPath = toPosix(path.relative(rootDir, absPath));
  const raw = fs.readFileSync(absPath, 'utf-8');
  const maxChars = 160_000;
  const truncated = raw.length > maxChars;
  const content = truncated ? `${raw.slice(0, maxChars)}\n\n... [обрезано до 160 000 символов]` : raw;
  const heading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const format = relPath.endsWith('.md') ? 'markdown' : relPath.endsWith('.json') ? 'json' : 'code';

  return {
    path: relPath,
    title: heading || path.basename(relPath),
    format,
    content,
    lineCount: raw.split(/\r?\n/).length,
    sizeBytes: Buffer.byteLength(raw, 'utf-8'),
    truncated,
  };
}

const LAYERS: WorkflowLayerMeta[] = [
  {
    id: 'L0',
    index: 0,
    title: 'L0 · UI Shell, Триггеры и Desktop IPC',
    shortTitle: 'UI и Триггеры',
    description: 'Входные точки пользователя (Chat, PLAN/ACT, Navigation, Terminal, Browser, Projects, Designer, Tauri 2 WebView2).',
    x: 40,
  },
  {
    id: 'L1',
    index: 1,
    title: 'L1 · Периметр API, Auth и Approval',
    shortTitle: 'API и Защита',
    description: 'Loopback Host, Origin/Fetch Metadata, Bearer 256-bit, Context Propagation и ручные подтверждения Class C.',
    x: 380,
  },
  {
    id: 'L2',
    index: 2,
    title: 'L2 · Маршрутизация и Оркестратор',
    shortTitle: 'Роутинг и Control',
    description: 'routeAgentPrompt, General Agent, Team Orchestrator, Manager Intake, Dispatcher Decompose, Approve Graph (SYS), Context Builder.',
    x: 720,
  },
  {
    id: 'L3',
    index: 3,
    title: 'L3 · Рой ролей, Контракты и Циклы',
    shortTitle: 'Роли и Handoffs',
    description: '10 ролей субагентов, agent-handoff.v1 / worker-result.v1, изоляция evidence, цикл needs_more_context (max 2) и тупики.',
    x: 1060,
  },
  {
    id: 'L4',
    index: 4,
    title: 'L4 · Инструменты, Guard и Verification',
    shortTitle: 'Инструменты и Gate',
    description: '16 системных инструментов, safeResolveInside + symlink-проверка, allowlist проекта, VerificationGate (байты/exitCode/undo).',
    x: 1400,
  },
  {
    id: 'L5',
    index: 5,
    title: 'L5 · AI Провайдеры, LlamaServer и GGUF',
    shortTitle: 'Модели и Runtime',
    description: 'Local (Ollama/LM Studio), Cloud, Compatible endpoints, управляемый llama-server, Range-докачка HF + SHA-256 и SSE disconnect.',
    x: 1740,
  },
  {
    id: 'L6',
    index: 6,
    title: 'L6 · Состояние, Vault, Знания и Аудит',
    shortTitle: 'Хранилище и Аудит',
    description: 'Operation Registry, Agent Journal + SSE, Vault v2 scrypt, Settings/Revisions, Approved Knowledge vs «КАК У ДРУГИХ», GitHub/SSH/TG.',
    x: 2080,
  },
];

export async function scanSystemWorkflowGraph(rootDir: string): Promise<SystemWorkflowGraphPayload> {
  const docsCatalog = scanDocumentationCatalog(rootDir);
  const docsByPath = new Map(docsCatalog.map((d) => [d.path, d]));
  const apiRoutes = scanApiRoutes(rootDir);
  const tauriCommands = scanTauriCommands(rootDir);
  const knowledgeRoot = path.join(rootDir, 'docs', 'knowledge');
  const knowledgeDocs = listKnowledgeDocuments(knowledgeRoot);
  const approvedKnowledgeDocs = knowledgeDocs.filter((d) => d.status === 'approved');
  const toolsRegistry = buildAgentToolsRegistry(rootDir);

  const serverModules = walkFiles(path.join(rootDir, 'server'), ['.ts']);
  const uiPages = walkFiles(path.join(rootDir, 'src', 'pages'), ['.tsx']);
  const uiComponents = walkFiles(path.join(rootDir, 'src', 'components'), ['.tsx']);
  const designerModules = walkFiles(path.join(rootDir, 'designer', 'src'), ['.ts', '.tsx']);

  const operations = listOperations(500);
  const journalEvents = readAgentJournal(1000);
  const projects = listProjects().projects;
  const settingsManifest = await readAppSettings();

  const configuredProviders = settingsManifest?.settings.freeProviders?.filter((p) => p.enabled !== false) ?? [];
  const activeProviderId = settingsManifest?.settings.activeProviderId ?? null;

  const docRef = (docPath: string, section: string, fallbackTitle?: string): WorkflowDocBinding => {
    const normalized = toPosix(docPath);
    const scanned = docsByPath.get(normalized);
    return {
      path: normalized,
      title: scanned?.title || fallbackTitle || path.basename(normalized),
      section,
      status: scanned?.status || 'missing',
      verifiedOnDisk: Boolean(scanned) || fs.existsSync(path.join(rootDir, normalized)),
    };
  };

  const matchRoutes = (prefixes: string[]) =>
    apiRoutes
      .filter((r) => prefixes.some((p) => r.path.startsWith(p)))
      .map((r) => `${r.method} ${r.path} (L${r.line})`);

  const computeLiveMetrics = (matchers: {
    pathPrefixes?: string[];
    categories?: AgentJournalEvent['category'][];
    sources?: string[];
    stagePatterns?: RegExp[];
  }) => {
    const matchedOps = operations.filter((op) =>
      matchers.pathPrefixes?.some((prefix) => op.path.startsWith(prefix)),
    );
    const matchedEvents = journalEvents.filter((ev) => {
      if (matchers.categories && matchers.categories.includes(ev.category)) return true;
      if (matchers.sources && matchers.sources.some((s) => ev.source.includes(s))) return true;
      if (matchers.stagePatterns && matchers.stagePatterns.some((re) => re.test(`${ev.title} ${ev.trace?.stageId ?? ''} ${ev.trace?.toolName ?? ''} ${ev.trace?.actorId ?? ''}`))) {
        return true;
      }
      return false;
    });

    const latestEventTs = matchedEvents[0]?.timestamp ?? null;
    const latestOpTs = matchedOps[0]?.startedAt ?? null;
    const lastSeenAt = latestEventTs && latestOpTs
      ? (latestEventTs > latestOpTs ? latestEventTs : latestOpTs)
      : latestEventTs ?? latestOpTs;

    return {
      journalHits: matchedEvents.length,
      activeOps: matchedOps.filter((o) => o.status === 'running').length,
      completedOps: matchedOps.filter((o) => o.status === 'completed').length,
      failedOps: matchedOps.filter((o) => o.status === 'failed').length,
      cancelledOps: matchedOps.filter((o) => o.status === 'cancelled').length,
      lastSeenAt,
    };
  };

  const nodeStatusFromMetrics = (
    baseStatus: Exclude<WorkflowNodeStatus, 'live-active'>,
    metrics: WorkflowNode['liveMetrics'],
  ): WorkflowNodeStatus => {
    if (baseStatus === 'dead-end' || baseStatus === 'planned-draft') return baseStatus;
    if (metrics.activeOps > 0 || metrics.journalHits > 0 || metrics.completedOps > 0) return 'live-active';
    return baseStatus;
  };

  type RawNodeDef = Omit<WorkflowNode, 'status' | 'liveMetrics'> & {
    baseStatus: Exclude<WorkflowNodeStatus, 'live-active'>;
    matchers?: Parameters<typeof computeLiveMetrics>[0];
  };

  const layerOffsets: Record<WorkflowLayerId, number> = {
    L0: 0,
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
    L5: 0,
    L6: 0,
  };

  const layerXMap = Object.fromEntries(LAYERS.map((l) => [l.id, l.x])) as Record<WorkflowLayerId, number>;

  const makeNode = (def: RawNodeDef): WorkflowNode => {
    const idx = layerOffsets[def.layerId];
    layerOffsets[def.layerId] += 1;
    const metrics = def.matchers
      ? computeLiveMetrics(def.matchers)
      : { journalHits: 0, activeOps: 0, completedOps: 0, failedOps: 0, cancelledOps: 0, lastSeenAt: null };
    return {
      id: def.id,
      layerId: def.layerId,
      macroId: def.macroId,
      kind: def.kind,
      title: def.title,
      subtitle: def.subtitle,
      status: nodeStatusFromMetrics(def.baseStatus, metrics),
      isDeadEnd: def.isDeadEnd,
      deadEndReason: def.deadEndReason,
      x: def.x || layerXMap[def.layerId],
      y: def.y || 70 + idx * 145,
      eventTrigger: def.eventTrigger,
      emittedEvents: def.emittedEvents,
      microFeatures: def.microFeatures,
      sourceFiles: def.sourceFiles,
      apiRoutes: def.apiRoutes,
      docRefs: def.docRefs,
      liveMetrics: metrics,
    };
  };

  const rawNodes: RawNodeDef[] = [
    // ================= L0: UI Shell, Triggers & Desktop IPC =================
    {
      id: 'ui-chat-prompt',
      layerId: 'L0',
      macroId: 'macro-project-agent-loop',
      kind: 'trigger',
      title: 'Чат и ввод промпта / Slash-команды',
      subtitle: 'Центральная панель чата: свободный ввод, /run, /search, /web, /browse, /git, /undo и переключение PLAN/ACT.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 40,
      y: 70,
      eventTrigger: 'user.submit_prompt',
      emittedEvents: ['ui:infer_mode', 'ui:route_prompt'],
      microFeatures: [
        'inferAgentMode: автоопределение ACT для команд правки/запуска и PLAN для вопросов',
        'Slash-триггеры: /run, /undo, /git, /search, /web, /browse',
        'Передача sessionId и messageId для привязки SSE-ленты к сообщению',
      ],
      sourceFiles: ['src/components/workstation/CenterAgentPane.tsx', 'src/utils/agentRouter.ts', 'src/store/useOneCoreStore.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/SYSTEM_MAP.md', '3. Current request/data flow'), docRef('docs/architecture/NAVIGATION_AND_SHELL.md', 'Routing behavior')],
      matchers: { categories: ['agent', 'api'] },
    },
    {
      id: 'ui-team-trigger',
      layerId: 'L0',
      macroId: 'macro-team-swarm',
      kind: 'trigger',
      title: 'Командный запуск роя (SUB Agents)',
      subtitle: 'Форма постановки цели, выбора ролей и лимита циклов maxCycles (1..4) во вкладке Командное выполнение.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 40,
      y: 215,
      eventTrigger: 'user.start_team_run',
      emittedEvents: ['http:POST /api/agents/team-run'],
      microFeatures: [
        'Выбор активного проекта и целевого задания (objective)',
        'Лимит циклов maxCycles: от 1 (по умолчанию) до 4',
        'Просмотр отчёта по ролям, статусов проверок и артефактов',
      ],
      sourceFiles: ['src/pages/ai-resources/TeamExecutionPage.tsx', 'src/pages/ai-resources/SubAgentsPage.tsx'],
      apiRoutes: matchRoutes(['/api/agents/team-run', '/api/agents/registry']),
      docRefs: [docRef('docs/knowledge/procedures/team-execution.md', 'Team execution flow'), docRef('docs/intelligence-architecture/delegation-model.md', '3. Модель делегирования')],
      matchers: { pathPrefixes: ['/api/agents/team-run'], sources: ['team-orchestrator'] },
    },
    {
      id: 'ui-nav-shell',
      layerId: 'L0',
      macroId: 'macro-ui-tauri-designer',
      kind: 'trigger',
      title: '10-групповая навигация и Shell',
      subtitle: 'AppNavigation, NavigationGroupPopup, PageSubNavigation ribbon, SecondaryTabBar и Visibility Tree.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 40,
      y: 360,
      eventTrigger: 'user.navigate_group_or_tab',
      emittedEvents: ['store:setActiveTab', 'store:sync_subitem'],
      microFeatures: [
        '10 верхнеуровневых групп NAV_GROUPS + единый источник ленты NavigationRibbon',
        'Гранулярное скрытие пунктов/иконок/лейблов через navigationVisibility',
        '3-колоночный layout без обёртки всей страницы в одну карточку',
      ],
      sourceFiles: ['src/data/appNavigation.ts', 'src/components/layout/AppNavigation.tsx', 'src/components/layout/PageSubNavigation.tsx'],
      apiRoutes: matchRoutes(['/api/designer/configuration']),
      docRefs: [docRef('docs/architecture/NAVIGATION_AND_SHELL.md', 'Navigation model'), docRef('docs/governance/AI_WORKING_RULES.md', 'Shell constraints')],
    },
    {
      id: 'ui-tools-workspace',
      layerId: 'L0',
      macroId: 'macro-tools-guard',
      kind: 'trigger',
      title: 'Проекты, Задачи, Терминал, Браузер, Заметки',
      subtitle: 'UI рабочих инструментов: файловое дерево, диффы, Git, браузерный поиск и заметки пользователя.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 40,
      y: 505,
      eventTrigger: 'user.workspace_action',
      emittedEvents: ['http:project_files', 'http:terminal_exec', 'http:browser_tool', 'http:notes_crud'],
      microFeatures: [
        'ProjectModal + ProjectAllowedToolsPage (вкл/выкл read_file, write_file, run_command, git, search_code)',
        'GitDiffViewer для визуальной проверки предлагаемых правок до подтверждения',
        'NotesPage с локальным CRUD и ProjectPlanModal с 1 планом на проект',
      ],
      sourceFiles: ['src/pages/context/ProjectsPage.tsx', 'src/pages/context/ProjectAllowedToolsPage.tsx', 'src/pages/workspace/TerminalPage.tsx', 'src/pages/workspace/BrowserPage.tsx'],
      apiRoutes: matchRoutes(['/api/projects', '/api/tasks', '/api/notes', '/api/browser']),
      docRefs: [docRef('docs/architecture/NAVIGATION_AND_SHELL.md', 'Context pages'), docRef('docs/architecture/IMPLEMENTATION_STATUS.md', 'Implemented')],
      matchers: { pathPrefixes: ['/api/projects', '/api/tasks', '/api/notes'] },
    },
    {
      id: 'ui-models-providers',
      layerId: 'L0',
      macroId: 'macro-provider-llamaserver',
      kind: 'trigger',
      title: 'Провайдеры, LlamaServer и Центр GGUF',
      subtitle: 'Управление Local/Cloud/Compatible профилями, установкой llama.cpp, скачиванием GGUF и назначением ролям.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 40,
      y: 650,
      eventTrigger: 'user.configure_provider_or_model',
      emittedEvents: ['http:models_manage', 'http:provider_verify'],
      microFeatures: [
        'Разделение Local / Cloud / Compatible и отдельный цикл LlamaServer',
        'Памятка по квантованию и реальный профиль GPU/CPU в боковой панели',
        'Привязка providerProfilesByRole для каждой роли субагента',
      ],
      sourceFiles: ['src/pages/ai-resources/ProvidersPage.tsx', 'src/pages/ai-resources/LlamaServerSettingsPage.tsx', 'src/components/models/ModelHubView.tsx'],
      apiRoutes: matchRoutes(['/api/models', '/api/hf', '/api/hardware', '/api/providers']),
      docRefs: [docRef('docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md', '2.1 Provider settings surface')],
      matchers: { pathPrefixes: ['/api/models', '/api/hf'] },
    },
    {
      id: 'tauri-ipc-shell',
      layerId: 'L0',
      macroId: 'macro-ui-tauri-designer',
      kind: 'gateway',
      title: 'Tauri 2 Desktop Core & Rust IPC',
      subtitle: `Edge WebView2 хост, генерация 256-bit нативного токена, sidecar llama-server и ${tauriCommands.length} IPC-команд.`,
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 40,
      y: 795,
      eventTrigger: 'desktop.tauri_launch',
      emittedEvents: ['ipc:get_backend_session_token', 'ipc:get_backend_url', 'spawn:node_server'],
      microFeatures: [
        ...tauriCommands.slice(0, 6).map((c) => `#[tauri::command] ${c.name} (${c.file}:${c.line})`),
        'Миграция legacy %APPDATA%/com.kovastudio.app при пустом новом каталоге',
      ],
      sourceFiles: ['src-tauri/src/lib.rs', 'src-tauri/tauri.conf.json', 'src-tauri/capabilities/default.json'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/REALTIME_SERVER_AUTH_CONTRACT.md', 'Packaged Tauri auth'), docRef('docs/architecture/SYSTEM_MAP.md', '1. Runtime topology')],
    },
    {
      id: 'designer-companion',
      layerId: 'L0',
      macroId: 'macro-ui-tauri-designer',
      kind: 'trigger',
      title: 'OneCore Designer (Отдельное приложение)',
      subtitle: 'Редактор токенов оформления, макета и навигации сопрягаемый через одноразовый pairing-код.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 40,
      y: 940,
      eventTrigger: 'designer.pair_and_apply',
      emittedEvents: ['http:POST /api/designer/pairing', 'http:POST /api/designer/session'],
      microFeatures: [
        'Ограниченный токен Designer получает 403 на /api/projects и рабочие API',
        'История ревизий конфигурации с откатом и блокировкой устаревших черновиков',
        'Валидация циклов зависимостей и глубины JSON до сохранения',
      ],
      sourceFiles: ['designer/src/App.tsx', 'server/configurationManager.ts', 'server/configurationEngine.ts'],
      apiRoutes: matchRoutes(['/api/designer']),
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', 'Designer API'), docRef('docs/governance/AI_WORKING_RULES.md', 'Designer boundaries')],
    },

    // ================= L1: API Perimeter, Auth & Approval Gates =================
    {
      id: 'mw-loopback-origin',
      layerId: 'L1',
      macroId: 'macro-security-perimeter',
      kind: 'guard',
      title: 'Loopback Host & Origin / Fetch Metadata Guard',
      subtitle: 'Глобальный middleware в server/app.ts: отсекает внешние домены, невалидные Host и чужие Origin.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 380,
      y: 70,
      eventTrigger: 'http.incoming_request',
      emittedEvents: ['guard:origin_passed', 'dead:403_untrusted_origin'],
      microFeatures: [
        'Разрешены только 127.0.0.1 / localhost / ::1',
        'Fetch Metadata и strict CORS whitelist (Origin tauri://localhost и loopback)',
        'Поддержка заголовка X-OneCore-Approval в CORS allow-headers',
      ],
      sourceFiles: ['server/app.ts'],
      apiRoutes: ['/api/* (global middleware)'],
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', '4. Cross-cutting controls'), docRef('docs/architecture/REALTIME_SERVER_AUTH_CONTRACT.md', 'Origin policy')],
    },
    {
      id: 'mw-bearer-session',
      layerId: 'L1',
      macroId: 'macro-security-perimeter',
      kind: 'guard',
      title: 'Bearer Session Auth & Designer Scope',
      subtitle: 'Проверка 256-bit Bearer-токена (SHA-256 хэш, 12ч TTL) или нативного ONECORE_API_TOKEN.',
      baseStatus: 'partial',
      isDeadEnd: false,
      x: 380,
      y: 230,
      eventTrigger: 'guard:origin_passed',
      emittedEvents: ['auth:session_verified', 'dead:401_403_auth'],
      microFeatures: [
        'Packaged Tauri: нативный токен без Origin-bootstrap (/api/auth/session -> 403)',
        'Dev/Browser режим: Origin-trusted bootstrap сессии (отмечен как weak gap в матрице)',
        'Designer session token изолирован только на /api/designer/*',
      ],
      sourceFiles: ['server/app.ts'],
      apiRoutes: matchRoutes(['/api/auth/session', '/api/health']),
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', '3. Current implementation delta'), docRef('docs/architecture/SECURITY_AND_APPROVALS.md', 'Session auth')],
    },
    {
      id: 'mw-operation-context',
      layerId: 'L1',
      macroId: 'macro-operation-lifecycle',
      kind: 'gateway',
      title: 'API Operation Middleware & Audit Trace',
      subtitle: 'Регистрация каждой API-операции в OperationRegistry, связывание parentOperationId и AsyncLocalStorage.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 380,
      y: 390,
      eventTrigger: 'auth:session_verified',
      emittedEvents: ['op:CREATED_RUNNING', 'route:dispatch_handler'],
      microFeatures: [
        'Автосоздание AbortController и связывание с X-OneCore-Parent-Operation',
        'runWithAgentOperationContext прокидывает operationId/sessionId/messageId вглубь сервисов',
        'Автоматическая фиксация завершения ответа HTTP на finish',
      ],
      sourceFiles: ['server/app.ts', 'server/operationRegistry.ts', 'server/agentJournal.ts'],
      apiRoutes: matchRoutes(['/api/operations']),
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '1. Operation identity')],
      matchers: { pathPrefixes: ['/api/'] },
    },
    {
      id: 'gate-explicit-approval',
      layerId: 'L1',
      macroId: 'macro-security-perimeter',
      kind: 'guard',
      title: 'Side-Effect Approval Gate (Class C)',
      subtitle: 'evaluateSideEffectApproval проверяет approved === true или X-OneCore-Approval перед опасными действиями.',
      baseStatus: 'partial',
      isDeadEnd: false,
      x: 380,
      y: 550,
      eventTrigger: 'route:side_effect_requested',
      emittedEvents: ['gate:approved_execute', 'dead:403_approval_denied', 'gap:missing_one_time_ticket'],
      microFeatures: [
        '15 областей: model.download, project.delete, project.file.write, project.terminal, project.git.mutate, agent.team-run и др.',
        'Каждое решение фиксируется в agentJournal с actor, scope и timestamp',
        'Известный пробел: сигнал пока булев/заголовок от клиента без одноразового крипто-тикета',
      ],
      sourceFiles: ['server/permissionManager.ts', 'server/app.ts'],
      apiRoutes: apiRoutes.filter((r) => r.hasExplicitApproval).map((r) => `${r.method} ${r.path}`),
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', '4. High-priority findings'), docRef('docs/architecture/OPERATION_LIFECYCLE.md', '6. Approval is a pause')],
      matchers: { stagePatterns: [/approval|подтверж|запрещ/i] },
    },
    {
      id: 'dead-401-403-auth',
      layerId: 'L1',
      macroId: 'macro-security-perimeter',
      kind: 'dead-end',
      title: 'ТУПИК: 401/403 Блокировка периметра',
      subtitle: 'Отказ при чужом Origin, отсутствии Bearer-токена, попытке Designer доступа к /api/projects или отказе Class C.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'Запрос жёстко отклоняется на границе Express middleware/route без побочных эффектов; повтор требует валидной сессии или подтверждения.',
      x: 380,
      y: 720,
      eventTrigger: 'dead:untrusted_or_unapproved',
      emittedEvents: ['terminal:HTTP_401_403', 'journal:security_reject'],
      microFeatures: [
        'Нет побочных эффектов на ФС, моделях или Git при 401/403',
        'Аудит отказа для Class C операций попадает в Agent Journal',
      ],
      sourceFiles: ['server/app.ts', 'server/permissionManager.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', '5. Required regression coverage')],
      matchers: { stagePatterns: [/запрещ|отклон|403|401/i] },
    },
    {
      id: 'dead-approval-ticket-missing',
      layerId: 'L1',
      macroId: 'macro-security-perimeter',
      kind: 'dead-end',
      title: 'ПРОБЕЛ / ТУПИК: Нет One-Time Approval Ticket',
      subtitle: 'Целевой одноразовый тикет (args hash + context hash + TTL + replay-protection) ещё не реализован.',
      baseStatus: 'planned-draft',
      isDeadEnd: true,
      deadEndReason: 'Архитектурный разрыв: любой клиент с валидным Bearer-токеном может передать approved: true; отсутствует серверный реестр тикетов и 409/replay защита.',
      x: 380,
      y: 880,
      eventTrigger: 'gap:ticket_check_target',
      emittedEvents: ['gap:forgeable_client_boolean'],
      microFeatures: [
        'Целевой контракт описан в execution-model.md и API_SECURITY_MATRIX.md',
        'Pre-flight тикет, expiry, привязка к session/route/project пока отсутствуют',
      ],
      sourceFiles: ['server/permissionManager.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', 'Approval Ticket'), docRef('docs/intelligence-architecture/execution-model.md', '6. Authorization, Guardrails и Confirmation')],
    },

    // ================= L2: Intent Routing & Orchestration Control =================
    {
      id: 'router-prompt-classify',
      layerId: 'L2',
      macroId: 'macro-project-agent-loop',
      kind: 'router',
      title: 'Интент-роутер (routeAgentPrompt)',
      subtitle: 'Детерминированная классификация промпта: chat | browser | terminal | project + PLAN/ACT.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 720,
      y: 70,
      eventTrigger: 'ui:route_prompt',
      emittedEvents: ['route:chat', 'route:browser', 'route:terminal', 'route:project'],
      microFeatures: [
        'Приоритет: /web,/browse -> terminal -> /git,/search,/undo -> URL+action -> project -> chat',
        'Сохраняет независимость от самооценки модели',
      ],
      sourceFiles: ['src/utils/agentRouter.ts', 'src/store/useOneCoreStore.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/SYSTEM_MAP.md', '2. Main components')],
    },
    {
      id: 'route-standard-chat',
      layerId: 'L2',
      macroId: 'macro-provider-llamaserver',
      kind: 'router',
      title: 'Ветка Chat & Role Subagent Chat',
      subtitle: 'Потоковый SSE чат через /api/providers/chat (или проектный subagent /api/agents/chat при активном проекте).',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 720,
      y: 215,
      eventTrigger: 'route:chat',
      emittedEvents: ['http:POST /api/providers/chat', 'http:POST /api/agents/chat'],
      microFeatures: [
        'При разрыве клиента abort передаётся в upstream fetch',
        'Subagent с проектом получает read-only инструменты + базу знаний',
        'Subagent без проекта идёт в прямой provider-chat без доступа к ФС',
      ],
      sourceFiles: ['server/app.ts', 'src/store/useOneCoreStore.ts'],
      apiRoutes: matchRoutes(['/api/providers/chat', '/api/agents/chat']),
      docRefs: [docRef('docs/knowledge/architecture/multi-agent-runtime.md', 'Existing implementation mapping')],
      matchers: { pathPrefixes: ['/api/providers/chat', '/api/agents/chat'], categories: ['agent', 'subagent', 'model'] },
    },
    {
      id: 'orch-general-agent',
      layerId: 'L2',
      macroId: 'macro-project-agent-loop',
      kind: 'orchestrator',
      title: 'General / Project Agent Loop',
      subtitle: 'executeGeneralAgentTask & executeProjectTask: сбор начального контекста, цикл вызовов инструментов (до 6 раундов / 12 вызовов).',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 720,
      y: 360,
      eventTrigger: 'route:project_or_worker',
      emittedEvents: ['exec:tool_loop', 'propose:diff_or_command', 'mutate:tasks_in_act_mode'],
      microFeatures: [
        'readInitialProjectContext ранжирует файлы по терминам промпта',
        'Поддержка roleKey, allowedCapabilities и provisionedContext для воркеров',
        'В ACT-режиме способен создавать/обновлять задачи проекта из ответа модели',
      ],
      sourceFiles: ['server/agentOrchestrator.ts', 'server/projectAgent.ts'],
      apiRoutes: matchRoutes(['/api/projects/:id/task']),
      docRefs: [docRef('docs/architecture/SYSTEM_MAP.md', 'Project task flow'), docRef('docs/architecture/LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md', 'Initial implemented route')],
      matchers: { pathPrefixes: ['/api/projects'], stagePatterns: [/project-agent|Контекст|раунд/i] },
    },
    {
      id: 'orch-team-run',
      layerId: 'L2',
      macroId: 'macro-team-swarm',
      kind: 'orchestrator',
      title: 'Team Orchestrator (runTeamExecution)',
      subtitle: 'Единый контроллер многоагентного запуска: до 4 циклов, до 8 задач в цикле, последовательное выполнение.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 720,
      y: 505,
      eventTrigger: 'http:POST /api/agents/team-run',
      emittedEvents: ['hooks:team_run_start', 'stage:manager_intake', 'stage:dispatcher_decompose'],
      microFeatures: [
        'Константы: MAX_CYCLES=4, MAX_TASKS_PER_CYCLE=8, MAX_NEEDS_MORE_CONTEXT_RETRIES=2',
        'Загружает ТОЛЬКО approved документы (team-execution, task-handoff, worker-result, manager, dispatcher)',
        'Детерминированный discovery-сбор файлов до первого обращения к LLM',
      ],
      sourceFiles: ['server/orchestration/teamOrchestrator.ts'],
      apiRoutes: matchRoutes(['/api/agents/team-run']),
      docRefs: [docRef('docs/knowledge/procedures/team-execution.md', 'Execution loop'), docRef('docs/knowledge/architecture/multi-agent-runtime.md', 'Layers')],
      matchers: { sources: ['team-orchestrator'], stagePatterns: [/Командный запуск|team/i] },
    },
    {
      id: 'orch-manager-approve',
      layerId: 'L2',
      macroId: 'macro-team-swarm',
      kind: 'subagent',
      title: 'Manager: Приёмка и Approve Graph (SYS)',
      subtitle: 'Утверждение графа поручений, контроль зависимостей, повторов, отмены и финальный ответ пользователю.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 720,
      y: 650,
      eventTrigger: 'stage:graph_proposed_by_dispatcher',
      emittedEvents: ['cap:approve_graph (SYS)', 'dispatch:worker_handoff', 'stage:final_acceptance'],
      microFeatures: [
        '(SYS) capability approve_graph закреплён исключительно за role.manager',
        'Статус worker completed НЕ равен завершению всей задачи без проверки Manager',
        'Решает судьбу needs_more_context vs реплан vs эскалация',
      ],
      sourceFiles: ['server/orchestration/teamOrchestrator.ts', 'server/orchestration/roleContracts.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/knowledge/roles/manager.md', 'Manager role'), docRef('docs/intelligence-architecture/delegation-model.md', '7. Приёмка результата')],
      matchers: { stagePatterns: [/role\.manager|Manager/i] },
    },
    {
      id: 'orch-dispatcher-decompose',
      layerId: 'L2',
      macroId: 'macro-team-swarm',
      kind: 'subagent',
      title: 'Dispatcher: Декомпозиция графа (SYS)',
      subtitle: 'Разбивает цель и инвентарь файлов на ограниченный ациклический граф задач (PlannedSubtask[]).',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 720,
      y: 795,
      eventTrigger: 'stage:manager_intake',
      emittedEvents: ['cap:decompose_tasks (SYS)', 'stage:graph_proposed_by_dispatcher'],
      microFeatures: [
        '(SYS) capability decompose_tasks закреплён исключительно за role.dispatcher',
        'Не выдаёт полномочия и не утверждает итоговый результат',
        'Приоритезирует retry-задачи через prioritizePendingContextRetries',
      ],
      sourceFiles: ['server/orchestration/teamOrchestrator.ts', 'server/orchestration/roleContracts.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/knowledge/roles/dispatcher.md', 'Dispatcher role'), docRef('docs/knowledge/procedures/team-execution.md', 'Decomposition')],
      matchers: { stagePatterns: [/role\.dispatcher|Dispatcher/i] },
    },
    {
      id: 'orch-context-builder',
      layerId: 'L2',
      macroId: 'macro-team-swarm',
      kind: 'orchestrator',
      title: 'Context Builder & Deduplication Cache',
      subtitle: 'Упаковка минимального Task Context: лимит 8 файлов, 16k старт / 6k на файл / 40k общий бюджет + SHA-256.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 720,
      y: 940,
      eventTrigger: 'dispatch:worker_handoff',
      emittedEvents: ['context:provisioned_to_worker', 'cache:sha256_fragment_hit'],
      microFeatures: [
        'FragmentDeduplicationCache: 512 записей, TTL 5 минут, ключ taskId+path+lines',
        'Предоставленные выдержки НЕ считаются самостоятельным чтением воркера',
        'Очищает пропущенные файлы в omittedFiles с явной причиной',
      ],
      sourceFiles: ['server/orchestration/contextBuilder.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/knowledge/protocols/file-content-provisioning.md', 'Limits & SHA-256'), docRef('docs/intelligence-architecture/task-context-package.md', 'Task Context Package')],
    },
    {
      id: 'dead-no-provider-configured',
      layerId: 'L2',
      macroId: 'macro-provider-llamaserver',
      kind: 'dead-end',
      title: 'ТУПИК: Не настроен провайдер / Нет модели',
      subtitle: 'Остановка оркестратора или чата, если ни ролевой профиль, ни основной провайдер не имеют активного URL/ключа/модели.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'resolveRoleProvider / provider route возвращает null или 400; выполнение обрывается до вызова LLM.',
      x: 720,
      y: 1085,
      eventTrigger: 'error:no_active_provider_or_model',
      emittedEvents: ['terminal:FAILED_NO_PROVIDER'],
      microFeatures: [
        'Секреты не подставляются из клиента — если ключ не сохранён в Vault, провайдер недоступен',
        'В UI отображается явная ошибка настройки провайдера',
      ],
      sourceFiles: ['server/orchestration/teamOrchestrator.ts', 'server/settingsManager.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md', '3. Provider and model lifecycle')],
    },

    // ================= L3: Swarm Roles, Contracts & Cycle Loop =================
    {
      id: 'role-discovery-readonly',
      layerId: 'L3',
      macroId: 'macro-team-swarm',
      kind: 'subagent',
      title: 'Read-Only Специалисты (Researcher / Analyst / Architect / Reviewer)',
      subtitle: 'Исследование и архитектура без права записи файлов, терминала и Git-мутаций.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1060,
      y: 70,
      eventTrigger: 'worker:start_discovery',
      emittedEvents: ['tool:read_only_fs', 'tool:read_knowledge', 'emit:worker_result_v1'],
      microFeatures: [
        `Доступно из ${Object.keys(ROLE_CONTRACTS).length} ролей: researcher (lightweight), analyst, architect (strong)`,
        'readOnly: true — инструменты write_file / run_command исключены из пересечения прав',
      ],
      sourceFiles: ['server/orchestration/roleContracts.ts'],
      apiRoutes: matchRoutes(['/api/agents/registry']),
      docRefs: [docRef('docs/knowledge/roles/researcher.md', 'Researcher'), docRef('docs/knowledge/roles/analyst.md', 'Analyst'), docRef('docs/knowledge/roles/architect.md', 'Architect')],
      matchers: { stagePatterns: [/researcher|analyst|architect/i] },
    },
    {
      id: 'role-impl-coders',
      layerId: 'L3',
      macroId: 'macro-team-swarm',
      kind: 'subagent',
      title: 'Исполнители изменений (Developer / Coder)',
      subtitle: 'Подготовка целевых изменений и предложений write_file_proposal при строгом сохранении границ проекта.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1060,
      y: 215,
      eventTrigger: 'worker:start_implementation',
      emittedEvents: ['tool:write_file_proposal', 'tool:run_command_proposal', 'emit:worker_result_v1'],
      microFeatures: [
        'developer и coder обладают capability write_file_proposal',
        'Автоматический intersection с project.allowedTools: запрет на проекте блокирует роль',
      ],
      sourceFiles: ['server/orchestration/roleContracts.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/knowledge/roles/developer.md', 'Developer'), docRef('docs/knowledge/roles/coder.md', 'Coder')],
      matchers: { stagePatterns: [/developer|coder/i] },
    },
    {
      id: 'role-qa-review',
      layerId: 'L3',
      macroId: 'macro-team-swarm',
      kind: 'subagent',
      title: 'Проверка и тесты (QA / Tester)',
      subtitle: 'Запуск проверок и регрессий с подтверждением реального exitCode, без права записи в код.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1060,
      y: 360,
      eventTrigger: 'worker:start_verification',
      emittedEvents: ['tool:run_command_proposal', 'emit:worker_result_v1'],
      microFeatures: [
        'readOnly: false только в части run_command_proposal (без write_file_proposal)',
        'Любая проверка обязана фиксироваться в checks[] с подтверждением runtime',
      ],
      sourceFiles: ['server/orchestration/roleContracts.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/knowledge/roles/qa.md', 'QA'), docRef('docs/knowledge/roles/tester.md', 'Tester')],
      matchers: { stagePatterns: [/qa|tester/i] },
    },
    {
      id: 'contract-validator-v1',
      layerId: 'L3',
      macroId: 'macro-team-swarm',
      kind: 'guard',
      title: 'Contract & Evidence Validator (v1)',
      subtitle: 'Валидация agent-handoff.v1 и worker-result.v1 + перекрёстная сверка filesInspected и checks с реальными вызовами.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1060,
      y: 505,
      eventTrigger: 'emit:worker_result_v1',
      emittedEvents: ['validate:accepted', 'retry:needs_more_context', 'dead:evidence_violation'],
      microFeatures: [
        'Изоляция evidence между воркерами: файл, прочитанный Worker A или родителем, НЕ засчитывается Worker B',
        'Публичная схема v1 запрещает утечку orchestration-internal полей (provisionedContext / evidenceRegistry)',
        'Привязка childOpId как изолированного workerId в реестре доказательств',
      ],
      sourceFiles: ['server/orchestration/contractValidator.ts'],
      apiRoutes: matchRoutes(['/api/knowledge/schemas']),
      docRefs: [
        docRef('docs/knowledge/schemas/agent-handoff.v1.schema.json', 'agent-handoff.v1'),
        docRef('docs/knowledge/schemas/worker-result.v1.schema.json', 'worker-result.v1'),
        docRef('docs/knowledge/protocols/worker-result.md', 'Validation'),
      ],
    },
    {
      id: 'retry-needs-more-context',
      layerId: 'L3',
      macroId: 'macro-team-swarm',
      kind: 'router',
      title: 'Цикл дозапроса (needs_more_context ≤ 2)',
      subtitle: 'Перезапуск той же taskId с новым childOpId и приоритетом в следующем цикле (при maxCycles ≥ 3).',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1060,
      y: 650,
      eventTrigger: 'retry:needs_more_context',
      emittedEvents: ['loop:requeue_task_with_priority', 'dead:retry_budget_exhausted'],
      microFeatures: [
        'Сохраняет taskId, acceptanceCriteria и parentOperationId при новом childOpId',
        'Жёсткий лимит: не более 2 повторов на один taskId',
        'Приоритетная очередь prioritizePendingContextRetries в начале цикла',
      ],
      sourceFiles: ['server/orchestration/teamOrchestrator.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '5. Parent/child operations'), docRef('docs/knowledge/protocols/file-content-provisioning.md', 'Retry policy')],
    },
    {
      id: 'dead-evidence-violation',
      layerId: 'L3',
      macroId: 'macro-team-swarm',
      kind: 'dead-end',
      title: 'ТУПИК: Нарушение Evidence / Контракта v1',
      subtitle: 'Отклонение отчёта воркера, если заявлены непрочитанные файлы, чужие чтения или неподтверждённые проверки.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'validateWorkerResult возвращает ok: false — галлюцинированные пути файлов или фиктивные тесты блокируют приёмку результата.',
      x: 1060,
      y: 795,
      eventTrigger: 'dead:evidence_violation',
      emittedEvents: ['terminal:CONTRACT_REJECTED'],
      microFeatures: [
        'Сверяется с confirmedReadFiles и confirmedChecks конкретного childOpId',
        'Исключает подмену факта чтения выдержками из provisionedContext',
      ],
      sourceFiles: ['server/orchestration/contractValidator.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/knowledge/protocols/worker-result.md', 'Evidence rules')],
    },
    {
      id: 'dead-retry-budget-exhausted',
      layerId: 'L3',
      macroId: 'macro-team-swarm',
      kind: 'dead-end',
      title: 'ТУПИК: Исчерпан бюджет циклов / повторов / вложенности',
      subtitle: 'Остановка при превышении 2 retry на задачу, 4 циклов, 8 задач, 40k символов или попытке вложенного делегирования.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'Защита от бесконечного разветвления (runaway fan-out): задача переводится в blocked/partial и эскалируется Manager.',
      x: 1060,
      y: 940,
      eventTrigger: 'dead:retry_budget_exhausted',
      emittedEvents: ['terminal:BLOCKED_BUDGET_CAP'],
      microFeatures: [
        'Вложенное делегирование (worker -> sub-worker) запрещено по умолчанию',
        'maxCycles по умолчанию 1: при 1 цикле needs_more_context не успевает перезапуститься',
      ],
      sourceFiles: ['server/orchestration/teamOrchestrator.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/intelligence-architecture/delegation-model.md', '5. Ограничения графа'), docRef('docs/architecture/OPERATION_LIFECYCLE.md', '9. File context provisioning')],
    },

    // ================= L4: Tools, Runtime Guard & Verification Gate =================
    {
      id: 'guard-project-allowlist',
      layerId: 'L4',
      macroId: 'macro-tools-guard',
      kind: 'guard',
      title: 'Runtime Guard: Белый список и Безопасный путь',
      subtitle: 'assertProjectToolAllowed(projectId, tool) + safeResolveInside (анти-traversal, Windows-имена, symlink trap).',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1400,
      y: 70,
      eventTrigger: 'tool:invoke_requested',
      emittedEvents: ['guard:path_and_tool_ok', 'dead:path_traversal_symlink', 'dead:tool_disabled'],
      microFeatures: [
        '5 серверных инструментов: read_file, write_file, run_command, git, search_code',
        'Блокировка CON/NUL/PRN/AUX, ADS-потоков (:stream), завершающих точек/пробелов на Windows',
        'Проверка lstatSync на каждом сегменте пути для перехвата симлинков наружу',
      ],
      sourceFiles: ['server/permissionManager.ts', 'server/projectAgent.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', '3.1 Project terminal permission identifier'), docRef('docs/architecture/SECURITY_AND_APPROVALS.md', 'Path containment')],
    },
    {
      id: 'tool-fs-read-search',
      layerId: 'L4',
      macroId: 'macro-tools-guard',
      kind: 'tool',
      title: 'Чтение и поиск по проекту (list / read / search)',
      subtitle: 'list_project_files, read_project_file (срезы строк + SHA-256) и search_project_code.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1400,
      y: 215,
      eventTrigger: 'guard:path_and_tool_ok',
      emittedEvents: ['evidence:confirmed_read', 'error:missing_file_or_bounds'],
      microFeatures: [
        `Реестр инструментов: ${toolsRegistry.summary.totalTools} инструментов, ${toolsRegistry.summary.sysSingleSubagentCount} с меткой (SYS)`,
        'readProjectFile использует синхронный fs.readFileSync с проверкой AbortSignal до и после вызова',
        'Построчная нарезка extractLineFragment с проверкой границ файла',
      ],
      sourceFiles: ['server/projectAgent.ts', 'server/orchestration/toolsRegistry.ts'],
      apiRoutes: matchRoutes(['/api/projects/:id/files', '/api/projects/:id/file', '/api/projects/:id/search', '/api/tools/registry']),
      docRefs: [docRef('docs/knowledge/protocols/file-content-provisioning.md', 'Reading & bounds'), docRef('docs/architecture/OPERATION_LIFECYCLE.md', '4. Cancellation propagation')],
      matchers: { stagePatterns: [/read_project_file|list_project_files|search_project_code/i] },
    },
    {
      id: 'tool-fs-write-undo',
      layerId: 'L4',
      macroId: 'macro-tools-guard',
      kind: 'tool',
      title: 'Запись файлов, Откат (Undo) и Git',
      subtitle: 'writeProjectFile + undoLastAction (снапшоты) и runProjectGit (read vs commit/fetch/push/init).',
      baseStatus: 'partial',
      isDeadEnd: false,
      x: 1400,
      y: 360,
      eventTrigger: 'gate:approved_execute',
      emittedEvents: ['gate:verify_bytes_and_undo', 'dead:stale_write_no_409'],
      microFeatures: [
        'После записи/отката обязательно вызывается Verification Gate',
        'Git: read-действия (status/diff/log) без Class C; commit/fetch/push/init требуют approval',
        'Ограничение: нет optimistic locking / 409 при конкурентной модификации на диске',
      ],
      sourceFiles: ['server/projectAgent.ts', 'server/projectsManager.ts'],
      apiRoutes: matchRoutes(['/api/projects/:id/undo', '/api/projects/:id/git']),
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', 'File integrity'), docRef('docs/architecture/OPERATION_LIFECYCLE.md', '7. Verification gate')],
      matchers: { categories: ['project', 'git', 'tool'] },
    },
    {
      id: 'tool-exec-terminal-hooks',
      layerId: 'L4',
      macroId: 'macro-tools-guard',
      kind: 'tool',
      title: 'Терминал, Lifecycle Hooks, Web & MCP',
      subtitle: 'execProjectCommand, runLifecycleHooks (team_run_start/end), browserTools (DuckDuckGo/read) и mcpInspector.',
      baseStatus: 'partial',
      isDeadEnd: false,
      x: 1400,
      y: 505,
      eventTrigger: 'gate:approved_execute',
      emittedEvents: ['gate:verify_command_exit', 'dead:win_process_tree_partial'],
      microFeatures: [
        'AbortSignal передаётся в child process терминала',
        'browserTools блокирует приватные/localhost SSRF адреса и требует X-OneCore-Approval',
        'mcpInspector инспектирует конфигурацию MCP без самовольного исполнения кода',
      ],
      sourceFiles: ['server/projectAgent.ts', 'server/orchestration/hookRunner.ts', 'server/browserTools.ts', 'server/orchestration/mcpInspector.ts'],
      apiRoutes: matchRoutes(['/api/projects/:id/exec', '/api/browser', '/api/mcp', '/api/hooks']),
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '4. Cancellation propagation'), docRef('docs/architecture/API_SECURITY_MATRIX.md', 'External URL / SSRF')],
      matchers: { categories: ['terminal', 'tool'], pathPrefixes: ['/api/browser'] },
    },
    {
      id: 'gate-verification',
      layerId: 'L4',
      macroId: 'macro-project-agent-loop',
      kind: 'guard',
      title: 'Verification Gate (Проверка факта)',
      subtitle: 'verifyFileContent (реальный файл + побайтовое совпадение), verifyFileRemoved и verifyCommandResult.',
      baseStatus: 'partial',
      isDeadEnd: false,
      x: 1400,
      y: 650,
      eventTrigger: 'tool:execution_finished',
      emittedEvents: ['terminal:VERIFIED_COMPLETED', 'terminal:VERIFICATION_FAILED'],
      microFeatures: [
        'Не доверяет «слову модели»: проверяет байты на диске и код возврата процесса',
        'Пробел: Git post-state, смена runtime-модели и критерии приёмки задач пока не покрыты универсальным gate',
      ],
      sourceFiles: ['server/verificationGate.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '7. Verification gate'), docRef('docs/architecture/IMPLEMENTATION_STATUS.md', 'Verification Gate')],
    },
    {
      id: 'dead-path-traversal-symlink',
      layerId: 'L4',
      macroId: 'macro-tools-guard',
      kind: 'dead-end',
      title: 'ТУПИК: Traversal / Symlink Escape / Tool Disabled',
      subtitle: 'Попытка выйти через ../, симлинк вне корня проекта или вызов отключённого в проекте инструмента.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'safeResolveInside и assertProjectToolAllowed выбрасывают ошибку ДО любых операций с диском или процессом.',
      x: 1400,
      y: 795,
      eventTrigger: 'dead:unsafe_path_or_disabled_tool',
      emittedEvents: ['terminal:BLOCKED_CONTAINMENT'],
      microFeatures: [
        'Перехват UNC-путей (\\\\server\\share), drive-relative путей и reserved-имён Windows',
        'Интеграционные тесты проверяют симлинки и обход каталогов',
      ],
      sourceFiles: ['server/projectAgent.ts', 'server/permissionManager.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/TEST_MAP.md', 'Path safety tests')],
    },
    {
      id: 'dead-win-process-tree-partial',
      layerId: 'L4',
      macroId: 'macro-operation-lifecycle',
      kind: 'dead-end',
      title: 'ОГРАНИЧЕНИЕ / ТУПИК: Неполная остановка дерева процессов (Win) и Stale Write',
      subtitle: 'child.kill() на Windows может не завершать дочерних потомков; нет 409 при устаревшем файле.',
      baseStatus: 'partial',
      isDeadEnd: true,
      deadEndReason: 'Известное ограничение текущей реализации: на Windows возможны осиротевшие подпроцессы, а запись файла перезапишет изменившийся файл без 409.',
      x: 1400,
      y: 940,
      eventTrigger: 'gap:windows_tree_or_stale_write',
      emittedEvents: ['warn:partial_cancellation_or_overwrite'],
      microFeatures: [
        'Зафиксировано в OPERATION_LIFECYCLE.md §4 и API_SECURITY_MATRIX.md §4.5',
        'Требуется tree-aware kill (taskkill /T /F или Win32 JobObject) и expectedSha256 на PUT /file',
      ],
      sourceFiles: ['server/projectAgent.ts', 'server/app.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '4. Cancellation propagation'), docRef('docs/architecture/API_SECURITY_MATRIX.md', 'File integrity')],
    },

    // ================= L5: AI Providers, LlamaServer & Model Hub =================
    {
      id: 'prov-adapters-proxy',
      layerId: 'L5',
      macroId: 'macro-provider-llamaserver',
      kind: 'provider',
      title: 'Адаптеры AI Провайдеров (Local / Cloud / Compatible)',
      subtitle: 'Серверный прокси: подставляет baseUrl и Vault API-ключ по providerId, игнорируя URL/ключи из браузера.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1740,
      y: 70,
      eventTrigger: 'llm:inference_or_discovery',
      emittedEvents: ['stream:sse_tokens', 'dead:stream_idle_timeout', 'dead:model_capability_gap'],
      microFeatures: [
        `Активных профилей провайдеров сейчас: ${configuredProviders.length}${activeProviderId ? ` (основной: ${activeProviderId})` : ''}`,
        'Local (Ollama/LM Studio), Cloud (OpenAI/OpenRouter/DeepSeek/Groq/Qwen), Compatible (множественные профили)',
        'Защита от подмены URL и утечки секретов в браузер/логи',
      ],
      sourceFiles: ['server/app.ts', 'server/settingsManager.ts', 'server/ollamaRuntime.ts'],
      apiRoutes: matchRoutes(['/api/providers']),
      docRefs: [docRef('docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md', '2. Provider classes')],
      matchers: { pathPrefixes: ['/api/providers'] },
    },
    {
      id: 'runtime-llama-server',
      layerId: 'L5',
      macroId: 'macro-provider-llamaserver',
      kind: 'provider',
      title: 'Управляемый LlamaServer (llama.cpp)',
      subtitle: 'Жизненный цикл локального процесса llama-server: установка, GPU-бэкенд (CUDA/Vulkan/CPU), OpenAI API и бенчмарк.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1740,
      y: 230,
      eventTrigger: 'llama:start_or_infer',
      emittedEvents: ['llama:process_ready', 'dead:single_llama_collision'],
      microFeatures: [
        'llamaCppInstaller скачивает/проверяет бинарник llama-server',
        'Разделение состояний: выбранная модель vs загруженная в память vs назначенная агенту',
        'Внешние клиенты честно помечены как «нет телеметрии» без вымышленных счётчиков',
      ],
      sourceFiles: ['server/llamaCppRuntime.ts', 'server/llamaCppInstaller.ts', 'server/llamaRequestHistory.ts', 'server/modelMetrics.ts'],
      apiRoutes: matchRoutes(['/api/models/llama-cpp', '/api/hardware']),
      docRefs: [docRef('docs/architecture/LLMS_RUNTIME_INTEGRATION.md', 'LlamaServer runtime'), docRef('docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md', '2.3 Provider and LlamaServer workspaces')],
      matchers: { pathPrefixes: ['/api/models/llama-cpp'] },
    },
    {
      id: 'model-hf-range-sha256',
      layerId: 'L5',
      macroId: 'macro-provider-llamaserver',
      kind: 'tool',
      title: 'Центр GGUF: HF Поиск, HTTP Range и SHA-256',
      subtitle: 'Возобновляемая докачка GGUF с Hugging Face, проверка магии GGUF + потоковая верификация SHA-256.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1740,
      y: 390,
      eventTrigger: 'model:download_or_import',
      emittedEvents: ['model:verified_local_gguf', 'model:paused_or_resumed'],
      microFeatures: [
        'Поддержка паузы/возобновления через HTTP Range',
        'Аппаратные рекомендации (VRAM/RAM) на основе server/hardware.ts',
        'Управление локальными моделями защищено явным одобрением',
      ],
      sourceFiles: ['server/modelsManager.ts', 'server/hardware.ts'],
      apiRoutes: matchRoutes(['/api/models', '/api/hf']),
      docRefs: [docRef('docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md', '2.2 Model catalog')],
      matchers: { pathPrefixes: ['/api/models/download'] },
    },
    {
      id: 'stream-sse-abort',
      layerId: 'L5',
      macroId: 'macro-operation-lifecycle',
      kind: 'gateway',
      title: 'SSE Стриминг и Abort при отключении клиента',
      subtitle: 'Проксирование токенов по SSE с контролем разрыва соединения, общим таймаутом и idle-таймаутом чанков.',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 1740,
      y: 550,
      eventTrigger: 'stream:sse_tokens',
      emittedEvents: ['ui:token_chunk', 'cancel:upstream_abort', 'dead:stream_idle_timeout'],
      microFeatures: [
        'Таймауты настраиваются в systemConfig (request=30s, idle=60s, operation=120s)',
        'При нажатии Stop в UI upstream запрос к модели прерывается немедленно',
      ],
      sourceFiles: ['server/app.ts', 'src/data/systemConfig.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '4. Cancellation propagation')],
    },
    {
      id: 'dead-single-llama-collision',
      layerId: 'L5',
      macroId: 'macro-provider-llamaserver',
      kind: 'dead-end',
      title: 'ОГРАНИЧЕНИЕ / ТУПИК: Одна GGUF-модель в LlamaServer & Capability Gap',
      subtitle: 'Единственный процесс llama-server меняет модель сразу для всех ролей; модель без tool-calling не исполняет tools.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'Смена GGUF в общем процессе влияет на всех агентов; при отсутствии function_calling модель не может вызывать инструменты и возвращает текстовое ограничение.',
      x: 1740,
      y: 720,
      eventTrigger: 'dead:model_collision_or_no_tools',
      emittedEvents: ['terminal:CAPABILITY_LIMITATION'],
      microFeatures: [
        'Способность модели !== права приложения (capability check обязателен)',
        'Полноценный Model Router с очередью VRAM — целевой этап (Draft/Partial)',
      ],
      sourceFiles: ['server/llamaCppRuntime.ts', 'server/app.ts'],
      apiRoutes: matchRoutes(['/api/providers/capabilities']),
      docRefs: [docRef('docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md', '4. Model and agent routing')],
    },
    {
      id: 'dead-stream-idle-timeout',
      layerId: 'L5',
      macroId: 'macro-operation-lifecycle',
      kind: 'dead-end',
      title: 'ТУПИК: Stream Idle Timeout / Upstream Error / Abort',
      subtitle: 'Зависание потока между чанками > providerStreamIdleTimeoutMs или отказ провайдера обрывает операцию.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'Операция переходит в FAILED или CANCELLED; частичный вывод не засчитывается как завершённый результат.',
      x: 1740,
      y: 880,
      eventTrigger: 'dead:idle_timeout_or_abort',
      emittedEvents: ['terminal:FAILED_TIMEOUT', 'terminal:CANCELLED'],
      microFeatures: [
        'Внешняя отмена через /api/operations/:id/cancel выставляет статус cancelled',
        'Автоматических слепых ретраев на неидемпотентные операции нет',
      ],
      sourceFiles: ['server/app.ts', 'server/operationRegistry.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '3. State meanings')],
    },

    // ================= L6: Persistence, Vault, Knowledge & Audit =================
    {
      id: 'state-operation-registry',
      layerId: 'L6',
      macroId: 'macro-operation-lifecycle',
      kind: 'state',
      title: 'Operation Registry (In-Memory Abort Tree)',
      subtitle: `Дерево родительских и дочерних операций (сейчас в памяти: ${operations.length}, активных: ${operations.filter((o) => o.status === 'running').length}).`,
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 2080,
      y: 70,
      eventTrigger: 'op:lifecycle_update',
      emittedEvents: ['cancel:propagate_to_children', 'snapshot:system_map'],
      microFeatures: [
        'Отмена родителя каскадно отменяет дочерних воркеров',
        'Отмена одного дочернего воркера НЕ отменяет родителя и сиблингов',
        'Ограничено памятью процесса (500 записей) — не переживает рестарт сервера',
      ],
      sourceFiles: ['server/operationRegistry.ts'],
      apiRoutes: matchRoutes(['/api/operations', '/api/system-map']),
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '4. Cancellation propagation')],
      matchers: { pathPrefixes: ['/api/operations', '/api/system-map'] },
    },
    {
      id: 'state-agent-journal-sse',
      layerId: 'L6',
      macroId: 'macro-operation-lifecycle',
      kind: 'state',
      title: 'Agent Journal & Live SSE Stream',
      subtitle: `Асинхронная запись снимков (сейчас событий: ${journalEvents.length}) + /api/agent-journal/stream с redaction.`,
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 2080,
      y: 215,
      eventTrigger: 'emit:record_agent_event',
      emittedEvents: ['sse:broadcast_journal_event'],
      microFeatures: [
        'Upsert по event.id обновляет статус события без дублей на диске',
        'Типизированные trace-поля: stageId, actorType, modelId, instructionId/Version, handoffTarget',
        'Проекция в Live Map («Процессы») и все журналы без отдельной БД процессов',
      ],
      sourceFiles: ['server/agentJournal.ts'],
      apiRoutes: matchRoutes(['/api/agent-journal']),
      docRefs: [docRef('docs/architecture/LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md', 'Trace event contract')],
      matchers: { pathPrefixes: ['/api/agent-journal'] },
    },
    {
      id: 'state-vault-v2',
      layerId: 'L6',
      macroId: 'macro-security-perimeter',
      kind: 'state',
      title: 'Encrypted Vault v2 (scrypt N=32768) & Settings',
      subtitle: 'Хранение ключей провайдеров, GitHub PAT и ботов отдельно от settings.json (с защитой битых файлов).',
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 2080,
      y: 360,
      eventTrigger: 'settings:save_secret',
      emittedEvents: ['vault:atomic_write_v2'],
      microFeatures: [
        'Формат v2: случайная соль 32 байта + scrypt cost=32768 + AES-GCM',
        'Повреждённый vault не перезаписывается молча при попытке записи',
        'GET /api/settings возвращает apiKey: "" и флаг secretConfigured: true',
      ],
      sourceFiles: ['server/vault.ts', 'server/settingsManager.ts'],
      apiRoutes: matchRoutes(['/api/settings']),
      docRefs: [docRef('docs/architecture/API_SECURITY_MATRIX.md', '3. Current implementation delta')],
      matchers: { pathPrefixes: ['/api/settings'] },
    },
    {
      id: 'state-project-workspace',
      layerId: 'L6',
      macroId: 'macro-project-agent-loop',
      kind: 'state',
      title: 'Project Workspace, Задачи, Память и Логи',
      subtitle: `Хранилище ${projects.length} проектов: метаданные, 1 план на проект, задачи, память и журнал действий.`,
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 2080,
      y: 505,
      eventTrigger: 'project:mutate_workspace',
      emittedEvents: ['project:persisted_on_disk'],
      microFeatures: [
        'Удаление проекта удаляет только запись в ONE CORE, сохраняя файлы пользователя на диске',
        'GET /api/tasks агрегирует задачи по всем проектам с projectId/projectName',
        'Ограничение: статус задачи done сам по себе не проверяет acceptance criteria',
      ],
      sourceFiles: ['server/projectsManager.ts', 'server/chatHistoryManager.ts', 'server/notesManager.ts'],
      apiRoutes: matchRoutes(['/api/projects', '/api/tasks', '/api/chat', '/api/notes']),
      docRefs: [docRef('docs/architecture/SYSTEM_MAP.md', '4. Important boundaries')],
      matchers: { categories: ['project'] },
    },
    {
      id: 'state-knowledge-vs-external',
      layerId: 'L6',
      macroId: 'macro-knowledge-external',
      kind: 'state',
      title: 'Approved Knowledge vs Изолированный «КАК У ДРУГИХ»',
      subtitle: `В базе знаний: ${approvedKnowledgeDocs.length}/${knowledgeDocs.length} approved документов; внешние заметки полностью изолированы.`,
      baseStatus: 'implemented',
      isDeadEnd: false,
      x: 2080,
      y: 650,
      eventTrigger: 'knowledge:list_or_read',
      emittedEvents: ['knowledge:approved_doc_loaded', 'dead:draft_knowledge_blocked'],
      microFeatures: [
        'YAML frontmatter: id, version, status, owner_role обязательны от 0-го байта',
        'readApprovedKnowledgeDocument отклоняет все документы со статусом != approved',
        'externalReferences.ts хранит ссылки в %ONECORE_HOME%/external-references.json вне docs/knowledge',
      ],
      sourceFiles: ['server/knowledgeManager.ts', 'server/externalReferences.ts'],
      apiRoutes: matchRoutes(['/api/knowledge', '/api/external-references']),
      docRefs: [
        docRef('docs/architecture/DOCUMENTATION_FIRST_KNOWLEDGE.md', '4. Canonical ownership'),
        docRef('docs/architecture/LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md', 'Authority boundary'),
      ],
      matchers: { pathPrefixes: ['/api/knowledge', '/api/external-references'] },
    },
    {
      id: 'ext-github-ssh-gateway',
      layerId: 'L6',
      macroId: 'macro-tools-guard',
      kind: 'gateway',
      title: 'Внешние каналы: GitHub Sync, SSH и Gateway',
      subtitle: 'Верификация GitHub (токен из Vault), синхронизация репозитория, SSH-пробы и Telegram/Discord/Slack шлюзы.',
      baseStatus: 'partial',
      isDeadEnd: false,
      x: 2080,
      y: 795,
      eventTrigger: 'ext:sync_or_verify',
      emittedEvents: ['ext:verified_or_synced'],
      microFeatures: [
        'githubRepoSync: diff, pull, push с явным одобрением и валидацией',
        'SSH/Docker Execution Environments: часть путей остаётся конфигурационной или требует проверки на Windows',
      ],
      sourceFiles: ['server/githubRepoSync.ts', 'server/app.ts'],
      apiRoutes: matchRoutes(['/api/github', '/api/ssh', '/api/gateway']),
      docRefs: [docRef('docs/architecture/IMPLEMENTATION_STATUS.md', 'Execution environments')],
      matchers: { pathPrefixes: ['/api/github', '/api/ssh', '/api/gateway'] },
    },
    {
      id: 'dead-draft-knowledge-blocked',
      layerId: 'L6',
      macroId: 'macro-knowledge-external',
      kind: 'dead-end',
      title: 'ТУПИК: Draft-документы / Нет промоута из «КАК У ДРУГИХ»',
      subtitle: 'Черновики (status: draft), внешние ссылки и docs/intelligence-architecture не попадают в runtime агентов автоматически.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'Жёсткая граница доверия: readApprovedKnowledgeDocument блокирует draft; промоут внешних идей требует ручного ревью и коммита.',
      x: 2080,
      y: 940,
      eventTrigger: 'dead:read_draft_or_external_as_rule',
      emittedEvents: ['terminal:BLOCKED_UNAPPROVED_DOC'],
      microFeatures: [
        'Файлы недоверенного проекта с похожим YAML frontmatter никогда не считаются системными знаниями',
        'Intelligence Library сейчас имеет статус Draft / архитектурный контракт',
      ],
      sourceFiles: ['server/knowledgeManager.ts', 'server/externalReferences.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/intelligence-architecture/README.md', 'Границы источников истины'), docRef('docs/knowledge/README.md', 'Runtime boundary')],
    },
    {
      id: 'dead-crash-no-recovery',
      layerId: 'L6',
      macroId: 'macro-operation-lifecycle',
      kind: 'dead-end',
      title: 'ТУПИК: Рестарт / Сбой без Crash Recovery',
      subtitle: 'В памяти OperationRegistry операции при падении процесса теряются; в журнале зависшие running-записи не восстанавливаются.',
      baseStatus: 'dead-end',
      isDeadEnd: true,
      deadEndReason: 'Архитектурный разрыв: нет durable scheduler, idempotency keys и reconciliation незавершённых операций после рестарта.',
      x: 2080,
      y: 1085,
      eventTrigger: 'dead:process_restart_or_crash',
      emittedEvents: ['terminal:ORPHANED_IN_MEMORY_OPS'],
      microFeatures: [
        'Описано в OPERATION_LIFECYCLE.md §8 и IMPLEMENTATION_STATUS.md',
        'Journal сохраняет события best-effort, но не перезапускает оборванные цепочки',
      ],
      sourceFiles: ['server/operationRegistry.ts', 'server/agentJournal.ts'],
      apiRoutes: [],
      docRefs: [docRef('docs/architecture/OPERATION_LIFECYCLE.md', '8. Recovery and idempotency')],
    },
  ];

  const nodes = rawNodes.map(makeNode);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const isEdgeLive = (from: string, to: string): boolean => {
    const src = nodeById.get(from);
    const dst = nodeById.get(to);
    return Boolean(src?.status === 'live-active' && dst?.status === 'live-active');
  };

  type RawEdgeDef = Omit<WorkflowEdge, 'isLiveActive'>;
  const rawEdges: RawEdgeDef[] = [
    // L0 -> L1/L2
    { id: 'e-chat-to-router', from: 'ui-chat-prompt', to: 'router-prompt-classify', eventName: 'ui:route_prompt', kind: 'normal' },
    { id: 'e-team-to-perimeter', from: 'ui-team-trigger', to: 'mw-loopback-origin', eventName: 'POST /api/agents/team-run', kind: 'normal' },
    { id: 'e-nav-to-perimeter', from: 'ui-nav-shell', to: 'mw-loopback-origin', eventName: 'GET/PUT /api/settings|designer', kind: 'normal' },
    { id: 'e-tools-to-perimeter', from: 'ui-tools-workspace', to: 'mw-loopback-origin', eventName: 'HTTP /api/projects|browser|notes', kind: 'normal' },
    { id: 'e-models-to-perimeter', from: 'ui-models-providers', to: 'mw-loopback-origin', eventName: 'HTTP /api/models|providers|hf', kind: 'normal' },
    { id: 'e-tauri-to-bearer', from: 'tauri-ipc-shell', to: 'mw-bearer-session', eventName: 'ipc:native_256bit_token', kind: 'normal' },
    { id: 'e-designer-to-bearer', from: 'designer-companion', to: 'mw-bearer-session', eventName: 'POST /api/designer/pairing->session', kind: 'approval', condition: 'scope=designer-only' },

    // L1 Security perimeter
    { id: 'e-origin-to-bearer', from: 'mw-loopback-origin', to: 'mw-bearer-session', eventName: 'guard:origin_passed', kind: 'normal' },
    { id: 'e-origin-dead', from: 'mw-loopback-origin', to: 'dead-401-403-auth', eventName: 'reject:bad_host_or_origin', kind: 'dead-end', condition: '403 Forbidden' },
    { id: 'e-bearer-to-op', from: 'mw-bearer-session', to: 'mw-operation-context', eventName: 'auth:session_verified', kind: 'normal' },
    { id: 'e-bearer-dead', from: 'mw-bearer-session', to: 'dead-401-403-auth', eventName: 'reject:missing_or_wrong_scope', kind: 'dead-end', condition: '401 / 403' },
    { id: 'e-op-to-approval', from: 'mw-operation-context', to: 'gate-explicit-approval', eventName: 'check:class_c_side_effect', kind: 'conditional' },
    { id: 'e-approval-dead', from: 'gate-explicit-approval', to: 'dead-401-403-auth', eventName: 'reject:approved!==true', kind: 'dead-end', condition: '403 Unconfirmed' },
    { id: 'e-approval-ticket-gap', from: 'gate-explicit-approval', to: 'dead-approval-ticket-missing', eventName: 'gap:no_one_time_ticket', kind: 'planned', condition: 'client boolean forgeable' },

    // L1 -> L2 & L6 telemetry
    { id: 'e-op-to-registry', from: 'mw-operation-context', to: 'state-operation-registry', eventName: 'startOperation()', kind: 'telemetry' },
    { id: 'e-op-to-team', from: 'mw-operation-context', to: 'orch-team-run', eventName: 'POST /api/agents/team-run', kind: 'conditional', condition: 'approved===true' },
    { id: 'e-op-to-general', from: 'mw-operation-context', to: 'orch-general-agent', eventName: 'POST /api/projects/:id/task', kind: 'conditional' },
    { id: 'e-op-to-chat', from: 'mw-operation-context', to: 'route-standard-chat', eventName: 'POST /api/providers|agents/chat', kind: 'conditional' },
    { id: 'e-approval-to-write', from: 'gate-explicit-approval', to: 'tool-fs-write-undo', eventName: 'approved:file_write|git|undo', kind: 'approval' },
    { id: 'e-approval-to-exec', from: 'gate-explicit-approval', to: 'tool-exec-terminal-hooks', eventName: 'approved:run_command|browser', kind: 'approval' },
    { id: 'e-approval-to-model', from: 'gate-explicit-approval', to: 'model-hf-range-sha256', eventName: 'approved:model_download_manage', kind: 'approval' },

    // L2 Routing & Orchestration
    { id: 'e-router-to-chat', from: 'router-prompt-classify', to: 'route-standard-chat', eventName: 'route:chat', kind: 'conditional' },
    { id: 'e-router-to-project', from: 'router-prompt-classify', to: 'orch-general-agent', eventName: 'route:project', kind: 'conditional' },
    { id: 'e-router-to-browser', from: 'router-prompt-classify', to: 'tool-exec-terminal-hooks', eventName: 'route:browser|terminal', kind: 'conditional' },
    { id: 'e-team-to-hooks', from: 'orch-team-run', to: 'tool-exec-terminal-hooks', eventName: 'hooks:team_run_start/end', kind: 'normal' },
    { id: 'e-team-to-dispatcher', from: 'orch-team-run', to: 'orch-dispatcher-decompose', eventName: 'stage:manager_intake', kind: 'normal' },
    { id: 'e-dispatcher-to-manager', from: 'orch-dispatcher-decompose', to: 'orch-manager-approve', eventName: 'cap:decompose_tasks (SYS)', kind: 'normal' },
    { id: 'e-manager-to-context', from: 'orch-manager-approve', to: 'orch-context-builder', eventName: 'cap:approve_graph (SYS)', kind: 'normal' },
    { id: 'e-team-no-provider', from: 'orch-team-run', to: 'dead-no-provider-configured', eventName: 'resolveRoleProvider===null', kind: 'dead-end' },
    { id: 'e-chat-no-provider', from: 'route-standard-chat', to: 'dead-no-provider-configured', eventName: 'missing_provider_or_model', kind: 'dead-end' },

    // L2 -> L3 Swarm
    { id: 'e-ctx-to-readonly', from: 'orch-context-builder', to: 'role-discovery-readonly', eventName: 'handoff.v1 (discovery)', kind: 'normal' },
    { id: 'e-ctx-to-coders', from: 'orch-context-builder', to: 'role-impl-coders', eventName: 'handoff.v1 (impl)', kind: 'normal' },
    { id: 'e-ctx-to-qa', from: 'orch-context-builder', to: 'role-qa-review', eventName: 'handoff.v1 (verify)', kind: 'normal' },

    // L3 Validation & Cycles
    { id: 'e-readonly-to-val', from: 'role-discovery-readonly', to: 'contract-validator-v1', eventName: 'worker-result.v1', kind: 'normal' },
    { id: 'e-coders-to-val', from: 'role-impl-coders', to: 'contract-validator-v1', eventName: 'worker-result.v1', kind: 'normal' },
    { id: 'e-qa-to-val', from: 'role-qa-review', to: 'contract-validator-v1', eventName: 'worker-result.v1', kind: 'normal' },
    { id: 'e-val-to-manager', from: 'contract-validator-v1', to: 'orch-manager-approve', eventName: 'validate:accepted', kind: 'normal' },
    { id: 'e-val-to-retry', from: 'contract-validator-v1', to: 'retry-needs-more-context', eventName: 'status:needs_more_context', kind: 'retry' },
    { id: 'e-retry-to-dispatcher', from: 'retry-needs-more-context', to: 'orch-dispatcher-decompose', eventName: 'requeue_priority (≤2)', kind: 'retry', condition: 'maxCycles ≥ 3' },
    { id: 'e-val-dead-evidence', from: 'contract-validator-v1', to: 'dead-evidence-violation', eventName: 'unconfirmed_file_or_check', kind: 'dead-end' },
    { id: 'e-retry-dead-budget', from: 'retry-needs-more-context', to: 'dead-retry-budget-exhausted', eventName: 'retryCount > 2 or cycle > 4', kind: 'dead-end' },

    // L2/L3 -> L4 Tools & Guards
    { id: 'e-gen-to-guard', from: 'orch-general-agent', to: 'guard-project-allowlist', eventName: 'tool_call (rounds ≤ 6)', kind: 'normal' },
    { id: 'e-readonly-to-guard', from: 'role-discovery-readonly', to: 'guard-project-allowlist', eventName: 'read_only_tools', kind: 'normal' },
    { id: 'e-coders-to-guard', from: 'role-impl-coders', to: 'guard-project-allowlist', eventName: 'proposal_tools', kind: 'normal' },
    { id: 'e-qa-to-guard', from: 'role-qa-review', to: 'guard-project-allowlist', eventName: 'command_proposal', kind: 'normal' },

    { id: 'e-guard-to-read', from: 'guard-project-allowlist', to: 'tool-fs-read-search', eventName: 'allowed:read_file|search_code', kind: 'normal' },
    { id: 'e-guard-to-write', from: 'guard-project-allowlist', to: 'tool-fs-write-undo', eventName: 'allowed:write_file|git', kind: 'conditional' },
    { id: 'e-guard-to-exec', from: 'guard-project-allowlist', to: 'tool-exec-terminal-hooks', eventName: 'allowed:run_command', kind: 'conditional' },
    { id: 'e-guard-dead', from: 'guard-project-allowlist', to: 'dead-path-traversal-symlink', eventName: 'reject:traversal|symlink|disabled', kind: 'dead-end' },

    { id: 'e-write-to-verify', from: 'tool-fs-write-undo', to: 'gate-verification', eventName: 'verify:file_bytes_or_removed', kind: 'normal' },
    { id: 'e-exec-to-verify', from: 'tool-exec-terminal-hooks', to: 'gate-verification', eventName: 'verify:exitCode_timeout', kind: 'normal' },
    { id: 'e-write-stale-gap', from: 'tool-fs-write-undo', to: 'dead-win-process-tree-partial', eventName: 'gap:no_409_stale_fingerprint', kind: 'planned' },
    { id: 'e-exec-win-gap', from: 'tool-exec-terminal-hooks', to: 'dead-win-process-tree-partial', eventName: 'gap:windows_child_tree_kill', kind: 'planned' },

    // L2/L4 -> L5 Providers & LlamaServer
    { id: 'e-chat-to-prov', from: 'route-standard-chat', to: 'prov-adapters-proxy', eventName: 'POST /api/providers/chat', kind: 'normal' },
    { id: 'e-gen-to-prov', from: 'orch-general-agent', to: 'prov-adapters-proxy', eventName: 'executeGeneralAgentTask()', kind: 'normal' },
    { id: 'e-prov-to-llama', from: 'prov-adapters-proxy', to: 'runtime-llama-server', eventName: 'kind===llama-cpp', kind: 'conditional' },
    { id: 'e-prov-to-sse', from: 'prov-adapters-proxy', to: 'stream-sse-abort', eventName: 'upstream_sse_response', kind: 'normal' },
    { id: 'e-llama-to-sse', from: 'runtime-llama-server', to: 'stream-sse-abort', eventName: '127.0.0.1 OpenAI SSE', kind: 'normal' },
    { id: 'e-model-to-llama', from: 'model-hf-range-sha256', to: 'runtime-llama-server', eventName: 'activateLocalModel()', kind: 'normal' },
    { id: 'e-llama-collision', from: 'runtime-llama-server', to: 'dead-single-llama-collision', eventName: 'single_process_overwrite', kind: 'dead-end' },
    { id: 'e-prov-cap-gap', from: 'prov-adapters-proxy', to: 'dead-single-llama-collision', eventName: 'no_function_calling', kind: 'dead-end' },
    { id: 'e-sse-timeout', from: 'stream-sse-abort', to: 'dead-stream-idle-timeout', eventName: 'idle>60s or client_abort', kind: 'dead-end' },

    // L4/L5/L2 -> L6 Persistence, Vault, Knowledge & Audit
    { id: 'e-verify-to-workspace', from: 'gate-verification', to: 'state-project-workspace', eventName: 'commit:verified_state', kind: 'normal' },
    { id: 'e-verify-to-journal', from: 'gate-verification', to: 'state-agent-journal-sse', eventName: 'recordAgentEvent()', kind: 'telemetry' },
    { id: 'e-prov-to-vault', from: 'prov-adapters-proxy', to: 'state-vault-v2', eventName: 'getProviderConnection(vault)', kind: 'normal' },
    { id: 'e-read-to-knowledge', from: 'tool-fs-read-search', to: 'state-knowledge-vs-external', eventName: 'list/read_knowledge_document', kind: 'normal' },
    { id: 'e-team-to-knowledge', from: 'orch-team-run', to: 'state-knowledge-vs-external', eventName: 'safeReadApproved()', kind: 'normal' },
    { id: 'e-knowledge-draft-dead', from: 'state-knowledge-vs-external', to: 'dead-draft-knowledge-blocked', eventName: 'status!==approved or external_ref', kind: 'dead-end' },
    { id: 'e-op-crash-dead', from: 'state-operation-registry', to: 'dead-crash-no-recovery', eventName: 'process_exit_without_recovery', kind: 'dead-end' },
    { id: 'e-workspace-to-ext', from: 'state-project-workspace', to: 'ext-github-ssh-gateway', eventName: 'sync_github_or_gateway', kind: 'conditional' },
    { id: 'e-ext-to-vault', from: 'ext-github-ssh-gateway', to: 'state-vault-v2', eventName: 'read_pat_or_bot_token', kind: 'normal' },
    { id: 'e-sse-to-journal', from: 'stream-sse-abort', to: 'state-agent-journal-sse', eventName: 'record_stream_outcome', kind: 'telemetry' },
  ];

  const edges: WorkflowEdge[] = rawEdges.map((edge) => ({
    ...edge,
    isLiveActive: isEdgeLive(edge.from, edge.to),
  }));

  // Link documents catalog <-> nodes automatically
  for (const node of nodes) {
    for (const ref of node.docRefs) {
      const entry = docsByPath.get(ref.path);
      if (entry && !entry.linkedNodeIds.includes(node.id)) {
        entry.linkedNodeIds.push(node.id);
      }
    }
  }

  // Build Macro-Workflow Layer Unpackings (8 major workflows)
  const macros: MacroWorkflowSpec[] = [
    {
      id: 'macro-team-swarm',
      title: '1. Рой субагентов и Командная оркестрация (Team Execution)',
      subtitle: 'Полная распаковка цикла Manager → Dispatcher → Context Builder → Sequential Workers → Contract Validator → Acceptance.',
      status: 'implemented',
      entryEvent: 'POST /api/agents/team-run { projectId, objective, maxCycles }',
      terminalStates: ['COMPLETED (accepted)', 'PARTIAL / BLOCKED (budget cap)', 'FAILED (contract/no-provider)', 'CANCELLED (parent/child abort)'],
      layers: [
        {
          layer: 'Layer 1 · Вход и одобрение границ',
          stateName: 'CREATED -> RUNNING',
          actor: 'server/app.ts + permissionManager',
          summary: 'Проверка Bearer-токена, approve gate, создание parentOperationId в OperationRegistry и запуск lifecycle hooks (team_run_start).',
          nodeIds: ['ui-team-trigger', 'mw-loopback-origin', 'mw-bearer-session', 'mw-operation-context', 'gate-explicit-approval'],
          deadEnds: ['dead-401-403-auth'],
        },
        {
          layer: 'Layer 2 · Discovery и Декомпозиция',
          stateName: 'PLANNING -> GRAPH_APPROVAL',
          actor: 'Manager + Dispatcher (SYS)',
          summary: 'Детерминированное индексирование до 200 файлов (без LLM-токенов), вызов Dispatcher (decompose_tasks SYS) и утверждение графа Manager (approve_graph SYS, до 8 задач).',
          nodeIds: ['orch-team-run', 'orch-dispatcher-decompose', 'orch-manager-approve'],
          deadEnds: ['dead-no-provider-configured'],
        },
        {
          layer: 'Layer 3 · Изоляция контекста и Воркеры',
          stateName: 'EXECUTING_WORKERS (Sequential)',
          actor: 'contextBuilder + 10 ROLE_CONTRACTS',
          summary: 'Формирование Task Context (max 8 файлов, 16k начальных / 6k на файл / 40k общий бюджет + SHA-256 кэш 5 мин) и последовательный запуск воркеров с дочерним childOpId.',
          nodeIds: ['orch-context-builder', 'role-discovery-readonly', 'role-impl-coders', 'role-qa-review'],
          deadEnds: [],
        },
        {
          layer: 'Layer 4 · Валидация Evidence и Петли повтора',
          stateName: 'VERIFYING -> ACCEPTED | RETRY | BLOCKED',
          actor: 'contractValidator + teamOrchestrator',
          summary: 'Строгая сверка worker-result.v1 (filesInspected и checks строго своего childOpId), при needs_more_context — приоритетный перезапуск (≤ 2 раза при maxCycles ≥ 3).',
          nodeIds: ['contract-validator-v1', 'retry-needs-more-context'],
          deadEnds: ['dead-evidence-violation', 'dead-retry-budget-exhausted'],
        },
      ],
      docRefs: [
        docRef('docs/knowledge/procedures/team-execution.md', 'Full procedure'),
        docRef('docs/knowledge/architecture/multi-agent-runtime.md', '6-Layer architecture'),
        docRef('docs/intelligence-architecture/delegation-model.md', 'Delegation contract'),
        docRef('docs/knowledge/protocols/file-content-provisioning.md', 'Budgets & SHA-256'),
      ],
      sourceFiles: [
        'server/orchestration/teamOrchestrator.ts',
        'server/orchestration/contextBuilder.ts',
        'server/orchestration/contractValidator.ts',
        'server/orchestration/roleContracts.ts',
      ],
    },
    {
      id: 'macro-project-agent-loop',
      title: '2. Исполнительный контур General / Project Agent',
      subtitle: 'От пользовательского промпта и классификатора routeAgentPrompt через tool-раунды (≤6) до предложений diff/команд и VerificationGate.',
      status: 'implemented',
      entryEvent: 'user.submit_prompt -> routeAgentPrompt() -> POST /api/projects/:id/task',
      terminalStates: ['COMPLETED (verified)', 'WAITING_FOR_APPROVAL (proposal)', 'FAILED (verification)', 'CANCELLED'],
      layers: [
        {
          layer: 'Layer 0 · Классификация и режим',
          stateName: 'INTAKE -> ROUTED (PLAN | ACT)',
          actor: 'agentRouter.ts',
          summary: 'Разделение на chat / browser / terminal / project и вывод PLAN/ACT по глаголам действия и slash-командам.',
          nodeIds: ['ui-chat-prompt', 'router-prompt-classify'],
          deadEnds: [],
        },
        {
          layer: 'Layer 2 · Цикл General Agent',
          stateName: 'CONTEXT_LOAD -> TOOL_LOOP (max 6 rounds / 12 calls)',
          actor: 'agentOrchestrator.ts',
          summary: 'Ранжирование файлов проекта, сбор начального контекста и многораундовые вызовы read-only и knowledge инструментов с отсечкой по бюджету.',
          nodeIds: ['orch-general-agent', 'state-knowledge-vs-external'],
          deadEnds: ['dead-no-provider-configured'],
        },
        {
          layer: 'Layer 4 · Предложения и Verification Gate',
          stateName: 'WAITING_FOR_APPROVAL -> EXECUTING_TOOL -> VERIFYING',
          actor: 'projectAgent.ts + verificationGate.ts',
          summary: 'Запись файлов, терминал и /undo подтверждаются пользователем; после исполнения проверяются фактические байты на диске и exitCode.',
          nodeIds: ['gate-explicit-approval', 'tool-fs-write-undo', 'gate-verification', 'state-project-workspace'],
          deadEnds: ['dead-path-traversal-symlink', 'dead-win-process-tree-partial'],
        },
      ],
      docRefs: [
        docRef('docs/architecture/SYSTEM_MAP.md', 'Project task flow'),
        docRef('docs/architecture/LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md', 'Initial implemented route'),
        docRef('docs/architecture/OPERATION_LIFECYCLE.md', 'Verification gate'),
      ],
      sourceFiles: ['src/utils/agentRouter.ts', 'server/agentOrchestrator.ts', 'server/projectAgent.ts', 'server/verificationGate.ts'],
    },
    {
      id: 'macro-security-perimeter',
      title: '3. Периметр безопасности, Vault v2 и Матрица одобрений',
      subtitle: 'Слоистая защита локального сервера, шифрование секретов scrypt N=32768 и карта пробелов безопасности (одноразовые тикеты).',
      status: 'partial',
      entryEvent: 'http.incoming_request -> Origin + Bearer + Approval + Path/Allowlist',
      terminalStates: ['AUTHORIZED', '401/403 REJECTED', 'GAP: CLIENT-FORGEABLE BOOLEAN'],
      layers: [
        {
          layer: 'Layer 1 · Сетевой периметр и токен',
          stateName: 'LOOPBACK -> ORIGIN -> BEARER_256',
          actor: 'server/app.ts + src-tauri/src/lib.rs',
          summary: 'Отклонение не-loopback Host, проверка Fetch Metadata/Origin, проверка SHA-256 Bearer-токена или scope Designer.',
          nodeIds: ['mw-loopback-origin', 'mw-bearer-session', 'tauri-ipc-shell', 'designer-companion'],
          deadEnds: ['dead-401-403-auth'],
        },
        {
          layer: 'Layer 1/4 · Явное одобрение Class C и Tool Guard',
          stateName: 'WAIT_APPROVAL -> CHECK_ALLOWLIST -> CHECK_PATH',
          actor: 'permissionManager.ts + projectAgent.ts',
          summary: 'Проверка approved===true на 15+ Class C скоупах, allowlist из 5 серверных ProjectTool и защита от симлинков/traversal.',
          nodeIds: ['gate-explicit-approval', 'guard-project-allowlist'],
          deadEnds: ['dead-approval-ticket-missing', 'dead-path-traversal-symlink'],
        },
        {
          layer: 'Layer 6 · Зашифрованное хранилище секретов',
          stateName: 'VAULT_ENCRYPTED (scrypt v2)',
          actor: 'vault.ts + settingsManager.ts',
          summary: 'Ключи провайдеров, GitHub PAT и Telegram токены никогда не возвращаются в UI и не пишутся в settings.json.',
          nodeIds: ['state-vault-v2'],
          deadEnds: [],
        },
      ],
      docRefs: [
        docRef('docs/architecture/API_SECURITY_MATRIX.md', 'Full audit matrix'),
        docRef('docs/architecture/REALTIME_SERVER_AUTH_CONTRACT.md', 'Auth contract'),
        docRef('docs/architecture/SECURITY_AND_APPROVALS.md', 'Security architecture'),
      ],
      sourceFiles: ['server/app.ts', 'server/permissionManager.ts', 'server/vault.ts'],
    },
    {
      id: 'macro-operation-lifecycle',
      title: '4. Жизненный цикл операций, Отмена (Abort Tree) и Live SSE',
      subtitle: 'Иерархия parent/child AbortController, трансляция событий в Agent Journal SSE и известные границы на Windows / Crash Recovery.',
      status: 'partial',
      entryEvent: 'startOperation() -> AsyncLocalStorage -> SSE /api/agent-journal/stream',
      terminalStates: ['COMPLETED', 'FAILED', 'CANCELLED (scoped)', 'ORPHANED_ON_CRASH'],
      layers: [
        {
          layer: 'Layer 1/6 · Идентификация и дерево отмены',
          stateName: 'CREATED -> RUNNING -> ABORT_TREE',
          actor: 'operationRegistry.ts',
          summary: 'Каждая операция получает operationId и AbortController; parent cancellation отменяет детей, но child cancellation изолирован от сиблингов.',
          nodeIds: ['mw-operation-context', 'state-operation-registry'],
          deadEnds: ['dead-crash-no-recovery'],
        },
        {
          layer: 'Layer 4/5 · Прокидывание сигнала остановки',
          stateName: 'UPSTREAM_ABORT | SUBPROCESS_SIGNAL',
          actor: 'app.ts + projectAgent.ts',
          summary: 'Остановка upstream LLM fetch по abort клиента, проверка сигнала вокруг fs.readFileSync и остановка терминальных команд.',
          nodeIds: ['stream-sse-abort', 'tool-exec-terminal-hooks'],
          deadEnds: ['dead-stream-idle-timeout', 'dead-win-process-tree-partial'],
        },
        {
          layer: 'Layer 6 · Трассировка и Live UI',
          stateName: 'JOURNAL_UPSERT -> SSE_PUSH',
          actor: 'agentJournal.ts + ProcessesPage.tsx',
          summary: 'Upsert по event.id, bounded snapshot на диск и живое обновление UI через EventSource / fetch stream.',
          nodeIds: ['state-agent-journal-sse'],
          deadEnds: [],
        },
      ],
      docRefs: [
        docRef('docs/architecture/OPERATION_LIFECYCLE.md', 'Lifecycle states'),
        docRef('docs/architecture/LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md', 'Live map & SSE'),
      ],
      sourceFiles: ['server/operationRegistry.ts', 'server/agentJournal.ts', 'src/pages/context/ProcessesPage.tsx'],
    },
    {
      id: 'macro-provider-llamaserver',
      title: '5. AI Провайдеры, Управляемый LlamaServer и Центр GGUF',
      subtitle: 'Маршрут от выбора профиля (Local/Cloud/Compatible/LlamaServer) до скачивания GGUF по HTTP Range и инференса.',
      status: 'implemented',
      entryEvent: 'user.configure_provider_or_model -> /api/providers/* | /api/models/*',
      terminalStates: ['STREAMING_COMPLETED', 'LOCAL_GGUF_VERIFIED', 'CAPABILITY_LIMITATION', 'IDLE_TIMEOUT'],
      layers: [
        {
          layer: 'Layer 0/5 · Адаптеры и профили',
          stateName: 'PROFILE_RESOLVED -> VAULT_KEY_INJECTED',
          actor: 'ProvidersPage + app.ts',
          summary: 'Локальные Ollama/LM Studio, облачные API и Compatible эндпоинты с привязкой к ролям субагентов.',
          nodeIds: ['ui-models-providers', 'prov-adapters-proxy', 'state-vault-v2'],
          deadEnds: ['dead-no-provider-configured'],
        },
        {
          layer: 'Layer 5 · Центр GGUF и LlamaServer',
          stateName: 'HF_RANGE_DOWNLOAD -> SHA256_OK -> LLAMA_SERVER_SPAWN',
          actor: 'modelsManager + llamaCppRuntime',
          summary: 'Пауза/докачка GGUF, проверка заголовка GGUF + SHA256, автодетект GPU и запуск OpenAI-совместимого sidecar.',
          nodeIds: ['model-hf-range-sha256', 'runtime-llama-server', 'stream-sse-abort'],
          deadEnds: ['dead-single-llama-collision', 'dead-stream-idle-timeout'],
        },
      ],
      docRefs: [
        docRef('docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md', 'Provider & LlamaServer contracts'),
        docRef('docs/architecture/LLMS_RUNTIME_INTEGRATION.md', 'Runtime integration'),
      ],
      sourceFiles: ['server/modelsManager.ts', 'server/llamaCppRuntime.ts', 'server/llamaCppInstaller.ts', 'server/ollamaRuntime.ts', 'server/hardware.ts'],
    },
    {
      id: 'macro-knowledge-external',
      title: '6. База знаний (Documentation-First) и Изоляция «КАК У ДРУГИХ»',
      subtitle: 'Строгое разделение утверждённых runtime-правил (YAML status: approved), Draft-контрактов и внешней библиотеки исследований.',
      status: 'implemented',
      entryEvent: 'list_knowledge_documents | read_knowledge_document | /api/external-references',
      terminalStates: ['APPROVED_DOC_LOADED', 'DRAFT_BLOCKED', 'EXTERNAL_ISOLATED'],
      layers: [
        {
          layer: 'Layer 4/6 · Runtime Knowledge Manager',
          stateName: 'SCAN_FRONTMATTER -> FILTER_APPROVED_ONLY',
          actor: 'knowledgeManager.ts',
          summary: 'Читает роли, процедуры, протоколы и уроки из docs/knowledge; к загрузке агентом допускаются только status: approved.',
          nodeIds: ['tool-fs-read-search', 'state-knowledge-vs-external'],
          deadEnds: ['dead-draft-knowledge-blocked'],
        },
        {
          layer: 'Layer 6 · Внешний справочник «КАК У ДРУГИХ»',
          stateName: 'VALIDATE_HTTP_URL -> STORE_OUTSIDE_KNOWLEDGE',
          actor: 'externalReferences.ts',
          summary: 'Отдельное хранилище external-references.json в %ONECORE_HOME%; никогда не сканируется Knowledge Manager и не становится инструкцией.',
          nodeIds: ['state-knowledge-vs-external'],
          deadEnds: ['dead-draft-knowledge-blocked'],
        },
      ],
      docRefs: [
        docRef('docs/architecture/DOCUMENTATION_FIRST_KNOWLEDGE.md', 'Knowledge rules'),
        docRef('docs/knowledge/README.md', 'Runtime knowledge boundary'),
        docRef('docs/intelligence-architecture/README.md', 'Draft Intelligence Library'),
      ],
      sourceFiles: ['server/knowledgeManager.ts', 'server/externalReferences.ts'],
    },
    {
      id: 'macro-tools-guard',
      title: '7. Файловая изоляция, Терминал, Git, Браузер, MCP и Внешние шлюзы',
      subtitle: 'Механизмы защиты ФС, смешанный контроль Git, анти-SSRF веб-инструменты, MCP инспектор и внешние интеграции.',
      status: 'partial',
      entryEvent: 'tool_call | /api/projects/:id/git | /api/browser/* | /api/github/* | /api/mcp/*',
      terminalStates: ['EXECUTED_AND_VERIFIED', 'BLOCKED_CONTAINMENT', 'BLOCKED_TOOL_ALLOWLIST'],
      layers: [
        {
          layer: 'Layer 4 · Проверка прав и путей',
          stateName: 'CHECK_ALLOWLIST -> SAFE_RESOLVE_NO_SYMLINK',
          actor: 'permissionManager + projectAgent',
          summary: 'Проверка белого списка инструментов проекта и жёсткая локализация путей без симлинков, reserved-имён и traversal.',
          nodeIds: ['guard-project-allowlist', 'tool-fs-read-search', 'tool-fs-write-undo'],
          deadEnds: ['dead-path-traversal-symlink'],
        },
        {
          layer: 'Layer 4/6 · Исполнение и Внешние коннекторы',
          stateName: 'RUN_HOOKS_OR_COMMAND -> SYNC_EXTERNAL',
          actor: 'hookRunner + browserTools + mcpInspector + githubRepoSync',
          summary: 'Хуки жизненного цикла, анти-SSRF поиск/чтение страниц, инспекция MCP, GitHub diff/pull/push и Telegram/SSH проверки.',
          nodeIds: ['tool-exec-terminal-hooks', 'ext-github-ssh-gateway'],
          deadEnds: ['dead-win-process-tree-partial'],
        },
      ],
      docRefs: [
        docRef('docs/architecture/API_SECURITY_MATRIX.md', 'Project & external routes'),
        docRef('docs/architecture/AGENT_REGISTRY_AND_CONTEXT.md', 'Tools & MCP'),
      ],
      sourceFiles: ['server/projectAgent.ts', 'server/browserTools.ts', 'server/orchestration/mcpInspector.ts', 'server/orchestration/hookRunner.ts', 'server/githubRepoSync.ts'],
    },
    {
      id: 'macro-ui-tauri-designer',
      title: '8. Оболочка UI Shell, Tauri 2 IPC и Конфигурации Designer',
      subtitle: 'Синхронизация 10-групповой навигации, дерева видимости, ревизий конфигурации и сопряжения с desktop-редактором.',
      status: 'implemented',
      entryEvent: 'Tauri launch | Navigation click | Designer pairing',
      terminalStates: ['SHELL_SYNCED', 'REVISION_APPLIED', 'REVISION_ROLLED_BACK'],
      layers: [
        {
          layer: 'Layer 0 · Оболочка и Desktop WebView2',
          stateName: 'TAURI_SPAWN -> SHELL_HYDRATION',
          actor: 'src-tauri + AppNavigation + PageSubNavigation',
          summary: 'Запуск локального Node-бэкенда, выдача токена через IPC и рендер 3-колоночного интерфейса с единой лентой навигации.',
          nodeIds: ['tauri-ipc-shell', 'ui-nav-shell'],
          deadEnds: [],
        },
        {
          layer: 'Layer 0/1/6 · Designer Configuration Engine',
          stateName: 'PAIR_APPROVED -> DRAFT -> VALIDATE_CYCLES -> APPLY_OR_RESTORE',
          actor: 'configurationManager + configurationEngine',
          summary: 'Мерж слоёв конфигурации с защитой от prototype-pollution, проверкой глубины JSON и циклов зависимостей, и откатом ревизий.',
          nodeIds: ['designer-companion', 'mw-bearer-session', 'dead-401-403-auth'],
          deadEnds: ['dead-401-403-auth'],
        },
      ],
      docRefs: [
        docRef('docs/architecture/NAVIGATION_AND_SHELL.md', 'Navigation & Shell'),
        docRef('docs/governance/AI_WORKING_RULES.md', 'UI Architecture rules'),
      ],
      sourceFiles: ['src/data/appNavigation.ts', 'src/data/componentRegistry.ts', 'server/configurationManager.ts', 'server/configurationEngine.ts', 'src-tauri/src/lib.rs'],
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    scanSummary: {
      totalDocs: docsCatalog.length,
      totalApiRoutes: apiRoutes.length,
      totalServerModules: serverModules.length,
      totalUiPages: uiPages.length,
      totalUiComponents: uiComponents.length,
      totalTauriCommands: tauriCommands.length,
      totalDesignerModules: designerModules.length,
      totalKnowledgeDocs: knowledgeDocs.length,
      approvedKnowledgeDocs: approvedKnowledgeDocs.length,
      totalRoles: Object.keys(ROLE_CONTRACTS).length,
      totalTools: toolsRegistry.summary.totalTools,
      sysToolsCount: toolsRegistry.summary.sysSingleSubagentCount,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      deadEndCount: nodes.filter((n) => n.isDeadEnd).length,
      liveActiveNodes: nodes.filter((n) => n.status === 'live-active').length,
      observedJournalEvents: journalEvents.length,
      inMemoryOperations: operations.length,
      activeOperationsCount: operations.filter((o) => o.status === 'running').length,
      connectedProjectsCount: projects.length,
      configuredProvidersCount: configuredProviders.length,
      activeProviderId,
    },
    layers: LAYERS,
    macros,
    nodes,
    edges,
    documentsCatalog: docsCatalog,
    apiRoutes,
    tauriCommands,
  };
}

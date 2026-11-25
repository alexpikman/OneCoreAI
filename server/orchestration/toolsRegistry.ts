import fs from 'node:fs';
import path from 'node:path';
import { listKnowledgeDocuments, type KnowledgeDocumentSummary } from '../knowledgeManager';
import { ROLE_CONTRACTS, type ModelTier } from './roleContracts';

export type AgentToolCategory =
  | 'filesystem'
  | 'mutation'
  | 'execution'
  | 'knowledge-orchestration'
  | 'web-external';

export type ToolEnforcementStatus =
  | 'runtime-enforced'
  | 'approval-required'
  | 'orchestration-enforced';

export interface ToolSubagentAccess {
  roleKey: string;
  title: string;
  knowledgeDocId: string;
  capability: string;
  accessMode: 'read-only' | 'proposal-only' | 'orchestration';
  readOnly: boolean;
  modelTier: ModelTier;
}

export interface ToolDocumentBinding {
  docId?: string;
  title: string;
  path: string;
  section: string;
  status: string;
  verifiedOnDisk: boolean;
}

export interface ToolEntityBinding {
  entityType: 'Module' | 'Contract' | 'Schema' | 'Endpoint' | 'Policy' | 'Gate' | 'Store';
  name: string;
  path: string;
  note: string;
}

export interface ToolInteractionSchema {
  operationId: string;
  protocol: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  effects: string[];
  authorizationAndGuardrails: string[];
  confirmationPolicy: string;
  flowSteps: string[];
  documentBindings: ToolDocumentBinding[];
  entityBindings: ToolEntityBinding[];
}

export interface AgentToolRegistryEntry {
  toolId: string;
  capabilityKey: string | null;
  title: string;
  subtitle: string;
  category: AgentToolCategory;
  enforcementStatus: ToolEnforcementStatus;
  projectPermissionGate: string | null;
  generalAgentAccess: {
    allowed: boolean;
    modeConstraint: string;
    mechanism: string;
  };
  subagentAccess: ToolSubagentAccess[];
  subagentAccessNote: string;
  isSysSingleSubagent: boolean;
  sysDelegatedFrom: string | null;
  sysReason: string | null;
  interactionSchema: ToolInteractionSchema;
}

export interface AgentToolsRegistryPayload {
  tools: AgentToolRegistryEntry[];
  summary: {
    totalTools: number;
    sysSingleSubagentCount: number;
    subagentEnabledCount: number;
    generalAgentDirectCount: number;
    verifiedDocumentsCount: number;
  };
}

interface DocumentSpecInput {
  docId?: string;
  title: string;
  path: string;
  section: string;
  fallbackStatus?: string;
}

function buildRoleAccessForCapability(
  capability: string,
  accessModeOverride?: ToolSubagentAccess['accessMode'],
): ToolSubagentAccess[] {
  return Object.values(ROLE_CONTRACTS)
    .filter((contract) => contract.allowedCapabilities.includes(capability))
    .map((contract) => ({
      roleKey: contract.roleKey,
      title: contract.title,
      knowledgeDocId: contract.knowledgeDocId,
      capability,
      accessMode:
        accessModeOverride ??
        (capability === 'approve_graph' || capability === 'decompose_tasks'
          ? 'orchestration'
          : contract.readOnly
            ? 'read-only'
            : 'proposal-only'),
      readOnly: contract.readOnly,
      modelTier: contract.modelTier,
    }));
}

export function buildAgentToolsRegistry(rootDir: string): AgentToolsRegistryPayload {
  const knowledgeRoot = path.join(rootDir, 'docs', 'knowledge');
  let knowledgeDocs: KnowledgeDocumentSummary[] = [];
  try {
    knowledgeDocs = listKnowledgeDocuments(knowledgeRoot);
  } catch {
    knowledgeDocs = [];
  }
  const docsById = new Map(knowledgeDocs.map((doc) => [doc.id, doc]));
  const docsByRelPath = new Map(
    knowledgeDocs.map((doc) => [`docs/knowledge/${doc.relativePath.replace(/\\/g, '/')}`, doc]),
  );

  const resolveDocs = (specs: DocumentSpecInput[]): ToolDocumentBinding[] =>
    specs.map((spec) => {
      const normalizedPath = spec.path.replace(/\\/g, '/');
      const knowledgeDoc =
        (spec.docId ? docsById.get(spec.docId) : undefined) ?? docsByRelPath.get(normalizedPath);
      const verifiedOnDisk = fs.existsSync(path.join(rootDir, normalizedPath));
      const status = knowledgeDoc?.status ?? spec.fallbackStatus ?? (verifiedOnDisk ? 'documented' : 'missing');
      return {
        ...(spec.docId ? { docId: spec.docId } : knowledgeDoc ? { docId: knowledgeDoc.id } : {}),
        title: knowledgeDoc?.title ?? spec.title,
        path: normalizedPath,
        section: spec.section,
        status,
        verifiedOnDisk,
      };
    });

  const makeEntry = (config: {
    toolId: string;
    capabilityKey: string | null;
    title: string;
    subtitle: string;
    category: AgentToolCategory;
    enforcementStatus: ToolEnforcementStatus;
    projectPermissionGate: string | null;
    generalAgentAccess: AgentToolRegistryEntry['generalAgentAccess'];
    subagentCapability?: string;
    subagentAccessMode?: ToolSubagentAccess['accessMode'];
    subagentAccessNote: string;
    sysDelegatedFrom?: string | null;
    sysReason?: string | null;
    interactionSchema: Omit<ToolInteractionSchema, 'documentBindings'> & {
      documentSpecs: DocumentSpecInput[];
    };
  }): AgentToolRegistryEntry => {
    const subagentAccess = config.subagentCapability
      ? buildRoleAccessForCapability(config.subagentCapability, config.subagentAccessMode)
      : [];
    const isSysSingleSubagent = subagentAccess.length === 1;
    const { documentSpecs, ...schemaRest } = config.interactionSchema;

    return {
      toolId: config.toolId,
      capabilityKey: config.capabilityKey,
      title: config.title,
      subtitle: config.subtitle,
      category: config.category,
      enforcementStatus: config.enforcementStatus,
      projectPermissionGate: config.projectPermissionGate,
      generalAgentAccess: config.generalAgentAccess,
      subagentAccess,
      subagentAccessNote: config.subagentAccessNote,
      isSysSingleSubagent,
      sysDelegatedFrom: isSysSingleSubagent ? (config.sysDelegatedFrom ?? 'General Agent / Координатор') : null,
      sysReason: isSysSingleSubagent ? (config.sysReason ?? null) : null,
      interactionSchema: {
        ...schemaRest,
        documentBindings: resolveDocs(documentSpecs),
      },
    };
  };

  const tools: AgentToolRegistryEntry[] = [
    makeEntry({
      toolId: 'list_project_files',
      capabilityKey: 'list_files',
      title: 'Инвентаризация файлов проекта',
      subtitle: 'Детерминированное перечисление относительных путей, языков и размеров файлов проекта',
      category: 'filesystem',
      enforcementStatus: 'runtime-enforced',
      projectPermissionGate: 'read_file',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'PLAN и ACT (read-only)',
        mechanism: 'OpenAI Function Tool в executeGeneralAgentTask() + listProjectFiles()',
      },
      subagentCapability: 'list_files',
      subagentAccessMode: 'read-only',
      subagentAccessNote: 'Доступно всем 10 встроенным ролям субагентов при активном разрешении проекта read_file.',
      interactionSchema: {
        operationId: 'fs.project.list_files',
        protocol: 'OpenAI Function Calling (tools) / Deterministic Team Discovery',
        inputSchema: {
          limit: 'maxFiles = 250 (для LLM tool) / 200 (для team discovery)',
        },
        outputSchema: {
          files: 'Array<{ path: string; language: string; sizeBytes: number }>',
        },
        effects: ['filesystem.read'],
        authorizationAndGuardrails: [
          'assertProjectToolAllowed(projectId, "read_file")',
          'Исключение IGNORED_DIRS (node_modules, .git, dist, target и т.д.)',
          'Лимит выдачи (250 путей), чтобы не тратить токены на обход дерева',
        ],
        confirmationPolicy: 'none (read-only)',
        flowSteps: [
          '1. Агент или оркестратор запрашивает list_project_files',
          '2. permissionManager проверяет флаг read_file в проекте',
          '3. projectAgent.listProjectFiles() обходит корень проекта без симлинков вне корня',
          '4. Результат фиксируется как evidence: "listed" (не считается чтением файла)',
        ],
        documentSpecs: [
          {
            docId: 'protocol.file-content-provisioning',
            title: 'File Content Provisioning Protocol',
            path: 'docs/knowledge/protocols/file-content-provisioning.md',
            section: 'Context selection and handoff / Evidence Registry',
          },
          {
            docId: 'procedure.project-discovery',
            title: 'Project Discovery Procedure',
            path: 'docs/knowledge/procedures/project-discovery.md',
            section: 'Deterministic inventory',
          },
          {
            title: 'Capability Contract',
            path: 'docs/intelligence-architecture/capability-contract.md',
            section: '§4 Типы эффектов / §7 Enforcement',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'listProjectFiles()', path: 'server/projectAgent.ts', note: 'Детерминированный обход каталога проекта' },
          { entityType: 'Module', name: 'executeGeneralAgentTask()', path: 'server/agentOrchestrator.ts', note: 'Регистрация function tool list_project_files' },
          { entityType: 'Policy', name: 'assertProjectToolAllowed("read_file")', path: 'server/permissionManager.ts', note: 'Гейт доступа проекта' },
          { entityType: 'Contract', name: 'ROLE_CONTRACTS / intersectCapabilities()', path: 'server/orchestration/roleContracts.ts', note: 'Выдача capability list_files ролям' },
        ],
      },
    }),

    makeEntry({
      toolId: 'read_project_file',
      capabilityKey: 'read_file',
      title: 'Чтение файла и фрагментов проекта',
      subtitle: 'Построчное чтение с path containment, лимитом бюджета 40K символов и SHA-256 кэшем фрагментов',
      category: 'filesystem',
      enforcementStatus: 'runtime-enforced',
      projectPermissionGate: 'read_file',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'PLAN и ACT (read-only)',
        mechanism: 'OpenAI Function Tool read_project_file + контекстный бюджет Worker',
      },
      subagentCapability: 'read_file',
      subagentAccessMode: 'read-only',
      subagentAccessNote: 'Доступно всем 10 встроенным ролям при включённом read_file; только самостоятельный вызов попадает в filesInspected.',
      interactionSchema: {
        operationId: 'fs.project.read_file',
        protocol: 'OpenAI Function Calling + Evidence Registry Provenance',
        inputSchema: {
          path: 'string (относительный путь от корня проекта, <= 1024 символов)',
          startLine: 'integer? (1-based начало диапазона)',
          endLine: 'integer? (1-based конец диапазона)',
        },
        outputSchema: {
          path: 'string',
          sizeBytes: 'number',
          startLine: 'number',
          endLine: 'number',
          content: 'string (<= 24 000 символов за чтение / остаток бюджета 40 000)',
          contentHash: 'string (SHA-256 фрагмента)',
          cacheHit: 'boolean',
          truncated: 'boolean',
        },
        effects: ['filesystem.read'],
        authorizationAndGuardrails: [
          'assertProjectToolAllowed(projectId, "read_file")',
          'safeResolveInside(): запрет path traversal и выхода по symlink',
          'Лимит размера исходника 2 MiB; лимит чтения 24 000 chars; общий бюджет Worker 40 000 chars',
          'Evidence Registry: readFiles обновляется только при успешном вызове инструмента',
        ],
        confirmationPolicy: 'none (read-only; исключение — секреты/.env по политике разрешений)',
        flowSteps: [
          '1. Вызов read_project_file(path, startLine?, endLine?)',
          '2. Проверка read_file + safeResolveInside + AbortSignal',
          '3. Извлечение диапазона extractLineFragment() и проверка бюджета Worker',
          '4. Дедупликация в workerFragmentDeduplicationCache (TTL 5 мин, 512 записей)',
          '5. Добавление пути в confirmedReadFiles для валидации worker-result.v1',
        ],
        documentSpecs: [
          {
            docId: 'protocol.file-content-provisioning',
            title: 'File Content Provisioning Protocol',
            path: 'docs/knowledge/protocols/file-content-provisioning.md',
            section: 'Budgets and limits / Fragment hashing',
          },
          {
            docId: 'protocol.worker-result',
            title: 'Specialist Worker Result Protocol',
            path: 'docs/knowledge/protocols/worker-result.md',
            section: 'filesInspected validation',
          },
          {
            title: 'Security, Permissions, and Approvals',
            path: 'docs/architecture/SECURITY_AND_APPROVALS.md',
            section: '§2.4 File integrity and path containment',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'readProjectFile()', path: 'server/projectAgent.ts', note: 'Валидация пути, лимит 2 MiB и чтение с диска' },
          { entityType: 'Module', name: 'extractLineFragment() / workerFragmentDeduplicationCache', path: 'server/orchestration/contextBuilder.ts', note: 'Построчные фрагменты и SHA-256 кэш' },
          { entityType: 'Gate', name: 'validateWorkerResult()', path: 'server/orchestration/contractValidator.ts', note: 'Сверка filesInspected с подтверждёнными чтениями' },
          { entityType: 'Endpoint', name: 'GET /api/projects/:id/file', path: 'server/app.ts', note: 'HTTP-чтение файла проекта' },
        ],
      },
    }),

    makeEntry({
      toolId: 'search_project_code',
      capabilityKey: 'search_code',
      title: 'Поиск фрагментов по коду проекта',
      subtitle: 'Детерминированный поиск подстрок по текстовым файлам (<= 512 KiB, до 60 совпадений)',
      category: 'filesystem',
      enforcementStatus: 'runtime-enforced',
      projectPermissionGate: 'search_code',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'PLAN и ACT (read-only)',
        mechanism: 'OpenAI Function Tool search_project_code + команда /search <query>',
      },
      subagentCapability: 'search_code',
      subagentAccessMode: 'read-only',
      subagentAccessNote: 'Доступно всем 10 встроенным ролям при одновременном разрешении search_code и read_file.',
      interactionSchema: {
        operationId: 'fs.project.search_code',
        protocol: 'OpenAI Function Calling / Slash command /search',
        inputSchema: {
          query: 'string (1..300 символов, регистронезависимый литеральный поиск)',
        },
        outputSchema: {
          count: 'number',
          matches: 'Array<{ path: string; line: number; text: string }>',
        },
        effects: ['filesystem.read'],
        authorizationAndGuardrails: [
          'Требует оба разрешения проекта: search_code AND read_file',
          'Ограничение 250 файлов, <= 512 KiB на файл, максимум 60 совпадений',
          'Совпадения поиска фиксируются как evidence: "searched", не как полное чтение',
        ],
        confirmationPolicy: 'none (read-only)',
        flowSteps: [
          '1. Агент вызывает search_project_code({ query })',
          '2. intersectCapabilities / assertProjectToolAllowed проверяет search_code + read_file',
          '3. searchProjectCode() сканирует допустимые файлы с проверкой AbortSignal',
          '4. Возвращает список { path, line, text } без автоматического чтения всего файла',
        ],
        documentSpecs: [
          {
            docId: 'protocol.file-content-provisioning',
            title: 'File Content Provisioning Protocol',
            path: 'docs/knowledge/protocols/file-content-provisioning.md',
            section: 'Evidence Registry and provenance / 512 KiB limit',
          },
          {
            docId: 'procedure.lightweight-discovery',
            title: 'Lightweight Discovery Procedure',
            path: 'docs/knowledge/procedures/lightweight-discovery.md',
            section: 'Deterministic search before reasoning',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'searchProjectCode()', path: 'server/projectAgent.ts', note: 'Поиск по строкам внутри проекта' },
          { entityType: 'Endpoint', name: 'GET /api/projects/:id/search', path: 'server/app.ts', note: 'HTTP-поиск по коду' },
          { entityType: 'Contract', name: 'intersectCapabilities()', path: 'server/orchestration/roleContracts.ts', note: 'Требует search_code && read_file' },
        ],
      },
    }),

    makeEntry({
      toolId: 'write_project_file',
      capabilityKey: 'write_file_proposal',
      title: 'Изменение и создание файлов проекта (Diff Proposal)',
      subtitle: 'Подготовка диффа в ACT с обязательным подтверждением пользователя, pre/post hooks и Verification Gate',
      category: 'mutation',
      enforcementStatus: 'approval-required',
      projectPermissionGate: 'write_file',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Только ACT (в PLAN запись запрещена)',
        mechanism: 'ACT JSON contract writeFile -> DiffProposal в UI -> PUT /api/projects/:id/file',
      },
      subagentCapability: 'write_file_proposal',
      subagentAccessMode: 'proposal-only',
      subagentAccessNote: 'Доступно только 2 не-readonly ролям (Разработчик, Кодер) в форме предложения; прямое автоприменение запрещено.',
      interactionSchema: {
        operationId: 'fs.project.write_file',
        protocol: 'ACT JSON Action Contract -> DiffProposal -> HTTP PUT with Approval',
        inputSchema: {
          path: 'string (относительный путь файла проекта)',
          content: 'string (новое содержимое файла)',
          summary: 'string (краткое описание правки)',
          approved: 'boolean | X-OneCore-Approval: user-confirmed',
        },
        outputSchema: {
          path: 'string',
          existedBefore: 'boolean',
          verification: 'VerificationReport (verifyFileContent)',
          logEntry: 'ProjectActionLogEntry (для /undo)',
        },
        effects: ['filesystem.write'],
        authorizationAndGuardrails: [
          'assertProjectToolAllowed(projectId, "write_file")',
          'Только роли с readOnly: false (developer, coder)',
          'requireSideEffectApproval("project.file.write") на PUT /api/projects/:id/file',
          'safeResolveInside() + Verification Gate (verifyFileContent)',
          'Запись предыдущего содержимого в action log для /undo',
        ],
        confirmationPolicy: 'user-diff-confirmation (явное подтверждение пользователем в DiffViewer)',
        flowSteps: [
          '1. Агент в режиме ACT или субагент-исполнитель формирует предложение writeFile / write_file_proposal',
          '2. Сервер вычисляет diff без записи на диск и возвращает его клиенту',
          '3. Пользователь нажимает «Применить дифф», отправляя approved: true / X-OneCore-Approval',
          '4. hookRunner запускает pre_file_write -> writeProjectFile() пишет на диск -> verifyFileContent() -> post_file_write',
        ],
        documentSpecs: [
          {
            title: 'Security, Permissions, and Approvals',
            path: 'docs/architecture/SECURITY_AND_APPROVALS.md',
            section: '§2.3 Project permissions / Class C',
          },
          {
            title: 'Capability Contract',
            path: 'docs/intelligence-architecture/capability-contract.md',
            section: '§5 Confirmation / §6 Compensation',
          },
          {
            docId: 'role.developer',
            title: 'Developer Role',
            path: 'docs/knowledge/roles/developer.md',
            section: 'Workflow / Must not',
          },
          {
            docId: 'role.coder',
            title: 'Coder Role',
            path: 'docs/knowledge/roles/coder.md',
            section: 'Workflow / Constraints',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'writeProjectFile()', path: 'server/projectAgent.ts', note: 'Изолированная запись + аудит для отката' },
          { entityType: 'Gate', name: 'verifyFileContent()', path: 'server/verificationGate.ts', note: 'Проверка фактической записи файла' },
          { entityType: 'Module', name: 'runLifecycleHooks("pre_file_write" | "post_file_write")', path: 'server/orchestration/hookRunner.ts', note: 'Lifecycle-хуки до и после записи' },
          { entityType: 'Endpoint', name: 'PUT /api/projects/:id/file', path: 'server/app.ts', note: 'Контролируемая запись с проверкой одобрения' },
        ],
      },
    }),

    makeEntry({
      toolId: 'undo_project_action',
      capabilityKey: null,
      title: 'Откат последнего изменения файла (/undo)',
      subtitle: 'Компенсационная операция: восстановление прежнего содержимого или удаление вновь созданного файла',
      category: 'mutation',
      enforcementStatus: 'approval-required',
      projectPermissionGate: 'write_file',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Команда /undo или кнопка отката в рабочей области',
        mechanism: 'POST /api/projects/:id/undo или /undo в executeProjectTask()',
      },
      subagentAccessNote: 'Субагентам недоступен: компенсация на диске выполняется только основным агентом / пользователем после подтверждения.',
      interactionSchema: {
        operationId: 'fs.project.undo',
        protocol: 'HTTP POST /api/projects/:id/undo или команда /undo',
        inputSchema: {
          projectId: 'string',
          approved: 'boolean | X-OneCore-Approval',
        },
        outputSchema: {
          ok: 'boolean',
          restoredFile: 'string?',
          action: '"restored" | "deleted"',
          verification: 'VerificationReport (verifyFileContent | verifyFileRemoved)',
        },
        effects: ['filesystem.write', 'filesystem.delete'],
        authorizationAndGuardrails: [
          'assertProjectToolAllowed(projectId, "write_file")',
          'requireSideEffectApproval("project.undo")',
          'Откат только последней неоткаченной записи kind === "file_write" из журнала проекта',
          'Проверка Verification Gate после восстановления или удаления',
        ],
        confirmationPolicy: 'explicit-side-effect-approval (project.undo)',
        flowSteps: [
          '1. Пользователь или /undo инициирует откат последней правки',
          '2. Сервер проверяет write_file + project.undo approval',
          '3. Восстанавливает previousContent либо удаляет созданный файл (safeResolveInside)',
          '4. verifyFileContent / verifyFileRemoved подтверждает результат, запись помечается undone: true',
        ],
        documentSpecs: [
          {
            title: 'Capability Contract',
            path: 'docs/intelligence-architecture/capability-contract.md',
            section: '§6 Idempotency, cancellation и compensation',
          },
          {
            title: 'Security, Permissions, and Approvals',
            path: 'docs/architecture/SECURITY_AND_APPROVALS.md',
            section: 'Class C — File undo/restore',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'undoLastProjectAction()', path: 'server/projectAgent.ts', note: 'Компенсационный откат последней file_write операции' },
          { entityType: 'Gate', name: 'verifyFileRemoved()', path: 'server/verificationGate.ts', note: 'Верификация удаления при откате нового файла' },
          { entityType: 'Endpoint', name: 'POST /api/projects/:id/undo', path: 'server/app.ts', note: 'HTTP-точка отката' },
        ],
      },
    }),

    makeEntry({
      toolId: 'exec_project_command',
      capabilityKey: 'run_command_proposal',
      title: 'Запуск команд в терминале проекта',
      subtitle: 'Подготовка и выполнение shell-команд (PowerShell / sh) с таймаутом, pre/post hooks и захватом stdout/stderr',
      category: 'execution',
      enforcementStatus: 'approval-required',
      projectPermissionGate: 'run_command',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Только ACT (в PLAN запрещено); /run формирует предложение без автозапуска',
        mechanism: 'CommandProposal (/run или ACT JSON runCommand) -> POST /api/projects/:id/exec',
      },
      subagentCapability: 'run_command_proposal',
      subagentAccessMode: 'proposal-only',
      subagentAccessNote: 'Доступно 3 ролям (Разработчик, Тестировщик, QA-инженер) только при активном run_command; не запускается без подтверждения.',
      interactionSchema: {
        operationId: 'process.project.exec',
        protocol: 'CommandProposal -> HTTP POST /api/projects/:id/exec with Approval',
        inputSchema: {
          command: 'string (команда для выполнения в папке проекта)',
          timeoutMs: 'number? (по умолчанию 30 000 мс)',
          approved: 'boolean | X-OneCore-Approval',
        },
        outputSchema: {
          command: 'string',
          cwd: 'string',
          stdout: 'string',
          stderr: 'string',
          exitCode: 'number (124=timeout, 130=cancelled)',
          durationMs: 'number',
          verification: 'VerificationReport (verifyCommandResult)',
        },
        effects: ['process.exec'],
        authorizationAndGuardrails: [
          'assertProjectToolAllowed(projectId, "run_command")',
          'requireSideEffectApproval("project.terminal")',
          'Ограничение cwd корнем проекта, лимит буферов 128 KiB, отмена по AbortSignal',
          'Verification Gate проверяет exitCode, timedOut и cancelled',
        ],
        confirmationPolicy: 'user-command-confirmation (кнопка «Выполнить» / project.terminal)',
        flowSteps: [
          '1. Агент в ACT или /run предлагает команду (proposedCommand), не запуская её',
          '2. Пользователь подтверждает выполнение -> POST /api/projects/:id/exec',
          '3. Проверка run_command + approval -> pre_command hook',
          '4. execProjectCommand() запускает процесс с таймаутом и AbortSignal -> verifyCommandResult -> post_command hook',
        ],
        documentSpecs: [
          {
            title: 'Security, Permissions, and Approvals',
            path: 'docs/architecture/SECURITY_AND_APPROVALS.md',
            section: 'Class C — Shell command execution',
          },
          {
            docId: 'role.tester',
            title: 'Tester Role',
            path: 'docs/knowledge/roles/tester.md',
            section: 'Workflow / Constraints',
          },
          {
            docId: 'role.qa',
            title: 'QA Role',
            path: 'docs/knowledge/roles/qa.md',
            section: 'Verification checks',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'execProjectCommand()', path: 'server/projectAgent.ts', note: 'Запуск shell в cwd проекта с таймаутом' },
          { entityType: 'Gate', name: 'verifyCommandResult()', path: 'server/verificationGate.ts', note: 'Проверка exitCode и отсутствия таймаута/отмены' },
          { entityType: 'Module', name: 'runLifecycleHooks("pre_command" | "post_command")', path: 'server/orchestration/hookRunner.ts', note: 'Хуки до/после команды' },
          { entityType: 'Endpoint', name: 'POST /api/projects/:id/exec', path: 'server/app.ts', note: 'Защищённый запуск команды' },
        ],
      },
    }),

    makeEntry({
      toolId: 'run_project_git',
      capabilityKey: 'git',
      title: 'Операции Git в репозитории проекта',
      subtitle: 'Read-only диагностика (status/diff/log) и подтверждаемые мутации (commit/fetch/push/init)',
      category: 'execution',
      enforcementStatus: 'approval-required',
      projectPermissionGate: 'git',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: '/git status|diff|log доступны сразу; fetch/push/commit/init требуют подтверждения',
        mechanism: 'runProjectGit() через /git или POST /api/projects/:id/git',
      },
      subagentAccessNote: 'Субагентам недоступен: роли не имеют capability git и не вправе мутировать состояние репозитория.',
      interactionSchema: {
        operationId: 'vcs.project.git',
        protocol: 'HTTP POST /api/projects/:id/git или /git <action>',
        inputSchema: {
          action: '"status" | "diff" | "log" | "commit" | "fetch" | "push" | "init"',
          commitMessage: 'string? (для commit)',
          approved: 'boolean? (обязательно для commit/fetch/push/init)',
        },
        outputSchema: {
          stdout: 'string',
          stderr: 'string',
          exitCode: 'number',
        },
        effects: ['filesystem.read', 'filesystem.write', 'network.request', 'external.side_effect'],
        authorizationAndGuardrails: [
          'assertProjectToolAllowed(projectId, "git")',
          'Мутирующие действия (commit, fetch, push, init) требуют approval("project.git.mutate")',
          'Фиксированный allowlist git-аргументов (без произвольного shell-инъектирования)',
        ],
        confirmationPolicy: 'read-only для status/diff/log; explicit-side-effect-approval для commit/fetch/push/init',
        flowSteps: [
          '1. Запрос действия git в каталоге проекта',
          '2. Проверка разрешения git (+ project.git.mutate для мутирующих команд)',
          '3. Выполнение execFile("git", ["-C", cwd, ...args]) с таймаутом 25 сек',
          '4. Запись результата в журнал действий проекта',
        ],
        documentSpecs: [
          {
            title: 'Security, Permissions, and Approvals',
            path: 'docs/architecture/SECURITY_AND_APPROVALS.md',
            section: '§2.3 Git actions / Class C',
          },
          {
            docId: 'procedure.team-execution',
            title: 'Bounded Team Execution',
            path: 'docs/knowledge/procedures/team-execution.md',
            section: 'Safety — workers cannot mutate Git',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'runProjectGit()', path: 'server/projectAgent.ts', note: 'Исполнение allowlist git-команд в cwd проекта' },
          { entityType: 'Endpoint', name: 'POST /api/projects/:id/git', path: 'server/app.ts', note: 'API-граница с разделением read/mutate' },
          { entityType: 'Policy', name: 'project.git.mutate', path: 'server/permissionManager.ts', note: 'Scope подтверждения мутаций Git' },
        ],
      },
    }),

    makeEntry({
      toolId: 'run_lifecycle_hooks',
      capabilityKey: 'hooks',
      title: 'Lifecycle Hooks среды выполнения',
      subtitle: 'Пользовательские команды на события pre/post file_write, pre/post command, team_run_start и team_run_finish',
      category: 'execution',
      enforcementStatus: 'runtime-enforced',
      projectPermissionGate: 'run_command',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Автоматический системный контур при событиях записи, команд и team-run',
        mechanism: 'runLifecycleHooks() из server/app.ts и teamOrchestrator.ts',
      },
      subagentAccessNote: 'Не вызывается моделью напрямую; запускается оркестратором при событиях жизненного цикла и проверяет run_command.',
      interactionSchema: {
        operationId: 'runtime.lifecycle.hooks',
        protocol: 'Internal Event Hook Runner -> execProjectCommand()',
        inputSchema: {
          event: '"pre_file_write" | "post_file_write" | "pre_command" | "post_command" | "team_run_start" | "team_run_finish"',
          projectId: 'string',
        },
        outputSchema: {
          outcomes: 'Array<{ hookId, name, event, command, executed, exitCode, output, error? }>',
        },
        effects: ['process.exec'],
        authorizationAndGuardrails: [
          'isProjectToolAllowed(projectId, "run_command"): при отключении все хуки пропускаются с предупреждением',
          'Таймаут каждого hook ограничен диапазоном 1 000..60 000 мс',
          'Каждый запуск записывается в Agent Journal',
        ],
        confirmationPolicy: 'наследуется от подтверждённой родительской операции (write/exec/team-run) + настройки Hooks',
        flowSteps: [
          '1. Срабатывание lifecycle-события в app.ts или teamOrchestrator.ts',
          '2. hookRunner фильтрует включённые hooks из settings.hooks',
          '3. Проверяет разрешение проекта run_command',
          '4. Последовательно выполняет команды через execProjectCommand() и пишет события в журнал',
        ],
        documentSpecs: [
          {
            title: 'Navigation and Application Shell',
            path: 'docs/architecture/NAVIGATION_AND_SHELL.md',
            section: 'Интеграции -> Hooks (Lifecycle Hooks)',
          },
          {
            title: 'Operation Lifecycle',
            path: 'docs/architecture/OPERATION_LIFECYCLE.md',
            section: 'Operation events and verification',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'runLifecycleHooks()', path: 'server/orchestration/hookRunner.ts', note: 'Исполнитель настроенных hooks' },
          { entityType: 'Contract', name: 'AppHookConfig / AppHookEvent', path: 'src/types/onecore.ts', note: 'Типы событий и конфигурации hooks' },
          { entityType: 'Store', name: 'ToolsHooksPage.tsx', path: 'src/pages/integrations/ToolsHooksPage.tsx', note: 'UI настройки Lifecycle Hooks' },
        ],
      },
    }),

    makeEntry({
      toolId: 'list_knowledge_documents',
      capabilityKey: 'read_knowledge',
      title: 'Каталог утверждённых документов знаний',
      subtitle: 'Получение метаданных только утверждённых (approved) ролей, процедур и протоколов из docs/knowledge',
      category: 'knowledge-orchestration',
      enforcementStatus: 'runtime-enforced',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'PLAN и ACT (read-only)',
        mechanism: 'OpenAI Function Tool list_knowledge_documents',
      },
      subagentCapability: 'read_knowledge',
      subagentAccessMode: 'read-only',
      subagentAccessNote: 'Доступно всем 10 ролям через capability read_knowledge; черновики (draft/review) скрыты от runtime.',
      interactionSchema: {
        operationId: 'knowledge.catalog.list',
        protocol: 'OpenAI Function Calling + GET /api/knowledge',
        inputSchema: {
          filter: 'status === "approved" (автоматически применяется в executeTool)',
        },
        outputSchema: {
          count: 'number',
          documents: 'Array<{ id, version, ownerRole, triggers, category, relativePath, title }>',
        },
        effects: ['filesystem.read'],
        authorizationAndGuardrails: [
          'Сканируются только прямые .md файлы в architecture/, roles/, procedures/, protocols/',
          'Лимит файла 64 KiB; проверка выхода за пределы knowledgeRoot',
          'В агентский контекст попадают только документы со статусом approved',
        ],
        confirmationPolicy: 'none (read-only)',
        flowSteps: [
          '1. Агент вызывает list_knowledge_documents()',
          '2. knowledgeManager читает YAML frontmatter и фильтрует status === "approved"',
          '3. Возвращает стабильные ID, версии и triggers для выбора нужного регламента',
        ],
        documentSpecs: [
          {
            title: 'ONE CORE AI Knowledge Base Index',
            path: 'docs/knowledge/README.md',
            section: 'Current loader boundary / Lifecycle',
          },
          {
            docId: 'protocol.procedure-lifecycle',
            title: 'Procedure Lifecycle and Continuous Improvement',
            path: 'docs/knowledge/protocols/procedure-lifecycle.md',
            section: 'States (draft -> review -> approved)',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'listKnowledgeDocuments()', path: 'server/knowledgeManager.ts', note: 'Загрузчик и индексатор метаданных знаний' },
          { entityType: 'Endpoint', name: 'GET /api/knowledge', path: 'server/app.ts', note: 'API каталога знаний' },
        ],
      },
    }),

    makeEntry({
      toolId: 'read_knowledge_document',
      capabilityKey: 'read_knowledge',
      title: 'Чтение утверждённого документа знаний',
      subtitle: 'Загрузка полного текста регламента, роли или протокола по стабильному ID с записью версии в Trace',
      category: 'knowledge-orchestration',
      enforcementStatus: 'runtime-enforced',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'PLAN и ACT (read-only)',
        mechanism: 'OpenAI Function Tool read_knowledge_document + trace.instructionId/Version',
      },
      subagentCapability: 'read_knowledge',
      subagentAccessMode: 'read-only',
      subagentAccessNote: 'Доступно всем 10 ролям для чтения своих ролевых контрактов, процедур и протоколов.',
      interactionSchema: {
        operationId: 'knowledge.document.read',
        protocol: 'OpenAI Function Calling + GET /api/knowledge/documents/:id',
        inputSchema: {
          id: 'string (стабильный ID документа, например role.manager или protocol.task-handoff)',
        },
        outputSchema: {
          id: 'string',
          version: 'string',
          category: 'string',
          relativePath: 'string',
          title: 'string',
          content: 'string',
        },
        effects: ['filesystem.read'],
        authorizationAndGuardrails: [
          'readApprovedKnowledgeDocument() отклоняет draft, review и deprecated документы',
          'Регламенты не могут переопределять системные политики безопасности и разрешения проекта',
          'ID и версия прочитанного документа записываются в trace Agent Journal',
        ],
        confirmationPolicy: 'none (read-only)',
        flowSteps: [
          '1. Агент или субагент запрашивает read_knowledge_document({ id })',
          '2. knowledgeManager проверяет status === "approved"',
          '3. Возвращает документ и фиксирует instructionId + instructionVersion в трассировке',
        ],
        documentSpecs: [
          {
            docId: 'protocol.procedure-lifecycle',
            title: 'Procedure Lifecycle and Continuous Improvement',
            path: 'docs/knowledge/protocols/procedure-lifecycle.md',
            section: 'Promotion rules / Runtime knowledge loading',
          },
          {
            title: 'Documentation-First Knowledge Architecture',
            path: 'docs/architecture/DOCUMENTATION_FIRST_KNOWLEDGE.md',
            section: 'Runtime instruction binding',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'readApprovedKnowledgeDocument()', path: 'server/knowledgeManager.ts', note: 'Строгое чтение только approved документов' },
          { entityType: 'Module', name: 'executeGeneralAgentTask()', path: 'server/agentOrchestrator.ts', note: 'Привязка instructionId/Version к trace' },
        ],
      },
    }),

    makeEntry({
      toolId: 'approve_graph',
      capabilityKey: 'approve_graph',
      title: 'Утверждение графа делегирования и приёмка команды',
      subtitle: 'Системная возможность оркестрации: проверка графа подзадач, бюджетов, зависимостей и итоговая приёмка отчёта',
      category: 'knowledge-orchestration',
      enforcementStatus: 'orchestration-enforced',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: false,
        modeConstraint: 'Передаётся от Координатора (General Agent) системному субагенту Менеджер',
        mechanism: 'Стадии Manager Intake & Reconciliation в runTeamExecution()',
      },
      subagentCapability: 'approve_graph',
      subagentAccessMode: 'orchestration',
      subagentAccessNote: 'Закреплено исключительно за 1 субагентом (Менеджер), принимающим задачу от General Agent / Координатора.',
      sysDelegatedFrom: 'General Agent / Координатор (role.coordinator)',
      sysReason: 'В контрактах ролей (ROLE_CONTRACTS) и документации используется только 1 субагентом — Менеджером (manager), который принимает задачу от общего агента и единолично утверждает граф и итог работы команды.',
      interactionSchema: {
        operationId: 'orchestration.graph.approve',
        protocol: 'Team Orchestrator Stage (POST /api/agents/team-run)',
        inputSchema: {
          objective: 'string (цель и критерии приёмки)',
          plannedSubtasks: 'PlannedSubtask[] (граф подзадач от Диспетчера, <= 8 на цикл)',
          workerResults: 'TeamTaskExecutionRecord[] (валидированные результаты специалистов)',
        },
        outputSchema: {
          approvedHandoffs: 'AgentHandoffContract[]',
          teamResult: 'TeamExecutionResult (finalReport, verifiedFiles, unresolvedQuestions, status)',
        },
        effects: ['orchestration.control'],
        authorizationAndGuardrails: [
          'Эксклюзивное capability роли manager в ROLE_CONTRACTS',
          'Manager не может выдавать права проекту, обходить write_file/run_command или утверждать diff на диске',
          'Приёмка опирается на validateAgentHandoff() и validateWorkerResult()',
          'Лимит <= 8 задач в цикле и <= 4 циклов',
        ],
        confirmationPolicy: 'agent.team-run side-effect approval на старте командного запуска',
        flowSteps: [
          '1. General Agent / Координатор передаёт задачу и критерии приёмки Менеджеру (role.manager)',
          '2. Менеджер поручает Диспетчеру декомпозицию и проверяет предложенный граф подзадач',
          '3. Оркестратор валидирует каждый Handoff и последовательно запускает специалистов',
          '4. Менеджер сверяет WorkerResult, evidence и формирует единый итоговый отчёт для Координатора',
        ],
        documentSpecs: [
          {
            docId: 'role.manager',
            title: 'Manager Role',
            path: 'docs/knowledge/roles/manager.md',
            section: 'Mission / Workflow / Authority boundaries',
          },
          {
            docId: 'procedure.team-execution',
            title: 'Bounded Team Execution',
            path: 'docs/knowledge/procedures/team-execution.md',
            section: 'Procedure steps 1, 3, 7',
          },
          {
            title: 'Delegation Model',
            path: 'docs/intelligence-architecture/delegation-model.md',
            section: '§3 Модель делегирования / §7 Приёмка результата',
          },
        ],
        entityBindings: [
          { entityType: 'Contract', name: 'ROLE_CONTRACTS.manager', path: 'server/orchestration/roleContracts.ts', note: 'Единственная роль с approve_graph' },
          { entityType: 'Module', name: 'runTeamExecution() Stage 1 & 4', path: 'server/orchestration/teamOrchestrator.ts', note: 'Контроль Manager Intake и Reconciliation' },
          { entityType: 'Schema', name: 'worker-result.v1.schema.json', path: 'docs/knowledge/schemas/worker-result.v1.schema.json', note: 'Контракт приёмки отчётов воркеров' },
        ],
      },
    }),

    makeEntry({
      toolId: 'decompose_tasks',
      capabilityKey: 'decompose_tasks',
      title: 'Декомпозиция цели в граф подзадач (Task Graph)',
      subtitle: 'Разбиение задачи Менеджера на ограниченные поручения специалистам с назначением ролей и файлов',
      category: 'knowledge-orchestration',
      enforcementStatus: 'orchestration-enforced',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: false,
        modeConstraint: 'Назначается Менеджером / General Agent системному субагенту Диспетчер',
        mechanism: 'Стадия Dispatcher в runTeamExecution() + агентский JSON граф или детерминированный fallback',
      },
      subagentCapability: 'decompose_tasks',
      subagentAccessMode: 'orchestration',
      subagentAccessNote: 'Закреплено исключительно за 1 субагентом (Диспетчер), принимающим постановку от Менеджера / General Agent.',
      sysDelegatedFrom: 'Менеджер (role.manager) / General Agent',
      sysReason: 'В контрактах ролей (ROLE_CONTRACTS) и документации используется только 1 субагентом — Диспетчером (dispatcher), который преобразует цель в ациклический граф подзадач для специалистов.',
      interactionSchema: {
        operationId: 'orchestration.tasks.decompose',
        protocol: 'Team Orchestrator Dispatcher Stage -> AgentHandoff v1',
        inputSchema: {
          objective: 'string',
          cycle: 'number (1..4)',
          initialFilesManifest: 'AgentHandoffFileEntry[] (результат детерминированной разведки)',
          allowedTools: 'string[]',
        },
        outputSchema: {
          riskLevel: '"low" | "medium" | "high"',
          acceptanceCriteria: 'string[]',
          tasks: 'PlannedSubtask[] (<= 8 подзадач: taskId, role, objective, files[])',
        },
        effects: ['orchestration.control'],
        authorizationAndGuardrails: [
          'Эксклюзивное capability роли dispatcher в ROLE_CONTRACTS',
          'Максимум 8 подзадач за цикл; строго последовательное выполнение без вложенного самоделегирования',
          'Каждый сформированный Handoff проходит validateAgentHandoff() по agent-handoff.v1.schema.json',
          'При недоступности LLM используется детерминированная декомпозиция по ролям',
        ],
        confirmationPolicy: 'утверждается Менеджером перед запуском специалистов',
        flowSteps: [
          '1. Менеджер передаёт цель и собранный манифест файлов Диспетчеру (role.dispatcher)',
          '2. Диспетчер формирует ограниченный список подзадач (taskId, role, files)',
          '3. Оркестратор пересекает права проекта с ROLE_CONTRACTS (intersectCapabilities)',
          '4. Собирает AgentHandoffContract, проверяет его contractValidator и передаёт специалистам',
        ],
        documentSpecs: [
          {
            docId: 'role.dispatcher',
            title: 'Dispatcher Role',
            path: 'docs/knowledge/roles/dispatcher.md',
            section: 'Mission / Workflow / Constraints / Output',
          },
          {
            docId: 'protocol.task-handoff',
            title: 'Agent Task Handoff Protocol',
            path: 'docs/knowledge/protocols/task-handoff.md',
            section: 'AgentHandoff v1 contract',
          },
          {
            title: 'Delegation Model',
            path: 'docs/intelligence-architecture/delegation-model.md',
            section: '§4 Контракт поручения / §5 Ограничения графа',
          },
        ],
        entityBindings: [
          { entityType: 'Contract', name: 'ROLE_CONTRACTS.dispatcher', path: 'server/orchestration/roleContracts.ts', note: 'Единственная роль с decompose_tasks' },
          { entityType: 'Module', name: 'runTeamExecution() Dispatcher Stage', path: 'server/orchestration/teamOrchestrator.ts', note: 'Построение графа и Handoff v1' },
          { entityType: 'Schema', name: 'agent-handoff.v1.schema.json', path: 'docs/knowledge/schemas/agent-handoff.v1.schema.json', note: 'Схема выходных поручений' },
          { entityType: 'Gate', name: 'validateAgentHandoff()', path: 'server/orchestration/contractValidator.ts', note: 'Валидатор контракта передачи' },
        ],
      },
    }),

    makeEntry({
      toolId: 'manage_project_tasks',
      capabilityKey: null,
      title: 'Управление задачами проекта',
      subtitle: 'Создание и обновление статусов задач проекта (todo / in-progress / done) из ответа ACT-агента',
      category: 'knowledge-orchestration',
      enforcementStatus: 'runtime-enforced',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Только ACT (в PLAN изменение задач запрещено)',
        mechanism: 'ACT JSON contract createTasks / updateTasks в executeProjectTask()',
      },
      subagentAccessNote: 'Субагентам недоступен: воркеры возвращают только структурированный отчёт WorkerResult v1 без прямых правок задач проекта.',
      interactionSchema: {
        operationId: 'project.tasks.mutate',
        protocol: 'ACT JSON Action Contract -> saveProjectTask()',
        inputSchema: {
          createTasks: 'Array<{ title: string; description?: string; status?: "todo"|"in-progress"|"done" }> (<= 10)',
          updateTasks: 'Array<{ id: string; status: "todo"|"in-progress"|"done" }> (<= 20)',
        },
        outputSchema: {
          createdTasks: 'Array<{ id: string; title: string }>',
          updatedTasks: 'Array<{ id: string; status: string }>',
        },
        effects: ['external.side_effect'],
        authorizationAndGuardrails: [
          'Выполняется только при mode === "act"',
          'updateTasks допускает изменение только существующих taskId текущего проекта',
          'Каждое изменение дублируется записью в память проекта (recordProjectMemory)',
        ],
        confirmationPolicy: 'выполняется в рамках режима ACT (не затрагивает файлы или терминал)',
        flowSteps: [
          '1. Модель в ACT возвращает JSON с полями createTasks / updateTasks',
          '2. executeProjectTask() фильтрует валидные элементы и проверяет mode === "act"',
          '3. saveProjectTask() сохраняет задачи в project workspace и записывает факт в память проекта',
        ],
        documentSpecs: [
          {
            title: 'ONE CORE AI — System Map',
            path: 'docs/architecture/SYSTEM_MAP.md',
            section: '§3 Project task flow / §4 Boundaries',
          },
          {
            title: 'Delegation Model',
            path: 'docs/intelligence-architecture/delegation-model.md',
            section: '§7 Приёмка результата',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'executeProjectTask()', path: 'server/projectAgent.ts', note: 'Обработка createTasks и updateTasks в ACT' },
          { entityType: 'Module', name: 'saveProjectTask()', path: 'server/projectsManager.ts', note: 'Сохранение задач проекта' },
          { entityType: 'Endpoint', name: 'POST /api/projects/:id/task', path: 'server/app.ts', note: 'Маршрут проектного агента' },
        ],
      },
    }),

    makeEntry({
      toolId: 'project_memory',
      capabilityKey: null,
      title: 'Память проекта и агента',
      subtitle: 'Чтение и сохранение устойчивых фактов проекта и документов памяти (SOUL.md / MEMORY.md / USER.md)',
      category: 'knowledge-orchestration',
      enforcementStatus: 'approval-required',
      projectPermissionGate: 'write_file',
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Чтение всегда; запись фактов при ACT-операциях и редактировании памяти',
        mechanism: 'recordProjectMemory() и API /api/projects/:id/models/memory',
      },
      subagentAccessNote: 'Субагентам недоступен напрямую: долгосрочную память обновляет только приложение после проверенных действий.',
      interactionSchema: {
        operationId: 'project.memory.rw',
        protocol: 'HTTP GET/POST/DELETE /api/projects/:id/models/memory + recordProjectMemory()',
        inputSchema: {
          projectId: 'string',
          content: 'string (факт памяти проекта)',
        },
        outputSchema: {
          entries: 'Array<{ id, timestamp, content }>',
        },
        effects: ['filesystem.write'],
        authorizationAndGuardrails: [
          'Запись и удаление памяти проекта через HTTP проверяют write_file разрешение проекта',
          'Операции с базой знаний (docs/knowledge) изолированы от проектной памяти',
        ],
        confirmationPolicy: 'автоматически при сохранении задач или явно через UI памяти',
        flowSteps: [
          '1. Запрос чтения или сохранения факта памяти проекта',
          '2. Проверка привязки к проекту и флага write_file для мутирующих запросов',
          '3. Сохранение в локальное хранилище проекта',
        ],
        documentSpecs: [
          {
            title: 'ONE CORE AI Knowledge Base Index',
            path: 'docs/knowledge/README.md',
            section: 'Distinction between knowledge base and project/durable memory',
          },
          {
            docId: 'protocol.procedure-lifecycle',
            title: 'Procedure Lifecycle and Continuous Improvement',
            path: 'docs/knowledge/protocols/procedure-lifecycle.md',
            section: 'Storage boundaries',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'recordProjectMemory()', path: 'server/projectAgent.ts', note: 'Запись событий/решений в память проекта' },
          { entityType: 'Endpoint', name: 'GET/POST/DELETE /api/projects/:id/models/memory', path: 'server/app.ts', note: 'HTTP API памяти проекта' },
        ],
      },
    }),

    makeEntry({
      toolId: 'web_search',
      capabilityKey: null,
      title: 'Поиск в публичном интернете',
      subtitle: 'Поиск через DuckDuckGo HTML с проверкой публичных HTTPS-адресов и защитой от SSRF',
      category: 'web-external',
      enforcementStatus: 'approval-required',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Через роутинг браузерных инструментов или раздел «Браузер»',
        mechanism: 'GET /api/browser/search -> searchPublicWeb()',
      },
      subagentAccessNote: 'Субагентам отключён: по правилам изоляции и code-audit сетевой доступ воркерам по умолчанию закрыт.',
      interactionSchema: {
        operationId: 'network.web.search',
        protocol: 'HTTP GET /api/browser/search with Side-Effect Approval',
        inputSchema: {
          q: 'string (1..300 символов)',
        },
        outputSchema: {
          results: 'Array<{ title: string; url: string; snippet: string }> (<= 6 результатов)',
        },
        effects: ['network.request'],
        authorizationAndGuardrails: [
          'requireSideEffectApproval("browser.network")',
          'validatePublicHttpsUrl() + проверка DNS/IP через isPrivateAddress() (защита от SSRF)',
          'Лимит тела HTML 1 MiB, таймаут 12 сек, максимум 3 редиректа',
        ],
        confirmationPolicy: 'explicit-side-effect-approval (browser.network)',
        flowSteps: [
          '1. Запрос на веб-поиск поступает на GET /api/browser/search',
          '2. Проверка одобрения browser.network',
          '3. validatePublicHttpsUrl() проверяет HTTPS и блокирует локальные/приватные адреса',
          '4. searchPublicWeb() парсит публичную выдачу и возвращает очищенные сниппеты',
        ],
        documentSpecs: [
          {
            title: 'Capability Contract',
            path: 'docs/intelligence-architecture/capability-contract.md',
            section: '§7 Enforcement — network egress & DNS/IP validation',
          },
          {
            title: 'Code Audit — первый вертикальный сценарий',
            path: 'docs/intelligence-architecture/code-audit.md',
            section: '§4 Read-only ограничения (сетевой доступ выключен)',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'searchPublicWeb()', path: 'server/browserTools.ts', note: 'Поиск по публичному вебу с SSRF-защитой' },
          { entityType: 'Endpoint', name: 'GET /api/browser/search', path: 'server/app.ts', note: 'HTTP-маршрут поиска' },
          { entityType: 'Policy', name: 'browser.network', path: 'server/permissionManager.ts', note: 'Scope подтверждения сетевого доступа' },
        ],
      },
    }),

    makeEntry({
      toolId: 'web_read',
      capabilityKey: null,
      title: 'Чтение публичной веб-страницы',
      subtitle: 'Извлечение читаемого текста публичной HTTPS-страницы (<= 12 000 символов) с блокировкой приватных сетей',
      category: 'web-external',
      enforcementStatus: 'approval-required',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Через браузерные команды в чате или раздел «Браузер»',
        mechanism: 'GET /api/browser/read -> readPublicWebPage()',
      },
      subagentAccessNote: 'Субагентам отключён: воркеры изолированы от внешнего сетевого egress.',
      interactionSchema: {
        operationId: 'network.web.read_page',
        protocol: 'HTTP GET /api/browser/read with Side-Effect Approval',
        inputSchema: {
          url: 'string (валидный публичный https:// URL без логина/пароля)',
        },
        outputSchema: {
          page: '{ title: string; url: string; text: string (<= 12 000 chars) }',
        },
        effects: ['network.request'],
        authorizationAndGuardrails: [
          'requireSideEffectApproval("browser.network")',
          'validatePublicHttpsUrl() + lookup() DNS-проверка каждого IP и редиректа',
          'Разрешены только text/html, application/xhtml+xml, text/plain до 1 MiB',
        ],
        confirmationPolicy: 'explicit-side-effect-approval (browser.network)',
        flowSteps: [
          '1. Запрос URL на GET /api/browser/read',
          '2. Проверка browser.network approval',
          '3. Валидация URL и каждого DNS-адреса против приватных диапазонов',
          '4. Очистка HTML-тегов и возврат текста <= 12 000 символов',
        ],
        documentSpecs: [
          {
            title: 'Capability Contract',
            path: 'docs/intelligence-architecture/capability-contract.md',
            section: '§4 network.request / §7 network enforcement',
          },
          {
            title: 'Security, Permissions, and Approvals',
            path: 'docs/architecture/SECURITY_AND_APPROVALS.md',
            section: '§2.3 Confirmed approval checks',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'readPublicWebPage() / validatePublicHttpsUrl()', path: 'server/browserTools.ts', note: 'SSRF-валидация и парсинг текста' },
          { entityType: 'Endpoint', name: 'GET /api/browser/read', path: 'server/app.ts', note: 'HTTP-маршрут чтения страницы' },
        ],
      },
    }),

    makeEntry({
      toolId: 'mcp_inspect',
      capabilityKey: null,
      title: 'Инспекция и обнаружение MCP-инструментов',
      subtitle: 'Подключение к внешним MCP-серверам (HTTP JSON-RPC initialize + tools/list или проверка stdio-бинарника)',
      category: 'web-external',
      enforcementStatus: 'approval-required',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Настройка и проверка в Интеграции -> MCP (прямой вызов MCP-tools из чата пока не подключён)',
        mechanism: 'POST /api/mcp/inspect -> inspectMcpServer()',
      },
      subagentAccessNote: 'Субагентам недоступен: внешние MCP-инструменты пока не пробрасываются в ROLE_CONTRACTS и executeGeneralAgentTask().',
      interactionSchema: {
        operationId: 'integration.mcp.inspect',
        protocol: 'JSON-RPC 2.0 (HTTP POST) / PATH lookup (stdio)',
        inputSchema: {
          transport: '"http" | "stdio"',
          endpoint: 'string? (URL для http)',
          command: 'string? (команда для stdio)',
        },
        outputSchema: {
          ok: 'boolean',
          transport: '"http" | "stdio"',
          serverInfo: '{ name?: string; version?: string }',
          tools: 'Array<{ name: string; description?: string }>',
          message: 'string',
        },
        effects: ['network.request', 'process.exec'],
        authorizationAndGuardrails: [
          'requireSideEffectApproval("browser.network")',
          'stdio-режим проверяет наличие исполняемого файла через which/where без запуска произвольных аргументов',
          'HTTP-режим ограничен http/https и таймаутом 8 000 мс',
        ],
        confirmationPolicy: 'explicit-side-effect-approval (browser.network)',
        flowSteps: [
          '1. Пользователь или интеграция запускает проверку MCP-сервера',
          '2. Сервер проверяет browser.network approval и транспорт',
          '3. Выполняет initialize + tools/list (HTTP) либо проверяет PATH (stdio)',
          '4. Сохраняет список discoveredTools в настройках интеграции',
        ],
        documentSpecs: [
          {
            title: 'Navigation and Application Shell',
            path: 'docs/architecture/NAVIGATION_AND_SHELL.md',
            section: 'Интеграции -> MCP',
          },
          {
            title: 'Capability Contract',
            path: 'docs/intelligence-architecture/capability-contract.md',
            section: '§2 Tool / §7 Enforcement',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'inspectMcpServer()', path: 'server/orchestration/mcpInspector.ts', note: 'Опрос HTTP/stdio MCP-серверов' },
          { entityType: 'Endpoint', name: 'POST /api/mcp/inspect', path: 'server/app.ts', note: 'Маршрут инспекции MCP' },
          { entityType: 'Contract', name: 'McpServerConfig', path: 'src/types/onecore.ts', note: 'Конфигурация и discoveredTools' },
        ],
      },
    }),

    makeEntry({
      toolId: 'remote_ssh_and_github',
      capabilityKey: null,
      title: 'Удалённые интеграции SSH и GitHub Sync',
      subtitle: 'Проверка SSH-хостов, токенов GitHub и синхронизации репозитория (check / pull / push)',
      category: 'web-external',
      enforcementStatus: 'approval-required',
      projectPermissionGate: null,
      generalAgentAccess: {
        allowed: true,
        modeConstraint: 'Через интеграционные маршруты настроек и подтверждения; прямой вызов из LLM отключён',
        mechanism: 'POST /api/ssh/test, /api/github/verify, /api/repo-sync/*',
      },
      subagentAccessNote: 'Субагентам недоступен: учётные данные SSH/GitHub защищены vault и не передаются воркерам.',
      interactionSchema: {
        operationId: 'integration.remote.ssh_github',
        protocol: 'HTTP REST + Side-Effect Approval + Vault Credentials',
        inputSchema: {
          ssh: '{ host, port, user, remotePath, authType, identityFile }',
          github: '{ authMethod, repoOwnerSlashName, defaultBranch }',
        },
        outputSchema: {
          ok: 'boolean',
          message: 'string',
          syncStatus: 'RepoSyncStatus?',
        },
        effects: ['network.request', 'secret.access', 'external.side_effect'],
        authorizationAndGuardrails: [
          'requireSideEffectApproval("ssh.connect" | "github.verify")',
          'Секреты (PAT / ключи) хранятся в server/vault.ts и не отдаются в промпты модели',
          'Прямые действия SSH/GitHub для проектного агента помечены available: false в /api/providers/capabilities',
        ],
        confirmationPolicy: 'explicit-side-effect-approval (ssh.connect / github.verify)',
        flowSteps: [
          '1. Проверка состояния SSH/GitHub инициируется из UI интеграций',
          '2. Сервер требует подтверждение ssh.connect или github.verify',
          '3. Секреты подтягиваются на сервере из vault.ts без раскрытия в UI/LLM',
        ],
        documentSpecs: [
          {
            title: 'Security, Permissions, and Approvals',
            path: 'docs/architecture/SECURITY_AND_APPROVALS.md',
            section: '§2.3 Approval checks / Vault boundaries',
          },
          {
            title: 'API Security Matrix',
            path: 'docs/architecture/API_SECURITY_MATRIX.md',
            section: 'Remote integration endpoints',
          },
        ],
        entityBindings: [
          { entityType: 'Module', name: 'verifySshConnectionAndPath() / githubRepoSync', path: 'server/githubRepoSync.ts', note: 'Проверка и синхронизация удалённых репозиториев' },
          { entityType: 'Module', name: 'Vault secret store', path: 'server/vault.ts', note: 'Хранение токенов и ключей на сервере' },
          { entityType: 'Endpoint', name: 'POST /api/ssh/test & /api/github/verify', path: 'server/app.ts', note: 'API проверки удалённых подключений' },
        ],
      },
    }),
  ];

  const verifiedDocumentsCount = new Set(
    tools.flatMap((t) =>
      t.interactionSchema.documentBindings.filter((d) => d.verifiedOnDisk).map((d) => d.path),
    ),
  ).size;

  return {
    tools,
    summary: {
      totalTools: tools.length,
      sysSingleSubagentCount: tools.filter((t) => t.isSysSingleSubagent).length,
      subagentEnabledCount: tools.filter((t) => t.subagentAccess.length > 0).length,
      generalAgentDirectCount: tools.filter((t) => t.generalAgentAccess.allowed).length,
      verifiedDocumentsCount,
    },
  };
}

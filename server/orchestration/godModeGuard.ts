import fs from 'node:fs';
import path from 'node:path';
import {
  CRITICAL_GOD_MODE_RULES,
  GOD_PRO_CONTROL_PHRASE,
  type CriticalGodModeRule,
} from '../../src/data/generalAgentModes';
import type {
  CriticalActionConfirmationRequest,
  GeneralAgentAuthorityMode,
  PersistedAppSettings,
} from '../../src/types/onecore';
import { recordAgentEvent } from '../agentJournal';
import {
  execProjectCommand,
  readProjectFile,
  runProjectGit,
  safeResolveInside,
  writeProjectFile,
} from '../projectAgent';
import { getProjectById } from '../projectsManager';
import { verifyFileRemoved } from '../verificationGate';

const pendingConfirmations = new Map<string, CriticalActionConfirmationRequest & { createdAtMs: number }>();

const DESTRUCTIVE_SHELL_RE =
  /(?:\brm\s+-[a-z]*r|\bformat(?:\.com|\s+[a-z]:|\s|$)|\bdiskpart\b|\bmkfs\b|\bdd\s+if=|\bshutdown\b|\breboot\b|\bpoweroff\b|\bhalt\b|\bdel\s+\/[sfq]|\brmdir\s+\/s|\bremove-item\b[^\n]*-recurse|\breg\s+(?:delete|add)\b|\bsudo\b|\bsu\s+-|\bkillall\b|\bpkill\b|\btaskkill\b|\bchown\b|\bchmod\s+777|\btruncate\s+-s\s+0|:\(\)\s*\{\s*:\|\:&\s*\}\s*;)/i;

const SENSITIVE_CONFIG_PATH_RE =
  /(?:^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.(?:pem|key|pfx|p12|crt)|settings\.json|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.toml|tsconfig\.json|server\.ts|tauri\.conf\.json|vite\.config\.[jt]s|firestore\.rules)$/i;

function findRule(ruleId: string): CriticalGodModeRule {
  return CRITICAL_GOD_MODE_RULES.find((rule) => rule.id === ruleId) ?? CRITICAL_GOD_MODE_RULES[0];
}

function isOutsideProjectPath(rawPath: string): boolean {
  const trimmed = rawPath.trim();
  if (!trimmed) return false;
  if (
    path.isAbsolute(trimmed) ||
    path.posix.isAbsolute(trimmed) ||
    path.win32.isAbsolute(trimmed) ||
    /^[a-zA-Z]:/.test(trimmed)
  ) {
    return true;
  }
  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized === '..' || normalized.startsWith('../') || normalized.includes('/../');
}

export function resolveVerifiedAuthorityMode(
  requestedMode: unknown,
  settings?: PersistedAppSettings | null,
): GeneralAgentAuthorityMode {
  const cfg = settings?.generalAgentConfig;
  const godProVerified = Boolean(
    cfg?.authorityMode === 'god-pro' &&
      cfg?.godProActivation?.controlPhraseVerified === true &&
      cfg?.godProActivation?.stage1Accepted === true &&
      cfg?.godProActivation?.stage3WaiverAccepted === true,
  );

  if (requestedMode === 'god-pro') {
    return godProVerified ? 'god-pro' : 'god';
  }
  if (requestedMode === 'god') return 'god';
  if (requestedMode === 'standard') return 'standard';
  return 'standard';
}

export function isVerifiedGodProSettings(settings?: PersistedAppSettings | null): boolean {
  const cfg = settings?.generalAgentConfig;
  return Boolean(
    cfg?.authorityMode === 'god-pro' &&
      cfg?.godProActivation?.controlPhraseVerified === true &&
      cfg?.godProActivation?.stage1Accepted === true &&
      cfg?.godProActivation?.stage3WaiverAccepted === true,
  );
}

export function verifyGodProActivationInput(input: {
  stage1Accepted?: unknown;
  typedPhrase?: unknown;
  stage3WaiverAccepted?: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (input.stage1Accepted !== true) {
    return {
      ok: false,
      error: 'Этап 1 не подтверждён: необходимо принять полную ответственность за возможную потерю IT-инфраструктуры.',
    };
  }
  const phrase = typeof input.typedPhrase === 'string' ? input.typedPhrase.trim() : '';
  if (phrase !== GOD_PRO_CONTROL_PHRASE) {
    return {
      ok: false,
      error: `Этап 2 не пройден: необходимо вручную ввести точную контрольную фразу «${GOD_PRO_CONTROL_PHRASE}».`,
    };
  }
  if (input.stage3WaiverAccepted !== true) {
    return {
      ok: false,
      error: 'Этап 3 не подтверждён: необходимо принять отказ от ответственности разработчика.',
    };
  }
  return { ok: true };
}

export interface CriticalRiskEvaluation {
  critical: boolean;
  rule?: CriticalGodModeRule;
  targetSummary: string;
}

export function evaluateCriticalActionRisk(input: {
  toolName: string;
  args: Record<string, unknown>;
  authorityMode: GeneralAgentAuthorityMode;
}): CriticalRiskEvaluation {
  if (input.authorityMode === 'god-pro') {
    return { critical: false, targetSummary: '' };
  }

  const rawPath = typeof input.args.path === 'string' ? input.args.path.trim() : '';

  if (rawPath && isOutsideProjectPath(rawPath)) {
    return {
      critical: true,
      rule: findRule('god-rule-outside-project'),
      targetSummary: rawPath,
    };
  }

  if (input.toolName === 'delete_project_file') {
    return {
      critical: true,
      rule: findRule('god-rule-file-delete'),
      targetSummary: rawPath || '(не указан путь)',
    };
  }

  if (input.toolName === 'run_project_command') {
    const command = typeof input.args.command === 'string' ? input.args.command.trim() : '';
    const isDestructive = DESTRUCTIVE_SHELL_RE.test(command);
    return {
      critical: true,
      rule: findRule(isDestructive ? 'god-rule-destructive-shell' : 'god-rule-mutating-shell'),
      targetSummary: command || '(пустая команда)',
    };
  }

  if (input.toolName === 'run_project_git') {
    const action = typeof input.args.action === 'string' ? input.args.action.trim().toLowerCase() : '';
    if (['commit', 'fetch', 'push', 'init', 'reset', 'clean', 'rebase'].includes(action)) {
      return {
        critical: true,
        rule: findRule('god-rule-git-mutate'),
        targetSummary: `git ${action}`,
      };
    }
  }

  if (input.toolName === 'write_project_file' && rawPath) {
    const normalized = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
    if (SENSITIVE_CONFIG_PATH_RE.test(normalized)) {
      return {
        critical: true,
        rule: findRule('god-rule-sensitive-configs'),
        targetSummary: normalized,
      };
    }
  }

  return { critical: false, targetSummary: rawPath };
}

export function createPendingCriticalConfirmation(input: {
  projectId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  rule: CriticalGodModeRule;
  targetSummary: string;
  operationId?: string;
}): CriticalActionConfirmationRequest {
  const id = `god-confirm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: CriticalActionConfirmationRequest = {
    id,
    operationId: input.operationId,
    actionType: input.rule.actionType,
    ruleId: input.rule.id,
    riskLevel: input.rule.riskLevel,
    titleRu: input.rule.titleRu,
    titleEn: input.rule.titleEn,
    descriptionRu: input.rule.descriptionRu,
    descriptionEn: input.rule.descriptionEn,
    targetSummary: input.targetSummary,
    toolName: input.toolName,
    toolArgs: input.toolArgs,
    projectId: input.projectId,
    status: 'pending',
  };

  pendingConfirmations.set(id, { ...entry, createdAtMs: Date.now() });
  while (pendingConfirmations.size > 256) {
    const oldest = pendingConfirmations.keys().next().value;
    if (!oldest) break;
    pendingConfirmations.delete(oldest);
  }

  recordAgentEvent({
    category: 'agent',
    level: 'warning',
    status: 'info',
    title: `GOD · Ожидание подтверждения: ${input.rule.titleRu}`,
    summary: `${input.toolName}: ${input.targetSummary.slice(0, 180)}`,
    source: 'god-mode-guard',
    projectId: input.projectId,
    details: {
      confirmationId: id,
      ruleId: input.rule.id,
      riskLevel: input.rule.riskLevel,
      toolName: input.toolName,
    },
  });

  return entry;
}

export function rejectPendingCriticalConfirmation(confirmationId: string): CriticalActionConfirmationRequest | null {
  const existing = pendingConfirmations.get(confirmationId);
  if (!existing) return null;
  pendingConfirmations.delete(confirmationId);
  return {
    ...existing,
    status: 'rejected',
  };
}

export async function executeConfirmedCriticalAction(input: {
  confirmationId: string;
  projectId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{
  ok: boolean;
  output: string;
  filePath?: string;
  commandResult?: Awaited<ReturnType<typeof execProjectCommand>>;
}> {
  const stored = pendingConfirmations.get(input.confirmationId);
  if (stored) {
    pendingConfirmations.delete(input.confirmationId);
  }

  const projectId = (stored?.projectId || input.projectId || '').trim();
  const toolName = (stored?.toolName || input.toolName || '').trim();
  const toolArgs = stored?.toolArgs ?? input.toolArgs ?? {};

  if (!projectId || !toolName) {
    throw new Error('Запрос на подтверждение не найден или уже устарел.');
  }

  const project = getProjectById(projectId);
  if (!project || !project.folderPath || !fs.existsSync(project.folderPath)) {
    throw new Error(`Проект ${projectId} или его папка недоступны.`);
  }

  if (toolName === 'delete_project_file') {
    const relPath = typeof toolArgs.path === 'string' ? toolArgs.path.trim().replace(/^\.\//, '') : '';
    const full = safeResolveInside(project.folderPath, relPath);
    if (!fs.existsSync(full)) {
      throw new Error(`Файл не найден для удаления: ${relPath}`);
    }
    fs.unlinkSync(full);
    const verification = verifyFileRemoved(full);
    if (!verification.verified) {
      throw new Error(`Не удалось подтвердить удаление файла ${relPath}`);
    }
    recordAgentEvent({
      category: 'project',
      level: 'warning',
      status: 'completed',
      title: 'GOD · Файл удалён после подтверждения',
      summary: `Удалён файл ${relPath}`,
      source: 'god-mode-guard',
      projectId,
      details: { filePath: relPath, confirmationId: input.confirmationId },
    });
    return {
      ok: true,
      filePath: relPath,
      output: `Файл ${relPath} удалён с диска после явного подтверждения пользователя.`,
    };
  }

  if (toolName === 'write_project_file') {
    const relPath = typeof toolArgs.path === 'string' ? toolArgs.path.trim().replace(/^\.\//, '') : '';
    const content = typeof toolArgs.content === 'string' ? toolArgs.content : '';
    const summary = typeof toolArgs.summary === 'string' && toolArgs.summary.trim()
      ? toolArgs.summary.trim()
      : 'GOD · подтверждённая запись критического файла';
    const result = writeProjectFile(projectId, relPath, content, summary);
    return {
      ok: true,
      filePath: result.path,
      output: `Файл ${result.path} записан после подтверждения (${content.length} символов).`,
    };
  }

  if (toolName === 'run_project_command') {
    const command = typeof toolArgs.command === 'string' ? toolArgs.command.trim() : '';
    const result = await execProjectCommand(projectId, command, 30000, input.signal);
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    return {
      ok: result.exitCode === 0,
      commandResult: result,
      output: `Команда \`${result.command}\` завершена с кодом ${result.exitCode}.${combined ? `\n\n${combined}` : ''}`,
    };
  }

  if (toolName === 'run_project_git') {
    const action = typeof toolArgs.action === 'string' ? toolArgs.action : 'status';
    if (!['status', 'diff', 'log', 'commit', 'fetch', 'push', 'init'].includes(action)) {
      throw new Error(`Неподдерживаемое действие Git: ${action}`);
    }
    const commitMessage = typeof toolArgs.message === 'string' ? toolArgs.message : undefined;
    const result = await runProjectGit(
      projectId,
      action as 'status' | 'diff' | 'log' | 'commit' | 'fetch' | 'push' | 'init',
      commitMessage,
    );
    return {
      ok: result.exitCode === 0,
      output: `Git ${action} (код ${result.exitCode}):\n${result.stdout || result.stderr || '(пустой вывод)'}`,
    };
  }

  if (toolName === 'read_project_file' || toolName === 'open_project_file') {
    const relPath = typeof toolArgs.path === 'string' ? toolArgs.path.trim() : '';
    if (isOutsideProjectPath(relPath)) {
      const resolved = path.resolve(project.folderPath, relPath);
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) throw new Error(`Путь не является файлом: ${resolved}`);
      const content = fs.readFileSync(resolved, 'utf-8').slice(0, 24000);
      return {
        ok: true,
        filePath: resolved,
        output: `Содержимое внешнего файла ${resolved}:\n\`\`\`\n${content}\n\`\`\``,
      };
    }
    const file = readProjectFile(projectId, relPath, input.signal);
    return {
      ok: true,
      filePath: file.path,
      output: `Файл ${file.path} прочитан (${file.sizeBytes} байт).`,
    };
  }

  throw new Error(`Подтверждение для инструмента ${toolName} не поддерживается.`);
}

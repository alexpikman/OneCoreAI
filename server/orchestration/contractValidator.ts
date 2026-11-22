import fs from 'node:fs';
import path from 'node:path';
import type { AgentHandoffContract, WorkerResultContract } from '../../src/types/onecore';

export interface ContractValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

export interface VerifiedWorkerEvidence {
  confirmedReadFiles: string[];
  confirmedChecks: Array<{ command: string; exitCode: number }>;
}

const VALID_HANDOFF_STATUSES = new Set(['ready', 'completed', 'blocked', 'needs_more_context', 'failed', 'cancelled']);
const VALID_RESULT_STATUSES = new Set(['completed', 'blocked', 'needs_more_context', 'failed', 'cancelled']);
const VALID_EVIDENCE_LEVELS = new Set(['listed', 'searched', 'read']);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const VALID_CHECK_STATUSES = new Set(['passed', 'failed', 'skipped', 'unavailable']);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function checkNoExtraKeys(obj: Record<string, unknown>, allowed: Set<string>, label: string, errors: string[]): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) errors.push(`${label}: недопустимое свойство "${key}"`);
  }
}

export function loadKnowledgeSchemas(knowledgeRoot: string): {
  agentHandoff: Record<string, unknown> | null;
  workerResult: Record<string, unknown> | null;
} {
  const readSchema = (filename: string) => {
    const filePath = path.join(knowledgeRoot, 'schemas', filename);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  return {
    agentHandoff: readSchema('agent-handoff.v1.schema.json'),
    workerResult: readSchema('worker-result.v1.schema.json'),
  };
}

export function validateAgentHandoff(payload: unknown): ContractValidationResult<AgentHandoffContract> {
  const errors: string[] = [];
  if (!isPlainObject(payload)) {
    return { ok: false, errors: ['AgentHandoff должен быть JSON-объектом.'] };
  }

  const allowedKeys = new Set([
    'schemaVersion', 'taskId', 'operationId', 'parentOperationId', 'fromRole', 'toRole',
    'objective', 'acceptanceCriteria', 'procedureRefs', 'project', 'files',
    'findings', 'completedSteps', 'unresolvedQuestions', 'allowedCapabilities',
    'outputFormat', 'status',
  ]);
  checkNoExtraKeys(payload, allowedKeys, 'AgentHandoff', errors);

  if (payload.schemaVersion !== 1) errors.push('AgentHandoff.schemaVersion должен быть равен 1.');
  for (const field of ['taskId', 'operationId', 'fromRole', 'toRole', 'objective', 'outputFormat'] as const) {
    if (typeof payload[field] !== 'string' || !payload[field].trim()) {
      errors.push(`AgentHandoff.${field} должен быть непустой строкой.`);
    }
  }
  if (payload.parentOperationId !== undefined && (typeof payload.parentOperationId !== 'string' || !payload.parentOperationId.trim())) {
    errors.push('AgentHandoff.parentOperationId должен быть непустой строкой.');
  }
  if (typeof payload.status !== 'string' || !VALID_HANDOFF_STATUSES.has(payload.status)) {
    errors.push('AgentHandoff.status содержит недопустимое значение.');
  }

  const validateStringArray = (value: unknown, field: string, maxItems: number) => {
    if (!Array.isArray(value)) {
      errors.push(`AgentHandoff.${field} должен быть массивом.`);
      return;
    }
    if (value.length > maxItems) errors.push(`AgentHandoff.${field} превышает лимит ${maxItems}.`);
    for (const item of value) {
      if (typeof item !== 'string') errors.push(`AgentHandoff.${field} должен содержать только строки.`);
    }
  };

  validateStringArray(payload.acceptanceCriteria, 'acceptanceCriteria', 40);
  validateStringArray(payload.findings, 'findings', 100);
  validateStringArray(payload.completedSteps, 'completedSteps', 100);
  validateStringArray(payload.unresolvedQuestions, 'unresolvedQuestions', 50);
  validateStringArray(payload.allowedCapabilities, 'allowedCapabilities', 30);

  if (!Array.isArray(payload.procedureRefs)) {
    errors.push('AgentHandoff.procedureRefs должен быть массивом.');
  } else {
    for (const ref of payload.procedureRefs) {
      if (!isPlainObject(ref) || typeof ref.id !== 'string' || !ref.id.trim() || typeof ref.version !== 'string' || !SEMVER_RE.test(ref.version)) {
        errors.push('AgentHandoff.procedureRefs содержит некорректную ссылку на регламент.');
      }
    }
  }

  if (!isPlainObject(payload.project) || typeof payload.project.projectId !== 'string' || !payload.project.projectId.trim() || !Array.isArray(payload.project.constraints)) {
    errors.push('AgentHandoff.project имеет некорректную структуру.');
  }

  if (!Array.isArray(payload.files)) {
    errors.push('AgentHandoff.files должен быть массивом.');
  } else {
    for (const file of payload.files) {
      if (
        !isPlainObject(file) ||
        typeof file.path !== 'string' || !file.path.trim() ||
        typeof file.purpose !== 'string' || !file.purpose.trim() ||
        typeof file.evidence !== 'string' || !VALID_EVIDENCE_LEVELS.has(file.evidence)
      ) {
        errors.push('AgentHandoff.files содержит некорректную запись файла.');
      }
    }
  }

  return errors.length === 0
    ? { ok: true, value: payload as unknown as AgentHandoffContract, errors: [] }
    : { ok: false, errors };
}

export function validateWorkerResult(
  payload: unknown,
  expectedHandoff: AgentHandoffContract,
  verifiedEvidence: VerifiedWorkerEvidence,
): ContractValidationResult<WorkerResultContract> {
  const errors: string[] = [];
  if (!isPlainObject(payload)) {
    return { ok: false, errors: ['WorkerResult должен быть JSON-объектом.'] };
  }

  const allowedKeys = new Set([
    'schemaVersion', 'taskId', 'operationId', 'status', 'summary',
    'findings', 'filesInspected', 'checks', 'unresolvedQuestions', 'limitations',
  ]);
  checkNoExtraKeys(payload, allowedKeys, 'WorkerResult', errors);

  if (payload.schemaVersion !== 1) errors.push('WorkerResult.schemaVersion должен быть равен 1.');
  // Rule 1: Reject mismatched task or operation IDs
  if (payload.taskId !== expectedHandoff.taskId) {
    errors.push(`WorkerResult.taskId ("${String(payload.taskId)}") не совпадает с handoff.taskId ("${expectedHandoff.taskId}").`);
  }
  if (payload.operationId !== expectedHandoff.operationId) {
    errors.push(`WorkerResult.operationId ("${String(payload.operationId)}") не совпадает с handoff.operationId ("${expectedHandoff.operationId}").`);
  }

  // Rule 2: Reject unknown statuses and malformed required fields
  if (typeof payload.status !== 'string' || !VALID_RESULT_STATUSES.has(payload.status)) {
    errors.push('WorkerResult.status содержит недопустимое значение.');
  }
  if (typeof payload.summary !== 'string' || !payload.summary.trim()) {
    errors.push('WorkerResult.summary должен быть непустой строкой.');
  }

  if (!Array.isArray(payload.findings)) {
    errors.push('WorkerResult.findings должен быть массивом.');
  } else {
    for (const finding of payload.findings) {
      if (
        !isPlainObject(finding) ||
        typeof finding.severity !== 'string' || !VALID_SEVERITIES.has(finding.severity) ||
        typeof finding.statement !== 'string' || !finding.statement.trim() ||
        !Array.isArray(finding.evidence) ||
        typeof finding.impact !== 'string' ||
        typeof finding.recommendation !== 'string'
      ) {
        errors.push('WorkerResult.findings содержит некорректную запись.');
      }
    }
  }

  // Rule 3: Do not accept a path as inspected unless an application tool confirms the read
  const confirmedReads = new Set(verifiedEvidence.confirmedReadFiles);
  if (!Array.isArray(payload.filesInspected)) {
    errors.push('WorkerResult.filesInspected должен быть массивом.');
  } else {
    for (const filePath of payload.filesInspected) {
      if (typeof filePath !== 'string' || !filePath.trim()) {
        errors.push('WorkerResult.filesInspected должен содержать непустые строки.');
      } else if (!confirmedReads.has(filePath)) {
        errors.push(`Путь "${filePath}" указан в filesInspected без подтверждения чтения инструментом приложения.`);
      }
    }
  }

  // Rule 4: Do not accept a check as passed unless an execution result confirms exit code zero
  if (!Array.isArray(payload.checks)) {
    errors.push('WorkerResult.checks должен быть массивом.');
  } else {
    for (const check of payload.checks) {
      if (
        !isPlainObject(check) ||
        typeof check.command !== 'string' || !check.command.trim() ||
        typeof check.status !== 'string' || !VALID_CHECK_STATUSES.has(check.status) ||
        (check.exitCode !== null && typeof check.exitCode !== 'number') ||
        typeof check.output !== 'string'
      ) {
        errors.push('WorkerResult.checks содержит некорректную запись.');
        continue;
      }
      if (check.status === 'passed') {
        const matched = verifiedEvidence.confirmedChecks.some(
          (item) => item.command === check.command && item.exitCode === 0,
        );
        if (!matched || check.exitCode !== 0) {
          errors.push(`Проверка "${check.command}" отмечена как passed без подтверждения от исполнителя с exitCode=0.`);
        }
      }
    }
  }

  if (!Array.isArray(payload.unresolvedQuestions) || payload.unresolvedQuestions.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push('WorkerResult.unresolvedQuestions должен быть массивом непустых строк.');
  }
  if (!Array.isArray(payload.limitations) || payload.limitations.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push('WorkerResult.limitations должен быть массивом непустых строк.');
  }

  return errors.length === 0
    ? { ok: true, value: payload as unknown as WorkerResultContract, errors: [] }
    : { ok: false, errors };
}

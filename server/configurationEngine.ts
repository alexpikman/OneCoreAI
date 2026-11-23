export type ConfigurationValue =
  | string
  | number
  | boolean
  | null
  | ConfigurationValue[]
  | { [key: string]: ConfigurationValue };

export type ConfigurationObject = { [key: string]: ConfigurationValue };

export interface ConfigurationNode {
  id: string;
  kind: string;
  parentId?: string;
  enabled?: boolean;
  requires?: string[];
  conflictsWith?: string[];
}

export interface ConfigurationDiagnostic {
  code:
    | 'duplicate-id'
    | 'missing-parent'
    | 'parent-cycle'
    | 'missing-dependency'
    | 'disabled-dependency'
    | 'dependency-cycle'
    | 'conflicting-nodes'
    | 'invalid-draft';
  message: string;
  nodeIds: string[];
}

export interface ConfigurationAnalysis {
  canApply: boolean;
  diagnostics: ConfigurationDiagnostic[];
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SENSITIVE_KEY_PATTERN = /(?:api.?key|api.?token|access.?token|refresh.?token|github.?token|provider.?token|cloud.?token|cloudfallback.?key|bot.?token|bearer.?token|oauth.?token|personal.?access.?token|private.?key|password|secret|authorization|credential|^token$)/i;

function isConfigurationObject(value: unknown): value is ConfigurationObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneConfigurationValue(value: ConfigurationValue): ConfigurationValue {
  if (Array.isArray(value)) return value.map(cloneConfigurationValue);
  if (isConfigurationObject(value)) {
    const result: ConfigurationObject = {};
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new Error(`Недопустимый ключ конфигурации: ${key}`);
      }
      result[key] = cloneConfigurationValue(child);
    }
    return result;
  }
  return value;
}

/**
 * Resolves configuration layers from lowest to highest priority.
 * Objects merge recursively; arrays and scalar values are replaced atomically.
 * Inputs are never mutated. A null value explicitly overrides a lower layer.
 */
export function mergeConfigurationLayers(
  ...layers: readonly ConfigurationObject[]
): ConfigurationObject {
  let resolved: ConfigurationObject = {};

  for (const layer of layers) {
    if (!isConfigurationObject(layer) || !validateConfigurationValue(layer, new WeakSet())) {
      throw new Error('Слой конфигурации должен содержать только безопасные JSON-значения');
    }

    const merge = (base: ConfigurationObject, override: ConfigurationObject): ConfigurationObject => {
      const result = cloneConfigurationValue(base) as ConfigurationObject;
      for (const [key, value] of Object.entries(override)) {
        if (FORBIDDEN_KEYS.has(key)) {
          throw new Error(`Недопустимый ключ конфигурации: ${key}`);
        }
        const previous = result[key];
        result[key] =
          isConfigurationObject(previous) && isConfigurationObject(value)
            ? merge(previous, value)
            : cloneConfigurationValue(value);
      }
      return result;
    };

    resolved = merge(resolved, layer);
  }

  return resolved;
}

export function analyzeConfigurationDependencies(
  nodes: readonly ConfigurationNode[],
): ConfigurationAnalysis {
  const diagnostics: ConfigurationDiagnostic[] = [];
  const nodesById = new Map<string, ConfigurationNode>();
  const duplicateIds = new Set<string>();

  for (const node of nodes) {
    if (!node.id.trim()) {
      diagnostics.push({
        code: 'duplicate-id',
        message: 'Идентификатор элемента не может быть пустым',
        nodeIds: [node.id],
      });
      continue;
    }
    if (nodesById.has(node.id)) duplicateIds.add(node.id);
    else nodesById.set(node.id, node);
  }

  for (const id of duplicateIds) {
    diagnostics.push({
      code: 'duplicate-id',
      message: `Идентификатор элемента "${id}" используется несколько раз`,
      nodeIds: [id],
    });
  }

  const reportedConflicts = new Set<string>();

  for (const node of nodes) {
    if (node.parentId && !nodesById.has(node.parentId)) {
      diagnostics.push({
        code: 'missing-parent',
        message: `Родительский элемент "${node.parentId}" не найден`,
        nodeIds: [node.id, node.parentId],
      });
    }

    for (const dependencyId of node.requires ?? []) {
      const dependency = nodesById.get(dependencyId);
      if (!dependency) {
        diagnostics.push({
          code: 'missing-dependency',
          message: `Зависимость "${dependencyId}" элемента "${node.id}" не найдена`,
          nodeIds: [node.id, dependencyId],
        });
      } else if (node.enabled !== false && dependency.enabled === false) {
        diagnostics.push({
          code: 'disabled-dependency',
          message: `Элемент "${node.id}" требует отключённый элемент "${dependencyId}"`,
          nodeIds: [node.id, dependencyId],
        });
      }
    }

    if (node.enabled === false) continue;
    for (const conflictId of node.conflictsWith ?? []) {
      const conflict = nodesById.get(conflictId);
      if (!conflict || conflict.enabled === false) continue;
      const pair = [node.id, conflictId].sort();
      const conflictKey = pair.join('|');
      const conflictIsDeclared =
        nodesById.get(pair[0])?.conflictsWith?.includes(pair[1]) ||
        nodesById.get(pair[1])?.conflictsWith?.includes(pair[0]);
      if (conflictIsDeclared && !reportedConflicts.has(conflictKey)) {
        reportedConflicts.add(conflictKey);
        diagnostics.push({
          code: 'conflicting-nodes',
          message: `Элементы "${pair[0]}" и "${pair[1]}" несовместимы`,
          nodeIds: pair,
        });
      }
    }
  }

  const dependencyState = new Map<string, 0 | 1 | 2>();
  const dependencyStack: string[] = [];
  const reportedDependencyCycles = new Set<string>();
  const visitDependency = (id: string): void => {
    const state = dependencyState.get(id) ?? 0;
    if (state === 2) return;
    if (state === 1) {
      const cycleStart = dependencyStack.indexOf(id);
      const cycle = dependencyStack.slice(cycleStart);
      const key = [...cycle].sort().join('|');
      if (!reportedDependencyCycles.has(key)) {
        reportedDependencyCycles.add(key);
        diagnostics.push({
          code: 'dependency-cycle',
          message: `Обнаружен цикл зависимостей: ${[...cycle, id].join(' → ')}`,
          nodeIds: [...cycle, id],
        });
      }
      return;
    }

    dependencyState.set(id, 1);
    dependencyStack.push(id);
    for (const dependencyId of nodesById.get(id)?.requires ?? []) {
      if (nodesById.has(dependencyId)) visitDependency(dependencyId);
    }
    dependencyStack.pop();
    dependencyState.set(id, 2);
  };

  for (const id of nodesById.keys()) visitDependency(id);

  const parentState = new Map<string, 0 | 1 | 2>();
  const parentStack: string[] = [];
  const reportedParentCycles = new Set<string>();
  const visitParent = (id: string): void => {
    const state = parentState.get(id) ?? 0;
    if (state === 2) return;
    if (state === 1) {
      const cycleStart = parentStack.indexOf(id);
      const cycle = parentStack.slice(cycleStart);
      const key = [...cycle].sort().join('|');
      if (!reportedParentCycles.has(key)) {
        reportedParentCycles.add(key);
        diagnostics.push({
          code: 'parent-cycle',
          message: `Обнаружен цикл вложенности: ${[...cycle, id].join(' → ')}`,
          nodeIds: [...cycle, id],
        });
      }
      return;
    }

    parentState.set(id, 1);
    parentStack.push(id);
    const parentId = nodesById.get(id)?.parentId;
    if (parentId && nodesById.has(parentId)) visitParent(parentId);
    parentStack.pop();
    parentState.set(id, 2);
  };

  for (const id of nodesById.keys()) visitParent(id);

  return {
    canApply: diagnostics.length === 0,
    diagnostics,
  };
}


export const CONFIGURATION_SCHEMA_VERSION = 1 as const;

export interface ConfigurationScope {
  type: 'global' | 'project';
  projectId?: string;
}

export interface ConfigurationDocument {
  schemaVersion: typeof CONFIGURATION_SCHEMA_VERSION;
  revision: number;
  scope: ConfigurationScope;
  config: ConfigurationObject;
}

export interface ConfigurationDraft {
  status: 'draft';
  schemaVersion: typeof CONFIGURATION_SCHEMA_VERSION;
  scope: ConfigurationScope;
  baseRevision: number;
  config: ConfigurationObject;
}

export interface ConfigurationDocumentValidation {
  valid: boolean;
  diagnostics: Array<{
    code: 'invalid-document' | 'unsupported-schema-version' | 'invalid-revision' | 'invalid-scope' | 'invalid-config';
    message: string;
  }>;
}

function validateConfigurationValue(
  value: unknown,
  seen: WeakSet<object>,
  depth = 0,
): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  let valid: boolean;
  if (Array.isArray(value)) {
    valid = value.every((item) => validateConfigurationValue(item, seen, depth + 1));
  } else if (!isConfigurationObject(value)) {
    valid = false;
  } else {
    valid = Object.entries(value).every(([key, child]) =>
      !FORBIDDEN_KEYS.has(key) && !SENSITIVE_KEY_PATTERN.test(key) && validateConfigurationValue(child, seen, depth + 1),
    );
  }
  seen.delete(value);
  return valid;
}

export function validateConfigurationDocument(
  value: unknown,
): ConfigurationDocumentValidation {
  const diagnostics: ConfigurationDocumentValidation['diagnostics'] = [];
  if (!isConfigurationObject(value)) {
    return {
      valid: false,
      diagnostics: [{ code: 'invalid-document', message: 'Документ конфигурации должен быть объектом' }],
    };
  }

  if (value.schemaVersion !== CONFIGURATION_SCHEMA_VERSION) {
    diagnostics.push({
      code: 'unsupported-schema-version',
      message: `Версия схемы конфигурации "${String(value.schemaVersion)}" не поддерживается`,
    });
  }

  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    diagnostics.push({
      code: 'invalid-revision',
      message: 'Ревизия конфигурации должна быть целым неотрицательным числом',
    });
  }

  if (!isConfigurationObject(value.scope)) {
    diagnostics.push({
      code: 'invalid-scope',
      message: 'Область конфигурации должна быть объектом',
    });
  } else if (
    (value.scope.type !== 'global' && value.scope.type !== 'project') ||
    (value.scope.type === 'project' && (typeof value.scope.projectId !== 'string' || !value.scope.projectId.trim())) ||
    (value.scope.type === 'global' && value.scope.projectId !== undefined)
  ) {
    diagnostics.push({
      code: 'invalid-scope',
      message: 'Область должна быть global либо project с непустым projectId',
    });
  }

  if (!isConfigurationObject(value.config) || !validateConfigurationValue(value.config, new WeakSet())) {
    diagnostics.push({
      code: 'invalid-config',
      message: 'Конфигурация должна содержать только безопасные JSON-значения',
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function createConfigurationDocument(
  scope: ConfigurationScope,
  config: ConfigurationObject,
  revision = 0,
): ConfigurationDocument {
  if (!isConfigurationObject(config) || !validateConfigurationValue(config, new WeakSet())) {
    throw new Error('Конфигурация должна содержать только безопасные JSON-значения');
  }
  const document: ConfigurationDocument = {
    schemaVersion: CONFIGURATION_SCHEMA_VERSION,
    revision,
    scope: { ...scope },
    config: cloneConfigurationValue(config) as ConfigurationObject,
  };
  const validation = validateConfigurationDocument(document);
  if (!validation.valid) {
    throw new Error(validation.diagnostics.map((item) => item.message).join('; '));
  }
  return document;
}

/**
 * Creates an isolated draft. It never persists or applies changes to a runtime.
 * The base revision is retained so a future apply operation can detect stale drafts.
 */
export function createConfigurationDraft(
  base: ConfigurationDocument,
  changes: ConfigurationObject,
): ConfigurationDraft {
  const validation = validateConfigurationDocument(base);
  if (!validation.valid) {
    throw new Error(validation.diagnostics.map((item) => item.message).join('; '));
  }
  if (!isConfigurationObject(changes) || !validateConfigurationValue(changes, new WeakSet())) {
    throw new Error('Изменения черновика должны содержать только безопасные JSON-значения');
  }

  return {
    status: 'draft',
    schemaVersion: CONFIGURATION_SCHEMA_VERSION,
    scope: { ...base.scope },
    baseRevision: base.revision,
    config: mergeConfigurationLayers(base.config, changes),
  };
}

export function analyzeConfigurationDraft(
  draft: ConfigurationDraft,
  nodes: readonly ConfigurationNode[] = [],
): ConfigurationAnalysis {
  const diagnostics: ConfigurationDiagnostic[] = [];
  if (
    draft.status !== 'draft' ||
    draft.schemaVersion !== CONFIGURATION_SCHEMA_VERSION ||
    !Number.isSafeInteger(draft.baseRevision) ||
    draft.baseRevision < 0 ||
    !isConfigurationObject(draft.scope) ||
    (draft.scope.type !== 'global' && draft.scope.type !== 'project') ||
    (draft.scope.type === 'project' && (typeof draft.scope.projectId !== 'string' || !draft.scope.projectId.trim())) ||
    (draft.scope.type === 'global' && draft.scope.projectId !== undefined) ||
    !isConfigurationObject(draft.config) ||
    !validateConfigurationValue(draft.config, new WeakSet())
  ) {
    diagnostics.push({
      code: 'invalid-draft',
      message: 'Черновик конфигурации имеет некорректную структуру или версию',
      nodeIds: [],
    });
  }

  const dependencyAnalysis = analyzeConfigurationDependencies(nodes);
  diagnostics.push(...dependencyAnalysis.diagnostics);
  return { canApply: diagnostics.length === 0, diagnostics };
}

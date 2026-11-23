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
    | 'conflicting-nodes';
  message: string;
  nodeIds: string[];
}

export interface ConfigurationAnalysis {
  canApply: boolean;
  diagnostics: ConfigurationDiagnostic[];
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

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
    if (!isConfigurationObject(layer)) {
      throw new Error('Слой конфигурации должен быть объектом');
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
      if (nodesById.get(pair[0])?.conflictsWith?.includes(pair[1])) {
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

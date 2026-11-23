import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { getOneCoreHome } from './paths';
import { validateNavigationLayout } from '../src/data/navigationLayout';
import {
  analyzeConfigurationDraft,
  createConfigurationDocument,
  validateConfigurationDocument,
  type ConfigurationDocument,
  type ConfigurationDraft,
  type ConfigurationNode,
  type ConfigurationScope,
} from './configurationEngine';

export class ConfigurationRevisionConflictError extends Error {
  constructor(message = 'Конфигурация была изменена после создания черновика') {
    super(message);
    this.name = 'ConfigurationRevisionConflictError';
  }
}

function scopeKey(scope: ConfigurationScope): string {
  if (scope.type === 'global') return 'global';
  if (typeof scope.projectId !== 'string' || !scope.projectId.trim()) {
    throw new Error('Для проектной конфигурации требуется projectId');
  }
  return createHash('sha256').update(scope.projectId).digest('hex');
}

function storagePaths(scope: ConfigurationScope): { current: string; history: string } {
  const root = path.join(getOneCoreHome(), 'designer-configurations');
  const key = scopeKey(scope);
  return {
    current: path.join(root, 'current', `${key}.json`),
    history: path.join(root, 'history', key),
  };
}

function ensurePrivateDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}

function writeAtomicJson(filePath: string, value: unknown): void {
  ensurePrivateDirectory(path.dirname(filePath));
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

function readDocument(filePath: string, expectedScope: ConfigurationScope): ConfigurationDocument | null {
  if (!fs.existsSync(filePath)) return null;
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const validation = validateConfigurationDocument(parsed);
  if (!validation.valid) {
    throw new Error(`Сохранённая конфигурация повреждена: ${validation.diagnostics.map((item) => item.message).join('; ')}`);
  }

  const document = parsed as ConfigurationDocument;
  if (
    document.scope.type !== expectedScope.type ||
    document.scope.projectId !== expectedScope.projectId
  ) {
    throw new Error('Область сохранённой конфигурации не совпадает с запрошенной');
  }
  assertDesignerConfigurationValid(document.config);
  return document;
}

function assertDesignerConfigurationValid(config: ConfigurationDocument['config']): void {
  if (config.navigation === undefined) return;
  const validation = validateNavigationLayout(config.navigation);
  if (!validation.valid) {
    throw new Error(`Макет навигации некорректен: ${validation.diagnostics.map((item) => item.message).join('; ')}`);
  }
}

const scopeLocks = new Map<string, Promise<void>>();

async function withScopeLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = scopeLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  scopeLocks.set(key, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (scopeLocks.get(key) === current) scopeLocks.delete(key);
  }
}

function saveRevision(document: ConfigurationDocument, paths: ReturnType<typeof storagePaths>): void {
  const historyPath = path.join(paths.history, `${document.revision}.json`);
  if (fs.existsSync(historyPath)) {
    const existing = readDocument(historyPath, document.scope);
    if (!existing || JSON.stringify(existing) !== JSON.stringify(document)) {
      throw new ConfigurationRevisionConflictError('Такая ревизия конфигурации уже существует');
    }
  } else {
    writeAtomicJson(historyPath, document);
  }

  writeAtomicJson(paths.current, document);
}

export function readConfigurationDocument(scope: ConfigurationScope): ConfigurationDocument | null {
  return readDocument(storagePaths(scope).current, scope);
}

export function listConfigurationHistory(scope: ConfigurationScope): ConfigurationDocument[] {
  const paths = storagePaths(scope);
  if (!fs.existsSync(paths.history)) return [];

  return fs.readdirSync(paths.history)
    .filter((fileName) => /^\d+\.json$/.test(fileName))
    .map((fileName) => readDocument(path.join(paths.history, fileName), scope))
    .filter((document): document is ConfigurationDocument => document !== null)
    .sort((left, right) => right.revision - left.revision);
}

export async function applyConfigurationDraft(
  draft: ConfigurationDraft,
  nodes: readonly ConfigurationNode[] = [],
): Promise<ConfigurationDocument> {
  const analysis = analyzeConfigurationDraft(draft, nodes);
  if (!analysis.canApply) {
    throw new Error(`Применение заблокировано: ${analysis.diagnostics.map((item) => item.message).join('; ')}`);
  }
  assertDesignerConfigurationValid(draft.config);

  const key = scopeKey(draft.scope);
  return withScopeLock(key, async () => {
    const paths = storagePaths(draft.scope);
    const current = readDocument(paths.current, draft.scope);
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== draft.baseRevision) {
      throw new ConfigurationRevisionConflictError();
    }

    const next = createConfigurationDocument(
      draft.scope,
      draft.config,
      currentRevision + 1,
    );
    saveRevision(next, paths);
    return next;
  });
}

export async function restoreConfigurationRevision(
  scope: ConfigurationScope,
  targetRevision: number,
  expectedCurrentRevision: number,
): Promise<ConfigurationDocument> {
  if (!Number.isSafeInteger(targetRevision) || targetRevision < 1) {
    throw new Error('Целевая ревизия должна быть положительным целым числом');
  }
  if (!Number.isSafeInteger(expectedCurrentRevision) || expectedCurrentRevision < 0) {
    throw new Error('Текущая ревизия должна быть неотрицательным целым числом');
  }

  const key = scopeKey(scope);
  return withScopeLock(key, async () => {
    const paths = storagePaths(scope);
    const current = readDocument(paths.current, scope);
    if ((current?.revision ?? 0) !== expectedCurrentRevision) {
      throw new ConfigurationRevisionConflictError();
    }

    const target = readDocument(path.join(paths.history, `${targetRevision}.json`), scope);
    if (!target) throw new Error(`Ревизия ${targetRevision} не найдена`);
    assertDesignerConfigurationValid(target.config);

    const restored = createConfigurationDocument(
      scope,
      target.config,
      expectedCurrentRevision + 1,
    );
    saveRevision(restored, paths);
    return restored;
  });
}

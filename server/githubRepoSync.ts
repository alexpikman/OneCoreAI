import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { recordAgentEvent } from './agentJournal';
import { getProjectById, updateProjectGithubConfig } from './projectsManager';
import {
  clearIntegrationSecret,
  getIntegrationSecret,
  readAppSettings,
  readInternalAppSettings,
  saveAppSettings,
  setIntegrationSecret,
} from './settingsManager';
import { deleteSecret, getSecret, setSecret } from './vault';

const execFileAsync = promisify(execFile);

export type RepoSyncTargetType = 'app' | 'project';
export type RepoSyncAuthMethod = 'pat' | 'ssh' | 'public';
export type RepoPullStrategy = 'ff-only' | 'rebase-stash' | 'overwrite-from-remote';

export interface RepoSyncTargetInput {
  targetType: RepoSyncTargetType;
  projectId?: string;
}

export interface RepoSyncFileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'remote-only' | 'local-only';
  source: 'local' | 'remote' | 'both';
  label: string;
}

export interface RepoSyncCommitSummary {
  hash: string;
  subject: string;
}

export interface RepoSyncConfigState {
  targetType: RepoSyncTargetType;
  projectId?: string;
  targetLabel: string;
  targetPath: string;
  repo: string;
  branch: string;
  authMethod: RepoSyncAuthMethod;
  gitUserName: string;
  gitUserEmail: string;
  tokenConfigured: boolean;
  globalTokenConfigured: boolean;
  gitAvailable: boolean;
  hasGitRepo: boolean;
  currentBranch: string | null;
  currentOrigin: string | null;
}

export interface RepoSyncDiffReport {
  checkedAt: string;
  targetType: RepoSyncTargetType;
  projectId?: string;
  targetPath: string;
  repo: string;
  branch: string;
  hasGitRepo: boolean;
  remoteBranchExists: boolean;
  localHead: string | null;
  remoteHead: string | null;
  aheadCommits: number;
  behindCommits: number;
  incomingCommits: RepoSyncCommitSummary[];
  outgoingCommits: RepoSyncCommitSummary[];
  localDirtyFiles: RepoSyncFileDiff[];
  remoteDiffFiles: RepoSyncFileDiff[];
  allDiffFiles: RepoSyncFileDiff[];
  inSync: boolean;
  diffPreview: string;
  summary: string;
}

export interface RepoSyncMutationResult {
  ok: boolean;
  action: 'pull' | 'push';
  message: string;
  needsStrategyChoice?: boolean;
  remoteAhead?: boolean;
  behindCommits?: number;
  commitHash?: string;
  initializedGitRepo?: boolean;
  diff?: RepoSyncDiffReport;
}

export interface RepoSyncOperationOptions {
  remoteUrlForTestOnly?: string;
}

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'dev-dist',
  'coverage',
  '.vite',
  '.next',
  '.turbo',
  '__pycache__',
  '.venv',
]);

const DEFAULT_IGNORED_REL_PATHS = new Set([
  'src-tauri/binaries',
  'src-tauri/runtime',
  'src-tauri/target',
]);

export function normalizeGitHubRepo(rawRepo: string): {
  cleanRepo: string;
  owner: string;
  repoName: string;
} {
  const trimmed = rawRepo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');

  const match = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    throw new Error('Укажите GitHub-репозиторий строго в формате owner/repo.');
  }

  const [, owner, repoName] = match;
  if (
    owner === '.' ||
    owner === '..' ||
    repoName === '.' ||
    repoName === '..' ||
    owner.startsWith('-') ||
    repoName.startsWith('-')
  ) {
    throw new Error('Некорректное имя владельца или репозитория GitHub.');
  }

  return {
    cleanRepo: `${owner}/${repoName}`,
    owner,
    repoName,
  };
}

export function validateGitBranch(rawBranch: string): string {
  const branch = rawBranch.trim();
  if (!branch) {
    throw new Error('Укажите имя ветки Git (например, main).');
  }
  if (
    branch.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) ||
    branch.includes('..') ||
    branch.includes('@{') ||
    branch.includes('//') ||
    branch.endsWith('/') ||
    branch.endsWith('.') ||
    branch.endsWith('.lock')
  ) {
    throw new Error('Некорректное имя ветки Git.');
  }
  return branch;
}

function normalizeAuthMethod(value: unknown): RepoSyncAuthMethod {
  if (value === 'ssh' || value === 'public' || value === 'pat') return value;
  return 'pat';
}

function sanitizeGitIdentityValue(value: unknown, fallback: string): string {
  const cleaned = typeof value === 'string' ? value.replace(/[\r\n\0]/g, '').trim() : '';
  return (cleaned || fallback).slice(0, 120);
}

function sanitizeCommitMessage(value: unknown): string {
  const cleaned = typeof value === 'string' ? value.replace(/\0/g, '').trim() : '';
  return (cleaned || 'Обновление файлов из локальной копии').slice(0, 500);
}

export function buildGitHubRemoteUrl(cleanRepo: string, authMethod: RepoSyncAuthMethod): string {
  if (authMethod === 'ssh') {
    return `git@github.com:${cleanRepo}.git`;
  }
  return `https://github.com/${cleanRepo}.git`;
}

function redactSecrets(text: string, token?: string | null): string {
  let result = text;
  if (token && token.trim()) {
    result = result.split(token.trim()).join('[REDACTED]');
    const basic = Buffer.from(`x-access-token:${token.trim()}`, 'utf-8').toString('base64');
    result = result.split(basic).join('[REDACTED]');
  }
  result = result
    .replace(/https:\/\/x-access-token:[^@\s]+@/gi, 'https://x-access-token:[REDACTED]@')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/AUTHORIZATION:\s*basic\s+[A-Za-z0-9+/=]+/gi, 'AUTHORIZATION: basic [REDACTED]');
  return result;
}

function sanitizeRemoteOriginDisplay(rawOrigin: string | null): string | null {
  if (!rawOrigin) return null;
  return rawOrigin.replace(/https:\/\/[^/@\s]+@/i, 'https://');
}

function buildGitEnv(authMethod: RepoSyncAuthMethod, token: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  };

  if (authMethod === 'pat' && token?.trim()) {
    const basicToken = Buffer.from(`x-access-token:${token.trim()}`, 'utf-8').toString('base64');
    env.GIT_CONFIG_COUNT = '1';
    env.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader';
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basicToken}`;
  } else if (authMethod === 'ssh' && !env.GIT_SSH_COMMAND) {
    env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new';
  }

  return env;
}

async function execGit(
  cwd: string,
  args: string[],
  options: {
    authMethod?: RepoSyncAuthMethod;
    token?: string | null;
    timeoutMs?: number;
  } = {},
): Promise<{ stdout: string; stderr: string }> {
  const authMethod = options.authMethod ?? 'public';
  const token = options.token ?? null;
  const env = buildGitEnv(authMethod, token);
  try {
    const { stdout, stderr } = await execFileAsync('git', ['-C', cwd, ...args], {
      env,
      timeout: options.timeoutMs ?? 45000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return {
      stdout: redactSecrets(stdout, token),
      stderr: redactSecrets(stderr, token),
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    const cleanMsg = redactSecrets(e.stderr?.trim() || e.stdout?.trim() || e.message || 'Ошибка выполнения Git', token);
    const wrapped = new Error(cleanMsg) as Error & { stdout?: string; stderr?: string; code?: number };
    wrapped.stdout = redactSecrets(e.stdout ?? '', token);
    wrapped.stderr = redactSecrets(e.stderr ?? '', token);
    wrapped.code = e.code;
    throw wrapped;
  }
}

async function execGitWithDir(
  gitDir: string,
  args: string[],
  options: {
    authMethod?: RepoSyncAuthMethod;
    token?: string | null;
    timeoutMs?: number;
  } = {},
): Promise<{ stdout: string; stderr: string }> {
  const authMethod = options.authMethod ?? 'public';
  const token = options.token ?? null;
  const env = buildGitEnv(authMethod, token);
  try {
    const { stdout, stderr } = await execFileAsync('git', ['--git-dir', gitDir, ...args], {
      env,
      timeout: options.timeoutMs ?? 45000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return {
      stdout: redactSecrets(stdout, token),
      stderr: redactSecrets(stderr, token),
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    const cleanMsg = redactSecrets(e.stderr?.trim() || e.stdout?.trim() || e.message || 'Ошибка выполнения Git', token);
    const wrapped = new Error(cleanMsg) as Error & { stdout?: string; stderr?: string; code?: number };
    wrapped.stdout = redactSecrets(e.stdout ?? '', token);
    wrapped.stderr = redactSecrets(e.stderr ?? '', token);
    wrapped.code = e.code;
    throw wrapped;
  }
}

async function isGitAvailable(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function resolveRepoSyncTarget(
  rootDir: string,
  input: RepoSyncTargetInput,
): {
  targetType: RepoSyncTargetType;
  projectId?: string;
  dir: string;
  label: string;
} {
  if (input.targetType === 'project') {
    const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : '';
    if (!projectId) {
      throw new Error('Выберите проект для синхронизации с GitHub.');
    }
    const project = getProjectById(projectId);
    if (!project) {
      throw new Error(`Проект с ID ${projectId} не найден.`);
    }
    if (project.folderSource === 'ssh') {
      throw new Error(
        'Выбранный проект работает по SSH на удалённом сервере. Для файловой синхронизации выберите локальный/GitHub проект или копию приложения.',
      );
    }
    const dir = path.resolve(project.folderPath || '');
    if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new Error(`Локальная папка проекта не найдена: ${dir || '(пусто)'}`);
    }
    return {
      targetType: 'project',
      projectId: project.id,
      dir,
      label: project.name,
    };
  }

  const dir = path.resolve(rootDir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Рабочий каталог приложения не найден: ${dir}`);
  }
  return {
    targetType: 'app',
    dir,
    label: 'Локальная копия приложения (OneCoreAI)',
  };
}

async function resolveGithubSyncToken(targetType: RepoSyncTargetType, projectId?: string): Promise<{
  token: string | null;
  projectTokenConfigured: boolean;
  globalTokenConfigured: boolean;
}> {
  const globalToken = await getIntegrationSecret('github');
  const projectToken = targetType === 'project' && projectId ? await getSecret(`github:${projectId}`) : null;
  return {
    token: projectToken?.trim() || globalToken?.trim() || null,
    projectTokenConfigured: Boolean(projectToken?.trim()),
    globalTokenConfigured: Boolean(globalToken?.trim()),
  };
}

async function inspectGitRepoMetadata(dir: string): Promise<{
  hasGitRepo: boolean;
  currentBranch: string | null;
  currentOrigin: string | null;
}> {
  const gitMarker = path.join(dir, '.git');
  if (!fs.existsSync(gitMarker)) {
    return { hasGitRepo: false, currentBranch: null, currentOrigin: null };
  }

  let currentBranch: string | null = null;
  let currentOrigin: string | null = null;

  try {
    const branchRes = await execGit(dir, ['symbolic-ref', '--short', 'HEAD']);
    currentBranch = branchRes.stdout.trim() || null;
  } catch {
    try {
      const revRes = await execGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
      currentBranch = revRes.stdout.trim() || null;
    } catch {
      currentBranch = null;
    }
  }

  try {
    const originRes = await execGit(dir, ['remote', 'get-url', 'origin']);
    currentOrigin = sanitizeRemoteOriginDisplay(originRes.stdout.trim() || null);
  } catch {
    currentOrigin = null;
  }

  return { hasGitRepo: true, currentBranch, currentOrigin };
}

export async function getRepoSyncConfig(
  rootDir: string,
  input: RepoSyncTargetInput,
): Promise<RepoSyncConfigState> {
  const target = resolveRepoSyncTarget(rootDir, input);
  const manifest = await readAppSettings();
  const githubAccess = manifest?.settings?.githubAccess;
  const project = target.projectId ? getProjectById(target.projectId) : null;

  const repo =
    (target.targetType === 'project' ? project?.githubConfig?.repo : undefined)?.trim() ||
    githubAccess?.repoOwnerSlashName?.trim() ||
    'alexpikman/OneCoreAI';
  const branch =
    (target.targetType === 'project' ? project?.githubConfig?.branch : undefined)?.trim() ||
    githubAccess?.defaultBranch?.trim() ||
    'main';

  const rawAuthMethod =
    target.targetType === 'project' && project?.githubConfig?.authMethod
      ? project.githubConfig.authMethod
      : githubAccess?.authMethod === 'ssh'
        ? 'ssh'
        : 'pat';

  const authMethod: RepoSyncAuthMethod =
    rawAuthMethod === 'ssh' ? 'ssh' : rawAuthMethod === 'public' ? 'public' : 'pat';

  const gitUserName = githubAccess?.gitUserName?.trim() || 'OneCore Developer';
  const gitUserEmail = githubAccess?.gitUserEmail?.trim() || 'dev@onecore-ai.local';

  const [tokenInfo, gitAvailable, repoMeta] = await Promise.all([
    resolveGithubSyncToken(target.targetType, target.projectId),
    isGitAvailable(),
    inspectGitRepoMetadata(target.dir),
  ]);

  return {
    targetType: target.targetType,
    ...(target.projectId ? { projectId: target.projectId } : {}),
    targetLabel: target.label,
    targetPath: target.dir,
    repo,
    branch,
    authMethod,
    gitUserName,
    gitUserEmail,
    tokenConfigured: Boolean(tokenInfo.token),
    globalTokenConfigured: tokenInfo.globalTokenConfigured,
    gitAvailable,
    ...repoMeta,
  };
}

export async function saveRepoSyncConfig(
  rootDir: string,
  input: RepoSyncTargetInput & {
    repo: string;
    branch: string;
    authMethod: RepoSyncAuthMethod;
    gitUserName?: string;
    gitUserEmail?: string;
    token?: string;
    clearToken?: boolean;
  },
): Promise<RepoSyncConfigState> {
  const target = resolveRepoSyncTarget(rootDir, input);
  const { cleanRepo } = normalizeGitHubRepo(input.repo);
  const branch = validateGitBranch(input.branch);
  const authMethod = normalizeAuthMethod(input.authMethod);
  const gitUserName = sanitizeGitIdentityValue(input.gitUserName, 'OneCore Developer');
  const gitUserEmail = sanitizeGitIdentityValue(input.gitUserEmail, 'dev@onecore-ai.local');
  const trimmedToken = typeof input.token === 'string' ? input.token.trim() : '';

  if (input.clearToken) {
    if (target.targetType === 'project' && target.projectId) {
      await deleteSecret(`github:${target.projectId}`);
    } else {
      await clearIntegrationSecret('github', 'default');
    }
  } else if (trimmedToken) {
    if (trimmedToken.length > 8192) {
      throw new Error('Токен GitHub превышает допустимую длину.');
    }
    if (target.targetType === 'project' && target.projectId) {
      await setSecret(`github:${target.projectId}`, trimmedToken);
    } else {
      await setIntegrationSecret('github', 'default', trimmedToken);
    }
  }

  if (target.targetType === 'project' && target.projectId) {
    const projectToken = await getSecret(`github:${target.projectId}`);
    updateProjectGithubConfig(target.projectId, {
      repo: cleanRepo,
      branch,
      authMethod,
      ...(projectToken?.trim() ? { secretRef: `github:${target.projectId}` } : {}),
    });
  }

  const internal = await readInternalAppSettings();
  if (internal?.settings) {
    const nextGithubAccess =
      target.targetType === 'app'
        ? {
            ...internal.settings.githubAccess,
            repoOwnerSlashName: cleanRepo,
            defaultBranch: branch,
            authMethod: authMethod === 'ssh' ? ('ssh' as const) : ('pat' as const),
            gitUserName,
            gitUserEmail,
          }
        : {
            ...internal.settings.githubAccess,
            gitUserName,
            gitUserEmail,
          };

    await saveAppSettings({
      ...internal.settings,
      githubAccess: nextGithubAccess,
    });
  }

  return getRepoSyncConfig(rootDir, {
    targetType: target.targetType,
    projectId: target.projectId,
  });
}

function loadSimpleGitIgnoreMatcher(targetDir: string): (relPath: string, isDir: boolean) => boolean {
  const gitignorePath = path.join(targetDir, '.gitignore');
  const patterns: Array<{ raw: string; dirOnly: boolean; hasSlash: boolean; regex: RegExp }> = [];

  if (fs.existsSync(gitignorePath) && fs.statSync(gitignorePath).isFile()) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
        const dirOnly = trimmed.endsWith('/');
        const clean = trimmed.replace(/^\/+|\/+$/g, '');
        if (!clean) continue;
        const hasSlash = clean.includes('/');
        const escaped = clean
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]');
        patterns.push({
          raw: clean,
          dirOnly,
          hasSlash,
          regex: new RegExp(`^${escaped}$`),
        });
      }
    } catch {
      // ignore unreadable .gitignore
    }
  }

  return (relPath: string, isDir: boolean): boolean => {
    const normalized = relPath.split(path.sep).join('/');
    const baseName = path.posix.basename(normalized);
    if (DEFAULT_IGNORED_DIRS.has(baseName)) return true;
    if (DEFAULT_IGNORED_REL_PATHS.has(normalized)) return true;
    if (baseName === '.env' || (baseName.startsWith('.env.') && baseName !== '.env.example')) return true;
    if (baseName.endsWith('.log')) return true;

    for (const pattern of patterns) {
      if (pattern.dirOnly && !isDir) {
        if (normalized.startsWith(`${pattern.raw}/`)) return true;
        continue;
      }
      if (pattern.hasSlash) {
        if (pattern.regex.test(normalized)) return true;
      } else if (pattern.regex.test(baseName)) {
        return true;
      }
    }
    return false;
  };
}

function computeGitBlobSha1(filePath: string): string {
  const data = fs.readFileSync(filePath);
  const header = Buffer.from(`blob ${data.length}\0`, 'utf-8');
  return crypto.createHash('sha1').update(header).update(data).digest('hex');
}

function walkLocalFilesForBlobCompare(targetDir: string, maxFiles = 20000): Map<string, string> {
  const isIgnored = loadSimpleGitIgnoreMatcher(targetDir);
  const result = new Map<string, string>();
  const stack: string[] = [''];

  while (stack.length > 0 && result.size < maxFiles) {
    const relDir = stack.pop()!;
    const absDir = relDir ? path.join(targetDir, relDir) : targetDir;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const isDir = entry.isDirectory();
      if (isIgnored(relPath, isDir)) continue;

      if (isDir) {
        stack.push(relPath);
      } else if (entry.isFile()) {
        try {
          result.set(relPath, computeGitBlobSha1(path.join(targetDir, relPath)));
        } catch {
          // skip unreadable file
        }
        if (result.size >= maxFiles) break;
      }
    }
  }

  return result;
}

function parseLsTreeOutput(output: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of output.split('\0')) {
    if (!record) continue;
    const tabIdx = record.indexOf('\t');
    if (tabIdx <= 0) continue;
    const meta = record.slice(0, tabIdx).trim().split(/\s+/);
    const filePath = record.slice(tabIdx + 1);
    const type = meta[1];
    const sha = meta[2];
    if (type === 'blob' && sha && filePath) {
      map.set(filePath, sha);
    }
  }
  return map;
}

function parsePorcelainStatus(output: string): RepoSyncFileDiff[] {
  const files: RepoSyncFileDiff[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine || rawLine.length < 4) continue;
    const code = rawLine.slice(0, 2);
    let filePath = rawLine.slice(3).trim();
    if (filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ').pop() || filePath;
    }
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1);
    }

    if (code === '??') {
      files.push({ path: filePath, status: 'untracked', source: 'local', label: 'Новый локально' });
    } else if (code.includes('D')) {
      files.push({ path: filePath, status: 'deleted', source: 'local', label: 'Удалён локально' });
    } else if (code.includes('A')) {
      files.push({ path: filePath, status: 'added', source: 'local', label: 'Добавлен локально' });
    } else if (code.includes('R')) {
      files.push({ path: filePath, status: 'renamed', source: 'local', label: 'Переименован' });
    } else {
      files.push({ path: filePath, status: 'modified', source: 'local', label: 'Изменён локально' });
    }
  }
  return files;
}

function parseCommitLog(output: string): RepoSyncCommitSummary[] {
  const commits: RepoSyncCommitSummary[] = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tabIdx = trimmed.indexOf('\t');
    if (tabIdx > 0) {
      commits.push({
        hash: trimmed.slice(0, tabIdx).trim(),
        subject: trimmed.slice(tabIdx + 1).trim(),
      });
    }
  }
  return commits;
}

function parseDiffNameStatusVsRemote(output: string): RepoSyncFileDiff[] {
  const files: RepoSyncFileDiff[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split('\t');
    const statusCode = parts[0] || '';
    const filePath = parts[parts.length - 1] || '';
    if (!filePath) continue;

    if (statusCode.startsWith('D')) {
      // File exists in remote ref, missing in local working tree
      files.push({ path: filePath, status: 'remote-only', source: 'remote', label: 'Есть на GitHub' });
    } else if (statusCode.startsWith('A')) {
      // File exists in local index/HEAD, missing in remote ref
      files.push({ path: filePath, status: 'local-only', source: 'local', label: 'Только локально' });
    } else if (statusCode.startsWith('R')) {
      files.push({ path: filePath, status: 'renamed', source: 'both', label: 'Переименован' });
    } else {
      files.push({ path: filePath, status: 'modified', source: 'both', label: 'Отличается от GitHub' });
    }
  }
  return files;
}

function mergeDiffFiles(
  localDirtyFiles: RepoSyncFileDiff[],
  remoteDiffFiles: RepoSyncFileDiff[],
  untrackedFiles: string[],
): RepoSyncFileDiff[] {
  const byPath = new Map<string, RepoSyncFileDiff>();
  for (const item of remoteDiffFiles) {
    byPath.set(item.path, item);
  }
  for (const relPath of untrackedFiles) {
    if (!byPath.has(relPath)) {
      byPath.set(relPath, {
        path: relPath,
        status: 'local-only',
        source: 'local',
        label: 'Новый локально',
      });
    }
  }
  for (const item of localDirtyFiles) {
    if (!byPath.has(item.path)) {
      byPath.set(item.path, item);
    }
  }
  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function isRemoteMissingBranchError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("couldn't find remote ref") ||
    lower.includes('could not find remote ref') ||
    lower.includes('remote ref does not exist') ||
    lower.includes('does not match any')
  );
}

async function compareWorkingTreeAgainstRemoteTree(
  targetDir: string,
  lsTreeOutput: string,
): Promise<{ diffFiles: RepoSyncFileDiff[]; diffPreview: string }> {
  const remoteBlobs = parseLsTreeOutput(lsTreeOutput);
  const localBlobs = walkLocalFilesForBlobCompare(targetDir);
  const diffFiles: RepoSyncFileDiff[] = [];

  for (const [filePath, remoteSha] of remoteBlobs.entries()) {
    const localSha = localBlobs.get(filePath);
    if (!localSha) {
      diffFiles.push({
        path: filePath,
        status: 'remote-only',
        source: 'remote',
        label: 'Есть на GitHub',
      });
    } else if (localSha !== remoteSha) {
      diffFiles.push({
        path: filePath,
        status: 'modified',
        source: 'both',
        label: 'Отличается от GitHub',
      });
    }
  }

  for (const filePath of localBlobs.keys()) {
    if (!remoteBlobs.has(filePath)) {
      diffFiles.push({
        path: filePath,
        status: 'local-only',
        source: 'local',
        label: 'Новый локально',
      });
    }
  }

  diffFiles.sort((a, b) => a.path.localeCompare(b.path));
  const diffPreview = diffFiles
    .slice(0, 120)
    .map((f) => `${f.status === 'remote-only' ? '+[GitHub]' : f.status === 'local-only' ? '+[Local]' : '~[Diff]'} ${f.path}`)
    .join('\n');

  return { diffFiles, diffPreview };
}

export async function checkRepoSyncDiff(
  rootDir: string,
  input: RepoSyncTargetInput & {
    repo?: string;
    branch?: string;
    authMethod?: RepoSyncAuthMethod;
  },
  options: RepoSyncOperationOptions = {},
): Promise<RepoSyncDiffReport> {
  if (!(await isGitAvailable())) {
    throw new Error('Git не установлен в системе или недоступен в PATH.');
  }

  const target = resolveRepoSyncTarget(rootDir, input);
  const currentConfig = await getRepoSyncConfig(rootDir, {
    targetType: target.targetType,
    projectId: target.projectId,
  });

  const { cleanRepo } = normalizeGitHubRepo(input.repo ?? currentConfig.repo);
  const branch = validateGitBranch(input.branch ?? currentConfig.branch);
  const authMethod = normalizeAuthMethod(input.authMethod ?? currentConfig.authMethod);
  const tokenInfo = await resolveGithubSyncToken(target.targetType, target.projectId);
  const token = tokenInfo.token;
  const remoteUrl = options.remoteUrlForTestOnly || buildGitHubRemoteUrl(cleanRepo, authMethod);

  const hasGitRepo = fs.existsSync(path.join(target.dir, '.git'));
  const checkedAt = new Date().toISOString();

  if (!hasGitRepo) {
    const tmpGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-git-check-'));
    try {
      await execGitWithDir(tmpGitDir, ['init', '--bare']);
      let remoteBranchExists = true;
      let remoteHead: string | null = null;
      const syncRef = `refs/remotes/onecore_sync/${branch}`;

      try {
        await execGitWithDir(
          tmpGitDir,
          ['fetch', '--depth=1', '--force', remoteUrl, `+refs/heads/${branch}:${syncRef}`],
          { authMethod, token },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isRemoteMissingBranchError(msg)) {
          remoteBranchExists = false;
        } else {
          throw err;
        }
      }

      if (!remoteBranchExists) {
        const localBlobs = walkLocalFilesForBlobCompare(target.dir);
        const localOnlyFiles: RepoSyncFileDiff[] = Array.from(localBlobs.keys())
          .sort((a, b) => a.localeCompare(b))
          .map((filePath) => ({
            path: filePath,
            status: 'local-only',
            source: 'local',
            label: 'Новый локально',
          }));

        return {
          checkedAt,
          targetType: target.targetType,
          ...(target.projectId ? { projectId: target.projectId } : {}),
          targetPath: target.dir,
          repo: cleanRepo,
          branch,
          hasGitRepo: false,
          remoteBranchExists: false,
          localHead: null,
          remoteHead: null,
          aheadCommits: 0,
          behindCommits: 0,
          incomingCommits: [],
          outgoingCommits: [],
          localDirtyFiles: localOnlyFiles,
          remoteDiffFiles: [],
          allDiffFiles: localOnlyFiles,
          inSync: localOnlyFiles.length === 0,
          diffPreview: localOnlyFiles.slice(0, 80).map((f) => `+[Local] ${f.path}`).join('\n'),
          summary:
            localOnlyFiles.length > 0
              ? `Ветка ${branch} на GitHub пока пуста. Локальных файлов для выгрузки: ${localOnlyFiles.length}.`
              : `Ветка ${branch} на GitHub и локальная папка пусты.`,
        };
      }

      const revRes = await execGitWithDir(tmpGitDir, ['rev-parse', '--short', syncRef]);
      remoteHead = revRes.stdout.trim() || null;

      const lsTreeRes = await execGitWithDir(tmpGitDir, ['ls-tree', '-r', '-z', syncRef]);
      const { diffFiles, diffPreview } = await compareWorkingTreeAgainstRemoteTree(target.dir, lsTreeRes.stdout);

      const remoteCount = diffFiles.filter((f) => f.status === 'remote-only').length;
      const modifiedCount = diffFiles.filter((f) => f.status === 'modified').length;
      const localOnlyCount = diffFiles.filter((f) => f.status === 'local-only').length;
      const inSync = diffFiles.length === 0;

      return {
        checkedAt,
        targetType: target.targetType,
        ...(target.projectId ? { projectId: target.projectId } : {}),
        targetPath: target.dir,
        repo: cleanRepo,
        branch,
        hasGitRepo: false,
        remoteBranchExists: true,
        localHead: null,
        remoteHead,
        aheadCommits: 0,
        behindCommits: remoteCount > 0 || modifiedCount > 0 ? 1 : 0,
        incomingCommits: remoteHead
          ? [{ hash: remoteHead, subject: `Состояние ветки ${branch} на GitHub` }]
          : [],
        outgoingCommits: [],
        localDirtyFiles: diffFiles.filter((f) => f.source !== 'remote'),
        remoteDiffFiles: diffFiles.filter((f) => f.source !== 'local'),
        allDiffFiles: diffFiles,
        inSync,
        diffPreview,
        summary: inSync
          ? `Локальные файлы полностью совпадают с ${cleanRepo} (${branch}).`
          : `Обнаружены различия с ${cleanRepo} (${branch}): на GitHub новее/отсутствуют локально — ${remoteCount}, отличаются — ${modifiedCount}, только локально — ${localOnlyCount}.`,
      };
    } finally {
      fs.rmSync(tmpGitDir, { recursive: true, force: true });
    }
  }

  // Existing Git repository flow
  const syncRef = `refs/remotes/onecore_sync/${branch}`;
  let remoteBranchExists = true;
  try {
    await execGit(
      target.dir,
      ['fetch', '--force', remoteUrl, `+refs/heads/${branch}:${syncRef}`],
      { authMethod, token },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isRemoteMissingBranchError(msg)) {
      remoteBranchExists = false;
    } else {
      throw err;
    }
  }

  let localHead: string | null = null;
  try {
    const headRes = await execGit(target.dir, ['rev-parse', '--short', 'HEAD']);
    localHead = headRes.stdout.trim() || null;
  } catch {
    localHead = null;
  }

  let remoteHead: string | null = null;
  if (remoteBranchExists) {
    try {
      const remRes = await execGit(target.dir, ['rev-parse', '--short', syncRef]);
      remoteHead = remRes.stdout.trim() || null;
    } catch {
      remoteHead = null;
    }
  }

  const statusRes = await execGit(target.dir, ['status', '--porcelain=v1', '-uall']);
  const localDirtyFiles = parsePorcelainStatus(statusRes.stdout);

  const untrackedRes = await execGit(target.dir, ['ls-files', '--others', '--exclude-standard']);
  const untrackedFiles = untrackedRes.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!remoteBranchExists) {
    const allDiffFiles = mergeDiffFiles(localDirtyFiles, [], untrackedFiles);
    return {
      checkedAt,
      targetType: target.targetType,
      ...(target.projectId ? { projectId: target.projectId } : {}),
      targetPath: target.dir,
      repo: cleanRepo,
      branch,
      hasGitRepo: true,
      remoteBranchExists: false,
      localHead,
      remoteHead: null,
      aheadCommits: localHead ? 1 : 0,
      behindCommits: 0,
      incomingCommits: [],
      outgoingCommits: [],
      localDirtyFiles,
      remoteDiffFiles: [],
      allDiffFiles,
      inSync: !localHead && allDiffFiles.length === 0,
      diffPreview: '',
      summary: `Ветка ${branch} в ${cleanRepo} ещё не создана. Локальных изменений/файлов: ${allDiffFiles.length}.`,
    };
  }

  if (!localHead) {
    const lsTreeRes = await execGit(target.dir, ['ls-tree', '-r', '-z', syncRef]);
    const { diffFiles, diffPreview } = await compareWorkingTreeAgainstRemoteTree(target.dir, lsTreeRes.stdout);
    return {
      checkedAt,
      targetType: target.targetType,
      ...(target.projectId ? { projectId: target.projectId } : {}),
      targetPath: target.dir,
      repo: cleanRepo,
      branch,
      hasGitRepo: true,
      remoteBranchExists: true,
      localHead: null,
      remoteHead,
      aheadCommits: 0,
      behindCommits: diffFiles.length > 0 ? 1 : 0,
      incomingCommits: remoteHead ? [{ hash: remoteHead, subject: `Ветка ${branch} на GitHub` }] : [],
      outgoingCommits: [],
      localDirtyFiles,
      remoteDiffFiles: diffFiles.filter((f) => f.source !== 'local'),
      allDiffFiles: diffFiles,
      inSync: diffFiles.length === 0,
      diffPreview,
      summary:
        diffFiles.length === 0
          ? `Файлы соответствуют ${cleanRepo} (${branch}).`
          : `Git инициализирован без коммитов. Отличий от GitHub: ${diffFiles.length}.`,
    };
  }

  const countRes = await execGit(target.dir, ['rev-list', '--left-right', '--count', `HEAD...${syncRef}`]);
  const [aheadRaw, behindRaw] = countRes.stdout.trim().split(/\s+/);
  const aheadCommits = Number(aheadRaw) || 0;
  const behindCommits = Number(behindRaw) || 0;

  const [inLogRes, outLogRes, diffNameRes, diffStatRes, diffPatchRes] = await Promise.all([
    behindCommits > 0
      ? execGit(target.dir, ['log', '--format=%h\t%s', '-n', '15', `HEAD..${syncRef}`])
      : Promise.resolve({ stdout: '', stderr: '' }),
    aheadCommits > 0
      ? execGit(target.dir, ['log', '--format=%h\t%s', '-n', '15', `${syncRef}..HEAD`])
      : Promise.resolve({ stdout: '', stderr: '' }),
    execGit(target.dir, ['diff', '--name-status', syncRef]),
    execGit(target.dir, ['diff', '--stat', syncRef]),
    execGit(target.dir, ['diff', syncRef]),
  ]);

  const incomingCommits = parseCommitLog(inLogRes.stdout);
  const outgoingCommits = parseCommitLog(outLogRes.stdout);
  const remoteDiffFiles = parseDiffNameStatusVsRemote(diffNameRes.stdout);
  const allDiffFiles = mergeDiffFiles(localDirtyFiles, remoteDiffFiles, untrackedFiles);
  const inSync = aheadCommits === 0 && behindCommits === 0 && allDiffFiles.length === 0;

  const patchLines = diffPatchRes.stdout.split(/\r?\n/).slice(0, 220).join('\n');
  const diffPreview = [diffStatRes.stdout.trim(), patchLines.trim()].filter(Boolean).join('\n\n').slice(0, 14000);

  let summary = `Локальная копия и ${cleanRepo} (${branch}) полностью синхронизированы.`;
  if (!inSync) {
    const parts: string[] = [];
    if (behindCommits > 0) parts.push(`доступно новых коммитов с GitHub: ${behindCommits}`);
    if (aheadCommits > 0) parts.push(`локальных коммитов для отправки: ${aheadCommits}`);
    if (localDirtyFiles.length > 0) parts.push(`незафиксированных файлов: ${localDirtyFiles.length}`);
    if (parts.length === 0 && allDiffFiles.length > 0) parts.push(`отличающихся файлов: ${allDiffFiles.length}`);
    summary = parts.join(' · ');
  }

  recordAgentEvent({
    category: 'git',
    level: 'info',
    status: 'completed',
    title: 'Проверка синхронизации с GitHub',
    summary: `${cleanRepo} (${branch}): ${summary}`,
    source: 'server',
    ...(target.projectId ? { projectId: target.projectId } : {}),
  });

  return {
    checkedAt,
    targetType: target.targetType,
    ...(target.projectId ? { projectId: target.projectId } : {}),
    targetPath: target.dir,
    repo: cleanRepo,
    branch,
    hasGitRepo: true,
    remoteBranchExists: true,
    localHead,
    remoteHead,
    aheadCommits,
    behindCommits,
    incomingCommits,
    outgoingCommits,
    localDirtyFiles,
    remoteDiffFiles,
    allDiffFiles,
    inSync,
    diffPreview,
    summary,
  };
}

async function ensureOriginRemote(dir: string, cleanRemoteUrl: string): Promise<void> {
  try {
    await execGit(dir, ['remote', 'get-url', 'origin']);
    await execGit(dir, ['remote', 'set-url', 'origin', cleanRemoteUrl]);
  } catch {
    await execGit(dir, ['remote', 'add', 'origin', cleanRemoteUrl]);
  }
}

export async function pullFromGitHub(
  rootDir: string,
  input: RepoSyncTargetInput & {
    repo?: string;
    branch?: string;
    authMethod?: RepoSyncAuthMethod;
    strategy?: RepoPullStrategy;
    gitUserName?: string;
    gitUserEmail?: string;
  },
  options: RepoSyncOperationOptions = {},
): Promise<RepoSyncMutationResult> {
  if (!(await isGitAvailable())) {
    throw new Error('Git не установлен в системе или недоступен в PATH.');
  }

  const target = resolveRepoSyncTarget(rootDir, input);
  const currentConfig = await getRepoSyncConfig(rootDir, {
    targetType: target.targetType,
    projectId: target.projectId,
  });

  const { cleanRepo } = normalizeGitHubRepo(input.repo ?? currentConfig.repo);
  const branch = validateGitBranch(input.branch ?? currentConfig.branch);
  const authMethod = normalizeAuthMethod(input.authMethod ?? currentConfig.authMethod);
  const strategy: RepoPullStrategy =
    input.strategy === 'rebase-stash' || input.strategy === 'overwrite-from-remote'
      ? input.strategy
      : 'ff-only';
  const gitUserName = sanitizeGitIdentityValue(input.gitUserName, currentConfig.gitUserName);
  const gitUserEmail = sanitizeGitIdentityValue(input.gitUserEmail, currentConfig.gitUserEmail);
  const tokenInfo = await resolveGithubSyncToken(target.targetType, target.projectId);
  const token = tokenInfo.token;
  const remoteUrl = options.remoteUrlForTestOnly || buildGitHubRemoteUrl(cleanRepo, authMethod);

  let initializedGitRepo = false;
  const hasGitRepo = fs.existsSync(path.join(target.dir, '.git'));

  if (!hasGitRepo) {
    const preDiff = await checkRepoSyncDiff(
      rootDir,
      { targetType: target.targetType, projectId: target.projectId, repo: cleanRepo, branch, authMethod },
      options,
    );
    if (!preDiff.remoteBranchExists) {
      return {
        ok: false,
        action: 'pull',
        message: `Ветка ${branch} ещё не существует в ${cleanRepo}. Нечего загружать с GitHub.`,
        diff: preDiff,
      };
    }

    const hasConflictingLocalFiles = preDiff.allDiffFiles.some(
      (file) => file.status === 'modified' || file.status === 'local-only',
    );

    if (hasConflictingLocalFiles && strategy === 'ff-only') {
      return {
        ok: false,
        action: 'pull',
        needsStrategyChoice: true,
        message:
          'Папка не инициализирована как Git-репозиторий и содержит локальные файлы, отличающиеся от GitHub. Выберите режим: «Сохранить локальные правки и обновить» или «Перезаписать локальные файлы из GitHub».',
        diff: preDiff,
      };
    }

    await execGit(target.dir, ['init', '-b', branch]);
    initializedGitRepo = true;
    await execGit(target.dir, ['config', 'user.name', gitUserName]);
    await execGit(target.dir, ['config', 'user.email', gitUserEmail]);
    await ensureOriginRemote(target.dir, remoteUrl);
    await execGit(target.dir, ['fetch', remoteUrl, `+refs/heads/${branch}:refs/remotes/origin/${branch}`], {
      authMethod,
      token,
    });

    if (strategy === 'rebase-stash' && hasConflictingLocalFiles) {
      await execGit(target.dir, ['add', '-A']);
      await execGit(target.dir, ['commit', '-m', 'Локальный снимок перед синхронизацией с GitHub']);
      try {
        await execGit(target.dir, ['rebase', `refs/remotes/origin/${branch}`]);
      } catch (err) {
        try {
          await execGit(target.dir, ['rebase', '--abort']);
        } catch {
          // ignore
        }
        throw new Error(
          `Возник конфликт при объединении локальных правок с GitHub (${cleanRepo}/${branch}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      await execGit(target.dir, ['checkout', '-B', branch, `refs/remotes/origin/${branch}`]);
    }

    const afterDiff = await checkRepoSyncDiff(
      rootDir,
      { targetType: target.targetType, projectId: target.projectId, repo: cleanRepo, branch, authMethod },
      options,
    );

    return {
      ok: true,
      action: 'pull',
      initializedGitRepo,
      message: `Файлы успешно обновлены из ${cleanRepo} (${branch}).`,
      diff: afterDiff,
    };
  }

  // Existing Git repository
  await ensureOriginRemote(target.dir, remoteUrl);
  try {
    await execGit(target.dir, ['fetch', remoteUrl, `+refs/heads/${branch}:refs/remotes/origin/${branch}`], {
      authMethod,
      token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isRemoteMissingBranchError(msg)) {
      return {
        ok: false,
        action: 'pull',
        message: `Ветка ${branch} не найдена в репозитории ${cleanRepo}.`,
      };
    }
    throw err;
  }

  const statusRes = await execGit(target.dir, ['status', '--porcelain=v1']);
  const isDirty = Boolean(statusRes.stdout.trim());

  let hasHead = true;
  try {
    await execGit(target.dir, ['rev-parse', '--verify', 'HEAD']);
  } catch {
    hasHead = false;
  }

  if (!hasHead) {
    if (isDirty && strategy === 'ff-only') {
      return {
        ok: false,
        action: 'pull',
        needsStrategyChoice: true,
        message: 'Есть локальные неотслеживаемые файлы. Выберите режим сохранения правок или перезаписи.',
      };
    }
    if (strategy === 'rebase-stash' && isDirty) {
      await execGit(target.dir, ['config', 'user.name', gitUserName]);
      await execGit(target.dir, ['config', 'user.email', gitUserEmail]);
      await execGit(target.dir, ['add', '-A']);
      await execGit(target.dir, ['commit', '-m', 'Локальный снимок перед синхронизацией с GitHub']);
      await execGit(target.dir, ['rebase', `refs/remotes/origin/${branch}`]);
    } else {
      await execGit(target.dir, ['checkout', '-B', branch, `refs/remotes/origin/${branch}`]);
    }
  } else if (strategy === 'overwrite-from-remote') {
    await execGit(target.dir, ['checkout', '-B', branch]);
    await execGit(target.dir, ['reset', '--hard', `refs/remotes/origin/${branch}`]);
  } else if (strategy === 'rebase-stash') {
    await execGit(target.dir, ['config', 'user.name', gitUserName]);
    await execGit(target.dir, ['config', 'user.email', gitUserEmail]);
    await execGit(target.dir, ['checkout', '-B', branch]);

    let stashed = false;
    if (isDirty) {
      await execGit(target.dir, ['stash', 'push', '-u', '-m', 'onecore-sync-autostash']);
      stashed = true;
    }

    try {
      await execGit(target.dir, ['rebase', `refs/remotes/origin/${branch}`]);
    } catch (err) {
      try {
        await execGit(target.dir, ['rebase', '--abort']);
      } catch {
        // ignore
      }
      if (stashed) {
        try {
          await execGit(target.dir, ['stash', 'pop']);
        } catch {
          // leave in stash if conflict
        }
      }
      throw new Error(
        `Не удалось выполнить rebase на ${cleanRepo}/${branch}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (stashed) {
      try {
        await execGit(target.dir, ['stash', 'pop']);
      } catch (err) {
        throw new Error(
          `Ветка обновлена, но при возврате локальных правок возник конфликт: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } else {
    // ff-only
    if (isDirty) {
      return {
        ok: false,
        action: 'pull',
        needsStrategyChoice: true,
        message:
          'В локальной копии есть незафиксированные изменения. Выберите режим «Сохранить правки и обновить» или «Перезаписать из GitHub».',
      };
    }
    await execGit(target.dir, ['checkout', '-B', branch]);
    try {
      await execGit(target.dir, ['merge', '--ff-only', `refs/remotes/origin/${branch}`]);
    } catch {
      return {
        ok: false,
        action: 'pull',
        needsStrategyChoice: true,
        message:
          'Локальная ветка разошлась с GitHub (fast-forward невозможен). Выберите «Сохранить правки и обновить (rebase)» или «Перезаписать из GitHub».',
      };
    }
  }

  const afterDiff = await checkRepoSyncDiff(
    rootDir,
    { targetType: target.targetType, projectId: target.projectId, repo: cleanRepo, branch, authMethod },
    options,
  );

  recordAgentEvent({
    category: 'git',
    level: 'info',
    status: 'completed',
    title: 'Обновление файлов с GitHub',
    summary: `Выполнено обновление ${target.label} из ${cleanRepo} (${branch})`,
    source: 'server',
    ...(target.projectId ? { projectId: target.projectId } : {}),
  });

  return {
    ok: true,
    action: 'pull',
    initializedGitRepo,
    message: `Обновление с GitHub (${cleanRepo}, ветка ${branch}) успешно завершено.`,
    diff: afterDiff,
  };
}

export async function pushToGitHub(
  rootDir: string,
  input: RepoSyncTargetInput & {
    repo?: string;
    branch?: string;
    authMethod?: RepoSyncAuthMethod;
    gitUserName?: string;
    gitUserEmail?: string;
    commitMessage?: string;
    forcePush?: boolean;
  },
  options: RepoSyncOperationOptions = {},
): Promise<RepoSyncMutationResult> {
  if (!(await isGitAvailable())) {
    throw new Error('Git не установлен в системе или недоступен в PATH.');
  }

  const target = resolveRepoSyncTarget(rootDir, input);
  const currentConfig = await getRepoSyncConfig(rootDir, {
    targetType: target.targetType,
    projectId: target.projectId,
  });

  const { cleanRepo } = normalizeGitHubRepo(input.repo ?? currentConfig.repo);
  const branch = validateGitBranch(input.branch ?? currentConfig.branch);
  const authMethod = normalizeAuthMethod(input.authMethod ?? currentConfig.authMethod);

  if (authMethod === 'public') {
    return {
      ok: false,
      action: 'push',
      message: 'Выгрузка изменений на GitHub невозможна в публичном режиме без авторизации. Выберите PAT (HTTPS) или SSH.',
    };
  }

  const tokenInfo = await resolveGithubSyncToken(target.targetType, target.projectId);
  const token = tokenInfo.token;
  if (authMethod === 'pat' && !token && !options.remoteUrlForTestOnly) {
    return {
      ok: false,
      action: 'push',
      message: 'Укажите и сохраните GitHub Personal Access Token (PAT) с правами repo для выгрузки изменений.',
    };
  }

  const gitUserName = sanitizeGitIdentityValue(input.gitUserName, currentConfig.gitUserName);
  const gitUserEmail = sanitizeGitIdentityValue(input.gitUserEmail, currentConfig.gitUserEmail);
  const commitMessage = sanitizeCommitMessage(input.commitMessage);
  const remoteUrl = options.remoteUrlForTestOnly || buildGitHubRemoteUrl(cleanRepo, authMethod);

  let initializedGitRepo = false;
  if (!fs.existsSync(path.join(target.dir, '.git'))) {
    await execGit(target.dir, ['init', '-b', branch]);
    initializedGitRepo = true;
  }

  await ensureOriginRemote(target.dir, remoteUrl);
  await execGit(target.dir, ['config', 'user.name', gitUserName]);
  await execGit(target.dir, ['config', 'user.email', gitUserEmail]);

  let hasHead = true;
  try {
    await execGit(target.dir, ['rev-parse', '--verify', 'HEAD']);
  } catch {
    hasHead = false;
  }

  if (hasHead) {
    try {
      const curBranchRes = await execGit(target.dir, ['symbolic-ref', '--short', 'HEAD']);
      if (curBranchRes.stdout.trim() !== branch) {
        await execGit(target.dir, ['checkout', '-B', branch]);
      }
    } catch {
      await execGit(target.dir, ['checkout', '-B', branch]);
    }
  } else {
    await execGit(target.dir, ['checkout', '-B', branch]);
  }

  await execGit(target.dir, ['add', '-A']);

  let hasStagedChanges = false;
  if (!hasHead) {
    const stagedRes = await execGit(target.dir, ['diff', '--cached', '--name-only']);
    hasStagedChanges = Boolean(stagedRes.stdout.trim());
  } else {
    try {
      await execGit(target.dir, ['diff', '--cached', '--quiet']);
      hasStagedChanges = false;
    } catch {
      hasStagedChanges = true;
    }
  }

  let commitHash: string | undefined;
  if (hasStagedChanges) {
    await execGit(target.dir, ['commit', '-m', commitMessage]);
    const hashRes = await execGit(target.dir, ['rev-parse', '--short', 'HEAD']);
    commitHash = hashRes.stdout.trim() || undefined;
    hasHead = true;
  } else if (hasHead) {
    const hashRes = await execGit(target.dir, ['rev-parse', '--short', 'HEAD']);
    commitHash = hashRes.stdout.trim() || undefined;
  } else {
    return {
      ok: false,
      action: 'push',
      message: 'В локальной папке нет файлов или изменений для отправки на GitHub.',
    };
  }

  // Verify remote branch divergence unless forcePush is explicitly confirmed
  const syncRef = `refs/remotes/onecore_sync/${branch}`;
  let remoteBranchExists = true;
  try {
    await execGit(target.dir, ['fetch', '--force', remoteUrl, `+refs/heads/${branch}:${syncRef}`], {
      authMethod,
      token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isRemoteMissingBranchError(msg)) {
      remoteBranchExists = false;
    } else {
      throw err;
    }
  }

  let expectedRemoteSha = '';
  if (remoteBranchExists) {
    try {
      const shaRes = await execGit(target.dir, ['rev-parse', syncRef]);
      expectedRemoteSha = shaRes.stdout.trim();
    } catch {
      expectedRemoteSha = '';
    }
  }

  if (remoteBranchExists && !input.forcePush) {
    const behindRes = await execGit(target.dir, ['rev-list', '--count', `HEAD..${syncRef}`]);
    const behindCommits = Number(behindRes.stdout.trim()) || 0;
    if (behindCommits > 0) {
      return {
        ok: false,
        action: 'push',
        remoteAhead: true,
        behindCommits,
        commitHash,
        message: `На GitHub в ветке ${branch} есть ${behindCommits} новых коммит(а/ов), которых нет локально. Сначала выполните «Обновиться с GitHub», чтобы не потерять изменения на сервере.`,
      };
    }
  }

  const pushArgs = ['push'];
  if (input.forcePush) {
    pushArgs.push(
      expectedRemoteSha
        ? `--force-with-lease=refs/heads/${branch}:${expectedRemoteSha}`
        : `--force-with-lease=refs/heads/${branch}:`,
    );
  }
  pushArgs.push('-u', remoteUrl, `HEAD:refs/heads/${branch}`);

  await execGit(target.dir, pushArgs, {
    authMethod,
    token,
    timeoutMs: 60000,
  });

  // Refresh tracking ref after successful push
  try {
    await execGit(target.dir, ['fetch', '--force', remoteUrl, `+refs/heads/${branch}:refs/remotes/origin/${branch}`], {
      authMethod,
      token,
    });
  } catch {
    // ignore post-push ref update issue
  }

  const afterDiff = await checkRepoSyncDiff(
    rootDir,
    { targetType: target.targetType, projectId: target.projectId, repo: cleanRepo, branch, authMethod },
    options,
  );

  recordAgentEvent({
    category: 'git',
    level: 'info',
    status: 'completed',
    title: 'Выгрузка обновлений на GitHub',
    summary: `Изменения отправлены в ${cleanRepo} (${branch})${commitHash ? ` · коммит ${commitHash}` : ''}`,
    source: 'server',
    ...(target.projectId ? { projectId: target.projectId } : {}),
  });

  return {
    ok: true,
    action: 'push',
    commitHash,
    initializedGitRepo,
    message: `Обновления успешно выгружены на GitHub (${cleanRepo}, ветка ${branch})${commitHash ? ` · ${commitHash}` : ''}.`,
    diff: afterDiff,
  };
}

import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ensureOneCoreDirs, getProjectsManifestPath } from './paths';
import { deleteSecret, getSecret, setSecret } from './vault';
import type { ProjectPlan, ProjectTask, ProjectTaskStatus, ProjectWorkspaceData } from '../src/types/onecore';

const execFileAsync = promisify(execFile);

export type ProjectFolderSource = 'local' | 'ssh' | 'github';

export interface ProjectSshConfig {
  host: string;
  port: number;
  user: string;
  remotePath: string;
  authType: 'key' | 'agent' | 'password';
  keyPath?: string;
  secretRef?: string;
}

export interface ProjectGithubConfig {
  repo: string;
  branch: string;
  authMethod: 'public' | 'pat' | 'ssh';
  secretRef?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  folderSource: ProjectFolderSource;
  folderPath: string;
  allowedTools: string[];
  defaultModelId: string;
  sshConfig?: ProjectSshConfig;
  githubConfig?: ProjectGithubConfig;
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrUpdateProjectInput {
  id?: string;
  name: string;
  description?: string;
  folderSource: ProjectFolderSource;
  folderPath?: string;
  allowedTools?: string[];
  defaultModelId?: string;
  sshConfig?: {
    host: string;
    port?: number;
    user: string;
    remotePath: string;
    authType: 'key' | 'agent' | 'password';
    keyPath?: string;
    password?: string;
  };
  githubConfig?: {
    repo: string;
    branch?: string;
    authMethod?: 'public' | 'pat' | 'ssh';
    token?: string;
    localClonePath?: string;
  };
}

interface ProjectsManifest {
  activeProjectId: string;
  projects: ProjectRecord[];
  workspaceData: Record<string, ProjectWorkspaceData>;
}

const DEFAULT_TOOLS = ['read_file', 'write_file', 'run_command', 'git', 'search_code'];

function readProjectsManifest(): ProjectsManifest {
  const manifestPath = getProjectsManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return { activeProjectId: '', projects: [], workspaceData: {} };
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProjectsManifest>;
    return {
      activeProjectId: typeof parsed.activeProjectId === 'string' ? parsed.activeProjectId : '',
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      workspaceData:
        parsed.workspaceData && typeof parsed.workspaceData === 'object'
          ? parsed.workspaceData
          : {},
    };
  } catch {
    return { activeProjectId: '', projects: [], workspaceData: {} };
  }
}

function writeProjectsManifest(manifest: ProjectsManifest): void {
  const manifestPath = getProjectsManifestPath();
  const tmpPath = `${manifestPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf-8');
  fs.renameSync(tmpPath, manifestPath);
}

export function listProjects(): { activeProjectId: string; projects: ProjectRecord[] } {
  ensureOneCoreDirs();
  return readProjectsManifest();
}

export function getProjectById(id: string): ProjectRecord | null {
  return readProjectsManifest().projects.find((p) => p.id === id) ?? null;
}

function requireProject(manifest: ProjectsManifest, projectId: string): void {
  if (!manifest.projects.some((project) => project.id === projectId)) {
    throw new Error(`Проект с ID ${projectId} не найден`);
  }
}

function getWorkspaceData(manifest: ProjectsManifest, projectId: string): ProjectWorkspaceData {
  const workspace = manifest.workspaceData[projectId];
  return {
    tasks: Array.isArray(workspace?.tasks) ? workspace.tasks : [],
    plan: workspace?.plan ?? null,
  };
}

export function getProjectWorkspaceData(projectId: string): ProjectWorkspaceData {
  const manifest = readProjectsManifest();
  requireProject(manifest, projectId);
  return getWorkspaceData(manifest, projectId);
}

export function saveProjectTask(
  projectId: string,
  input: Pick<ProjectTask, 'title' | 'description' | 'status'> & { id?: string },
): ProjectTask {
  const manifest = readProjectsManifest();
  requireProject(manifest, projectId);
  const title = input.title?.trim();
  if (!title) throw new Error('Укажите название задачи');
  const statuses: ProjectTaskStatus[] = ['todo', 'in-progress', 'done'];
  if (!statuses.includes(input.status)) throw new Error('Некорректный статус задачи');

  const workspace = getWorkspaceData(manifest, projectId);
  const existing = input.id ? workspace.tasks.find((task) => task.id === input.id) : undefined;
  if (input.id && !existing) throw new Error('Задача проекта не найдена');
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (title.length > 160) throw new Error('Название задачи должно быть не длиннее 160 символов');
  if (description.length > 10000) throw new Error('Описание задачи должно быть не длиннее 10000 символов');
  const now = new Date().toISOString();
  const task: ProjectTask = {
    id: existing?.id ?? `task-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    title,
    description,
    status: input.status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  workspace.tasks = existing
    ? workspace.tasks.map((item) => (item.id === task.id ? task : item))
    : [task, ...workspace.tasks];
  manifest.workspaceData[projectId] = workspace;
  writeProjectsManifest(manifest);
  return task;
}

export function deleteProjectTask(projectId: string, taskId: string): ProjectWorkspaceData {
  const manifest = readProjectsManifest();
  requireProject(manifest, projectId);
  const workspace = getWorkspaceData(manifest, projectId);
  const tasks = workspace.tasks.filter((task) => task.id !== taskId);
  if (tasks.length === workspace.tasks.length) throw new Error('Задача проекта не найдена');
  workspace.tasks = tasks;
  manifest.workspaceData[projectId] = workspace;
  writeProjectsManifest(manifest);
  return workspace;
}

export function saveProjectPlan(
  projectId: string,
  input: Pick<ProjectPlan, 'content' | 'progress'> | null,
): ProjectWorkspaceData {
  const manifest = readProjectsManifest();
  requireProject(manifest, projectId);
  const workspace = getWorkspaceData(manifest, projectId);
  if (input === null) {
    workspace.plan = null;
  } else {
    const content = input.content?.trim();
    if (!content) throw new Error('Добавьте описание плана проекта');
    if (content.length > 30000) throw new Error('План должен быть не длиннее 30000 символов');
    if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) {
      throw new Error('Прогресс должен быть целым числом от 0 до 100');
    }
    workspace.plan = {
      content,
      progress: input.progress,
      updatedAt: new Date().toISOString(),
    };
  }
  manifest.workspaceData[projectId] = workspace;
  writeProjectsManifest(manifest);
  return workspace;
}

export function setActiveProjectId(id: string): { activeProjectId: string } {
  const manifest = readProjectsManifest();
  if (id && !manifest.projects.some((p) => p.id === id)) {
    throw new Error(`Проект с ID ${id} не найден`);
  }
  manifest.activeProjectId = id;
  writeProjectsManifest(manifest);
  return { activeProjectId: id };
}

export function validateLocalFolder(folderPath: string): { resolvedPath: string } {
  const raw = folderPath?.trim();
  if (!raw) {
    throw new Error('Не выбрана папка проекта: укажите локальный путь.');
  }
  const resolved = path.resolve(raw);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Папка проекта не существует: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Указанный путь не является директорией: ${resolved}`);
  }
  try {
    fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    throw new Error(`Нет прав чтения/записи (R/W) для папки: ${resolved}`);
  }
  return { resolvedPath: resolved };
}

export async function verifySshConnectionAndPath(input: {
  host: string;
  port?: number;
  user: string;
  remotePath: string;
  authType: 'key' | 'agent' | 'password';
  keyPath?: string;
}): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  const host = input.host?.trim();
  const user = input.user?.trim();
  const remotePath = input.remotePath?.trim();
  const port = Number(input.port) || 22;

  if (!host || !user || !remotePath) {
    return { ok: false, error: 'Укажите host, user и путь к удалённой папке на сервере' };
  }
  if (port < 1 || port > 65535) {
    return { ok: false, error: `Некорректный SSH-порт: ${port}` };
  }

  // Check if ssh client binary exists
  try {
    await execFileAsync('which', ['ssh']);
  } catch {
    return {
      ok: false,
      error:
        'В текущей среде не установлен клиент OpenSSH (бинарник ssh отсутствует). Реальное SSH-подключение невозможно.',
    };
  }

  const escapedPath = remotePath.replace(/'/g, `'\\''`);
  const args: string[] = [
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=6',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-p',
    String(port),
  ];

  if (input.authType === 'key' && input.keyPath?.trim()) {
    args.push('-i', input.keyPath.trim());
  }

  args.push(`${user}@${host}`, `test -d '${escapedPath}' && test -w '${escapedPath}' && echo OK`);

  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync('ssh', args, { timeout: 8500 });
    if (stdout.includes('OK')) {
      return { ok: true, latencyMs: Date.now() - start };
    }
    return {
      ok: false,
      error: stderr.trim() || 'Удалённый каталог недоступен для чтения/записи',
    };
  } catch (err) {
    const errObj = err as { stderr?: string; message?: string; code?: number };
    return {
      ok: false,
      error:
        errObj.stderr?.trim() ||
        errObj.message ||
        `SSH-подключение к ${user}@${host}:${port} отклонено`,
    };
  }
}

export async function verifyAndCloneGithubRepo(input: {
  repo: string;
  branch?: string;
  authMethod?: 'public' | 'pat' | 'ssh';
  token?: string;
  localClonePath?: string;
}): Promise<{
  fullName: string;
  defaultBranch: string;
  clonedPath: string;
  isPrivate: boolean;
}> {
  const cleanRepo = input.repo
    .trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '');

  if (!cleanRepo || !cleanRepo.includes('/')) {
    throw new Error('Укажите GitHub-репозиторий в формате owner/repo');
  }

  const [owner, repoName] = cleanRepo.split('/');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ONECOREAI/1.0',
  };
  if (input.token?.trim()) {
    headers.Authorization = `Bearer ${input.token.trim()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let repoInfo: { full_name?: string; private?: boolean; default_branch?: string };

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
      { headers, signal: controller.signal },
    );
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(
        resp.status === 404 || resp.status === 401 || resp.status === 403
          ? `Репозиторий ${cleanRepo} недоступен (HTTP ${resp.status}). Проверьте имя или права токена.`
          : `GitHub API вернул HTTP ${resp.status}`,
      );
    }
    repoInfo = (await resp.json()) as typeof repoInfo;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.message.startsWith('Репозиторий')) throw err;
    throw new Error(
      `Не удалось проверить репозиторий ${cleanRepo}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const { reposDir } = ensureOneCoreDirs();
  const slug = cleanRepo.replace(/[^a-zA-Z0-9._-]+/g, '__');
  const destDir = input.localClonePath?.trim()
    ? path.resolve(input.localClonePath.trim())
    : path.join(reposDir, slug);

  const branch = input.branch?.trim() || repoInfo.default_branch || 'main';
  const cloneUrl =
    input.authMethod === 'ssh'
      ? `git@github.com:${cleanRepo}.git`
      : input.token?.trim()
        ? `https://x-access-token:${encodeURIComponent(input.token.trim())}@github.com/${cleanRepo}.git`
        : `https://github.com/${cleanRepo}.git`;

  if (fs.existsSync(path.join(destDir, '.git'))) {
    await execFileAsync('git', ['-C', destDir, 'fetch', '--all', '--prune'], { timeout: 25000 });
  } else {
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    await execFileAsync('git', ['clone', '--branch', branch, cloneUrl, destDir], { timeout: 60000 });
  }

  return {
    fullName: repoInfo.full_name || cleanRepo,
    defaultBranch: branch,
    clonedPath: destDir,
    isPrivate: Boolean(repoInfo.private),
  };
}

export async function createOrUpdateProject(input: CreateOrUpdateProjectInput): Promise<ProjectRecord> {
  const name = input.name?.trim();
  if (!name) {
    throw new Error('Укажите название проекта');
  }

  const id = input.id?.trim() || `proj-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  let resolvedFolderPath = '';
  let sshConfig: ProjectSshConfig | undefined;
  let githubConfig: ProjectGithubConfig | undefined;

  if (input.folderSource === 'local') {
    const { resolvedPath } = validateLocalFolder(input.folderPath || '');
    resolvedFolderPath = resolvedPath;
  } else if (input.folderSource === 'ssh') {
    if (!input.sshConfig) {
      throw new Error('Заполните параметры SSH-подключения (host, user, remotePath)');
    }
    const sshCheck = await verifySshConnectionAndPath({
      host: input.sshConfig.host,
      port: input.sshConfig.port,
      user: input.sshConfig.user,
      remotePath: input.sshConfig.remotePath,
      authType: input.sshConfig.authType,
      keyPath: input.sshConfig.keyPath,
    });
    if (!sshCheck.ok) {
      throw new Error(sshCheck.error || 'SSH-проверка не пройдена');
    }
    let secretRef: string | undefined;
    if (input.sshConfig.password?.trim()) {
      secretRef = `ssh:${id}`;
      await setSecret(secretRef, input.sshConfig.password.trim());
    }
    resolvedFolderPath = input.sshConfig.remotePath.trim();
    sshConfig = {
      host: input.sshConfig.host.trim(),
      port: Number(input.sshConfig.port) || 22,
      user: input.sshConfig.user.trim(),
      remotePath: resolvedFolderPath,
      authType: input.sshConfig.authType,
      keyPath: input.sshConfig.keyPath?.trim(),
      secretRef,
    };
  } else if (input.folderSource === 'github') {
    if (!input.githubConfig?.repo?.trim()) {
      throw new Error('Укажите GitHub-репозиторий (owner/repo)');
    }
    let tokenToUse = input.githubConfig.token?.trim();
    const secretRef = `github:${id}`;
    if (!tokenToUse && input.id) {
      tokenToUse = (await getSecret(secretRef)) ?? undefined;
    }

    const ghResult = await verifyAndCloneGithubRepo({
      repo: input.githubConfig.repo,
      branch: input.githubConfig.branch,
      authMethod: input.githubConfig.authMethod,
      token: tokenToUse,
      localClonePath: input.githubConfig.localClonePath || input.folderPath,
    });

    if (tokenToUse) {
      await setSecret(secretRef, tokenToUse);
    }

    resolvedFolderPath = ghResult.clonedPath;
    githubConfig = {
      repo: ghResult.fullName,
      branch: ghResult.defaultBranch,
      authMethod: input.githubConfig.authMethod ?? (tokenToUse ? 'pat' : 'public'),
      secretRef: tokenToUse ? secretRef : undefined,
    };
  } else {
    throw new Error('Некорректный источник папки проекта');
  }

  const manifest = readProjectsManifest();
  const now = new Date().toISOString();
  const existingIdx = manifest.projects.findIndex((p) => p.id === id);

  const record: ProjectRecord = {
    id,
    name,
    description: (input.description ?? '').trim(),
    folderSource: input.folderSource,
    folderPath: resolvedFolderPath,
    allowedTools:
      Array.isArray(input.allowedTools) && input.allowedTools.length > 0
        ? input.allowedTools
        : DEFAULT_TOOLS,
    defaultModelId: (input.defaultModelId ?? '').trim(),
    sshConfig,
    githubConfig,
    verifiedAt: now,
    createdAt: existingIdx >= 0 ? manifest.projects[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    manifest.projects[existingIdx] = record;
  } else {
    manifest.projects.unshift(record);
  }
  manifest.activeProjectId = record.id;
  writeProjectsManifest(manifest);

  return record;
}

export async function deleteProjectRecord(id: string): Promise<{ deleted: boolean; activeProjectId: string }> {
  const manifest = readProjectsManifest();
  const target = manifest.projects.find((p) => p.id === id);
  if (!target) {
    return { deleted: false, activeProjectId: manifest.activeProjectId };
  }

  // Delete secret references only — NEVER touch user's files on disk!
  if (target.sshConfig?.secretRef) {
    await deleteSecret(target.sshConfig.secretRef);
  }
  if (target.githubConfig?.secretRef) {
    await deleteSecret(target.githubConfig.secretRef);
  }

  manifest.projects = manifest.projects.filter((p) => p.id !== id);
  delete manifest.workspaceData[id];
  if (manifest.activeProjectId === id) {
    manifest.activeProjectId = manifest.projects[0]?.id ?? '';
  }
  writeProjectsManifest(manifest);
  return { deleted: true, activeProjectId: manifest.activeProjectId };
}

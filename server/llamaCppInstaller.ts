import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { readInternalAppSettings, saveAppSettings } from './settingsManager';

const execFileAsync = promisify(execFile);
const RELEASES_API = 'https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=10';
const MAX_ASSET_BYTES = 2 * 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export type LlamaCppOperationAction = 'download' | 'install' | 'remove-download' | 'uninstall' | 'start' | 'stop' | null;
export interface LlamaCppOperationProgress {
  active: boolean;
  action: LlamaCppOperationAction;
  phase: string;
  message: string;
  sourcePath: string | null;
  targetPath: string | null;
  fileName: string | null;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  percent: number | null;
  updatedAt: number;
}
export interface LlamaCppOperationHistoryEntry {
  action: Exclude<LlamaCppOperationAction, null>;
  phase: 'completed' | 'error';
  message: string;
  sourcePath: string | null;
  targetPath: string | null;
  fileName: string | null;
  completedAt: number;
}
let operationProgress: LlamaCppOperationProgress = {
  active: false, action: null, phase: 'idle', message: 'Ожидание операции',
  sourcePath: null, targetPath: null, fileName: null,
  downloadedBytes: 0, totalBytes: 0, speedBytesPerSecond: 0, percent: null, updatedAt: Date.now(),
};
let operationHistory: LlamaCppOperationHistoryEntry[] = [];
let historyLoaded = false;
function getOperationHistoryPath(): string { return path.join(getRuntimeRoot(), 'operations.json'); }
function loadOperationHistory(): void {
  if (historyLoaded) return;
  historyLoaded = true;
  try {
    const parsed = JSON.parse(fs.readFileSync(getOperationHistoryPath(), 'utf8')) as LlamaCppOperationHistoryEntry[];
    if (Array.isArray(parsed)) operationHistory = parsed.slice(0, 20);
  } catch { operationHistory = []; }
}
export function getLlamaCppOperationProgress(): LlamaCppOperationProgress { return { ...operationProgress }; }
export function getLlamaCppOperationHistory(): LlamaCppOperationHistoryEntry[] {
  loadOperationHistory();
  return operationHistory.map((entry) => ({ ...entry }));
}
export function updateLlamaCppOperationProgress(patch: Partial<LlamaCppOperationProgress>): void {
  const previous = operationProgress;
  operationProgress = { ...operationProgress, ...patch, updatedAt: Date.now() };
  if (previous.active && patch.active === false && (patch.phase === 'completed' || patch.phase === 'error') && previous.action) {
    loadOperationHistory();
    operationHistory = [{
      action: previous.action,
      phase: patch.phase as LlamaCppOperationHistoryEntry['phase'],
      message: patch.message || operationProgress.message,
      sourcePath: patch.sourcePath === undefined ? previous.sourcePath : patch.sourcePath,
      targetPath: patch.targetPath === undefined ? previous.targetPath : patch.targetPath,
      fileName: patch.fileName === undefined ? previous.fileName : patch.fileName,
      completedAt: Date.now(),
    }, ...operationHistory].slice(0, 20);
    try {
      fs.mkdirSync(path.dirname(getOperationHistoryPath()), { recursive: true });
      fs.writeFileSync(getOperationHistoryPath(), JSON.stringify(operationHistory, null, 2), 'utf8');
    } catch { /* The live operation status remains available if history persistence fails. */ }
  }
}
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ['КБ', 'МБ', 'ГБ'];
  let value = bytes / 1024; let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(1)} ${units[unit]}`;
}

interface ReleaseAsset {
  name: string;
  size: number;
  digest: string | null;
  browser_download_url: string;
}

interface LlamaRelease {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  assets: ReleaseAsset[];
}

interface SelectedRelease {
  release: LlamaRelease;
  variant: string;
  assets: ReleaseAsset[];
}

export interface LlamaCppInstallResult {
  executablePath: string;
  version: string;
  releaseUrl: string;
  variant: string;
  selected: boolean;
}

function getRuntimeRoot(): string {
  const localAppData = process.env.LOCALAPPDATA?.trim();
  const base = process.platform === 'win32'
    ? (localAppData || path.join(os.homedir(), 'AppData', 'Local'))
    : path.join(os.homedir(), '.onecoreai');
  return path.join(base, 'OneCoreAI', 'runtimes', 'llama.cpp');
}

function validAsset(asset: ReleaseAsset | undefined): asset is ReleaseAsset {
  return Boolean(
    asset &&
    /^https:\/\/github\.com\/ggml-org\/llama\.cpp\/releases\/download\//i.test(asset.browser_download_url) &&
    Number.isSafeInteger(asset.size) &&
    asset.size > 0 &&
    asset.size <= MAX_ASSET_BYTES &&
    typeof asset.digest === 'string' &&
    /^sha256:[a-f0-9]{64}$/i.test(asset.digest),
  );
}

async function selectRelease(preferCuda: boolean): Promise<SelectedRelease> {
  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OneCoreAI-runtime-installer',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub Releases API вернул HTTP ${response.status}.`);
  const releases = await response.json() as LlamaRelease[];
  if (!Array.isArray(releases)) throw new Error('GitHub вернул некорректный список релизов llama.cpp.');

  let cpuFallback: SelectedRelease | null = null;
  for (const release of releases) {
    if (release.draft || !/^b\d+$/i.test(release.tag_name)) continue;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const cpu = assets.find((asset) => /^llama-b\d+-bin-win-cpu-x64\.zip$/i.test(asset.name));
    const cuda = assets.find((asset) => /^llama-b\d+-bin-win-cuda-([\d.]+)-x64\.zip$/i.test(asset.name));
    const cudaVersion = cuda?.name.match(/cuda-([\d.]+)-x64\.zip$/i)?.[1];
    const cudaDeps = cudaVersion
      ? assets.find((asset) => asset.name.toLowerCase() === `cudart-llama-bin-win-cuda-${cudaVersion}-x64.zip`.toLowerCase())
      : undefined;

    if (preferCuda && validAsset(cuda) && validAsset(cudaDeps)) {
      return { release, variant: `CUDA ${cudaVersion}`, assets: [cuda, cudaDeps] };
    }
    if (!cpuFallback && validAsset(cpu)) {
      cpuFallback = { release, variant: 'CPU', assets: [cpu] };
      if (!preferCuda) return cpuFallback;
    }
  }

  if (cpuFallback) return cpuFallback;
  throw new Error('Не найден официальный Windows x64 архив llama.cpp с SHA256 digest. Автоматическая установка остановлена.');
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function downloadAsset(asset: ReleaseAsset, destination: string, completedBefore: number, totalBytes: number): Promise<void> {
  if (!asset.digest || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) {
    throw new Error(`Для ${asset.name} отсутствует официальный SHA256 digest.`);
  }
  const response = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'OneCoreAI-runtime-installer' },
    redirect: 'follow',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Не удалось скачать ${asset.name}: HTTP ${response.status}.`);
  }
  const finalHost = new URL(response.url).hostname.toLowerCase();
  if (!['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(finalHost)) {
    throw new Error('GitHub перенаправил загрузку на недоверенный хост.');
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 0 && contentLength !== asset.size) {
    throw new Error(`Размер ответа для ${asset.name} не совпадает с GitHub manifest.`);
  }
  let downloadedBytes = 0;
  let lastReportAt = Date.now();
  let lastReportBytes = 0;
  const sizeGuard = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > asset.size) {
        callback(new Error(`Размер ${asset.name} превышает объявленный размер релиза.`));
        return;
      }
      const now = Date.now();
      if (now - lastReportAt >= 250 || downloadedBytes === asset.size) {
        const elapsed = Math.max(1, now - lastReportAt);
        updateLlamaCppOperationProgress({
          phase: 'downloading', message: `Скачивается ${asset.name}`, fileName: asset.name,
          downloadedBytes: completedBefore + downloadedBytes, totalBytes,
          speedBytesPerSecond: Math.round((downloadedBytes - lastReportBytes) * 1000 / elapsed),
          percent: Math.min(100, Math.floor((completedBefore + downloadedBytes) * 100 / totalBytes)),
        });
        lastReportAt = now; lastReportBytes = downloadedBytes;
      }
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as never),
    sizeGuard,
    fs.createWriteStream(destination, { flags: 'wx' }),
  );
  if (downloadedBytes !== asset.size) {
    throw new Error(`Неполная загрузка ${asset.name}: ${downloadedBytes} из ${asset.size} байт.`);
  }

  const actualDigest = await sha256File(destination);
  const expectedDigest = asset.digest.slice('sha256:'.length).toLowerCase();
  if (actualDigest !== expectedDigest) {
    fs.rmSync(destination, { force: true });
    throw new Error(`SHA256 не совпал для ${asset.name}. Архив удалён.`);
  }
}

async function extractZipSafely(archivePath: string, destination: string): Promise<void> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    '$archivePath = $env:ONECORE_LLAMA_ARCHIVE',
    '$destination = [System.IO.Path]::GetFullPath($env:ONECORE_LLAMA_DESTINATION)',
    '$root = $destination.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar',
    '$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)',
    'try {',
    '  foreach ($entry in $zip.Entries) {',
    '    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destination, $entry.FullName))',
    '    if (!$target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and $target -ne $destination) { throw "Unsafe ZIP entry path" }',
    '  }',
    '} finally {',
    '  $zip.Dispose()',
    '}',
    '[System.IO.Compression.ZipFile]::ExtractToDirectory($archivePath, $destination)',
  ].join('\r\n');
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');

  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encodedScript,
  ], {
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
    encoding: 'utf8',
    env: {
      ...process.env,
      ONECORE_LLAMA_ARCHIVE: archivePath,
      ONECORE_LLAMA_DESTINATION: destination,
    },
  });
}

function findExecutable(root: string): string | null {
  const pending = [root];
  const executableNames = process.platform === 'win32'
    ? new Set(['llama-server.exe'])
    : new Set(['llama-server']);
  let inspected = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      inspected += 1;
      if (inspected > 20_000) throw new Error('Архив llama.cpp содержит слишком много файлов.');
      const candidate = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile() && executableNames.has(entry.name.toLowerCase())) return candidate;
    }
  }
  return null;
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function getLlamaCppInstallationStatus(configuredPath: string): Promise<{
  installed: boolean;
  downloaded: boolean;
  executablePath: string | null;
  version: string | null;
}> {
  const runtimeRoot = getRuntimeRoot();
  const downloadsDir = path.join(runtimeRoot, 'downloads');
  const versionsDir = path.join(runtimeRoot, 'versions');
  const downloaded = fs.existsSync(downloadsDir) &&
    fs.readdirSync(downloadsDir).some((name) => /\.(zip|tar\.gz)$/i.test(name));
  const configured = configuredPath.trim();
  const binaryName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const pathCandidates = (process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((directory) => path.join(directory, binaryName));
  const appDirectories = [
    path.join(process.cwd(), 'bin', binaryName),
    path.join(process.cwd(), binaryName),
    path.join(path.dirname(process.execPath), binaryName),
  ];
  const systemDirectories = process.platform === 'win32'
    ? []
    : ['/usr/local/bin', '/usr/bin', '/opt/homebrew/bin'].map((directory) => path.join(directory, binaryName));
  const candidates = [
    ...(configured ? [configured] : []),
    findExecutable(versionsDir),
    ...appDirectories,
    ...systemDirectories,
    ...pathCandidates,
    ...(configured && !configured.includes('/') && !configured.includes('\\') ? [configured] : []),
  ].filter((candidate, index, all): candidate is string => Boolean(candidate) && all.indexOf(candidate) === index);

  for (const candidate of candidates) {
    try {
      const result = await execFileAsync(candidate, ['--version'], {
        windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
      });
      const version = (result.stdout || result.stderr || '').trim().slice(0, 240);
      if (!version) continue;
      const resolved = path.isAbsolute(candidate) ? path.resolve(candidate) : candidate;
      const installedInRuntime = path.isAbsolute(resolved) && isInside(versionsDir, resolved);
      return {
        installed: installedInRuntime || !path.isAbsolute(resolved) || !isInside(runtimeRoot, resolved),
        downloaded,
        executablePath: candidate,
        version,
      };
    } catch {
      // Continue through PATH, system and application candidates.
    }
  }

  return { installed: false, downloaded, executablePath: candidates[0] || null, version: null };
}

function readDownloadedRelease(runtimeRoot: string): SelectedRelease {
  const downloadsDir = path.join(runtimeRoot, 'downloads');
  const manifestPath = path.join(downloadsDir, 'release.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Архив llama.cpp не скачан. Сначала выполните скачивание.');
  let parsed: SelectedRelease;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SelectedRelease;
  } catch {
    throw new Error('Не удалось прочитать манифест llama.cpp. Удалите архив и скачайте его заново.');
  }
  if (!parsed?.release?.tag_name || !parsed.release.html_url || !parsed.variant || !Array.isArray(parsed.assets) || parsed.assets.length === 0) {
    throw new Error('Повреждён манифест скачанного llama.cpp. Удалите архив и скачайте его заново.');
  }
  for (const asset of parsed.assets) {
    if (!validAsset(asset) || path.basename(asset.name) !== asset.name) {
      throw new Error('Манифест содержит недопустимый файл llama.cpp.');
    }
    const archivePath = path.join(downloadsDir, asset.name);
    if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size !== asset.size) {
      throw new Error(`Архив ${asset.name} отсутствует или имеет неверный размер. Скачайте его заново.`);
    }
  }
  return parsed;
}

let activeInstall: Promise<LlamaCppInstallResult> | null = null;
let activeDownload: Promise<{ variant: string; version: string; releaseUrl: string }> | null = null;

async function downloadLlamaCppRuntimeInternal(preferCuda: boolean): Promise<{ variant: string; version: string; releaseUrl: string }> {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Автоматическое скачивание llama.cpp пока поддерживает Windows x64.');
  }
  updateLlamaCppOperationProgress({
    active: true, action: 'download', phase: 'searching',
    message: 'Ищу подходящий официальный архив на GitHub Releases…',
    sourcePath: RELEASES_API, targetPath: null, fileName: null,
    downloadedBytes: 0, totalBytes: 0, speedBytesPerSecond: 0, percent: null,
  });
  const selected = await selectRelease(preferCuda);
  const totalBytes = selected.assets.reduce((sum, asset) => sum + asset.size, 0);
  const runtimeRoot = getRuntimeRoot();
  const downloadsDir = path.join(runtimeRoot, 'downloads');
  const stagingDir = path.join(runtimeRoot, `.download-${crypto.randomBytes(8).toString('hex')}`);
  fs.mkdirSync(stagingDir, { recursive: true });
  try {
    updateLlamaCppOperationProgress({
      phase: 'downloading',
      message: `Архив найден: ${selected.assets.map((asset) => asset.name).join(', ')}. Сохраняю в ${downloadsDir}`,
      targetPath: downloadsDir, totalBytes, percent: 0,
    });
    let completedBytes = 0;
    for (const asset of selected.assets) {
      await downloadAsset(asset, path.join(stagingDir, asset.name), completedBytes, totalBytes);
      completedBytes += asset.size;
    }
    updateLlamaCppOperationProgress({ phase: 'verifying', message: 'Загрузка завершена. Проверяю SHA256…', downloadedBytes: totalBytes, totalBytes, speedBytesPerSecond: 0, percent: 100 });
    fs.writeFileSync(path.join(stagingDir, 'release.json'), JSON.stringify(selected, null, 2), 'utf8');
    fs.rmSync(downloadsDir, { recursive: true, force: true });
    fs.renameSync(stagingDir, downloadsDir);
    updateLlamaCppOperationProgress({ active: false, action: null, phase: 'completed', message: 'Скачивание и проверка SHA256 завершены.', targetPath: downloadsDir, percent: 100, speedBytesPerSecond: 0 });
    return { variant: selected.variant, version: selected.release.tag_name, releaseUrl: selected.release.html_url };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

export function downloadLlamaCppRuntime(preferCuda: boolean): Promise<{ variant: string; version: string; releaseUrl: string }> {
  if (activeDownload) return activeDownload;
  activeDownload = downloadLlamaCppRuntimeInternal(preferCuda).catch((error) => {
    updateLlamaCppOperationProgress({ active: false, action: null, phase: 'error', message: error instanceof Error ? error.message : 'Ошибка скачивания.', speedBytesPerSecond: 0 });
    throw error;
  }).finally(() => { activeDownload = null; });
  return activeDownload;
}

export function removeDownloadedLlamaCppRuntime(): void {
  const targetPath = path.join(getRuntimeRoot(), 'downloads');
  updateLlamaCppOperationProgress({ active: true, action: 'remove-download', phase: 'removing', message: 'Удаляю скачанные архивы…', sourcePath: targetPath, targetPath, percent: null });
  fs.rmSync(targetPath, { recursive: true, force: true });
  updateLlamaCppOperationProgress({ active: false, action: null, phase: 'completed', message: 'Скачанные архивы удалены.', targetPath });
}

export async function uninstallLlamaCppRuntime(): Promise<void> {
  const runtimeRoot = getRuntimeRoot();
  const targetPath = path.join(runtimeRoot, 'versions');
  updateLlamaCppOperationProgress({ active: true, action: 'uninstall', phase: 'removing', message: 'Удаляю установленный runtime…', sourcePath: targetPath, targetPath, percent: null });
  fs.rmSync(targetPath, { recursive: true, force: true });
  const manifest = await readInternalAppSettings();
  const currentPath = manifest?.settings.appSettings.llamaServerPath?.trim() || 'llama-server';
  if (manifest && isInside(runtimeRoot, path.resolve(currentPath))) {
    await saveAppSettings({
      ...manifest.settings,
      appSettings: { ...manifest.settings.appSettings, llamaServerPath: 'llama-server' },
    });
  }
  updateLlamaCppOperationProgress({ active: false, action: null, phase: 'completed', message: 'Установленный runtime удалён. Архивы сохранены.', targetPath });
}

async function persistInstalledPath(
  executablePath: string,
  version: string,
  selected: SelectedRelease,
  runtimeRoot: string,
): Promise<LlamaCppInstallResult> {
  const manifest = await readInternalAppSettings();
  const currentPath = manifest?.settings.appSettings.llamaServerPath?.trim() || 'llama-server';
  const currentResolved = path.resolve(currentPath);
  const keepManualOverride =
    currentPath !== 'llama-server' &&
    currentPath !== executablePath &&
    !isInside(runtimeRoot, currentResolved);

  if (manifest && !keepManualOverride) {
    await saveAppSettings({
      ...manifest.settings,
      appSettings: { ...manifest.settings.appSettings, llamaServerPath: executablePath },
    });
  }
  return {
    executablePath,
    version,
    releaseUrl: selected.release.html_url,
    variant: selected.variant,
    selected: !keepManualOverride,
  };
}

async function installLlamaCppRuntimeInternal(): Promise<LlamaCppInstallResult> {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Автоматическая установка llama.cpp пока поддерживает Windows x64. Ручной путь к llama-server остаётся доступен.');
  }
  const runtimeRoot = getRuntimeRoot();
  const selected = readDownloadedRelease(runtimeRoot);
  const downloadsDir = path.join(runtimeRoot, 'downloads');
  const versionsDir = path.join(runtimeRoot, 'versions');
  const versionKey = `${selected.release.tag_name}-${selected.variant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const versionDir = path.join(versionsDir, versionKey);
  updateLlamaCppOperationProgress({
    active: true, action: 'install', phase: 'verifying', message: 'Проверяю скачанные архивы и SHA256…',
    sourcePath: downloadsDir, targetPath: versionDir, fileName: selected.assets.map((asset) => asset.name).join(', '),
    downloadedBytes: 0, totalBytes: 0, speedBytesPerSecond: 0, percent: null,
  });
  for (const asset of selected.assets) {
    const archivePath = path.join(runtimeRoot, 'downloads', asset.name);
    const actualDigest = await sha256File(archivePath);
    const expectedDigest = asset.digest!.slice('sha256:'.length).toLowerCase();
    if (actualDigest !== expectedDigest) {
      throw new Error(`SHA256 архива ${asset.name} не совпал. Удалите архив и скачайте его заново.`);
    }
  }

  updateLlamaCppOperationProgress({ phase: 'extracting', message: `SHA256 подтверждён. Распаковываю в ${versionDir}` });
  const existingExecutable = findExecutable(versionDir);
  if (existingExecutable) {
    try {
      const result = await execFileAsync(existingExecutable, ['--version'], {
        windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
      });
      const version = (result.stdout || result.stderr || selected.release.tag_name).trim().slice(0, 240);
      if (version) {
        const installed = await persistInstalledPath(existingExecutable, version, selected, runtimeRoot);
        updateLlamaCppOperationProgress({ active: false, action: null, phase: 'completed', message: `Уже установлено ${version}. Исполняемый файл: ${existingExecutable}`, sourcePath: downloadsDir, targetPath: existingExecutable, percent: 100 });
        return installed;
      }
    } catch {
      // A broken installation is replaced from the verified downloaded archives below.
    }
  }

  fs.mkdirSync(versionsDir, { recursive: true });
  const stagingDir = path.join(runtimeRoot, `.staging-${crypto.randomBytes(8).toString('hex')}`);
  const extractedDir = path.join(stagingDir, 'runtime');
  fs.mkdirSync(extractedDir, { recursive: true });
  try {
    for (const asset of selected.assets) {
      updateLlamaCppOperationProgress({ phase: 'extracting', message: `Распаковываю ${asset.name}…`, fileName: asset.name, targetPath: extractedDir });
      await extractZipSafely(path.join(runtimeRoot, 'downloads', asset.name), extractedDir);
    }
    const executable = findExecutable(extractedDir);
    if (!executable || !isInside(extractedDir, executable)) {
      throw new Error('В официальном архиве не найден безопасный путь к llama-server.exe.');
    }
    updateLlamaCppOperationProgress({ phase: 'checking', message: 'Проверяю llama-server.exe и определяю версию…', targetPath: executable });
    const versionResult = await execFileAsync(executable, ['--version'], {
      windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
    });
    const version = (versionResult.stdout || versionResult.stderr || selected.release.tag_name).trim().slice(0, 240);
    if (!version) throw new Error('llama-server.exe не вернул версию после установки.');

    const backupDir = path.join(runtimeRoot, `.previous-${versionKey}-${crypto.randomBytes(4).toString('hex')}`);
    if (fs.existsSync(versionDir)) fs.renameSync(versionDir, backupDir);
    try {
      fs.renameSync(extractedDir, versionDir);
    } catch (error) {
      if (fs.existsSync(backupDir) && !fs.existsSync(versionDir)) fs.renameSync(backupDir, versionDir);
      throw error;
    }
    fs.rmSync(backupDir, { recursive: true, force: true });
    const installedExecutable = path.join(versionDir, path.relative(extractedDir, executable));
    const result = await persistInstalledPath(installedExecutable, version, selected, runtimeRoot);
    updateLlamaCppOperationProgress({ active: false, action: null, phase: 'completed', message: `Установлено ${version}. Исполняемый файл: ${installedExecutable}`, sourcePath: downloadsDir, targetPath: installedExecutable, percent: 100 });
    return result;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function validateArchiveEntries(entries: string[]): void {
  if (entries.length === 0 || entries.length > 20_000) {
    throw new Error('Архив пуст или содержит слишком много файлов.');
  }
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, '/');
    if (
      normalized.startsWith('/') ||
      /^[a-z]:/i.test(normalized) ||
      normalized.split('/').some((part) => part === '..')
    ) {
      throw new Error('Архив содержит недопустимый путь. Распаковка отменена.');
    }
  }
}

export async function installLlamaCppArchive(archivePath: string): Promise<LlamaCppInstallResult> {
  const archiveName = path.basename(archivePath).toLowerCase();
  const isZip = archiveName.endsWith('.zip');
  const isTarGz = archiveName.endsWith('.tar.gz');
  if (!isZip && !isTarGz) throw new Error('Поддерживаются только архивы .zip и .tar.gz.');
  if (!fs.existsSync(archivePath) || !fs.statSync(archivePath).isFile()) {
    throw new Error('Загруженный архив не найден.');
  }
  if (fs.statSync(archivePath).size > MAX_ASSET_BYTES) {
    throw new Error('Размер архива превышает допустимые 2 GB.');
  }

  const runtimeRoot = getRuntimeRoot();
  const versionsDir = path.join(runtimeRoot, 'versions');
  const stagingDir = path.join(runtimeRoot, `.archive-${crypto.randomBytes(8).toString('hex')}`);
  const extractedDir = path.join(stagingDir, 'runtime');
  fs.mkdirSync(extractedDir, { recursive: true });
  updateLlamaCppOperationProgress({
    active: true,
    action: 'install',
    phase: 'extracting',
    message: `Проверяю и распаковываю архив ${path.basename(archivePath)}…`,
    sourcePath: archivePath,
    targetPath: extractedDir,
    fileName: path.basename(archivePath),
    downloadedBytes: 0,
    totalBytes: fs.statSync(archivePath).size,
    speedBytesPerSecond: 0,
    percent: null,
  });

  try {
    if (isZip && process.platform === 'win32') {
      await extractZipSafely(archivePath, extractedDir);
    } else if (isZip) {
      const listing = await execFileAsync('unzip', ['-Z1', archivePath], {
        timeout: 30_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
      });
      validateArchiveEntries(listing.stdout.split(/\r?\n/).filter(Boolean));
      await execFileAsync('unzip', ['-q', archivePath, '-d', extractedDir], {
        timeout: 120_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
      });
    } else {
      const listing = await execFileAsync('tar', ['-tzf', archivePath], {
        timeout: 30_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
      });
      validateArchiveEntries(listing.stdout.split(/\r?\n/).filter(Boolean));
      const verbose = await execFileAsync('tar', ['-tvzf', archivePath], {
        timeout: 30_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
      });
      if (verbose.stdout.split(/\r?\n/).some((line) => /^[lh]/.test(line))) {
        throw new Error('Архив с символическими или жёсткими ссылками не поддерживается.');
      }
      await execFileAsync('tar', [
        '-xzf', archivePath, '-C', extractedDir,
        ...(process.platform === 'win32' ? [] : ['--no-same-owner', '--no-same-permissions']),
      ], {
        timeout: 120_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
      });
    }

    const executable = findExecutable(extractedDir);
    if (!executable || !isInside(extractedDir, executable)) {
      throw new Error(`В архиве не найден исполняемый файл ${process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'}.`);
    }
    if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
    updateLlamaCppOperationProgress({
      phase: 'checking',
      message: 'Проверяю бинарник командой --version…',
      targetPath: executable,
    });
    const versionResult = await execFileAsync(executable, ['--version'], {
      windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
    });
    const version = (versionResult.stdout || versionResult.stderr || '').trim().slice(0, 240);
    if (!version) throw new Error('llama-server не вернул версию.');

    fs.mkdirSync(versionsDir, { recursive: true });
    const versionDir = path.join(versionsDir, `archive-${Date.now()}`);
    fs.renameSync(extractedDir, versionDir);
    const installedExecutable = path.join(versionDir, path.relative(extractedDir, executable));
    const manifest = await readInternalAppSettings();
    if (manifest) {
      await saveAppSettings({
        ...manifest.settings,
        appSettings: { ...manifest.settings.appSettings, llamaServerPath: installedExecutable },
      });
    }
    const result = {
      executablePath: installedExecutable,
      version,
      releaseUrl: '',
      variant: 'Локальный архив',
      selected: true,
    };
    updateLlamaCppOperationProgress({
      active: false,
      action: null,
      phase: 'completed',
      message: `Установлено ${version}. Путь: ${installedExecutable}`,
      sourcePath: archivePath,
      targetPath: installedExecutable,
      percent: 100,
    });
    return result;
  } catch (error) {
    updateLlamaCppOperationProgress({
      active: false,
      action: null,
      phase: 'error',
      message: error instanceof Error ? error.message : 'Не удалось установить архив llama-server.',
    });
    throw error;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

export function installLlamaCppRuntime(): Promise<LlamaCppInstallResult> {
  if (activeInstall) return activeInstall;
  activeInstall = installLlamaCppRuntimeInternal().catch((error) => {
    updateLlamaCppOperationProgress({ active: false, action: null, phase: 'error', message: error instanceof Error ? error.message : 'Ошибка установки.' });
    throw error;
  }).finally(() => { activeInstall = null; });
  return activeInstall;
}

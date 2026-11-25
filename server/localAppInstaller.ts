import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

const execFileAsync = promisify(execFile);
const MAX_INSTALLER_BYTES = 1024 * 1024 * 1024;

export type LocalAiAppId = 'ollama' | 'lmstudio';
export interface LocalAiAppStatus {
  installed: boolean;
  running: boolean;
  executablePath: string | null;
  displayName: string | null;
}

const config: Record<LocalAiAppId, {
  url: string;
  fileName: string;
  registryPattern: string;
  processPattern: string;
  candidates: string[];
}> = {
  ollama: {
    url: 'https://ollama.com/download/OllamaSetup.exe',
    fileName: 'OllamaSetup.exe',
    registryPattern: 'Ollama',
    processPattern: 'ollama',
    candidates: [
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Ollama', 'ollama app.exe'),
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Ollama', 'ollama.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama app.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
    ],
  },
  lmstudio: {
    url: 'https://lmstudio.ai/download/latest/win32/x64',
    fileName: 'LM-Studio-Setup.exe',
    registryPattern: 'LM Studio',
    processPattern: 'LM Studio|LMStudio',
    candidates: [
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'LM Studio', 'LM Studio.exe'),
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'LM Studio', 'LM Studio.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'LM Studio', 'LM Studio.exe'),
    ],
  },
};

function getInstallerPath(app: LocalAiAppId): string {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(base, 'OneCoreAI', 'installers', app, config[app].fileName);
}

function assertAppId(value: string): asserts value is LocalAiAppId {
  if (value !== 'ollama' && value !== 'lmstudio') throw new Error('Неизвестное локальное приложение.');
}

export async function getLocalAiAppStatus(app: LocalAiAppId): Promise<LocalAiAppStatus> {
  if (process.platform !== 'win32') return { installed: false, running: false, executablePath: null, displayName: null };
  const item = config[app];
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$keys = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
    "$entry = Get-ItemProperty -Path $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match $env:ONECORE_REGISTRY_PATTERN } | Select-Object -First 1",
    "$paths = ConvertFrom-Json $env:ONECORE_CANDIDATES",
    "$exe = $paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1",
    "$running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match $env:ONECORE_PROCESS_PATTERN }).Count -gt 0",
    "$displayName = $null",
    "if ($entry) { $displayName = [string]$entry.DisplayName }",
    "[pscustomobject]@{ installed = ([bool]$entry -or [bool]$exe); running = [bool]$running; executablePath = $exe; displayName = $displayName } | ConvertTo-Json -Compress"
  ].join('\r\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true, timeout: 20_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
    env: { ...process.env, ONECORE_REGISTRY_PATTERN: item.registryPattern, ONECORE_PROCESS_PATTERN: item.processPattern, ONECORE_CANDIDATES: JSON.stringify(item.candidates) },
  });
  const parsed = JSON.parse(result.stdout.trim()) as { installed?: boolean; running?: boolean; executablePath?: string | null; displayName?: string | null };
  return {
    installed: parsed.installed === true,
    running: parsed.running === true,
    executablePath: typeof parsed.executablePath === 'string' ? parsed.executablePath : null,
    displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
  };
}

function allowedHost(app: LocalAiAppId, url: string): boolean {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (app === 'lmstudio') return host === 'lmstudio.ai' || host.endsWith('.lmstudio.ai');
  if (host === 'ollama.com' || host.endsWith('.ollama.com')) return true;
  if (host === 'github.com') return /\/ollama\/ollama\/releases\/download\//i.test(parsed.pathname);
  return ['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(host);
}

async function verifySignature(filePath: string): Promise<void> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:ONECORE_INSTALLER_PATH",
    "if ($signature.Status -ne 'Valid') { throw ('Цифровая подпись установщика не подтверждена: ' + $signature.Status) }",
    "[pscustomobject]@{ status = [string]$signature.Status } | ConvertTo-Json -Compress"
  ].join('\r\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
    env: { ...process.env, ONECORE_INSTALLER_PATH: filePath },
  });
}

const activeDownloads = new Map<LocalAiAppId, Promise<{ installerPath: string }>>();

async function downloadInternal(app: LocalAiAppId): Promise<{ installerPath: string }> {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Установщики поддерживаются только в Windows x64.');
  const response = await fetch(config[app].url, { redirect: 'follow', headers: { 'User-Agent': 'OneCoreAI-installer' }, signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body) throw new Error(`Не удалось скачать установщик: HTTP ${response.status}.`);
  if (!allowedHost(app, response.url)) {
    await response.body.cancel().catch(() => undefined);
    throw new Error('Источник загрузки перенаправил на недоверенный домен.');
  }
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_INSTALLER_BYTES) throw new Error('Размер установщика превышает допустимый лимит.');
  const installerPath = getInstallerPath(app);
  const directory = path.dirname(installerPath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${crypto.randomBytes(8).toString('hex')}.partial`);
  let bytes = 0;
  const guard = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > MAX_INSTALLER_BYTES ? new Error('Размер установщика превышает допустимый лимит.') : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body as never), guard, fs.createWriteStream(temporaryPath, { flags: 'wx' }));
    const file = await fs.promises.open(temporaryPath, 'r');
    try {
      const magic = Buffer.alloc(2);
      await file.read(magic, 0, 2, 0);
      if (magic.toString('ascii') !== 'MZ') throw new Error('Загруженный файл не является Windows EXE.');
    } finally { await file.close(); }
    await verifySignature(temporaryPath);
    fs.rmSync(installerPath, { force: true });
    fs.renameSync(temporaryPath, installerPath);
    return { installerPath };
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function downloadLocalAiAppInstaller(value: string): Promise<{ installerPath: string }> {
  assertAppId(value);
  const existing = activeDownloads.get(value);
  if (existing) return existing;
  const operation = downloadInternal(value).finally(() => activeDownloads.delete(value));
  activeDownloads.set(value, operation);
  return operation;
}

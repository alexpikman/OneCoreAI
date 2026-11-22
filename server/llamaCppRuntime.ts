import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { scanLocalModels } from './modelsManager';
import { readAppSettings } from './settingsManager';

export type LlamaCppRuntimeStatus = 'stopped' | 'loading' | 'ready' | 'error';

export interface LlamaCppRuntimeSnapshot {
  status: LlamaCppRuntimeStatus;
  pid: number | null;
  modelId: string | null;
  modelPath: string | null;
  baseUrl: string;
  error: string | null;
  output: string;
}

interface LlamaCppLaunchOptions {
  modelPath: string;
  port: number;
  gpuLayers: number | null;
  contextSize: number;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080/v1';
const START_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 1_500;

let child: ChildProcess | null = null;
let startPromise: Promise<LlamaCppRuntimeSnapshot> | null = null;
let startCancellation: AbortController | null = null;
let stopping = false;
let outputTail = '';
let runtime: LlamaCppRuntimeSnapshot = {
  status: 'stopped',
  pid: null,
  modelId: null,
  modelPath: null,
  baseUrl: DEFAULT_BASE_URL,
  error: null,
  output: '',
};

export function buildLlamaCppArgs(options: LlamaCppLaunchOptions): string[] {
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('Некорректный порт llama-server.');
  }
  if (options.gpuLayers !== null && (!Number.isInteger(options.gpuLayers) || options.gpuLayers < 0 || options.gpuLayers > 999)) {
    throw new Error('Количество GPU Layers должно быть целым числом от 0 до 999 или null для автоматического режима.');
  }
  if (!Number.isInteger(options.contextSize) || options.contextSize < 512 || options.contextSize > 262144) {
    throw new Error('Размер контекста должен быть целым числом от 512 до 262144.');
  }

  return [
    '--model', options.modelPath,
    '--host', '127.0.0.1',
    '--port', String(options.port),
    ...(options.gpuLayers === null ? [] : ['--n-gpu-layers', String(options.gpuLayers)]),
    '--ctx-size', String(options.contextSize),
  ];
}

function appendOutput(chunk: unknown): void {
  outputTail = (outputTail + String(chunk)).slice(-8_000);
  runtime = { ...runtime, output: outputTail };
}

function resolveEndpoint(baseUrl: string): { baseUrl: string; healthUrl: string; port: number } {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('Некорректный Base URL провайдера llama.cpp.');
  }

  if (
    parsed.protocol !== 'http:' ||
    parsed.hostname !== '127.0.0.1' ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('llama.cpp должен использовать локальный HTTP endpoint на loopback-интерфейсе.');
  }

  if (parsed.pathname.replace(/\/+$/, '') !== '/v1' || parsed.search || parsed.hash) {
    throw new Error('Base URL llama.cpp должен оканчиваться на /v1.');
  }

  const port = parsed.port ? Number(parsed.port) : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Некорректный порт в Base URL llama.cpp.');
  }

  return {
    baseUrl: parsed.toString().replace(/\/+$/, ''),
    healthUrl: `http://127.0.0.1:${port}/health`,
    port,
  };
}

async function probeHealth(healthUrl: string): Promise<Response | null> {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    try {
      await response.body?.cancel();
    } catch {
      // The HTTP status is still useful for detecting an occupied port.
    }
    return response;
  } catch {
    return null;
  }
}

function hasExited(process: ChildProcess): boolean {
  return process.exitCode !== null || process.signalCode !== null;
}

function waitForExit(process: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasExited(process)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout;
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    timeout = setTimeout(() => {
      process.removeListener('exit', onExit);
      resolve(hasExited(process));
    }, timeoutMs);
    process.once('exit', onExit);
  });
}

async function terminateChild(process: ChildProcess): Promise<boolean> {
  if (hasExited(process)) return true;
  process.kill();
  if (await waitForExit(process, 5_000)) return true;
  if (hasExited(process)) return true;
  process.kill('SIGKILL');
  return waitForExit(process, 2_000);
}

function resolveExecutable(binaryPath: string): string {
  const configured = binaryPath.trim();
  if (!configured) throw new Error('Укажите путь к исполняемому файлу llama-server.');

  const isPath = path.isAbsolute(configured) || configured.includes('/') || configured.includes('\\');
  if (!isPath) return configured;

  const resolved = path.resolve(configured);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Исполняемый файл llama-server не найден: ${resolved}`);
  }
  return resolved;
}

function getSnapshot(): LlamaCppRuntimeSnapshot {
  return { ...runtime, output: outputTail };
}

async function startInternal(signal: AbortSignal): Promise<LlamaCppRuntimeSnapshot> {
  const models = await scanLocalModels();
  const manifest = await readAppSettings();
  const settings = manifest?.settings;
  const provider = settings?.freeProviders.find((item) => item.kind === 'llama-cpp');
  const selectedModelPath = provider?.selectedModel?.trim();
  const availableModels = models.models.filter((model) =>
    model.status === 'ready'
    && path.extname(model.localPath).toLowerCase() === '.gguf'
    && fs.existsSync(model.localPath),
  );
  const selected = availableModels.find((model) => {
    const relativePath = path.relative(models.modelsDir, model.localPath).split(path.sep).join('/');
    return relativePath === selectedModelPath
      || model.filename === selectedModelPath
      || model.name === selectedModelPath;
  }) ?? availableModels.find((model) => model.id === models.activeModelId);

  if (!selected) {
    throw new Error('В папке моделей не найден подходящий GGUF-файл. Проверьте выбор модели в настройках llama.cpp.');
  }
  if (selected.sourceType === 'ollama' || path.extname(selected.localPath).toLowerCase() !== '.gguf') {
    throw new Error('llama.cpp запускает GGUF-файлы. Выбранная модель относится к другому формату или runtime.');
  }
  if (!fs.existsSync(selected.localPath) || !fs.statSync(selected.localPath).isFile()) {
    throw new Error(`Файл GGUF не найден: ${selected.localPath}`);
  }
  const modelFd = fs.openSync(selected.localPath, 'r');
  const magic = Buffer.alloc(4);
  try {
    fs.readSync(modelFd, magic, 0, magic.length, 0);
  } finally {
    fs.closeSync(modelFd);
  }
  if (magic.toString('ascii') !== 'GGUF') {
    throw new Error('Файл выбранной модели не содержит сигнатуру GGUF и не может быть запущен через llama.cpp.');
  }
  const endpoint = resolveEndpoint(provider?.baseUrl?.trim() || DEFAULT_BASE_URL);
  const configuredExecutable = settings?.appSettings?.llamaServerPath?.trim() || 'llama-server';
  const executable = resolveExecutable(configuredExecutable);
  if (signal.aborted) throw new Error('Запуск llama-server отменён.');
  const inference = settings?.inferenceSettings;
  const gpuLayers = inference?.gpuBackend === 'cpu'
    ? 0
    : typeof inference?.gpuLayers === 'number' && Number.isInteger(inference.gpuLayers)
      ? inference.gpuLayers
      : null;
  const contextSize = typeof inference?.contextSize === 'number' && Number.isInteger(inference.contextSize)
    ? inference.contextSize
    : 16384;
  const args = buildLlamaCppArgs({
    modelPath: selected.localPath,
    port: endpoint.port,
    gpuLayers,
    contextSize,
  });

  const occupied = await probeHealth(endpoint.healthUrl);
  if (occupied) {
    throw new Error(`Порт ${endpoint.port} уже отвечает по HTTP. Остановка чужого процесса запрещена; проверьте локальный endpoint.`);
  }

  outputTail = '';
  runtime = {
    status: 'loading',
    pid: null,
    modelId: selected.id,
    modelPath: selected.localPath,
    baseUrl: endpoint.baseUrl,
    error: null,
    output: '',
  };

  const spawned = spawn(executable, args, {
    cwd: path.dirname(selected.localPath),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child = spawned;
  runtime = { ...runtime, pid: spawned.pid ?? null };

  let spawnError: Error | null = null;
  spawned.stdout?.on('data', appendOutput);
  spawned.stderr?.on('data', appendOutput);
  spawned.on('error', (error) => {
    spawnError = error;
    if (spawned.pid === undefined && child === spawned) child = null;
  });
  spawned.on('exit', (code, signal) => {
    if (child !== spawned) return;
    child = null;
    runtime = {
      ...runtime,
      status: stopping ? 'stopped' : 'error',
      pid: null,
      error: stopping ? null : `llama-server завершился (код: ${code ?? '—'}, сигнал: ${signal ?? '—'}).${outputTail ? `\n${outputTail.slice(-2_000)}` : ''}`,
      output: outputTail,
    };
  });

  try {
    for (let elapsed = 0; elapsed < START_TIMEOUT_MS; elapsed += 500) {
      if (signal.aborted) throw new Error('Запуск llama-server отменён.');
      if (spawnError) throw spawnError;
      if (spawned.exitCode !== null || spawned.signalCode !== null) {
        throw new Error(runtime.error || 'Процесс llama-server завершился до готовности API.');
      }
      const health = await probeHealth(endpoint.healthUrl);
      if (health?.ok) {
        runtime = { ...runtime, status: 'ready', error: null };
        return getSnapshot();
      }
      await delay(500);
    }
    throw new Error(`llama-server не стал готов за ${Math.round(START_TIMEOUT_MS / 1000)} секунд.`);
  } catch (error) {
    if (child === spawned) {
      stopping = true;
      const exited = await terminateChild(spawned);
      stopping = false;
      if (exited && child === spawned) child = null;
    }
    const message = error instanceof Error ? error.message : 'Не удалось запустить llama-server.';
    runtime = { ...runtime, status: 'error', pid: null, error: outputTail ? `${message}\n${outputTail.slice(-2_000)}` : message };
    throw new Error(runtime.error ?? message);
  }
}

export function getLlamaCppStatus(): LlamaCppRuntimeSnapshot {
  return getSnapshot();
}

export function startLlamaCppServer(): Promise<LlamaCppRuntimeSnapshot> {
  if (runtime.status === 'ready' && child && !hasExited(child)) {
    return Promise.resolve(getSnapshot());
  }
  if (startPromise) return startPromise;
  if (child && !hasExited(child)) {
    return Promise.reject(new Error('Процесс llama-server уже работает; дождитесь его остановки.'));
  }

  const controller = new AbortController();
  startCancellation = controller;
  startPromise = startInternal(controller.signal).catch((error) => {
    const message = error instanceof Error ? error.message : 'Не удалось запустить llama-server.';
    runtime = { ...runtime, status: 'error', pid: child?.pid ?? null, error: message };
    throw error;
  }).finally(() => {
    startPromise = null;
    if (startCancellation === controller) startCancellation = null;
  });
  return startPromise;
}

export async function stopLlamaCppServer(): Promise<LlamaCppRuntimeSnapshot> {
  if (startCancellation) {
    startCancellation.abort();
    try {
      await startPromise;
    } catch {
      // A cancelled startup is an expected path when the user stops the runtime.
    }
  }

  const current = child;
  if (!current) {
    stopping = false;
    runtime = { ...runtime, status: 'stopped', pid: null, error: null };
    return getSnapshot();
  }

  stopping = true;
  const exited = await terminateChild(current);
  stopping = false;
  if (!exited) {
    const error = 'Не удалось подтвердить остановку процесса llama-server.';
    runtime = { ...runtime, status: 'error', error };
    throw new Error(error);
  }

  if (child === current) child = null;
  runtime = { ...runtime, status: 'stopped', pid: null, error: null };
  return getSnapshot();
}

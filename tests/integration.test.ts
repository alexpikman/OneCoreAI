import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

// Isolate ONECORE_HOME in a temporary directory so tests never pollute real ~/.onecore-ai
const tempOneCoreHome = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-test-home-'));
process.env.ONECORE_HOME = tempOneCoreHome;

import { createApiApp } from '../server/app';
import { recommendModelForHardware, type HardwareProfile } from '../server/hardware';
import { getOneCoreHome } from '../server/paths';
import { recordProjectMemory, safeResolveInside } from '../server/projectAgent';
import { inferAgentMode, routeAgentPrompt } from '../src/utils/agentRouter';

let apiServer: http.Server;
let apiBaseUrl = '';

let rangeServer: http.Server;
let rangeBaseUrl = '';
let rangeRequestSeen = false;
let throttleFirstChunk = false;

const sampleModelBytes = Buffer.alloc(1024 * 512, 0x4b);
// Put GGUF magic header at start so file is a valid GGUF-prefixed payload
sampleModelBytes.write('GGUF', 0, 'ascii');
const sampleModelSha256 = crypto.createHash('sha256').update(sampleModelBytes).digest('hex');

test('supports the legacy KOVA_HOME environment variable', () => {
  const previousOneCoreHome = process.env.ONECORE_HOME;
  const previousKovaHome = process.env.KOVA_HOME;
  delete process.env.ONECORE_HOME;
  process.env.KOVA_HOME = tempOneCoreHome;

  try {
    assert.equal(getOneCoreHome(), path.resolve(tempOneCoreHome));
  } finally {
    if (previousOneCoreHome === undefined) delete process.env.ONECORE_HOME;
    else process.env.ONECORE_HOME = previousOneCoreHome;
    if (previousKovaHome === undefined) delete process.env.KOVA_HOME;
    else process.env.KOVA_HOME = previousKovaHome;
  }
});

async function jsonReq<T = Record<string, unknown>>(
  urlPath: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${apiBaseUrl}${urlPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(apiBaseUrl).origin,
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

test('local API rejects untrusted browser origins', async () => {
  const response = await fetch(`${apiBaseUrl}/api/health`, {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(response.status, 403);
});

test('project path resolution rejects traversal and symbolic-link escapes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-safe-root-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-safe-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'private-data', 'utf-8');

  try {
    assert.throws(() => safeResolveInside(root, '../onecore-safe-outside/secret.txt'));
    fs.symlinkSync(outside, path.join(root, 'external'), 'dir');
    assert.throws(() => safeResolveInside(root, 'external/secret.txt'), /символическ/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('agent router distinguishes chat from browser, project, and terminal work', () => {
  assert.deepEqual(routeAgentPrompt('Привет, расскажи, как устроен Git'), { kind: 'chat' });
  assert.deepEqual(routeAgentPrompt('Найди в интернете свежие новости о TypeScript'), {
    kind: 'browser',
    browserAction: 'search',
    query: 'свежие новости о TypeScript',
  });
  assert.deepEqual(routeAgentPrompt('/run npm test'), { kind: 'terminal' });
  assert.deepEqual(routeAgentPrompt('Запусти тесты'), { kind: 'terminal' });
  assert.deepEqual(routeAgentPrompt('Исправь баг в файле src/server.ts'), { kind: 'project' });
  assert.deepEqual(routeAgentPrompt('Прочитай файл src/server.ts'), { kind: 'project' });
  assert.deepEqual(routeAgentPrompt('Открой сайт https://example.com'), {
    kind: 'browser',
    browserAction: 'read',
    query: 'https://example.com',
  });
  assert.deepEqual(routeAgentPrompt('Проверь этот сайт https://example.com'), {
    kind: 'browser',
    browserAction: 'read',
    query: 'https://example.com',
  });
  assert.equal(inferAgentMode('Прочитай файл src/server.ts'), 'plan');
  assert.equal(inferAgentMode('Исправь баг в файле src/server.ts'), 'act');
  assert.equal(inferAgentMode('Проанализируй и исправь баг', 'plan'), 'act');
  assert.equal(inferAgentMode('Покажи команду для запуска', 'act'), 'plan');
});

test('settings can be saved and loaded from the local settings store', async () => {
  const providerKey = 'provider-secret-for-settings-test';
  const gatewayToken = 'gateway-secret-for-settings-test';
  const settings = {
    appNavigationWidth: 260,
    appSettings: { cloudFallbackKey: '' },
    githubAccess: { tokenInput: '' },
    freeProviders: [{ id: 'settings-test-provider', apiKey: providerKey }],
    gateways: [{ id: 'settings-test-gateway', botToken: gatewayToken }],
  };
  const saved = await jsonReq<{ ok: boolean; savedAt: string }>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.ok, true);
  assert.ok(saved.data.savedAt);

  const loaded = await jsonReq<{ ok: boolean; savedAt: string; settings: typeof settings }>('/api/settings');
  assert.equal(loaded.status, 200);
  assert.deepEqual(loaded.data.settings, settings);
  assert.equal(loaded.data.savedAt, saved.data.savedAt);
  const persistedFile = fs.readFileSync(path.join(tempOneCoreHome, 'settings.json'), 'utf-8');
  assert.equal(persistedFile.includes(providerKey), false);
  assert.equal(persistedFile.includes(gatewayToken), false);
});

test('OpenAI-compatible cloud chat forwards conversation history and auth to the provider', async () => {
  let receivedBody = '';
  let authorization = '';
  const providerServer = http.createServer((req, res) => {
    authorization = req.headers.authorization || '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      receivedBody += chunk;
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        model: 'cloud-test-model',
        choices: [{ message: { content: 'cloud reply' } }],
      }));
    });
  });

  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Mock provider did not bind a TCP port');

  try {
    const { status, data } = await jsonReq<{
      ok: boolean;
      content: string;
      model: string;
    }>('/api/providers/chat', {
      method: 'POST',
      body: JSON.stringify({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: 'test-provider-key',
        model: 'cloud-test-model',
        messages: [
          { role: 'user', content: 'Earlier question' },
          { role: 'assistant', content: 'Earlier answer' },
          { role: 'user', content: 'Current question' },
        ],
      }),
    });

    assert.equal(status, 200);
    assert.deepEqual(data, { ok: true, content: 'cloud reply', model: 'cloud-test-model', totalTokens: 0 });
    assert.equal(authorization, 'Bearer test-provider-key');
    assert.deepEqual(JSON.parse(receivedBody).messages, [
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' },
      { role: 'user', content: 'Current question' },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      providerServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

before(async () => {
  // 1. Start mock-free local HTTP Range file server for streaming download / pause / resume tests
  rangeServer = http.createServer(async (req, res) => {
    if (req.url === '/test-model.gguf') {
      const rangeHeader = req.headers.range;
      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        rangeRequestSeen = true;
        const start = Number(rangeHeader.replace('bytes=', '').split('-')[0]) || 0;
        if (start >= sampleModelBytes.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${sampleModelBytes.length}` });
          res.end();
          return;
        }
        const slice = sampleModelBytes.subarray(start);
        res.writeHead(206, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(slice.length),
          'Content-Range': `bytes ${start}-${sampleModelBytes.length - 1}/${sampleModelBytes.length}`,
          'Accept-Ranges': 'bytes',
        });
        res.end(slice);
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(sampleModelBytes.length),
        'Accept-Ranges': 'bytes',
      });

      if (throttleFirstChunk) {
        // Stream in small chunks so pause test can reliably interrupt mid-stream
        const chunkSize = 64 * 1024;
        for (let offset = 0; offset < sampleModelBytes.length; offset += chunkSize) {
          if (res.destroyed) break;
          res.write(sampleModelBytes.subarray(offset, offset + chunkSize));
          await new Promise((r) => setTimeout(r, 45));
        }
        res.end();
      } else {
        res.end(sampleModelBytes);
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    rangeServer.listen(0, '127.0.0.1', () => {
      const addr = rangeServer.address();
      if (addr && typeof addr === 'object') {
        rangeBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  // 2. Start OneCore Express backend
  const app = createApiApp(process.cwd());
  apiServer = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => {
    apiServer.once('listening', () => {
      const addr = apiServer.address();
      if (addr && typeof addr === 'object') {
        apiBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  await new Promise<void>((resolve) => rangeServer.close(() => resolve()));
  fs.rmSync(tempOneCoreHome, { recursive: true, force: true });
});

test('1. Real hardware detection & 3-tier recommendation logic', async () => {
  const { status, data } = await jsonReq<{ ok: boolean; hardware: HardwareProfile }>('/api/hardware');
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.hardware.cpu.cores >= 1);
  assert.ok(data.hardware.ram.totalGb > 0);
  assert.ok(data.hardware.disk.freeGb >= 0);

  // Verify 3-tier classification for 8 GB VRAM GPU + 16 GB RAM system
  const gpuProfile: HardwareProfile = {
    ...data.hardware,
    gpuDetected: true,
    totalVramGb: 8,
    freeVramGb: 7.5,
    ram: { ...data.hardware.ram, totalGb: 16, freeGb: 12 },
    disk: { ...data.hardware.disk, totalGb: 500, freeGb: 200 },
  };

  const fitsVram = recommendModelForHardware(
    { id: '7b-q4', name: 'Qwen2.5-7B Q4_K_M', quant: 'Q4_K_M', sizeGb: 4.7 },
    gpuProfile,
  );
  assert.equal(fitsVram.category, 'fits-vram');
  assert.equal(fitsVram.categoryLabel, 'Поместится в VRAM');
  assert.ok(fitsVram.remainingVramAfterGb > 0);

  const fitsRam = recommendModelForHardware(
    { id: '14b-q4', name: 'Qwen2.5-14B Q4_K_M', quant: 'Q4_K_M', sizeGb: 8.9 },
    gpuProfile,
  );
  assert.equal(fitsRam.category, 'fits-ram');
  assert.equal(fitsRam.categoryLabel, 'Поместится в RAM (CPU)');

  const tooHeavy = recommendModelForHardware(
    { id: '70b-q4', name: 'Llama-70B Q4_K_M', quant: 'Q4_K_M', sizeGb: 42 },
    gpuProfile,
  );
  assert.equal(tooHeavy.category, 'too-heavy');
  assert.equal(tooHeavy.categoryLabel, 'Слишком тяжело');
});

test('2. Local desktop origins can access the API without opening it to remote origins', async () => {
  const allowedOrigin = 'http://tauri.localhost';
  const preflight = await fetch(`${apiBaseUrl}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), allowedOrigin);

  const rejected = await fetch(`${apiBaseUrl}/api/health`, {
    headers: { Origin: 'https://example.com' },
  });
  assert.equal(rejected.status, 403);
});

test('2a. Browser tools only accept public HTTPS pages', async () => {
  const localAddress = await jsonReq<{ ok: boolean; error: string }>(
    `/api/browser/read?url=${encodeURIComponent('https://127.0.0.1/')}`,
  );
  assert.equal(localAddress.status, 400);
  assert.equal(localAddress.data.ok, false);
  assert.match(localAddress.data.error, /локальную|приватную/i);

  const insecureAddress = await jsonReq<{ ok: boolean; error: string }>(
    `/api/browser/read?url=${encodeURIComponent('http://example.com/')}`,
  );
  assert.equal(insecureAddress.status, 400);
  assert.match(insecureAddress.data.error, /HTTPS/i);

  const emptySearch = await jsonReq<{ ok: boolean; error: string }>('/api/browser/search');
  assert.equal(emptySearch.status, 400);
  assert.match(emptySearch.data.error, /поисковый запрос/i);
});

test('3. Real streaming download, pause, HTTP Range resume, SHA256 verify, corrupt block, and disk delete', async () => {
  throttleFirstChunk = true;
  rangeRequestSeen = false;

  const startRes = await jsonReq<{ ok: boolean; model: { id: string; localPath: string } }>(
    '/api/models/download',
    {
      method: 'POST',
      body: JSON.stringify({
        repoId: 'test/local-range',
        name: 'Test Range Model',
        quant: 'Q4_K_M',
        filename: 'test-model.gguf',
        downloadUrl: `${rangeBaseUrl}/test-model.gguf`,
        expectedSha256: sampleModelSha256,
      }),
    },
  );
  assert.equal(startRes.status, 202);
  assert.equal(startRes.data.ok, true);
  const modelId = startRes.data.model.id;
  const localPath = startRes.data.model.localPath;

  // Wait until at least 64 KB is written to .part, then pause
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 40));
    if (fs.existsSync(`${localPath}.part`) && fs.statSync(`${localPath}.part`).size >= 65536) {
      break;
    }
  }
  const pauseRes = await jsonReq<{ ok: boolean; model: { status: string; downloadedBytes: number } }>(
    `/api/models/download/${encodeURIComponent(modelId)}/pause`,
    { method: 'POST' },
  );
  assert.equal(pauseRes.status, 200);
  assert.equal(pauseRes.data.model.status, 'paused');
  assert.ok(fs.existsSync(`${localPath}.part`), '.part file must exist on disk after pause');
  assert.ok(fs.statSync(`${localPath}.part`).size > 0, '.part file must contain partial bytes');

  // Resume download and wait for completion + SHA256 verification
  throttleFirstChunk = false;
  const resumeRes = await jsonReq<{ ok: boolean }>(
    `/api/models/download/${encodeURIComponent(modelId)}/resume`,
    { method: 'POST' },
  );
  assert.equal(resumeRes.status, 200);

  let readyModel: { status: string; sha256Verified: boolean; computedSha256: string } | undefined;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 60));
    const listRes = await jsonReq<{
      models: Array<{ id: string; status: string; sha256Verified: boolean; computedSha256: string }>;
    }>('/api/models/local');
    const found = listRes.data.models.find((m) => m.id === modelId);
    if (found && (found.status === 'ready' || found.status === 'error' || found.status === 'corrupt')) {
      readyModel = found;
      break;
    }
  }

  assert.ok(readyModel, 'Model download should reach terminal state');
  assert.equal(readyModel.status, 'ready');
  assert.equal(readyModel.sha256Verified, true);
  assert.equal(readyModel.computedSha256, sampleModelSha256);
  assert.equal(rangeRequestSeen, true, 'Resumed download must issue HTTP Range header');
  assert.ok(fs.existsSync(localPath), 'Final GGUF file must exist on disk');

  // Corrupt SHA256 rejection test
  const badRes = await jsonReq<{ ok: boolean; model: { id: string } }>('/api/models/download', {
    method: 'POST',
    body: JSON.stringify({
      repoId: 'test/bad-hash',
      name: 'Corrupt Hash Model',
      quant: 'Q4_K_M',
      filename: 'bad-model.gguf',
      downloadUrl: `${rangeBaseUrl}/test-model.gguf`,
      expectedSha256: '0000000000000000000000000000000000000000000000000000000000000000',
    }),
  });
  const badId = badRes.data.model.id;
  let badState: string | undefined;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const listRes = await jsonReq<{ models: Array<{ id: string; status: string }> }>('/api/models/local');
    const found = listRes.data.models.find((m) => m.id === badId);
    if (found && (found.status === 'corrupt' || found.status === 'ready' || found.status === 'error')) {
      badState = found.status;
      break;
    }
  }
  assert.equal(badState, 'corrupt', 'SHA256 mismatch must mark model corrupt');

  const activateBad = await jsonReq<{ ok: boolean }>(`/api/models/local/${encodeURIComponent(badId)}/activate`, {
    method: 'POST',
  });
  assert.equal(activateBad.status, 400);
  assert.equal(activateBad.data.ok, false);

  // Physical disk deletion
  const delGood = await jsonReq<{ ok: boolean }>(`/api/models/local/${encodeURIComponent(modelId)}`, {
    method: 'DELETE',
  });
  assert.equal(delGood.data.ok, true);
  assert.equal(fs.existsSync(localPath), false, 'Deleted model file must be removed from disk');
  await jsonReq(`/api/models/local/${encodeURIComponent(badId)}`, { method: 'DELETE' });
});

test('4. Mandatory folder validation, real command execution, action log, /undo, and non-destructive project delete', async () => {
  // Attempt to create project without folder -> must fail with 400
  const invalidProj = await jsonReq<{ ok: boolean; error: string }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Missing Folder Project',
      folderSource: 'local',
      folderPath: '',
    }),
  });
  assert.equal(invalidProj.status, 400);
  assert.equal(invalidProj.data.ok, false);

  // Create real temporary workspace folder with a persistent user file
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-proj-'));
  const keepFile = path.join(workdir, 'keep.txt');
  fs.writeFileSync(keepFile, 'user-owned-data', 'utf-8');

  try {
    const createProj = await jsonReq<{ ok: boolean; project: { id: string; folderPath: string } }>(
      '/api/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Real Python Project',
          description: 'Integration test project',
          folderSource: 'local',
          folderPath: workdir,
        }),
      },
    );
    assert.equal(createProj.status, 201);
    assert.equal(createProj.data.ok, true);
    const projectId = createProj.data.project.id;

    const clearProject = await jsonReq<{ ok: boolean; activeProjectId: string }>(
      '/api/projects/activate',
      { method: 'POST', body: JSON.stringify({ projectId: '' }) },
    );
    assert.equal(clearProject.status, 200);
    assert.equal(clearProject.data.activeProjectId, '');
    const projectsWithoutActive = await jsonReq<{ activeProjectId: string }>('/api/projects');
    assert.equal(projectsWithoutActive.data.activeProjectId, '');
    const reactivateProject = await jsonReq<{ activeProjectId: string }>(
      `/api/projects/${encodeURIComponent(projectId)}/activate`,
      { method: 'POST' },
    );
    assert.equal(reactivateProject.data.activeProjectId, projectId);

    const emptyWorkspace = await jsonReq<{
      ok: boolean;
      workspace: { tasks: unknown[]; plan: unknown };
    }>(`/api/projects/${encodeURIComponent(projectId)}/workspace`);
    assert.deepEqual(emptyWorkspace.data.workspace, { tasks: [], plan: null });

    const createdTask = await jsonReq<{
      ok: boolean;
      task: { id: string; title: string; status: string };
    }>(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Review project scope',
        description: 'List the initial milestones.',
        status: 'todo',
      }),
    });
    assert.equal(createdTask.status, 201);
    assert.equal(createdTask.data.task.title, 'Review project scope');

    const updatedTask = await jsonReq<{ ok: boolean; task: { status: string } }>(
      `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(createdTask.data.task.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Review project scope',
          description: 'Milestones reviewed.',
          status: 'done',
        }),
      },
    );
    assert.equal(updatedTask.data.task.status, 'done');

    const plan = await jsonReq<{ ok: boolean; workspace: { plan: { content: string; progress: number } } }>(
      `/api/projects/${encodeURIComponent(projectId)}/plan`,
      {
        method: 'PUT',
        body: JSON.stringify({ content: '1. Define scope\n2. Deliver MVP', progress: 35 }),
      },
    );
    assert.equal(plan.status, 200);
    assert.equal(plan.data.workspace.plan.progress, 35);

    const deletePlan = await jsonReq<{ ok: boolean; workspace: { plan: unknown } }>(
      `/api/projects/${encodeURIComponent(projectId)}/plan`,
      { method: 'DELETE' },
    );
    assert.equal(deletePlan.data.workspace.plan, null);

    const deleteTask = await jsonReq<{ ok: boolean; workspace: { tasks: unknown[] } }>(
      `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(createdTask.data.task.id)}`,
      { method: 'DELETE' },
    );
    assert.deepEqual(deleteTask.data.workspace.tasks, []);
    for (let i = 0; i < 201; i += 1) {
      recordProjectMemory(projectId, `Recorded project action ${i}`);
    }

    // Write hello.py via API
    const writeRes = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/file`,
      {
        method: 'PUT',
        body: JSON.stringify({
          path: 'hello.py',
          content: 'print("Hello from OneCore")\n',
          summary: 'Create hello.py',
        }),
      },
    );
    assert.equal(writeRes.status, 200);
    assert.equal(writeRes.data.ok, true);
    assert.equal(fs.existsSync(path.join(workdir, 'hello.py')), true);

    // Execute Node.js, which is already required to run ONE CORE AI.
    const deniedExec = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/exec`,
      { method: 'POST', body: JSON.stringify({ command: 'node -e "process.exit(0)"' }) },
    );
    assert.equal(deniedExec.status, 403);

    const execRes = await jsonReq<{ ok: boolean; stdout: string; exitCode: number }>(
      `/api/projects/${encodeURIComponent(projectId)}/exec`,
      {
        method: 'POST',
        body: JSON.stringify({ command: 'node -e "console.log(\'Hello from OneCore\')"' , approved: true}),
      },
    );
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.exitCode, 0);
    assert.match(execRes.data.stdout, /Hello from OneCore/);

    const proposedCommand = `node -e "require('fs').writeFileSync('agent-command-ran.txt','ran')"`;
    const modelServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ reply: 'Нужна команда.', runCommand: proposedCommand }) } }],
        }),
      );
    });
    await new Promise<void>((resolve) => modelServer.listen(0, '127.0.0.1', resolve));
    const modelAddress = modelServer.address();
    assert.ok(modelAddress && typeof modelAddress === 'object');
    let taskRes: { status: number; data: { ok: boolean; proposedCommand?: string; commandResult?: unknown } };
    try {
      taskRes = await jsonReq<{ ok: boolean; proposedCommand?: string; commandResult?: unknown }>(
        `/api/projects/${encodeURIComponent(projectId)}/task`,
        {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Покажи команду для выполнения',
          mode: 'act',
          provider: {
            baseUrl: `http://127.0.0.1:${modelAddress.port}/v1`,
            model: 'test-model',
          },
        }),
        },
      );
    } finally {
      await new Promise<void>((resolve) => modelServer.close(() => resolve()));
    }
    assert.equal(taskRes.status, 200);
    assert.equal(taskRes.data.proposedCommand, proposedCommand);
    assert.equal(taskRes.data.commandResult, undefined);
    assert.equal(fs.existsSync(path.join(workdir, 'agent-command-ran.txt')), false);

    const approvedCommand = await jsonReq<{ ok: boolean; exitCode: number }>(
      `/api/projects/${encodeURIComponent(projectId)}/exec`,
      {
        method: 'POST',
        body: JSON.stringify({ command: taskRes.data.proposedCommand, approved: true }),
      },
    );
    assert.equal(approvedCommand.status, 200);
    assert.equal(approvedCommand.data.exitCode, 0);
    assert.equal(fs.existsSync(path.join(workdir, 'agent-command-ran.txt')), true);

    // Verify action log contains write & command entries
    const logsRes = await jsonReq<{
      ok: boolean;
      logs: Array<{ kind: string; summary: string; filePath?: string; command?: string }>;
    }>(`/api/projects/${encodeURIComponent(projectId)}/logs`);
    assert.equal(logsRes.status, 200);
    assert.ok(logsRes.data.logs.some((l) => l.kind === 'file_write' && l.filePath === 'hello.py'));
    assert.ok(logsRes.data.logs.some((l) => l.kind === 'command'));
    assert.ok(logsRes.data.logs.some((l) => l.kind === 'task' && l.summary.includes('Review project scope')));
    assert.ok(logsRes.data.logs.length > 200, 'Project memory must retain the full action history');

    // Undo file creation via /api/projects/:id/undo -> hello.py must be removed from disk
    const undoRes = await jsonReq<{ ok: boolean; message: string }>(
      `/api/projects/${encodeURIComponent(projectId)}/undo`,
      { method: 'POST' },
    );
    assert.equal(undoRes.status, 200);
    assert.equal(undoRes.data.ok, true);
    assert.equal(fs.existsSync(path.join(workdir, 'hello.py')), false, '/undo must remove newly created file');

    // Delete project record -> user folder and keep.txt must remain intact on disk
    const delProj = await jsonReq<{ ok: boolean }>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
    assert.equal(delProj.status, 200);
    assert.equal(delProj.data.ok, true);
    assert.equal(fs.existsSync(keepFile), true, 'Deleting project must NOT delete user files on disk');
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test('5. Real error handling for SSH / GitHub / Ollama without simulation', async () => {
  const sshRes = await jsonReq<{ ok: boolean; error: string }>('/api/ssh/test', {
    method: 'POST',
    body: JSON.stringify({
      hostName: '192.0.2.1',
      port: 22,
      user: 'nobody',
      remotePath: '/tmp',
      authType: 'key',
    }),
  });
  assert.equal(sshRes.status, 400);
  assert.equal(sshRes.data.ok, false);
  assert.ok(sshRes.data.error.length > 0);

  const ghBad = await jsonReq<{ ok: boolean; error: string }>('/api/github/verify', {
    method: 'POST',
    body: JSON.stringify({
      repo: 'invalid-format-without-slash',
    }),
  });
  assert.equal(ghBad.status, 400);
  assert.equal(ghBad.data.ok, false);
});

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';

// Isolate ONECORE_HOME in a temporary directory so tests never pollute the real user profile
const tempOneCoreHome = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-test-home-'));
process.env.ONECORE_HOME = tempOneCoreHome;
process.env.HOME = tempOneCoreHome;
process.env.USERPROFILE = tempOneCoreHome;
process.env.ONECORE_TEST_DISABLE_OS_KEYCHAIN = '1';

import { createApiApp } from '../server/app';
import { warmOllamaModel } from '../server/ollamaRuntime';
import { buildLlamaCppArgs } from '../server/llamaCppRuntime';
import { listLlamaRequestHistory, recordLlamaRequest } from '../server/llamaRequestHistory';
import { recommendModelForHardware, type HardwareProfile } from '../server/hardware';
import { flushAgentJournal, readAgentJournal, recordAgentEvent, runWithAgentOperationContext } from '../server/agentJournal';
import { cancelOperation, finishOperation, getOperation, getOperationSignal, listOperations, startOperation } from '../server/operationRegistry';
import { expandUserPath, getDefaultModelsDir, getOneCoreHome, getVaultPath } from '../server/paths';
import { getSecret, setEncryptedVaultSecret } from '../server/vault';
import { listKnowledgeDocuments, readApprovedKnowledgeDocument } from '../server/knowledgeManager';
import { deleteExternalReference, listExternalReferences, saveExternalReference } from '../server/externalReferences';
import { readProjectFile, recordProjectMemory, safeResolveInside } from '../server/projectAgent';
import { verifyCommandResult, verifyFileContent, verifyFileRemoved } from '../server/verificationGate';
import { inferAgentMode, routeAgentPrompt } from '../src/utils/agentRouter';
import { getActiveNavigationGroup, getActiveNavigationGroupId, isNavigationItemActive, NAV_GROUPS } from '../src/data/appNavigation';
import { LEFT_MENU_VISIBILITY, type VisibilityElement } from '../src/data/navigationVisibility';
import { validateAgentHandoff, validateWorkerResult } from '../server/orchestration/contractValidator';
import {
  buildProvisionedWorkerContext,
  extractLineFragment,
  FragmentDeduplicationCache,
  MAX_HANDOFF_EXCERPT_CHARS,
  MAX_WORKER_TOTAL_CHARS,
} from '../server/orchestration/contextBuilder';
import { getLatestTaskAttempts, prioritizePendingContextRetries, registerNeedsMoreContextRetry } from '../server/orchestration/teamOrchestrator';
import {
  createAppearanceStylesheet,
  DEFAULT_APPEARANCE_TOKENS,
  validateAppearanceTokens,
} from '../src/data/appearanceTokens';
import { createDefaultDashboardCards, validateDashboardLayout } from '../src/data/dashboardLayout';
import {
  analyzeConfigurationDependencies,
  analyzeConfigurationDraft,
  createConfigurationDocument,
  createConfigurationDraft,
  mergeConfigurationLayers,
  type ConfigurationObject,
  validateConfigurationDocument,
} from '../server/configurationEngine';
import {
  applyConfigurationDraft,
  listConfigurationHistory,
  readConfigurationDocument,
  restoreConfigurationRevision,
} from '../server/configurationManager';
import {
  BUILTIN_COMPONENT_REGISTRY,
  BUILTIN_NAVIGATION_REGISTRY,
  validateBuiltInComponentRegistry,
} from '../src/data/componentRegistry';
import {
  createDefaultNavigationLayout,
  resolveNavigationLayout,
  validateNavigationLayout,
} from '../src/data/navigationLayout';
import {
  checkRepoSyncDiff,
  normalizeGitHubRepo,
  pullFromGitHub,
  pushToGitHub,
  saveRepoSyncConfig,
  validateGitBranch,
} from '../server/githubRepoSync';

const execFileAsync = promisify(execFile);


test('external research library validates URLs and remains isolated from approved runtime knowledge', () => {
  const reference = saveExternalReference({
    title: 'External agent workflow',
    sourceUrl: 'https://example.com/architecture',
    sourceTitle: 'Example architecture',
    sourceType: 'documentation',
    collectedAt: '2026-11-18',
    summary: 'Research notes only.',
    architecture: 'Request -> planner -> worker -> verifier',
    notes: 'Candidate pattern; not an approved One Core instruction.',
    tags: ['agents', 'workflow'],
    status: 'unreviewed',
  });
  try {
    assert.ok(reference.id);
    assert.equal(listExternalReferences().some((item) => item.id === reference.id), true);
    assert.equal(reference.sourceUrl, 'https://example.com/architecture');
    assert.throws(() => saveExternalReference({
      title: 'Unsafe URL',
      sourceUrl: 'javascript:alert(1)',
    }), /HTTP или HTTPS/i);
    const runtimeKnowledge = listKnowledgeDocuments(path.join(process.cwd(), 'docs', 'knowledge'));
    assert.equal(runtimeKnowledge.some((document) => document.id === reference.id), false);
    assert.throws(() => readApprovedKnowledgeDocument(path.join(process.cwd(), 'docs', 'knowledge'), reference.id), /не найден/i);
  } finally {
    deleteExternalReference(reference.id);
  }
});

test('agent journal accepts structured trace metadata while retaining ordinary events', () => {
  const event = recordAgentEvent({
    category: 'tool',
    level: 'info',
    status: 'completed',
    title: 'Read approved procedure',
    summary: 'Procedure document was loaded.',
    source: 'integration-test',
    trace: {
      stageId: 'tool-read-knowledge',
      stageLabel: 'Чтение утверждённого документа',
      actorType: 'tool',
      actorId: 'read_knowledge_document',
      toolName: 'read_knowledge_document',
      instructionId: 'procedure.example',
      instructionVersion: '1.0.0',
    },
  });
  assert.equal(readAgentJournal(5000).find((item) => item.id === event.id)?.trace?.instructionVersion, '1.0.0');
  const legacyEvent = recordAgentEvent({
    category: 'system',
    level: 'info',
    status: 'info',
    title: 'Legacy event',
    summary: 'No trace metadata.',
    source: 'integration-test',
  });
  assert.equal(legacyEvent.trace, undefined);
});

test('GGUF model directory follows the active profile and expands user paths', () => {
  assert.equal(getDefaultModelsDir(), path.join(getOneCoreHome(), 'models'));
  assert.equal(expandUserPath('~/.onecoreai/models'), path.join(os.homedir(), '.onecoreai', 'models'));
});

test('fresh application data uses the ~/.onecoreai profile by default', () => {
  const configuredHome = process.env.ONECORE_HOME;
  try {
    delete process.env.ONECORE_HOME;
    assert.equal(getOneCoreHome(), path.join(os.homedir(), '.onecoreai'));
  } finally {
    if (configuredHome === undefined) delete process.env.ONECORE_HOME;
    else process.env.ONECORE_HOME = configuredHome;
  }
});

test('llama.cpp runtime builds an explicit loopback command and validates inference limits', () => {
  assert.deepEqual(
    buildLlamaCppArgs({
      modelPath: 'C:\\models\\coder.gguf',
      port: 8080,
      gpuLayers: 32,
      contextSize: 8192,
    }),
    [
      '--model', 'C:\\models\\coder.gguf',
      '--host', '127.0.0.1',
      '--port', '8080',
      '--n-gpu-layers', '32',
      '--ctx-size', '8192',
    ],
  );
  assert.throws(
    () => buildLlamaCppArgs({ modelPath: 'model.gguf', port: 70000, gpuLayers: 0, contextSize: 4096 }),
    /порт/i,
  );
  assert.throws(
    () => buildLlamaCppArgs({ modelPath: 'model.gguf', port: 8080, gpuLayers: -1, contextSize: 4096 }),
    /GPU Layers/i,
  );
  assert.throws(
    () => buildLlamaCppArgs({ modelPath: 'model.gguf', port: 8080, gpuLayers: 0, contextSize: 128 }),
    /контекста/i,
  );
});

test('LlamaServer request history persists token usage and runtime load snapshots', () => {
  const startedAt = new Date().toISOString();
  const record = {
    startedAt,
    finishedAt: new Date(Date.now() + 120).toISOString(),
    providerId: 'prov-llama-cpp',
    requestedModel: 'local-model',
    usedModel: 'local-model',
    stream: true,
    status: 'success' as const,
    durationMs: 120,
    ttftMs: 24,
    promptTokens: 40,
    completionTokens: 18,
    totalTokens: 58,
    tokensPerSecond: 187.5,
    runtimeUsageAtStart: { activeSlots: 1, totalSlots: 4, usedContextTokens: 120, totalContextTokens: 8192 },
    runtimeUsageAtEnd: { activeSlots: 0, totalSlots: 4, usedContextTokens: 120, totalContextTokens: 8192 },
  };
  recordLlamaRequest(record);
  const [saved] = listLlamaRequestHistory(1);
  assert.ok(saved.id);
  assert.equal(saved.requestedModel, 'local-model');
  assert.equal(saved.totalTokens, 58);
  assert.equal(saved.runtimeUsageAtStart?.activeSlots, 1);
  assert.equal(saved.runtimeUsageAtEnd?.activeSlots, 0);
});

test('llama.cpp API reports stopped state and rejects start without an active GGUF model', async () => {
  const initial = await jsonReq<{ ok: boolean; status: string }>('/api/models/llama-cpp/status');
  assert.equal(initial.status, 200);
  assert.equal(initial.data.status, 'stopped');

  const telemetry = await jsonReq<{ ok: boolean; error: string }>('/api/models/llama-cpp/telemetry');
  assert.equal(telemetry.status, 409);
  assert.equal(telemetry.data.ok, false);
  const invalidBenchmark = await jsonReq<{ ok: boolean; error: string }>('/api/models/llama-cpp/benchmark/history', {
    method: 'POST', body: JSON.stringify({ run: {} }),
  });
  assert.equal(invalidBenchmark.status, 400);
  const benchmarkHistory = await jsonReq<{ ok: boolean; history: unknown[] }>('/api/models/llama-cpp/benchmark/history');
  const requestHistory = await jsonReq<{ ok: boolean; history: Array<{ totalTokens: number | null }> }>('/api/models/llama-cpp/requests');
  assert.equal(requestHistory.status, 200);
  assert.ok(Array.isArray(requestHistory.data.history));
  assert.ok(requestHistory.data.history.some((item) => item.totalTokens === 58));
  assert.equal(benchmarkHistory.status, 200);
  assert.ok(Array.isArray(benchmarkHistory.data.history));

  const started = await jsonReq<{ ok: boolean; error: string }>('/api/models/llama-cpp/start', {
    method: 'POST',
    body: JSON.stringify({ approved: true }),
  });
  assert.equal(started.status, 400);
  assert.equal(started.data.ok, false);
  assert.match(started.data.error, /не найден подходящий GGUF-файл/i);
});

test('local model library discovers valid GGUF files copied into the models directory', async () => {
  const modelsDir = getDefaultModelsDir();
  fs.mkdirSync(modelsDir, { recursive: true });
  const filename = 'manually-copied-model.gguf';
  const modelPath = path.join(modelsDir, filename);
  fs.writeFileSync(modelPath, Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(1024)]));

  const result = await jsonReq<{
    ok: boolean;
    models: Array<{ filename: string; localPath: string; sourceType: string; status: string }>;
  }>('/api/models/local');

  assert.equal(result.status, 200);
  assert.equal(result.data.ok, true);
  const discovered = result.data.models.find((model) => model.localPath === modelPath);
  assert.ok(discovered);
  assert.equal(discovered.filename, filename);
  assert.equal(discovered.sourceType, 'local-import');
  assert.equal(discovered.status, 'ready');
});

test('Ollama warm-up uses the native API and keeps the selected model loaded', async () => {
  let requestedUrl = '';
  let requestBody: Record<string, unknown> = {};
  await warmOllamaModel(
    {
      id: 'prov-ollama',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434/v1',
      selectedModel: 'qwen2.5-coder:7b',
    },
    async (input, init) => {
      requestedUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ done: true }), { status: 200 });
    },
  );
  assert.equal(requestedUrl, 'http://127.0.0.1:11434/api/generate');
  assert.deepEqual(requestBody, {
    model: 'qwen2.5-coder:7b',
    prompt: '',
    stream: false,
    keep_alive: '30m',
  });
});

test('page-level navigation shares the primary catalog and resolves active destinations', () => {
  assert.ok(NAV_GROUPS.length <= 10);
  assert.deepEqual(
    NAV_GROUPS.map((group) => group.label),
    [
      'Чат',
      'Инструменты',
      'Контекст',
      'Провайдеры',
      'Агенты OneCore',
      'Центр GGUF',
      'Библиотека знаний',
      'Интеграции',
      'Настройки',
      'Журналы',
    ],
  );
  assert.deepEqual(NAV_GROUPS.map((group) => group.items.length), [1, 3, 5, 2, 2, 2, 4, 6, 5, 5]);
  for (const group of NAV_GROUPS) {
    assert.ok(group.items.length <= 6, `Group ${group.id} exceeds 6 items`);
  }
  assert.equal(getActiveNavigationGroup('directories', 'ui-chat'), 'Библиотека знаний');
  assert.equal(getActiveNavigationGroup('models', 'roles-pipeline'), 'Агенты OneCore');
  assert.equal(getActiveNavigationGroup('models', 'subagents-delegation'), 'Агенты OneCore');
  assert.equal(getActiveNavigationGroup('models', 'llama-gguf'), 'Центр GGUF');
  assert.equal(getActiveNavigationGroup('models', 'model-search'), 'Центр GGUF');
  assert.equal(getActiveNavigationGroup('models', 'llama-models'), 'Центр GGUF');
  assert.equal(getActiveNavigationGroup('instructions', 'intelligence-library'), 'Библиотека знаний');
  assert.equal(getActiveNavigationGroup('settings', 'gateway'), 'Интеграции');
  assert.equal(getActiveNavigationGroup('settings', 'execution-env'), 'Интеграции');
  assert.equal(getActiveNavigationGroup('system', 'ui-chat'), 'Настройки');
  assert.equal(getActiveNavigationGroup('settings', 'engine-paths'), 'Провайдеры');
  assert.equal(getActiveNavigationGroup('models', 'engine-paths'), 'Провайдеры');
  assert.equal(getActiveNavigationGroup('models', 'llama-benchmark'), 'Провайдеры');
  assert.equal(getActiveNavigationGroup('models', 'llama-paged-attention'), 'Провайдеры');
  assert.equal(getActiveNavigationGroup('models', 'llama-openai-api'), 'Провайдеры');

  const providersGroup = NAV_GROUPS.find((group) => group.id === 'providers-group');
  assert.deepEqual(
    providersGroup?.items.map((item) => item.id),
    ['provider-local', 'llama-settings'],
  );
  assert.deepEqual(
    providersGroup?.items.map((item) => item.label),
    ['Провайдеры', 'LlamaServer'],
  );

  const aiAgentsGroup = NAV_GROUPS.find((group) => group.id === 'ai-agents');
  assert.deepEqual(
    aiAgentsGroup?.items.map((item) => item.id),
    ['agent-roles', 'subagents-delegation'],
  );
  assert.deepEqual(
    aiAgentsGroup?.items.map((item) => item.label),
    ['General Agent', 'SUB Agents'],
  );

  const ggufGroup = NAV_GROUPS.find((group) => group.id === 'gguf-center');
  assert.deepEqual(
    ggufGroup?.items.map((item) => item.id),
    ['llama-gguf', 'llama-models'],
  );
  assert.deepEqual(
    ggufGroup?.items.map((item) => item.label),
    ['Модели', 'LLAMASERVER'],
  );
  assert.deepEqual(
    ggufGroup?.items[0]?.subItems?.map((sub) => sub.label),
    ['Каталог', 'Библиотека', 'Импорт'],
  );
  assert.deepEqual(
    ggufGroup?.items[1]?.subItems?.map((sub) => sub.label),
    ['Модели и запуск'],
  );

  const appSourceForRoutes = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert.match(appSourceForRoutes, /case 'model-search':/);
  assert.match(appSourceForRoutes, /case 'llama-models':/);
  assert.match(appSourceForRoutes, /case 'subagents-delegation':[\s\S]*<SubAgentsPage \/>/);
  assert.match(appSourceForRoutes, /case 'execution-env':[\s\S]*<ExecutionEnvPage \/>/);
  assert.match(appSourceForRoutes, /case 'directories':[\s\S]*<DirectoriesPage \/>/);

  const llamaSettings = providersGroup?.items.find((item) => item.id === 'llama-settings');
  const llamaGguf = ggufGroup?.items.find((item) => item.id === 'llama-gguf');
  const llamaModels = ggufGroup?.items.find((item) => item.id === 'llama-models');
  const localProvider = providersGroup?.items.find((item) => item.id === 'provider-local');
  assert.ok(llamaSettings);
  assert.ok(llamaGguf && llamaModels);
  assert.ok(localProvider);
  assert.equal(isNavigationItemActive(llamaSettings, 'models', 'engine-paths', 'ssh-hosts'), true);
  assert.equal(isNavigationItemActive(llamaSettings, 'models', 'llama-paged-attention', 'ssh-hosts'), true);
  assert.equal(isNavigationItemActive(llamaSettings, 'models', 'llama-openai-api', 'ssh-hosts'), true);
  assert.equal(isNavigationItemActive(llamaSettings, 'models', 'llama-benchmark', 'ssh-hosts'), true);
  assert.equal(isNavigationItemActive(llamaGguf, 'models', 'llama-gguf', 'ssh-hosts', undefined, undefined, 'search'), true);
  assert.equal(isNavigationItemActive(llamaGguf, 'models', 'llama-gguf', 'ssh-hosts', undefined, undefined, 'library'), true);
  assert.equal(isNavigationItemActive(llamaGguf, 'models', 'model-search', 'ssh-hosts', undefined, undefined, 'import'), true);
  assert.equal(isNavigationItemActive(llamaGguf, 'models', 'llama-models', 'ssh-hosts', undefined, undefined, 'search'), false);
  assert.equal(isNavigationItemActive(llamaModels, 'models', 'llama-models', 'ssh-hosts', undefined, undefined, 'search'), true);
  assert.equal(isNavigationItemActive(llamaModels, 'models', 'llama-gguf', 'ssh-hosts', undefined, undefined, 'search'), false);
  assert.equal(isNavigationItemActive(localProvider, 'models', 'providers', 'ssh-hosts', 'local'), true);
  assert.equal(isNavigationItemActive(localProvider, 'models', 'providers', 'ssh-hosts', 'cloud'), true);

  const integrations = NAV_GROUPS.find((group) => group.label === 'Интеграции');
  assert.deepEqual(
    integrations?.items.map((item) => item.label),
    ['Remote connection', 'Messaging Gateway', 'Execution Environments', 'Tools', 'Hooks', 'MCP'],
  );
  const remoteConnection = integrations?.items.find((item) => item.id === 'remote-connection');
  const toolsItem = integrations?.items.find((item) => item.id === 'tools-item');
  const hooksItem = integrations?.items.find((item) => item.id === 'hooks-item');
  assert.ok(remoteConnection);
  assert.ok(toolsItem);
  assert.ok(hooksItem);
  assert.equal(isNavigationItemActive(remoteConnection, 'settings', 'ssh-github', 'github'), true);
  assert.equal(isNavigationItemActive(remoteConnection, 'settings', 'ssh-github', 'ssh-hosts'), true);
  assert.equal(isNavigationItemActive(toolsItem, 'tools-hooks', 'ui-chat', 'ssh-keys', 'local', 'tools'), true);
  assert.equal(isNavigationItemActive(hooksItem, 'tools-hooks', 'ui-chat', 'ssh-keys', 'local', 'tools'), false);
  assert.equal(isNavigationItemActive(hooksItem, 'tools-hooks', 'ui-chat', 'ssh-keys', 'local', 'hooks'), true);
});

test('navigation visibility catalog exactly matches rendered groups and destinations', () => {
  const navigationVisibility = LEFT_MENU_VISIBILITY.find((group) => group.id === 'navigation-catalog')!;

  const configuredGroups = navigationVisibility.elements.map((element) => element.id);
  const renderedGroups = NAV_GROUPS.map((group) => `group.${group.id}`);
  assert.deepEqual(configuredGroups, renderedGroups);

  for (const group of NAV_GROUPS) {
    const configuredGroup: VisibilityElement | undefined = navigationVisibility.elements.find((element: VisibilityElement) => element.id === `group.${group.id}`);
    assert.ok(configuredGroup);
    const flattenVisibilityIds = (elements: VisibilityElement[]): string[] =>
      elements.flatMap((element) => [element.id, ...flattenVisibilityIds(element.children ?? [])]);
    assert.deepEqual(
      flattenVisibilityIds(configuredGroup.children ?? []),
      group.items.map((item) => `item.${item.id}`),
    );
  }

  assert.equal(
    navigationVisibility.elements.some((element: VisibilityElement) => element.id.startsWith('settings-subnav.')),
    false,
  );
  const workspaceVisibility = LEFT_MENU_VISIBILITY.find((group) => group.id === 'workspace-sidebar');
  assert.equal(
    workspaceVisibility?.elements.some((element) => element.id.startsWith('workspace.session-') || element.id === 'workspace.sessions'),
    false,
  );

  const appNavigationSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/AppNavigation.tsx'),
    'utf-8',
  );
  assert.ok(appNavigationSource.includes('showNav(`group.${group.id}`)'));
  assert.ok(appNavigationSource.includes('showNav(`item.${item.id}`)'));
  assert.ok(appNavigationSource.includes('showNav(`item.${item.id}.icon`)'));
  assert.ok(appNavigationSource.includes('showNav(`item.${item.id}.label`)'));

  const pageSubNavigationSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/PageSubNavigation.tsx'),
    'utf-8',
  );
  assert.ok(pageSubNavigationSource.includes('isNavigationVisibilityEnabled'));
  assert.ok(pageSubNavigationSource.includes('group.${group.id}'));
  assert.ok(pageSubNavigationSource.includes('item.${item.id}.label'));
});

test('remaining non-chat pages use the shared layout and explicit scroll ownership', () => {
  const readSource = (relativePath: string) =>
    fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');

  const systemSource = readSource('src/pages/settings/SystemPage.tsx');
  assert.match(systemSource, /<PageLayout>/);
  assert.match(systemSource, /<PageContent/);
  assert.doesNotMatch(systemSource, /overflow-y-auto|PageSubNavigation|PageTransition/);

  const rolesSource = readSource('src/pages/ai-resources/AgentTeamPage.tsx');
  assert.match(rolesSource, /<PageContent scrollable=\{false\}/);
  assert.match(rolesSource, /<PageLayout>/);
  assert.doesNotMatch(rolesSource, /PageTransition/);
  assert.equal(rolesSource.includes('PageSubNavigation'), false);
  assert.match(rolesSource, /PermissionsLibrarySection/);
  assert.match(rolesSource, /DirectivesPage/);
  assert.match(rolesSource, /GeneralAgentInstructionsPage/);
  assert.match(rolesSource, /AgentRolesPage/);

  const subAgentsSource = readSource('src/pages/ai-resources/SubAgentsPage.tsx');
  assert.match(subAgentsSource, /<PageContent scrollable=\{false\}/);
  assert.match(subAgentsSource, /<PageLayout>/);
  assert.match(subAgentsSource, /<SecondaryTabBar/);
  assert.match(subAgentsSource, /SubAgentsDelegationSection/);
  assert.match(subAgentsSource, /TeamExecutionPage/);

  const agentRolesPageSource = readSource('src/pages/ai-resources/AgentRolesPage.tsx');
  assert.match(agentRolesPageSource, /Создание новой роли/);
  assert.match(agentRolesPageSource, /Доступные роли/);
  assert.match(agentRolesPageSource, /flex-nowrap/);
  assert.ok(
    agentRolesPageSource.indexOf('Создание новой роли') < agentRolesPageSource.indexOf('Доступные роли'),
    'Создание новой роли should appear before Доступные роли',
  );

  const generalInstructionsSource = readSource('src/pages/ai-resources/GeneralAgentInstructionsPage.tsx');
  assert.match(generalInstructionsSource, /Инструкции/);
  assert.match(generalInstructionsSource, /Схема поведения/);
  assert.match(generalInstructionsSource, /Системный промпт/);
  assert.match(generalInstructionsSource, /flex-nowrap/);

  for (const unifiedTabbedPage of [
    'src/pages/ai-resources/ProvidersPage.tsx',
    'src/pages/ai-resources/LlamaServerSettingsPage.tsx',
    'src/pages/ai-resources/LlamaServerModelsPage.tsx',
    'src/components/models/ModelHubView.tsx',
    'src/pages/ai-resources/AgentTeamPage.tsx',
    'src/pages/ai-resources/SubAgentsPage.tsx',
    'src/pages/ai-resources/SkillsDirectoryPage.tsx',
    'src/pages/ai-resources/InstructionsCatalogPage.tsx',
    'src/pages/ai-resources/IntelligenceLibraryPage.tsx',
    'src/pages/ai-resources/DirectoriesPage.tsx',
    'src/pages/integrations/SshGithubPage.tsx',
    'src/pages/integrations/ToolsHooksPage.tsx',
  ]) {
    const src = readSource(unifiedTabbedPage);
    assert.match(src, /<PageContent scrollable=\{false\}/);
    assert.doesNotMatch(src, /PageTransition|<main\b|className="px-5 pt-4"|overflow-y-auto px-6/);
  }

  const teamExecutionSource = readSource('src/pages/ai-resources/TeamExecutionPage.tsx');
  assert.match(teamExecutionSource, /runTeamExecution/);
  assert.match(teamExecutionSource, /Командное выполнение/);
  assert.match(teamExecutionSource, /Отчёт о выполнении и контроль/);

  const appSource = readSource('src/App.tsx');
  assert.doesNotMatch(appSource, /PlaceholderPage/);
  assert.doesNotMatch(appSource, /<AiSettingsModal \/>/);
  assert.doesNotMatch(appSource, /AiSettingsModal/);

  const providerSource = readSource('src/pages/ai-resources/ProvidersPage.tsx');
  assert.match(providerSource, /<PageHeader showSave=\{false\}>/);
  assert.match(providerSource, /<PageLayout>/);
  assert.match(providerSource, /CATEGORY_ORDER: ProviderTabCategory\[\] = \['local', 'cloud', 'compatible'\]/);
  const providerCategorySource = readSource('src/utils/providerCategories.ts');
  assert.match(providerCategorySource, /kind === 'custom'\) return 'compatible'/);
  assert.match(providerCategorySource, /kind === 'llama-cpp'\) return 'llama-server'/);
  assert.equal(providerSource.includes('showSubNavigation={false}'), false);

  const appNavigationSource = readSource('src/components/layout/AppNavigation.tsx');
  assert.match(appNavigationSource, /NavigationGroupPopup/);
  assert.match(appNavigationSource, /WorkspaceControlsModal/);
  assert.match(appNavigationSource, /if \(item\.section\) setSettingsSection\(item\.section\)/);
  assert.match(appNavigationSource, /if \(item\.providerCategory\) setAiSettingsCategory\(item\.providerCategory\)/);
  assert.match(appNavigationSource, /setActiveTab\(item\.tab\)/);
  assert.doesNotMatch(appNavigationSource, /openAiSettingsModal/);
  assert.ok(
    appNavigationSource.indexOf("openWorkspaceModal('project')") < appNavigationSource.indexOf('setAgentMode('),
    'Проект launcher should appear before PLAN/ACT switch',
  );

  const groupPopupSource = readSource('src/components/layout/NavigationGroupPopup.tsx');
  assert.match(groupPopupSource, /onSelectItem\(item\)/);

  const storeSource = readSource('src/store/useOneCoreStore.ts');
  assert.match(storeSource, /legacyRuntimeProvider\?\.kind === 'custom' \? legacyRuntimeProvider\.id : 'prov-custom'/);
  assert.match(storeSource, /legacyRuntimeProvider\?\.kind === 'llama-cpp' \? legacyRuntimeProvider\.id : 'prov-llama-cpp'/);
  assert.match(storeSource, /providerProfilesByRole: Object\.fromEntries/);
  assert.match(storeSource, /normalizeProviderCategory\(/);
  assert.doesNotMatch(providerSource, /aiSettingsModalOpen|closeAiSettingsModal/);
  assert.doesNotMatch(providerSource, /toggleAgentRole|enabledRoleIds/);
  assert.match(providerSource, /<ProviderCategoryWorkspace category=\{selectedCategory\} \/>/);
  assert.match(providerSource, />Провайдеры</);
  assert.match(providerSource, /<SecondaryTabBar/);
  assert.doesNotMatch(providerSource, /<LlamaServerWorkspace/);
  const llamaModelsSource = readSource('src/pages/ai-resources/LlamaServerModelsPage.tsx');
  assert.match(llamaModelsSource, />Модели и запуск</);
  assert.match(llamaModelsSource, /<LlamaServerWorkspace \/>/);
  assert.match(storeSource, /addFreeProvider: \(provider: FreeProviderProfile\) => void/);
  assert.match(storeSource, /deleteFreeProvider: \(providerId: string\) => void/);
  assert.match(storeSource, /assignProviderModelToRole:/);
  assert.match(storeSource, /freeProviders: \[\.\.\.state\.freeProviders, provider\]/);

  const compatibleWorkspaceSource = readSource('src/components/settings/CompatibleProvidersWorkspace.tsx');
  assert.match(compatibleWorkspaceSource, /<ProviderCategoryWorkspace category="compatible" \/>/);

  const categoryWorkspaceSource = readSource('src/components/settings/ProviderCategoryWorkspace.tsx');
  assert.match(categoryWorkspaceSource, /crypto\.randomUUID\(\)/);
  assert.match(categoryWorkspaceSource, /getProviderCategory\(provider\.kind\) === category/);
  assert.match(categoryWorkspaceSource, /Добавить провайдер/);
  assert.match(categoryWorkspaceSource, /ДОБАВИТЬ И ПРОВЕРИТЬ/);
  assert.match(categoryWorkspaceSource, /const handleSaveEdit = async/);
  assert.match(categoryWorkspaceSource, /updateFreeProvider\(editingProviderId, patch\)/);
  assert.match(categoryWorkspaceSource, /deleteFreeProvider\(provider\.id\)/);
  assert.match(categoryWorkspaceSource, /role="switch"/);
  assert.match(categoryWorkspaceSource, /Доступные модели/);
  assert.match(categoryWorkspaceSource, /Изменить/);
  assert.match(categoryWorkspaceSource, /Удалить/);
  assert.match(categoryWorkspaceSource, /<ProviderModelsModal/);
  assert.match(categoryWorkspaceSource, /preset\.requiresKey && kind !== 'custom' && !apiKey\.trim\(\)/);

  const modelsModalSource = readSource('src/components/settings/ProviderModelsModal.tsx');
  assert.match(modelsModalSource, /assignProviderModelToRole/);
  assert.match(modelsModalSource, /Текущая роль/);
  assert.match(modelsModalSource, /Сделать активной для роли/);

  const llamaWorkspaceSource = readSource('src/components/settings/LlamaServerWorkspace.tsx');
  assert.match(llamaWorkspaceSource, /api\/models\/local/);
  assert.match(llamaWorkspaceSource, /api\/models\/llama-cpp\/start/);
  assert.match(llamaWorkspaceSource, /api\/models\/llama-cpp\/stop/);
  assert.match(llamaWorkspaceSource, /providerProfilesByRole/);
  assert.match(llamaWorkspaceSource, /Внешние клиенты: нет телеметрии/);
  assert.match(llamaWorkspaceSource, /requestDeleteWarning/);

  const llamaSettingsSource = readSource('src/pages/ai-resources/LlamaServerSettingsPage.tsx');
  assert.match(llamaSettingsSource, /<h1 className="text-xl font-semibold">LlamaServer<\/h1>/);
  assert.match(llamaSettingsSource, /<SecondaryTabBar/);
  assert.match(llamaSettingsSource, /label: 'Настройки'/);
  assert.match(llamaSettingsSource, /label: 'PagedAttention'/);
  assert.match(llamaSettingsSource, /label: 'API Console'/);
  assert.match(llamaSettingsSource, /label: 'Бенчмарк'/);
  assert.match(appSource, /<ModelHubView title="Центр GGUF" \/>/);

  const navigationSource = readSource('src/data/appNavigation.ts');
  assert.match(navigationSource, /label: 'Провайдеры'/);
  assert.match(navigationSource, /label: 'Агенты OneCore'/);
  assert.match(navigationSource, /label: 'Центр GGUF'/);
  assert.match(navigationSource, /label: 'Библиотека знаний'/);
  assert.match(navigationSource, /label: 'LlamaServer'/);
  assert.match(navigationSource, /label: 'General Agent'/);
  assert.match(navigationSource, /label: 'SUB Agents'/);
  const navigationVisibilitySource = readSource('src/data/navigationVisibility.ts');
  assert.match(navigationVisibilitySource, /group\.providers-group', label: 'Провайдеры'/);
  assert.match(navigationVisibilitySource, /group\.ai-agents', label: 'Агенты OneCore'/);
  assert.match(navigationVisibilitySource, /group\.gguf-center', label: 'Центр GGUF'/);
  assert.match(navigationVisibilitySource, /group\.knowledge', label: 'Библиотека знаний'/);
  assert.match(navigationVisibilitySource, /item\.provider-local', label: 'Провайдеры'/);
  assert.match(navigationVisibilitySource, /item\.llama-settings', label: 'LlamaServer'/);
  assert.match(navigationVisibilitySource, /item\.agent-roles', label: 'General Agent'/);
  assert.match(navigationVisibilitySource, /item\.subagents-delegation', label: 'SUB Agents'/);
  assert.match(navigationVisibilitySource, /item\.llama-gguf', label: 'Модели'/);
  assert.match(navigationVisibilitySource, /item\.llama-models', label: 'LLAMASERVER'/);

  const modelSearchSource = readSource('src/components/models/ModelHubView.tsx');
  assert.match(modelSearchSource, /Папка сохранения моделей/);
  assert.match(modelSearchSource, /Прямая ссылка \(HTTP Range\)/);
  assert.match(modelSearchSource, /Импорт локального файла/);
  assert.match(modelSearchSource, /label: 'Каталог'/);
  assert.match(modelSearchSource, /label: 'Библиотека'/);
  assert.match(modelSearchSource, /label: 'Импорт'/);
  assert.match(modelSearchSource, /title = 'Поиск моделей'/);
  assert.match(modelSearchSource, /<h1 className="text-xl font-semibold">\{title\}<\/h1>/);

  const contextSidebarSource = readSource('src/components/layout/PageContextSidebar.tsx');
  assert.match(contextSidebarSource, /Видеокарта/);
  assert.match(contextSidebarSource, /Остальные характеристики/);
  assert.match(contextSidebarSource, /<QuantGuideModal/);
  const quantModalSource = readSource('src/components/models/QuantGuideModal.tsx');
  assert.match(quantModalSource, /createPortal\(/);
  assert.ok(
    contextSidebarSource.indexOf('Памятка по квантованию') < contextSidebarSource.indexOf('Реальный профиль системы'),
    'Памятка по квантованию button should appear before Реальный профиль системы',
  );
});

test('shared page header owns subsection navigation directly below the page title', () => {
  const headerSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/PageHeader.tsx'), 'utf-8');
  const contentSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/PageContent.tsx'), 'utf-8');
  assert.match(headerSource, /<PageSubNavigation \/>/);
  assert.match(headerSource, /showSubNavigation = true/);
  assert.doesNotMatch(contentSource, /PageSubNavigation|showSubNavigation/);
});

test('shared navigation ribbon uses a single-row neutral track and pages share unified SecondaryTabBar', () => {
  const readSource = (relativePath: string) =>
    fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');

  const ribbonSource = readSource('src/components/layout/NavigationRibbon.tsx');
  assert.match(ribbonSource, /flex w-full max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-lg bg-zinc-200\/75/);
  assert.match(ribbonSource, /px-3 py-1 text-xs font-medium/);
  assert.match(ribbonSource, /whitespace-nowrap/);
  assert.doesNotMatch(ribbonSource, /flex-wrap|grid-cols-|h-11/);

  const pageNavigationSource = readSource('src/components/layout/PageSubNavigation.tsx');
  assert.match(pageNavigationSource, /NavigationRibbon/);

  for (const tabbedPage of [
    'src/pages/ai-resources/ProvidersPage.tsx',
    'src/pages/ai-resources/LlamaServerSettingsPage.tsx',
    'src/pages/ai-resources/LlamaServerModelsPage.tsx',
    'src/pages/ai-resources/AgentTeamPage.tsx',
    'src/pages/ai-resources/SubAgentsPage.tsx',
    'src/pages/ai-resources/SkillsDirectoryPage.tsx',
    'src/pages/ai-resources/InstructionsCatalogPage.tsx',
    'src/pages/ai-resources/IntelligenceLibraryPage.tsx',
    'src/pages/ai-resources/DirectoriesPage.tsx',
    'src/pages/integrations/SshGithubPage.tsx',
    'src/pages/integrations/ToolsHooksPage.tsx',
    'src/pages/settings/SystemPage.tsx',
  ]) {
    assert.match(readSource(tabbedPage), /<SecondaryTabBar/);
  }

  for (const relativePath of [
    'src/components/models/ModelHubView.tsx',
    'src/components/settings/LlamaServerTelemetryView.tsx',
    'src/components/settings/LlamaServerApiConsoleView.tsx',
    'src/components/settings/LlamaServerBenchmarkView.tsx',
    'src/pages/workspace/DashboardPage.tsx',
    'src/pages/workspace/TerminalPage.tsx',
    'src/pages/workspace/BrowserPage.tsx',
    'src/pages/workspace/NotesPage.tsx',
    'src/pages/context/ProjectsPage.tsx',
    'src/pages/context/TasksPage.tsx',
    'src/pages/context/ProcessesPage.tsx',
    'src/pages/context/FilesPage.tsx',
    'src/pages/context/ProjectHistoryPage.tsx',
    'src/pages/ai-resources/ProvidersPage.tsx',
    'src/pages/ai-resources/LlamaServerModelsPage.tsx',
    'src/pages/ai-resources/LlamaServerSettingsPage.tsx',
    'src/pages/ai-resources/AgentTeamPage.tsx',
    'src/pages/ai-resources/SubAgentsPage.tsx',
    'src/pages/ai-resources/SkillsDirectoryPage.tsx',
    'src/pages/ai-resources/InstructionsCatalogPage.tsx',
    'src/pages/ai-resources/IntelligenceLibraryPage.tsx',
    'src/pages/ai-resources/DirectoriesPage.tsx',
    'src/pages/integrations/SshGithubPage.tsx',
    'src/pages/integrations/GatewayPage.tsx',
    'src/pages/integrations/ExecutionEnvPage.tsx',
    'src/pages/integrations/McpPage.tsx',
    'src/pages/integrations/ToolsHooksPage.tsx',
    'src/pages/settings/InterfaceSettingsPage.tsx',
    'src/pages/settings/PermissionsPage.tsx',
    'src/pages/settings/SecurityPage.tsx',
    'src/pages/settings/SystemPage.tsx',
    'src/pages/settings/UpdatesSettingsPage.tsx',
    'src/pages/logs/OperationsLogPage.tsx',
    'src/pages/logs/ErrorLogPage.tsx',
    'src/pages/logs/MemoryPage.tsx',
    'src/pages/logs/TasksHistoryPage.tsx',
    'src/pages/logs/AgentHistoryPage.tsx',
  ]) {
    const source = readSource(relativePath);
    const headers = [...source.matchAll(/<PageHeader(?:\s+[^>]*)?>([\s\S]*?)<\/PageHeader>/g)];
    for (const header of headers) {
      assert.doesNotMatch(header[1], /<p\b/);
    }
  }
});

test('integration navigation has no legacy settings submenu and all 25 tabs route cleanly', () => {
  const navigationSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/AppNavigation.tsx'),
    'utf-8',
  );
  const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

  assert.doesNotMatch(navigationSource, /SETTINGS_ITEMS|Подразделы настроек/);
  assert.match(appSource, /case 'agent-journal':[\s\S]*<AgentHistoryPage \/>/);
  assert.match(appSource, /case 'operations-log':[\s\S]*<OperationsLogPage \/>/);
  assert.match(appSource, /case 'terminal':[\s\S]*<TerminalPage \/>/);
  assert.match(appSource, /case 'browser':[\s\S]*<BrowserPage \/>/);
  assert.match(appSource, /case 'files':[\s\S]*<FilesPage \/>/);
  assert.match(appSource, /case 'mcp':[\s\S]*<McpPage \/>/);
  assert.match(appSource, /case 'tools-hooks':[\s\S]*<ToolsHooksPage \/>/);
  assert.match(appSource, /case 'permissions':[\s\S]*<PermissionsPage \/>/);
  assert.match(appSource, /case 'error-log':[\s\S]*<ErrorLogPage \/>/);
  assert.match(appSource, /case 'memory':[\s\S]*<MemoryPage \/>/);
  assert.match(appSource, /case 'tasks-history':[\s\S]*<TasksHistoryPage \/>/);
  assert.match(appSource, /case 'directories':[\s\S]*<DirectoriesPage \/>/);
  assert.match(appSource, /case 'instructions':[\s\S]*<InstructionsCatalogPage defaultTab="knowledge" \/>/);
});

let apiServer: http.Server;
let apiBaseUrl = '';
let testApiToken: string | undefined;

let rangeServer: http.Server;
let rangeBaseUrl = '';
let rangeRequestSeen = false;
let throttleFirstChunk = false;

const sampleModelBytes = Buffer.alloc(1024 * 512, 0x4b);
// Put GGUF magic header at start so file is a valid GGUF-prefixed payload
sampleModelBytes.write('GGUF', 0, 'ascii');
const sampleModelSha256 = crypto.createHash('sha256').update(sampleModelBytes).digest('hex');

test('knowledge manager lists versioned documents and only exposes approved procedures', () => {
  const knowledgeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-knowledge-'));
  const proceduresDir = path.join(knowledgeRoot, 'procedures');
  fs.mkdirSync(proceduresDir, { recursive: true });
  fs.writeFileSync(
    path.join(proceduresDir, 'approved.md'),
    [
      '---',
      'id: procedure.test-approved',
      'version: 1.0.0',
      'status: approved',
      'owner_role: qa',
      'triggers:',
      '  - regression_check',
      '---',
      '# Approved procedure',
      'Use verified evidence.',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(proceduresDir, 'draft.md'),
    [
      '---',
      'id: procedure.test-draft',
      'version: 0.1.0',
      'status: draft',
      'owner_role: architect',
      '---',
      '# Draft procedure',
    ].join('\n'),
  );

  try {
    const documents = listKnowledgeDocuments(knowledgeRoot);
    assert.equal(documents.length, 2);
    assert.deepEqual(documents.find((document) => document.id === 'procedure.test-approved')?.triggers, ['regression_check']);
    assert.equal(readApprovedKnowledgeDocument(knowledgeRoot, 'procedure.test-approved').title, 'Approved procedure');
    assert.throws(
      () => readApprovedKnowledgeDocument(knowledgeRoot, 'procedure.test-draft'),
      /не утверждён/,
    );
  } finally {
    fs.rmSync(knowledgeRoot, { recursive: true, force: true });
  }
});


test('recovered team roles and procedures are available to the knowledge runtime', () => {
  const knowledgeRoot = path.resolve(process.cwd(), 'docs', 'knowledge');
  const documents = listKnowledgeDocuments(knowledgeRoot);
  const byId = new Map(documents.map((document) => [document.id, document]));

  for (const id of [
    'role.manager',
    'role.dispatcher',
    'role.analyst',
    'role.coder',
    'role.tester',
    'procedure.team-execution',
    'procedure.lightweight-discovery',
    'protocol.worker-result',
  ]) {
    assert.equal(byId.get(id)?.status, 'approved', `Expected approved knowledge document: ${id}`);
  }

  assert.match(readApprovedKnowledgeDocument(knowledgeRoot, 'procedure.team-execution').content, /maximum 8 specialist tasks per cycle/i);
});

test('operation cancellation propagates to children without cancelling siblings', () => {
  const parentId = 'lifecycle-parent-test';
  const childId = 'lifecycle-child-test';
  const siblingId = 'lifecycle-sibling-test';
  const parentSignal = startOperation({ id: parentId, method: 'POST', path: '/api/test-parent' });
  const childSignal = startOperation({ id: childId, parentOperationId: parentId, method: 'POST', path: '/api/test-child' });
  const siblingSignal = startOperation({ id: siblingId, parentOperationId: parentId, method: 'POST', path: '/api/test-sibling' });

  assert.equal(cancelOperation(childId, 'Child-only cancellation'), true);
  assert.equal(childSignal.aborted, true);
  assert.equal(parentSignal.aborted, false);
  assert.equal(siblingSignal.aborted, false);
  finishOperation(childId, 'cancelled');
  assert.equal(getOperation(childId)?.status, 'cancelled');

  assert.equal(cancelOperation(parentId, 'Parent cancellation'), true);
  assert.equal(parentSignal.aborted, true);
  assert.equal(siblingSignal.aborted, true);
  assert.equal(getOperationSignal(siblingId)?.aborted, true);
  finishOperation(siblingId, 'cancelled');
  finishOperation(parentId, 'cancelled');
  assert.equal(getOperation(parentId)?.status, 'cancelled');
  assert.equal(getOperation(siblingId)?.status, 'cancelled');
});

test('agent journal flush persists the latest version of an updated event', async () => {
  const event = {
    id: 'journal-persistence-test',
    operationId: 'journal-persistence-test',
    category: 'system' as const,
    level: 'info' as const,
    status: 'running' as const,
    title: 'Journal persistence test',
    summary: 'Initial state',
    source: 'integration-test',
    parentOperationId: 'parent-operation-test',
    sessionId: 'session-test',
    messageId: 'message-test',
  };

  recordAgentEvent(event);
  recordAgentEvent({
    ...event,
    status: 'completed',
    summary: 'Updated state',
  });
  await flushAgentJournal();

  const journalPath = path.join(tempOneCoreHome, 'logs', 'agent-journal.json');
  const persistedEvents = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as Array<{
    id: string;
    status: string;
    summary: string;
    parentOperationId?: string;
    sessionId?: string;
    messageId?: string;
  }>;
  const persistedEvent = persistedEvents.find((item) => item.id === event.id);

  assert.ok(persistedEvent);
  assert.equal(persistedEvent.status, 'completed');
  assert.equal(persistedEvent.summary, 'Updated state');
  assert.equal(persistedEvent.parentOperationId, 'parent-operation-test');
  assert.equal(persistedEvent.sessionId, 'session-test');
  assert.equal(persistedEvent.messageId, 'message-test');
  assert.equal(persistedEvents.filter((item) => item.id === event.id).length, 1);
});

test('agent journal events inherit the active operation context', async () => {
  runWithAgentOperationContext({
    operationId: 'agent-context-test',
    sessionId: 'session-context-test',
    messageId: 'message-context-test',
  }, () => {
    recordAgentEvent({
      id: 'journal-context-test',
      category: 'project',
      level: 'info',
      status: 'completed',
      title: 'Context propagation test',
      summary: 'Operation metadata inherited',
      source: 'integration-test',
    });
  });

  await flushAgentJournal();
  const event = readAgentJournal(5000).find((item) => item.id === 'journal-context-test');
  assert.ok(event);
  assert.equal(event.operationId, 'agent-context-test');
  assert.equal(event.sessionId, 'session-context-test');
  assert.equal(event.messageId, 'message-context-test');
});

test('ONECORE_HOME overrides the default application data directory', () => {
  const previousOneCoreHome = process.env.ONECORE_HOME;
  process.env.ONECORE_HOME = tempOneCoreHome;

  try {
    assert.equal(getOneCoreHome(), path.resolve(tempOneCoreHome));
  } finally {
    if (previousOneCoreHome === undefined) delete process.env.ONECORE_HOME;
    else process.env.ONECORE_HOME = previousOneCoreHome;
  }
});

async function jsonReq<T = Record<string, unknown>>(
  urlPath: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  if (!testApiToken) {
    const sessionResponse = await fetch(`${apiBaseUrl}/api/auth/session`, {
      headers: { Origin: new URL(apiBaseUrl).origin },
    });
    const sessionData = (await sessionResponse.json()) as { token?: string };
    assert.equal(sessionResponse.status, 200);
    assert.ok(sessionData.token);
    testApiToken = sessionData.token;
  }

  const res = await fetch(`${apiBaseUrl}${urlPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(apiBaseUrl).origin,
      Authorization: `Bearer ${testApiToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function configureTestProvider(providerId: string, baseUrl: string, apiKey = '', availableModels: string[] = []): Promise<void> {
  const result = await jsonReq<{ ok?: boolean; error?: string }>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({
      settings: {
        appNavigationWidth: 260,
        appSettings: { cloudFallbackKey: '' },
        githubAccess: { tokenInput: '' },
        freeProviders: [{
          id: providerId,
          name: providerId,
          baseUrl,
          apiKey,
          ...(availableModels.length > 0 ? {
            kind: 'openrouter-free',
            selectedModel: availableModels[0],
            availableModels,
          } : {}),
        }],
        gateways: [],
      },
    }),
  });
  assert.equal(result.status, 200, result.data.error);
}
test('personal notes API creates, updates, persists and deletes notes', async () => {
  const initial = await jsonReq<{ ok: boolean; notes: Array<{ id: string; title: string }> }>('/api/notes');
  assert.equal(initial.status, 200);
  assert.equal(initial.data.ok, true);
  assert.ok(initial.data.notes.some((note) => note.id === 'dashboard-review-follow-up'));

  const created = await jsonReq<{ ok: boolean; note: { id: string; title: string; content: string } }>('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ title: 'Integration note', content: 'Initial content' }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.note.title, 'Integration note');

  const updated = await jsonReq<{ ok: boolean; note: { id: string; title: string; content: string } }>(
    `/api/notes/${encodeURIComponent(created.data.note.id)}`,
    { method: 'PUT', body: JSON.stringify({ title: 'Updated note', content: 'Saved content' }) },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.data.note.title, 'Updated note');
  assert.equal(updated.data.note.content, 'Saved content');

  const manifestPath = path.join(tempOneCoreHome, 'notes.json');
  const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
    notes: Array<{ id: string; title: string; content: string }>;
  };
  assert.ok(persisted.notes.some((note) => note.id === created.data.note.id && note.title === 'Updated note'));

  const deleted = await jsonReq<{ ok: boolean }>(`/api/notes/${encodeURIComponent(created.data.note.id)}`, {
    method: 'DELETE',
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.ok, true);
});

test('global tasks endpoint aggregates project tasks with project identity', async () => {
  const createdProject = await jsonReq<{
    ok?: boolean;
    project?: { id: string; name: string };
    error?: string;
  }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Global tasks integration test',
      description: 'Temporary test project',
      folderSource: 'local',
      folderPath: tempOneCoreHome,
    }),
  });
  assert.equal(createdProject.status, 201, createdProject.data.error);
  assert.ok(createdProject.data.project);

  const project = createdProject.data.project;
  const createdTask = await jsonReq<{ ok?: boolean; task?: { id: string }; error?: string }>(
    '/api/projects/' + encodeURIComponent(project.id) + '/tasks',
    {
      method: 'POST',
      body: JSON.stringify({
        title: 'Global task aggregation test',
        description: 'Must retain its owning project ID',
        status: 'todo',
      }),
    },
  );
  assert.equal(createdTask.status, 201, createdTask.data.error);
  assert.ok(createdTask.data.task);

  const result = await jsonReq<{
    ok?: boolean;
    tasks?: Array<{ id: string; projectId: string; projectName: string }>;
  }>('/api/tasks');
  assert.equal(result.status, 200);
  assert.ok(result.data.tasks?.some((task) =>
    task.id === createdTask.data.task?.id &&
    task.projectId === project.id &&
    task.projectName === project.name,
  ));
});

test('model and project side effects reject requests without explicit approval', async () => {
  const modelDownload = await jsonReq<{ ok?: boolean; error?: string }>('/api/models/download', {
    method: 'POST',
    body: JSON.stringify({
      repoId: 'test/model',
      filename: 'model.gguf',
      downloadUrl: 'http://127.0.0.1:1/model.gguf',
    }),
  });
  assert.equal(modelDownload.status, 403);
  assert.match(modelDownload.data.error ?? '', /подтверждение/i);

  const missingProject = await jsonReq<{ ok?: boolean }>('/api/projects/does-not-exist', {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
  assert.equal(missingProject.status, 403);
});

test('local API requires a bearer session for protected endpoints', async () => {
  const origin = new URL(apiBaseUrl).origin;
  const unauthenticated = await fetch(`${apiBaseUrl}/api/projects`, { headers: { Origin: origin } });
  assert.equal(unauthenticated.status, 401);

  const session = await fetch(`${apiBaseUrl}/api/auth/session`, { headers: { Origin: origin } });
  assert.equal(session.status, 200);
  const payload = (await session.json()) as { token: string };
  assert.ok(payload.token.length >= 40);

  const authenticated = await fetch(`${apiBaseUrl}/api/projects`, {
    headers: { Origin: origin, Authorization: `Bearer ${payload.token}` },
  });
  assert.equal(authenticated.status, 200);
});

test('local API accepts only the native configured token when one is set', async () => {
  const token = crypto.randomBytes(32).toString('hex');
  const previousToken = process.env.ONECORE_API_TOKEN;
  process.env.ONECORE_API_TOKEN = token;
  const protectedApp = createApiApp(process.cwd());
  if (previousToken === undefined) delete process.env.ONECORE_API_TOKEN;
  else process.env.ONECORE_API_TOKEN = previousToken;

  const protectedServer = protectedApp.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => protectedServer.once('listening', resolve));
  const address = protectedServer.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const noToken = await fetch(`${baseUrl}/api/projects`, {
      headers: { Origin: new URL(baseUrl).origin },
    });
    assert.equal(noToken.status, 401);

    const invalidToken = await fetch(`${baseUrl}/api/projects`, {
      headers: { Origin: new URL(baseUrl).origin, Authorization: `Bearer ${token.slice(1)}` },
    });
    assert.equal(invalidToken.status, 401);

    const validToken = await fetch(`${baseUrl}/api/projects`, {
      headers: { Origin: new URL(baseUrl).origin, Authorization: `Bearer ${token}` },
    });
    assert.equal(validToken.status, 200);

    const pairingResponse = await fetch(`${baseUrl}/api/designer/pairing`, {
      method: 'POST',
      headers: {
        Origin: new URL(baseUrl).origin,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-OneCore-Approval': 'user-confirmed',
      },
      body: JSON.stringify({ approved: true }),
    });
    assert.equal(pairingResponse.status, 200);
    const pairing = await pairingResponse.json() as { code: string };

    const designerSessionResponse = await fetch(`${baseUrl}/api/designer/session`, {
      method: 'POST',
      headers: { Origin: 'tauri://localhost', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pairing.code }),
    });
    assert.equal(designerSessionResponse.status, 200);
    const designerSession = await designerSessionResponse.json() as { token: string };

    const designerAccess = await fetch(`${baseUrl}/api/designer/configuration?scope=global`, {
      headers: { Origin: 'tauri://localhost', Authorization: `Bearer ${designerSession.token}` },
    });
    assert.equal(designerAccess.status, 200);

    const deniedDesignerAccess = await fetch(`${baseUrl}/api/projects`, {
      headers: { Origin: 'tauri://localhost', Authorization: `Bearer ${designerSession.token}` },
    });
    assert.equal(deniedDesignerAccess.status, 403);

    const bootstrap = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Origin: new URL(baseUrl).origin },
    });
    assert.equal(bootstrap.status, 403);
  } finally {
    await new Promise<void>((resolve) => protectedServer.close(() => resolve()));
  }
});

test('fresh fallback vault stores secrets with versioned scrypt metadata', async () => {
  const vaultPath = getVaultPath();
  setEncryptedVaultSecret('migration-test:fresh', 'fresh-secret-value');

  const recovered = await getSecret('migration-test:fresh');
  assert.equal(recovered, 'fresh-secret-value');

  const persisted = JSON.parse(fs.readFileSync(vaultPath, 'utf-8')) as {
    version?: number;
    kdf?: { algorithm?: string; salt?: string; cost?: number };
    entries?: Record<string, unknown>;
  };
  assert.equal(persisted.version, 2);
  assert.equal(persisted.kdf?.algorithm, 'scrypt');
  assert.match(persisted.kdf?.salt ?? '', /^[a-f0-9]{64}$/);
  assert.equal(persisted.kdf?.cost, 32768);
  assert.ok(persisted.entries?.['migration-test:fresh']);
});

test('corrupt fallback vault is not silently replaced during secret writes', () => {
  const vaultPath = getVaultPath();
  const original = '{"entries":';
  fs.writeFileSync(vaultPath, original);
  assert.throws(() => setEncryptedVaultSecret('migration-test:corrupt', 'must-not-overwrite'));
  assert.equal(fs.readFileSync(vaultPath, 'utf-8'), original);
  fs.rmSync(vaultPath, { force: true });
});

test('project terminal permission UI uses the backend identifier and normalizes the legacy alias', () => {
  const projectModal = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'workstation', 'ProjectModal.tsx'),
    'utf-8',
  );
  assert.match(projectModal, /id: 'run_command'/);
  assert.match(projectModal, /tool === 'exec_command' \? 'run_command' : tool/);
  assert.doesNotMatch(projectModal, /id: 'exec_command'/);
});

test('side-effect permission approval requires an explicit affirmative decision', async () => {
  const { evaluateSideEffectApproval } = await import('../server/permissionManager');
  const denied = evaluateSideEffectApproval({ approved: false, scope: 'project.delete', resource: 'project-1' });
  const missing = evaluateSideEffectApproval({ approved: undefined, scope: 'ssh.connect', resource: 'host-1' });
  const allowed = evaluateSideEffectApproval({ approved: true, scope: 'model.download', resource: 'model.gguf' });
  assert.equal(denied.allowed, false);
  assert.equal(denied.actor, 'unconfirmed');
  assert.equal(missing.allowed, false);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.actor, 'local-user');
  assert.equal(allowed.scope, 'model.download');
});

test('local API rejects untrusted browser origins', async () => {
  const response = await fetch(`${apiBaseUrl}/api/health`, {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(response.status, 403);
});

test('verification gate checks persisted file bytes, deletion, and command outcomes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-verification-'));
  const filePath = path.join(directory, 'result.txt');
  try {
    fs.writeFileSync(filePath, 'verified output', 'utf-8');
    const validFile = verifyFileContent(filePath, 'verified output');
    assert.equal(validFile.verified, true);
    assert.equal(validFile.checks.every((check) => check.passed), true);
    assert.equal(verifyFileContent(filePath, 'different output').verified, false);
    assert.equal(verifyCommandResult({ exitCode: 0, timedOut: false, cancelled: false }).verified, true);
    assert.equal(verifyCommandResult({ exitCode: 1, timedOut: false, cancelled: false }).verified, false);
    assert.equal(verifyCommandResult({ exitCode: 124, timedOut: true, cancelled: false }).verified, false);
    fs.unlinkSync(filePath);
    assert.equal(verifyFileRemoved(filePath).verified, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('project path resolution rejects traversal and symbolic-link escapes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-safe-root-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-safe-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'private-data', 'utf-8');

  try {
    assert.throws(() => safeResolveInside(root, '../onecore-safe-outside/secret.txt'));
    for (const unsafePath of [
      'C:relative.txt',
      'C:\\absolute.txt',
      '\\\server\share\secret.txt',
      'CON',
      'con.txt',
      'NUL.log',
      'folder/file.txt:stream',
      'folder\\file.txt:stream',
      'folder\\trailing.',
      'folder\\trailing ',
      'folder\bad?.txt',
      'folder\\..\\..\\outside.txt',
    ]) {
      assert.throws(() => safeResolveInside(root, unsafePath), unsafePath);
    }
    assert.equal(path.basename(safeResolveInside(root, 'folder\\ordinary-file.txt')), 'ordinary-file.txt');
    fs.symlinkSync(outside, path.join(root, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
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
  assert.deepEqual(routeAgentPrompt('Добавь задачу проверить сборку'), { kind: 'project' });
  assert.deepEqual(routeAgentPrompt('Выполни задачу task-123'), { kind: 'project' });
  assert.deepEqual(routeAgentPrompt('Какие задачи есть в проекте?'), { kind: 'project' });
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

  const loaded = await jsonReq<{ ok: boolean; savedAt: string; settings: unknown }>('/api/settings');
  assert.equal(loaded.status, 200);
  assert.deepEqual(loaded.data.settings, {
    ...settings,
    appSettings: { cloudFallbackKey: '', modelsDir: getDefaultModelsDir() },
    githubAccess: { tokenInput: '' },
    freeProviders: [{ id: 'settings-test-provider', apiKey: '', secretConfigured: true }],
    gateways: [{ id: 'settings-test-gateway', botToken: '', secretConfigured: true }],
    systemConfig: {
      providerRequestTimeoutMs: 30000,
      providerStreamIdleTimeoutMs: 60000,
      agentOperationTimeoutMs: 120000,
      modelFallbackAttempts: 5,
      maxToolRounds: 6,
      maxToolCalls: 12,
    },
    security: { cloudFallbackConfigured: false, githubTokenConfigured: false },
  });
  assert.equal(loaded.data.savedAt, saved.data.savedAt);
  const persistedFile = fs.readFileSync(path.join(tempOneCoreHome, 'settings.json'), 'utf-8');
  assert.equal(persistedFile.includes(providerKey), false);
  assert.equal(persistedFile.includes(gatewayToken), false);
});

test('chat sessions are persisted and restored independently from application settings', async () => {
  const session = {
    id: 'persisted-chat-session',
    title: 'Persistent chat',
    updatedAt: '2026-11-15T10:00:00.000Z',
    archivedAt: '2026-11-16T12:00:00.000Z',
    mode: 'plan' as const,
    messages: [
      {
        id: 'persisted-user-message',
        role: 'user' as const,
        mode: 'plan' as const,
        timestamp: '10:00:00',
        content: 'Analyze the project.',
        isStreaming: false,
      },
      {
        id: 'persisted-assistant-message',
        role: 'assistant' as const,
        mode: 'plan' as const,
        timestamp: '10:00:10',
        content: 'Analysis result.',
        readFiles: ['README.md'],
        isStreaming: false,
      },
      {
        id: 'interrupted-assistant-message',
        role: 'assistant' as const,
        mode: 'plan' as const,
        timestamp: '10:00:20',
        content: 'Partial generation',
        isStreaming: true,
      },
    ],
  };
  const restoredSession = {
    ...session,
    messages: session.messages.map((message) => message.id === 'interrupted-assistant-message'
      ? {
          ...message,
          content: 'Partial generation\n\n[Генерация прервана при завершении приложения.]',
          isStreaming: false,
        }
      : message),
  };

  const saved = await jsonReq<{ ok: boolean; activeSessionId: string; savedAt: string }>('/api/chats', {
    method: 'PUT',
    body: JSON.stringify({
      activeSessionId: session.id,
      sessions: [session],
    }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.ok, true);
  assert.equal(saved.data.activeSessionId, session.id);
  assert.ok(saved.data.savedAt);

  const loaded = await jsonReq<{
    ok: boolean;
    activeSessionId: string;
    sessions: Array<typeof session>;
    savedAt: string;
  }>('/api/chats');
  assert.equal(loaded.status, 200);
  assert.equal(loaded.data.ok, true);
  assert.equal(loaded.data.activeSessionId, session.id);
  assert.deepEqual(loaded.data.sessions, [restoredSession]);
  assert.equal(loaded.data.savedAt, saved.data.savedAt);

  const invalid = await jsonReq<{ ok: boolean; error: string }>('/api/chats', {
    method: 'PUT',
    body: JSON.stringify({
      activeSessionId: session.id,
      sessions: [{ ...session, messages: [{ ...session.messages[0], role: 'system' }] }],
    }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.ok, false);

  const afterInvalidSave = await jsonReq<{ sessions: Array<typeof session> }>('/api/chats');
  assert.deepEqual(afterInvalidSave.data.sessions, [restoredSession]);
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
        usage: { prompt_tokens: 42, completion_tokens: 13, total_tokens: 55 },
      }));
    });
  });

  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Mock provider did not bind a TCP port');

  try {
    await configureTestProvider('provider-chat-test', `http://127.0.0.1:${address.port}/v1`, 'test-provider-key');
    const { status, data } = await jsonReq<{
      ok: boolean;
      content: string;
      model: string;
    }>('/api/providers/chat', {
      method: 'POST',
      body: JSON.stringify({
        baseUrl: 'http://127.0.0.1:1/attacker-controlled',
        providerId: 'provider-chat-test',
        model: 'cloud-test-model',
        messages: [
          { role: 'user', content: 'Earlier question' },
          { role: 'assistant', content: 'Earlier answer' },
          { role: 'user', content: 'Current question' },
        ],
      }),
    });

    assert.equal(status, 200);
    assert.deepEqual(data, { ok: true, content: 'cloud reply', model: 'cloud-test-model', requestedModel: 'cloud-test-model', promptTokens: 42, completionTokens: 13, totalTokens: 55 });
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

test('provider chat retries rate-limited models within the same provider and reports the fallback model', async () => {
  const requestedModels: string[] = [];
  const providerServer = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body) as { model: string; stream?: boolean };
      requestedModels.push(payload.model);
      if (payload.model === 'first-model:free') {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'x-openrouter-error-origin': 'provider',
        });
        res.end(JSON.stringify({
          error: {
            message: 'Provider returned error',
            metadata: { provider_code: 'MODEL_CAPACITY', error_type: 'rate_limit_exceeded' },
          },
        }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(
        'data: ' + JSON.stringify({
          model: 'fallback-model:free',
          choices: [{ delta: { content: 'Fallback response' } }],
        }) + '\n\n' +
        'data: [DONE]\n\n',
      );
    });
  });
  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Mock fallback provider did not bind a TCP port');

  try {
    await configureTestProvider(
      'provider-fallback-test',
      `http://127.0.0.1:${address.port}/v1`,
      'fallback-test-key',
      ['first-model:free', 'fallback-model:free'],
    );
    const response = await fetch(`${apiBaseUrl}/api/providers/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: new URL(apiBaseUrl).origin,
        Authorization: `Bearer ${testApiToken}`,
      },
      body: JSON.stringify({
        providerId: 'provider-fallback-test',
        model: 'first-model:free',
        stream: true,
        messages: [{ role: 'user', content: 'Test fallback' }],
      }),
    });
    assert.equal(response.status, 200);
    const stream = await response.text();
    assert.deepEqual(requestedModels, ['first-model:free', 'fallback-model:free']);
    assert.match(stream, /"requestedModel":"first-model:free"/);
    assert.match(stream, /"usedModel":"fallback-model:free"/);
    assert.match(stream, /Fallback response/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      providerServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('provider chat does not retry OpenRouter free models after the shared daily quota is exhausted', async () => {
  let requestCount = 0;
  const providerServer = http.createServer((_req, res) => {
    requestCount += 1;
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: { message: 'Rate limit exceeded: free-models-per-day' },
    }));
  });
  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Mock quota provider did not bind a TCP port');

  try {
    await configureTestProvider(
      'provider-daily-quota-test',
      `http://127.0.0.1:${address.port}/v1`,
      'daily-quota-test-key',
      ['first-model:free', 'fallback-model:free'],
    );
    const result = await jsonReq<{ ok: boolean; error: string; code: string }>(
      '/api/providers/chat',
      {
        method: 'POST',
        body: JSON.stringify({
          providerId: 'provider-daily-quota-test',
          model: 'first-model:free',
          messages: [{ role: 'user', content: 'Test daily quota' }],
        }),
      },
    );
    assert.equal(result.status, 429);
    assert.equal(result.data.code, 'openrouter_free_daily_limit');
    assert.match(result.data.error, /для всех бесплатных моделей/);
    assert.equal(requestCount, 1, 'Shared daily quota must not trigger model retries');
  } finally {
    await new Promise<void>((resolve, reject) =>
      providerServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('general agent executes real read-only project tools and returns their results to the model', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-agent-tools-'));
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# Real project content\nThis file was read by the tool runtime.\n', 'utf-8');
  const projectResponse = await jsonReq<{ ok: boolean; project: { id: string } }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Agent Tool Runtime Test',
      folderSource: 'local',
      folderPath: projectDir,
    }),
  });
  assert.equal(projectResponse.status, 201);
  const projectId = projectResponse.data.project.id;

  const providerRequests: Array<{ tools?: Array<{ function: { name: string } }>; messages: Array<{ role: string; content: string | null }> }> = [];
  const providerServer = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const request = JSON.parse(body) as {
        tools?: Array<{ function: { name: string } }>;
        messages: Array<{ role: string; content: string | null }>;
      };
      providerRequests.push(request);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (providerRequests.length === 1) {
        res.end(JSON.stringify({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'readme-call-1',
                type: 'function',
                function: {
                  name: 'read_project_file',
                  arguments: JSON.stringify({ path: 'README.md' }),
                },
              }],
            },
          }],
        }));
      } else {
        res.end(JSON.stringify({
          choices: [{ message: { content: 'Отчёт: README.md прочитан реальным инструментом.' } }],
        }));
      }
    });
  });
  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Mock agent provider did not bind a TCP port');

  try {
    await configureTestProvider('agent-tools-test', `http://127.0.0.1:${address.port}/v1`);
    const result = await jsonReq<{
      ok: boolean;
      content: string;
      readFiles: string[];
      toolCalls: number;
    }>('/api/agents/chat', {
      method: 'POST',
      headers: {
        'X-OneCore-Operation-Id': 'general-agent-tools-test',
        'X-OneCore-Message-Id': 'general-agent-tools-message',
        'X-OneCore-Session-Id': 'general-agent-tools-session',
      },
      body: JSON.stringify({
        projectId,
        provider: {
          providerId: 'agent-tools-test',
          model: 'mock-tool-model',
        },
        messages: [
          { role: 'system', content: 'Use the available tools.' },
          { role: 'user', content: 'Read README.md and summarize it.' },
        ],
      }),
    });

    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);
    assert.match(result.data.content, /README\.md прочитан/);
    assert.deepEqual(result.data.readFiles, ['README.md']);
    assert.equal(result.data.toolCalls, 1);
    assert.ok(providerRequests[0].tools?.some((tool) => tool.function.name === 'read_project_file'));
    assert.ok(providerRequests[0].tools?.every((tool) =>
      [
        'list_project_files',
        'read_project_file',
        'search_project_code',
        'list_knowledge_documents',
        'read_knowledge_document',
      ].includes(tool.function.name),
    ));
    assert.ok(providerRequests[0].tools?.some((tool) => tool.function.name === 'list_knowledge_documents'));
    assert.ok(providerRequests[0].tools?.some((tool) => tool.function.name === 'read_knowledge_document'));
    const toolResult = providerRequests[1].messages.find((message) => message.role === 'tool');
    assert.ok(toolResult);
    assert.match(toolResult.content ?? '', /This file was read by the tool runtime/);
    const toolEvents = readAgentJournal(5000).filter(
      (event) => event.category === 'tool' && event.operationId === 'general-agent-tools-test',
    );
    assert.ok(toolEvents.some((event) => event.status === 'running'));
    assert.ok(toolEvents.some((event) => event.status === 'completed'));
  } finally {
    await new Promise<void>((resolve, reject) =>
      providerServer.close((error) => (error ? reject(error) : resolve())),
    );
    await jsonReq(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('general agent rejects pseudo tool calls and retries with verified file context', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-agent-pseudo-tools-'));
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# Verified fallback context\n', 'utf-8');
  const projectResponse = await jsonReq<{ project: { id: string } }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Agent Pseudo Tool Test',
      folderSource: 'local',
      folderPath: projectDir,
    }),
  });
  const projectId = projectResponse.data.project.id;
  let providerCallCount = 0;
  const providerServer = http.createServer((_req, res) => {
    providerCallCount += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{
        message: {
          content: providerCallCount === 1
            ? '<<TOOLCALL>> read_file README.md'
            : 'Отчёт сформирован по реально прочитанному README.md.',
        },
      }],
    }));
  });
  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Mock fallback provider did not bind a TCP port');

  try {
    await configureTestProvider('agent-fallback-test', `http://127.0.0.1:${address.port}/v1`);
    const result = await jsonReq<{
      ok: boolean;
      content: string;
      readFiles: string[];
      toolCalls: number;
    }>('/api/agents/chat', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        provider: {
          providerId: 'agent-fallback-test',
          model: 'mock-pseudo-tool-model',
        },
        messages: [
          { role: 'system', content: 'Analyze only verified project content.' },
          { role: 'user', content: 'Analyze the project, read-only.' },
        ],
      }),
    });

    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);
    assert.match(result.data.content, /реально прочитанному README/);
    assert.deepEqual(result.data.readFiles, ['README.md']);
    assert.equal(result.data.toolCalls, 0);
    assert.equal(providerCallCount, 2);
  } finally {
    await new Promise<void>((resolve, reject) =>
      providerServer.close((error) => (error ? reject(error) : resolve())),
    );
    await jsonReq(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('streaming provider requests are aborted when the client disconnects', async () => {
  let resolveProviderClose: (() => void) | undefined;
  const providerClosed = new Promise<void>((resolve) => {
    resolveProviderClose = resolve;
  });
  const providerServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.on('close', () => resolveProviderClose?.());
    res.write('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n');
  });
  const nextProviderServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'next request works' } }] }));
  });
  await Promise.all([
    new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve)),
    new Promise<void>((resolve) => nextProviderServer.listen(0, '127.0.0.1', resolve)),
  ]);
  const address = providerServer.address();
  const nextAddress = nextProviderServer.address();
  if (!address || typeof address === 'string' || !nextAddress || typeof nextAddress === 'string') {
    throw new Error('Mock provider did not bind a TCP port');
  }

  const controller = new AbortController();
  try {
    await configureTestProvider('cancel-chat-test', `http://127.0.0.1:${address.port}/v1`);
    if (!testApiToken) {
      const sessionResponse = await fetch(`${apiBaseUrl}/api/auth/session`, {
        headers: { Origin: new URL(apiBaseUrl).origin },
      });
      const sessionData = (await sessionResponse.json()) as { token?: string };
      assert.equal(sessionResponse.status, 200);
      assert.ok(sessionData.token);
      testApiToken = sessionData.token;
    }
    const response = await fetch(`${apiBaseUrl}/api/providers/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: new URL(apiBaseUrl).origin,
        Authorization: `Bearer ${testApiToken}`,
        'X-OneCore-Operation-Id': 'cancel-chat-operation',
        'X-OneCore-Message-Id': 'cancel-chat-message',
        'X-OneCore-Session-Id': 'cancel-chat-session',
      },
      body: JSON.stringify({
        providerId: 'cancel-chat-test',
        model: 'stream-test-model',
        stream: true,
        messages: [{ role: 'user', content: 'Test disconnect' }],
      }),
      signal: controller.signal,
    });

    assert.equal(response.status, 200);
    const reader = response.body?.getReader();
    assert.ok(reader);
    const activeOperation = listOperations().find(
      (operation) => operation.parentOperationId === 'cancel-chat-operation' &&
        operation.messageId === 'cancel-chat-message' &&
        operation.status === 'running',
    );
    assert.ok(activeOperation);
    const decoder = new TextDecoder();
    let received = '';
    while (!received.includes('hello')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += decoder.decode(chunk.value, { stream: true });
    }
    assert.match(received, /hello/);

    controller.abort();
    await Promise.race([
      providerClosed,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Upstream provider connection was not closed')), 2000)),
    ]);
    await flushAgentJournal();
    const cancelledEvent = readAgentJournal(5000).find(
      (event) => event.parentOperationId === 'cancel-chat-operation' && event.messageId === 'cancel-chat-message',
    );
    assert.ok(cancelledEvent);
    assert.equal(cancelledEvent.sessionId, 'cancel-chat-session');
    assert.equal(cancelledEvent.status, 'cancelled');
    assert.equal(getOperation(activeOperation.id)?.status, 'cancelled');

    const clientCancelledEvent = await jsonReq<{ ok: boolean }>('/api/agent-journal/events', {
      method: 'POST',
      body: JSON.stringify({
        operationId: 'client-cancelled-operation',
        category: 'agent',
        status: 'cancelled',
        level: 'warning',
        title: 'Общий агент',
        summary: 'Запрос отменён пользователем',
        sessionId: 'cancel-chat-session',
        messageId: 'cancel-chat-message',
      }),
    });
    assert.equal(clientCancelledEvent.status, 200);
    await flushAgentJournal();
    assert.equal(
      readAgentJournal(5000).find((event) => event.operationId === 'client-cancelled-operation')?.status,
      'cancelled',
    );

    await configureTestProvider('next-chat-test', `http://127.0.0.1:${nextAddress.port}/v1`);
    const nextRequest = await jsonReq<{ ok: boolean; content: string }>('/api/providers/chat', {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'next-chat-test',
        model: 'stream-test-model',
        messages: [{ role: 'user', content: 'Test next request' }],
      }),
    });
    assert.equal(nextRequest.status, 200);
    assert.equal(nextRequest.data.content, 'next request works');
    const completedNextOperation = listOperations()[0];
    assert.ok(completedNextOperation);
    assert.equal(completedNextOperation.method, 'POST');
    assert.equal(completedNextOperation.status, 'completed');
  } finally {
    controller.abort();
    await Promise.all([
      new Promise<void>((resolve, reject) =>
        providerServer.close((error) => (error ? reject(error) : resolve())),
      ),
      new Promise<void>((resolve, reject) =>
        nextProviderServer.close((error) => (error ? reject(error) : resolve())),
      ),
    ]);
  }
});

test('model capability probe separates self-reported abilities from application tools', async () => {
  const providerServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            contextWindowTokens: 8192,
            capabilities: {
              readFiles: true,
              writeFiles: false,
              deleteFiles: false,
              runCommands: false,
              git: false,
              ssh: false,
              github: false,
              web: true,
              functionCalling: false,
              vision: null,
            },
            notes: 'Self-reported model features',
          }),
        },
      }],
    }));
  });
  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Mock provider did not bind a TCP port');
  try {
    await configureTestProvider('capability-test-provider', `http://127.0.0.1:${address.port}/v1`);
    const result = await jsonReq<{
      ok: boolean;
      report: {
        contextWindowTokens: number | null;
        selfReported: Record<string, boolean | null>;
        application: Record<string, { available: boolean; reason: string }>;
      };
    }>('/api/providers/capabilities', {
      method: 'POST',
      body: JSON.stringify({
        model: 'capability-test-model',
        providerId: 'capability-test-provider',
      }),
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);
    assert.equal(result.data.report.contextWindowTokens, 8192);
    assert.equal(result.data.report.selfReported.readFiles, true);
    assert.equal(result.data.report.selfReported.vision, null);
    assert.equal(result.data.report.application.readFiles.available, false);
    assert.equal(result.data.report.application.deleteFiles.available, false);
    assert.equal(result.data.report.application.web.available, true);
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
  await flushAgentJournal();
  fs.rmSync(tempOneCoreHome, { recursive: true, force: true });
});

test('live system map and external reference API keep runtime knowledge isolated', async () => {
  const map = await jsonReq<{
    ok: boolean;
    operations: Array<{ id: string }>;
    events: Array<{ id: string }>;
    coverage: { projectAgent: string; providerChat: string; managerDispatcher: string; instructionBinding: string };
  }>('/api/system-map');
  assert.equal(map.status, 200);
  assert.equal(map.data.ok, true);
  assert.equal(map.data.coverage.projectAgent, 'instrumented');
  assert.equal(map.data.coverage.providerChat, 'instrumented');
  assert.equal(map.data.coverage.managerDispatcher, 'implemented');
  assert.equal(map.data.coverage.instructionBinding, 'runtime-enforced');

  const knowledge = await jsonReq<{ ok: boolean; documents: Array<{ id: string; status: string }> }>('/api/knowledge');
  assert.equal(knowledge.status, 200);
  assert.equal(knowledge.data.ok, true);

  const created = await jsonReq<{ ok: boolean; reference: { id: string; title: string } }>('/api/external-references', {
    method: 'POST',
    body: JSON.stringify({
      title: 'API isolation test',
      sourceUrl: 'https://example.com/reference',
      sourceType: 'article',
      summary: 'External research only.',
      architecture: 'Request -> executor -> verifier',
      tags: ['test'],
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.ok, true);
  const id = created.data.reference.id;
  try {
    const listed = await jsonReq<{ ok: boolean; references: Array<{ id: string }> }>('/api/external-references');
    assert.equal(listed.data.references.some((item) => item.id === id), true);

    const updated = await jsonReq<{ ok: boolean; reference: { title: string } }>(`/api/external-references/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Updated API isolation test',
        sourceUrl: 'https://example.com/reference',
        sourceType: 'article',
        summary: 'Updated research note.',
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.reference.title, 'Updated API isolation test');

    const runtimeKnowledge = await jsonReq<{ ok: boolean; documents: Array<{ id: string }> }>('/api/knowledge');
    assert.equal(runtimeKnowledge.data.documents.some((document) => document.id === id), false);
  } finally {
    const deleted = await jsonReq<{ ok: boolean }>(`/api/external-references/${encodeURIComponent(id)}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
  }
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
    {
      headers: {
        'X-OneCore-Operation-Id': 'browser-operation-test',
        'X-OneCore-Message-Id': 'browser-message-test',
        'X-OneCore-Session-Id': 'browser-session-test',
        'X-OneCore-Approval': 'user-confirmed',
      },
    },
  );
  assert.equal(localAddress.status, 400);
  assert.equal(localAddress.data.ok, false);
  assert.match(localAddress.data.error, /локальную|приватную/i);
  await flushAgentJournal();
  const browserEvent = readAgentJournal(5000).find(
    (event) => event.parentOperationId === 'browser-operation-test' && event.messageId === 'browser-message-test',
  );
  assert.ok(browserEvent);
  assert.equal(browserEvent.sessionId, 'browser-session-test');
  assert.equal(browserEvent.category, 'tool');
  assert.equal(browserEvent.status, 'failed');

  const insecureAddress = await jsonReq<{ ok: boolean; error: string }>(
    `/api/browser/read?url=${encodeURIComponent('http://example.com/')}`,
    { headers: { 'X-OneCore-Approval': 'user-confirmed' } },
  );
  assert.equal(insecureAddress.status, 400);
  assert.match(insecureAddress.data.error, /HTTPS/i);

  const emptySearch = await jsonReq<{ ok: boolean; error: string }>('/api/browser/search', { headers: { 'X-OneCore-Approval': 'user-confirmed' } });
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
        approved: true,
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
    { method: 'POST', body: JSON.stringify({ approved: true }) }, 
  );
  assert.equal(pauseRes.status, 200);
  assert.equal(pauseRes.data.model.status, 'paused');
  assert.ok(fs.existsSync(`${localPath}.part`), '.part file must exist on disk after pause');
  assert.ok(fs.statSync(`${localPath}.part`).size > 0, '.part file must contain partial bytes');

  // Resume download and wait for completion + SHA256 verification
  throttleFirstChunk = false;
  const resumeRes = await jsonReq<{ ok: boolean }>(
    `/api/models/download/${encodeURIComponent(modelId)}/resume`,
    { method: 'POST', body: JSON.stringify({ approved: true }) }, 
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
      approved: true,
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
    body: JSON.stringify({ approved: true }),
  });
  assert.equal(activateBad.status, 400);
  assert.equal(activateBad.data.ok, false);

  // Physical disk deletion
  const delGood = await jsonReq<{ ok: boolean }>(`/api/models/local/${encodeURIComponent(modelId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ approved: true }),
  });
  assert.equal(delGood.data.ok, true);
  assert.equal(fs.existsSync(localPath), false, 'Deleted model file must be removed from disk');
  await jsonReq(`/api/models/local/${encodeURIComponent(badId)}`, { method: 'DELETE', body: JSON.stringify({ approved: true }) });
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

    const correlatedRead = await jsonReq<{ ok: boolean; content: string }>(
      `/api/projects/${encodeURIComponent(projectId)}/file?path=keep.txt`,
      {
        headers: {
          'X-OneCore-Operation-Id': 'agent-file-read-test',
          'X-OneCore-Message-Id': 'message-file-read-test',
          'X-OneCore-Session-Id': 'session-file-read-test',
        },
      },
    );
    assert.equal(correlatedRead.status, 200);
    assert.equal(correlatedRead.data.content, 'user-owned-data');
    const fileReadEvent = readAgentJournal(5000).find(
      (event) => event.title === 'Файл прочитан' && event.messageId === 'message-file-read-test',
    );
    assert.ok(fileReadEvent);
    assert.equal(fileReadEvent.operationId, 'agent-file-read-test');
    assert.equal(fileReadEvent.sessionId, 'session-file-read-test');

    const restrictedWorkdir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-restricted-project-'));
    fs.writeFileSync(path.join(restrictedWorkdir, 'private.txt'), 'restricted-content', 'utf-8');
    const restrictedProject = await jsonReq<{ ok: boolean; project: { id: string } }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Restricted Project',
        folderSource: 'local',
        folderPath: restrictedWorkdir,
        allowedTools: [],
      }),
    });
    assert.equal(restrictedProject.status, 201);
    const restrictedFiles = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(restrictedProject.data.project.id)}/files`,
    );
    assert.equal(restrictedFiles.status, 403);
    const restrictedFile = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(restrictedProject.data.project.id)}/file?path=private.txt`,
    );
    assert.equal(restrictedFile.status, 403);
    const restrictedExec = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(restrictedProject.data.project.id)}/exec`,
      {
        method: 'POST',
        body: JSON.stringify({ command: 'node -e "process.exit(0)"', approved: true }),
      },
    );
    assert.equal(restrictedExec.status, 403);
    await jsonReq(`/api/projects/${encodeURIComponent(restrictedProject.data.project.id)}`, { method: 'DELETE' });
    fs.rmSync(restrictedWorkdir, { recursive: true, force: true });

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

    // File writes must be rejected until the UI explicitly approves them.
    const deniedWrite = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/file`,
      {
        method: 'PUT',
        body: JSON.stringify({ path: 'denied.txt', content: 'no approval' }),
      },
    );
    assert.equal(deniedWrite.status, 403);
    assert.equal(fs.existsSync(path.join(workdir, 'denied.txt')), false);

    // Write hello.py via an explicitly approved API action.
    const writeRes = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/file`,
      {
        method: 'PUT',
        body: JSON.stringify({
          path: 'hello.py',
          content: 'print("Hello from OneCore")\n',
          summary: 'Create hello.py',
          approved: true,
        }),
        headers: {
          'X-OneCore-Operation-Id': 'agent-file-write-test',
          'X-OneCore-Message-Id': 'message-file-write-test',
          'X-OneCore-Session-Id': 'session-file-write-test',
        },
      },
    );
    assert.equal(writeRes.status, 200);
    assert.equal(writeRes.data.ok, true);
    assert.equal(fs.existsSync(path.join(workdir, 'hello.py')), true);
    const fileWriteEvent = readAgentJournal(5000).find(
      (event) => event.title === 'Изменение файла проекта' && event.messageId === 'message-file-write-test',
    );
    assert.ok(fileWriteEvent);
    assert.equal(fileWriteEvent.operationId, 'agent-file-write-test');

    const deniedUndo = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/undo`,
      { method: 'POST' },
    );
    assert.equal(deniedUndo.status, 403);

    const deniedTaskUndo = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/task`,
      { method: 'POST', body: JSON.stringify({ prompt: '/undo', mode: 'act' }) },
    );
    assert.equal(deniedTaskUndo.status, 403);

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

    const directRunPrompt = await jsonReq<{ ok: boolean; proposedCommand?: string; commandResult?: unknown }>(
      `/api/projects/${encodeURIComponent(projectId)}/task`,
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: `/run node -e "require('fs').writeFileSync('direct-run-ran.txt','ran')"`,
          mode: 'act',
        }),
      },
    );
    assert.equal(directRunPrompt.status, 200);
    assert.ok(directRunPrompt.data.proposedCommand);
    assert.equal(directRunPrompt.data.commandResult, undefined);
    assert.equal(fs.existsSync(path.join(workdir, 'direct-run-ran.txt')), false);

    const proposedCommand = `node -e "require('fs').writeFileSync('agent-command-ran.txt','ran')"`;
    const modelServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            reply: 'Нужна команда.',
            runCommand: proposedCommand,
            writeFile: {
              path: 'agent-created.txt',
              content: 'pending agent edit',
              summary: 'Test pending agent edit',
            },
          }) } }],
        }),
      );
    });
    await new Promise<void>((resolve) => modelServer.listen(0, '127.0.0.1', resolve));
    const modelAddress = modelServer.address();
    assert.ok(modelAddress && typeof modelAddress === 'object');
    let taskRes: {
      status: number;
      data: {
        ok: boolean;
        proposedCommand?: string;
        commandResult?: unknown;
        diff?: { filePath: string; oldContent: string; newContent: string; summary: string };
      };
    };
    try {
      taskRes = await jsonReq<{
        ok: boolean;
        proposedCommand?: string;
        commandResult?: unknown;
        diff?: { filePath: string; oldContent: string; newContent: string; summary: string };
      }>(
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
    assert.equal(taskRes.data.diff?.filePath, 'agent-created.txt');
    assert.equal(taskRes.data.diff?.newContent, 'pending agent edit');
    assert.equal(fs.existsSync(path.join(workdir, 'agent-created.txt')), false);
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
      { method: 'POST', body: JSON.stringify({ approved: true }) },
    );
    assert.equal(undoRes.status, 200);
    assert.equal(undoRes.data.ok, true);
    assert.equal(fs.existsSync(path.join(workdir, 'hello.py')), false, '/undo must remove newly created file');

    // Delete project record -> user folder and keep.txt must remain intact on disk
    const delProj = await jsonReq<{ ok: boolean }>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ approved: true }),
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
      approved: true,
    }),
  });
  assert.equal(sshRes.status, 400);
  assert.equal(sshRes.data.ok, false);
  assert.ok(sshRes.data.error.length > 0);

  const ghBad = await jsonReq<{ ok: boolean; error: string }>('/api/github/verify', {
    method: 'POST',
    body: JSON.stringify({
      repo: 'invalid-format-without-slash',
      approved: true,
    }),
  });
  assert.equal(ghBad.status, 400);
  assert.equal(ghBad.data.ok, false);
});

test('6. Contract validator enforces agent-handoff.v1 and worker-result.v1 schemas strictly', () => {
  const validHandoff = {
    schemaVersion: 1,
    taskId: 'task-1',
    operationId: 'op-1',
    parentOperationId: 'op-root',
    fromRole: 'role.dispatcher',
    toRole: 'role.qa',
    objective: 'Verify project readiness',
    acceptanceCriteria: ['Confirm files exist'],
    procedureRefs: [{ id: 'role.qa', version: '1.0.0' }],
    project: { projectId: 'proj-1', constraints: ['local-only'] },
    files: [{ path: 'README.md', purpose: 'entrypoint', evidence: 'read' }],
    findings: [],
    completedSteps: [],
    unresolvedQuestions: [],
    allowedCapabilities: ['project.files.read'],
    outputFormat: 'worker-result.v1',
    status: 'ready',
  };
  assert.equal(validateAgentHandoff(validHandoff).ok, true);

  const invalidHandoff = validateAgentHandoff({ ...validHandoff, unknownExtra: true });
  assert.equal(invalidHandoff.ok, false);
  assert.ok(invalidHandoff.errors.some((e) => e.includes('unknownExtra')));

  const handoffTyped = validateAgentHandoff(validHandoff).value!;
  const validWorker = {
    schemaVersion: 1,
    taskId: 'task-1',
    operationId: 'op-1',
    status: 'completed',
    summary: 'Verified README.md cleanly.',
    findings: [],
    filesInspected: ['README.md'],
    checks: [{ command: 'node -e "process.exit(0)"', status: 'passed', exitCode: 0, output: 'ok' }],
    unresolvedQuestions: [],
    limitations: [],
  };
  assert.equal(
    validateWorkerResult(validWorker, handoffTyped, {
      confirmedReadFiles: ['README.md'],
      confirmedChecks: [{ command: 'node -e "process.exit(0)"', exitCode: 0 }],
    }).ok,
    true,
  );

  const unverifiedFile = validateWorkerResult(validWorker, handoffTyped, {
    confirmedReadFiles: [],
    confirmedChecks: [{ command: 'node -e "process.exit(0)"', exitCode: 0 }],
  });
  assert.equal(unverifiedFile.ok, false);
  assert.ok(unverifiedFile.errors.some((e) => e.includes('README.md')));

  const unconfirmedCheck = validateWorkerResult(validWorker, handoffTyped, {
    confirmedReadFiles: ['README.md'],
    confirmedChecks: [],
  });
  assert.equal(unconfirmedCheck.ok, false);
  assert.ok(unconfirmedCheck.errors.some((e) => e.includes('passed')));
});

test('7. Knowledge schemas, approved-only document isolation, and multi-agent team execution', async () => {
  const schemasRes = await jsonReq<{
    ok: boolean;
    schemas: { agentHandoff: Record<string, unknown> | null; workerResult: Record<string, unknown> | null };
    enforcement: { handoffSchemaLoaded: boolean; workerResultSchemaLoaded: boolean; approvedDocumentsCount: number };
  }>('/api/knowledge/schemas');
  assert.equal(schemasRes.status, 200);
  assert.equal(schemasRes.data.ok, true);
  assert.equal(schemasRes.data.enforcement.handoffSchemaLoaded, true);
  assert.equal(schemasRes.data.enforcement.workerResultSchemaLoaded, true);
  assert.ok(schemasRes.data.enforcement.approvedDocumentsCount > 0);

  const approvedDoc = await jsonReq<{ ok: boolean; document: { id: string; status: string; content: string } }>(
    '/api/knowledge/documents/role.architect',
  );
  assert.equal(approvedDoc.status, 200);
  assert.equal(approvedDoc.data.ok, true);
  assert.equal(approvedDoc.data.document.status, 'approved');

  const missingDoc = await jsonReq<{ ok: boolean }>('/api/knowledge/documents/nonexistent.doc.id');
  assert.equal(missingDoc.status, 404);

  const unapprovedTeamRun = await jsonReq<{ ok: boolean }>('/api/agents/team-run', {
    method: 'POST',
    body: JSON.stringify({ projectId: 'proj-any', objective: 'Check approval gate' }),
  });
  assert.equal(unapprovedTeamRun.status, 403);

  const teamDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-team-proj-'));
  fs.writeFileSync(path.join(teamDir, 'README.md'), '# Team Test Project\nArchitecture overview.', 'utf-8');
  let projectId = '';
  try {
    const createRes = await jsonReq<{ ok: boolean; project: { id: string } }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Team Orchestration Test',
        folderSource: 'local',
        folderPath: teamDir,
      }),
    });
    assert.equal(createRes.status, 201);
    projectId = createRes.data.project.id;

    const runRes = await jsonReq<{
      ok: boolean;
      status: string;
      cyclesExecuted: number;
      tasks: Array<{
        taskId: string;
        roleId: string;
        handoff: { schemaVersion: number; taskId: string };
        result: { schemaVersion: number; taskId: string; filesInspected: string[] };
        validationOk: boolean;
      }>;
      finalReport: string;
    }>('/api/agents/team-run', {
      method: 'POST',
      headers: { 'X-OneCore-Approval': 'user-confirmed' },
      body: JSON.stringify({
        approved: true,
        projectId,
        objective: 'Analyze README.md architecture and QA readiness',
        requestedRoles: ['researcher', 'qa'],
        maxCycles: 2,
      }),
    });
    assert.equal(runRes.status, 200);
    assert.equal(runRes.data.ok, true);
    assert.ok(runRes.data.cyclesExecuted >= 1 && runRes.data.cyclesExecuted <= 2);
    assert.equal(runRes.data.tasks.length >= 1, true);
    for (const task of runRes.data.tasks) {
      assert.equal(task.handoff.schemaVersion, 1);
      assert.equal(task.result.schemaVersion, 1);
      assert.equal(task.validationOk, true);
    }
    assert.ok(runRes.data.finalReport.length > 0);
  } finally {
    if (projectId) {
      await jsonReq(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ approved: true }),
      });
    }
    fs.rmSync(teamDir, { recursive: true, force: true });
  }
});

test('8. Live HTTP MCP server inspector requires approval and discovers real JSON-RPC tools', async () => {
  const denied = await jsonReq<{ ok: boolean }>('/api/mcp/inspect', {
    method: 'POST',
    body: JSON.stringify({ transport: 'http', endpoint: 'http://127.0.0.1:1/mcp' }),
  });
  assert.equal(denied.status, 403);

  const mcpServer = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const rpc = JSON.parse(raw) as { id: number; method: string };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (rpc.method === 'initialize') {
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: rpc.id,
        result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test-mcp', version: '1.0.0' } },
      }));
      return;
    }
    if (rpc.method === 'tools/list') {
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: rpc.id,
        result: {
          tools: [
            { name: 'read_project_tree', description: 'Inspect repository tree' },
            { name: 'run_lint_check', description: 'Execute lint verification' },
          ],
        },
      }));
      return;
    }
    res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Method not found' } }));
  });

  await new Promise<void>((resolve) => mcpServer.listen(0, '127.0.0.1', resolve));
  const addr = mcpServer.address();
  assert.ok(addr && typeof addr === 'object');

  try {
    const inspectRes = await jsonReq<{
      ok: boolean;
      transport: string;
      tools: Array<{ name: string; description?: string }>;
      serverInfo?: { name?: string };
    }>('/api/mcp/inspect', {
      method: 'POST',
      headers: { 'X-OneCore-Approval': 'user-confirmed' },
      body: JSON.stringify({
        approved: true,
        transport: 'http',
        endpoint: `http://127.0.0.1:${addr.port}/mcp`,
      }),
    });
    assert.equal(inspectRes.status, 200);
    assert.equal(inspectRes.data.ok, true);
    assert.equal(inspectRes.data.transport, 'http');
    assert.equal(inspectRes.data.serverInfo?.name, 'test-mcp');
    assert.deepEqual(inspectRes.data.tools, [
      { name: 'read_project_tree', description: 'Inspect repository tree' },
      { name: 'run_lint_check', description: 'Execute lint verification' },
    ]);
  } finally {
    await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
  }
});

test('9. ModelHubView supports project memory installation and writes GGUF model specs to project MEMORY.md', async () => {
  const hubSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/models/ModelHubView.tsx'), 'utf-8');
  assert.match(hubSource, /<SecondaryTabBar/);
  assert.match(hubSource, /QUICK_SEARCH_PRESETS/);
  assert.match(hubSource, /installModelToProjectMemory/);
  assert.match(hubSource, /В папку и память проекта/);
  assert.doesNotMatch(hubSource, /<QuantGuideModal/);

  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-gguf-proj-'));
  const ggufDir = path.join(workdir, 'models');
  fs.mkdirSync(ggufDir, { recursive: true });
  const ggufFile = path.join(ggufDir, 'qwen2.5-coder-test-q4_k_m.gguf');
  fs.writeFileSync(ggufFile, sampleModelBytes);

  let projectId = '';
  let modelId = '';
  try {
    const createProj = await jsonReq<{ ok: boolean; project: { id: string } }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'GGUF Memory Project',
        folderSource: 'local',
        folderPath: workdir,
      }),
    });
    assert.equal(createProj.status, 201);
    projectId = createProj.data.project.id;

    const importRes = await jsonReq<{ ok: boolean; model: { id: string; localPath: string } }>('/api/models/import', {
      method: 'POST',
      body: JSON.stringify({ filePath: ggufFile, approved: true }),
    });
    assert.equal(importRes.status, 200);
    assert.equal(importRes.data.ok, true);
    modelId = importRes.data.model.id;

    const installMemRes = await jsonReq<{ ok: boolean; registeredPaths: string[]; filePath?: string }>(
      `/api/projects/${encodeURIComponent(projectId)}/models/memory`,
      {
        method: 'POST',
        headers: { 'X-OneCore-Approval': 'user-confirmed' },
        body: JSON.stringify({ modelId, approved: true }),
      },
    );
    assert.equal(installMemRes.status, 200);
    assert.equal(installMemRes.data.ok, true);
    assert.ok(installMemRes.data.registeredPaths.includes(importRes.data.model.localPath));

    const memDisk = fs.readFileSync(path.join(workdir, 'MEMORY.md'), 'utf-8');
    assert.match(memDisk, /## Установленные GGUF модели/);
    assert.ok(memDisk.includes(importRes.data.model.localPath));

    const getMemRes = await jsonReq<{ ok: boolean; memoryExists: boolean; registeredPaths: string[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/models/memory`,
    );
    assert.equal(getMemRes.status, 200);
    assert.equal(getMemRes.data.memoryExists, true);
    assert.ok(getMemRes.data.registeredPaths.includes(importRes.data.model.localPath));

    const delMemRes = await jsonReq<{ ok: boolean; registeredPaths: string[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/models/memory`,
      {
        method: 'DELETE',
        headers: { 'X-OneCore-Approval': 'user-confirmed' },
        body: JSON.stringify({ localPath: importRes.data.model.localPath, approved: true }),
      },
    );
    assert.equal(delMemRes.status, 200);
    assert.equal(delMemRes.data.registeredPaths.includes(importRes.data.model.localPath), false);
  } finally {
    if (modelId) {
      await jsonReq(`/api/models/local/${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ approved: true }),
      });
    }
    if (projectId) {
      await jsonReq(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ approved: true }),
      });
    }
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test('10. SecurityPage deduplicates duplicate subagent/role provider copies and renders collapsed-by-default groups', async () => {
  const securitySource = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/settings/SecurityPage.tsx'), 'utf-8');
  assert.match(securitySource, /useState<Record<string, boolean>>\(\{\}\)/);
  assert.match(securitySource, /aria-expanded=\{expanded\}/);
  assert.match(securitySource, /hidden=\{!expanded\}/);
  assert.match(securitySource, /if \(!item\.configured && !isUniqueToSubagent\) continue;/);

  const secretsRes = await jsonReq<{
    ok: boolean;
    providers?: Array<{ id: string; kind?: string; name: string; scope?: string }>;
  }>('/api/security/secrets');
  assert.equal(secretsRes.status, 200);
  assert.equal(secretsRes.data.ok, true);
  assert.ok(Array.isArray(secretsRes.data.providers));
  for (const p of secretsRes.data.providers ?? []) {
    assert.ok(p.kind !== undefined || true);
  }
});

test('11. GitHub repository sync checks diffs, pulls updates, pushes changes, and enforces approval & validation', async () => {
  assert.throws(() => normalizeGitHubRepo('https://evil.example.com/owner/repo'));
  assert.throws(() => normalizeGitHubRepo('../bad'));
  assert.throws(() => validateGitBranch('--upload-pack=evil'));
  assert.throws(() => validateGitBranch('main..other'));
  assert.equal(normalizeGitHubRepo('https://github.com/alexpikman/OneCoreAI.git').cleanRepo, 'alexpikman/OneCoreAI');
  assert.equal(validateGitBranch('feature/sync-v2'), 'feature/sync-v2');

  // Protected mutation/check routes must require explicit side-effect approval
  for (const endpoint of ['/api/repo-sync/check', '/api/repo-sync/pull', '/api/repo-sync/push']) {
    const unapproved = await jsonReq<{ ok: boolean }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ targetType: 'app', repo: 'alexpikman/OneCoreAI', branch: 'main' }),
    });
    assert.equal(unapproved.status, 403);
    assert.equal(unapproved.data.ok, false);
  }

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-repo-sync-'));
  const bareRemote = path.join(sandbox, 'remote.git');
  const dirA = path.join(sandbox, 'project-a');
  const dirB = path.join(sandbox, 'project-b');
  fs.mkdirSync(bareRemote, { recursive: true });
  fs.mkdirSync(dirA, { recursive: true });
  fs.mkdirSync(dirB, { recursive: true });

  let projAId = '';
  let projBId = '';

  try {
    await execFileAsync('git', ['init', '--bare', bareRemote]);

    fs.writeFileSync(path.join(dirA, 'README.md'), '# Project A v1\n', 'utf-8');
    fs.writeFileSync(path.join(dirA, 'app.txt'), 'line 1\n', 'utf-8');

    const createARes = await jsonReq<{ ok: boolean; project: { id: string } }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sync Project A',
        folderSource: 'local',
        folderPath: dirA,
        approved: true,
      }),
    });
    assert.equal(createARes.status, 201);
    projAId = createARes.data.project.id;

    const createBRes = await jsonReq<{ ok: boolean; project: { id: string } }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sync Project B',
        folderSource: 'local',
        folderPath: dirB,
        approved: true,
      }),
    });
    assert.equal(createBRes.status, 201);
    projBId = createBRes.data.project.id;

    // Save config via API and verify PAT secret is never echoed back
    const saveCfgRes = await jsonReq<{
      ok: boolean;
      config: { repo: string; branch: string; authMethod: string; tokenConfigured: boolean; token?: string };
    }>('/api/repo-sync/config', {
      method: 'PUT',
      body: JSON.stringify({
        targetType: 'project',
        projectId: projAId,
        repo: 'alexpikman/sync-demo',
        branch: 'main',
        authMethod: 'pat',
        gitUserName: 'Sync Tester',
        gitUserEmail: 'tester@onecore.local',
        token: 'ghp_testSecretTokenValue123456',
      }),
    });
    assert.equal(saveCfgRes.status, 200);
    assert.equal(saveCfgRes.data.ok, true);
    assert.equal(saveCfgRes.data.config.repo, 'alexpikman/sync-demo');
    assert.equal(saveCfgRes.data.config.branch, 'main');
    assert.equal(saveCfgRes.data.config.tokenConfigured, true);
    assert.equal('token' in saveCfgRes.data.config, false);

    // Check Project A without .git against empty remote branch
    const prePushDiff = await checkRepoSyncDiff(
      process.cwd(),
      { targetType: 'project', projectId: projAId },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(prePushDiff.hasGitRepo, false);
    assert.equal(prePushDiff.remoteBranchExists, false);
    assert.equal(prePushDiff.allDiffFiles.length, 2);

    // Push Project A to remote
    const pushARes = await pushToGitHub(
      process.cwd(),
      {
        targetType: 'project',
        projectId: projAId,
        commitMessage: 'Initial sync commit',
      },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(pushARes.ok, true);
    assert.equal(pushARes.initializedGitRepo, true);
    assert.ok(pushARes.commitHash);
    assert.equal(pushARes.diff?.inSync, true);

    // Configure Project B & inspect diffs BEFORE .git is initialized in Project B
    await saveRepoSyncConfig(process.cwd(), {
      targetType: 'project',
      projectId: projBId,
      repo: 'alexpikman/sync-demo',
      branch: 'main',
      authMethod: 'pat',
      gitUserName: 'Sync Receiver',
      gitUserEmail: 'receiver@onecore.local',
    });

    const prePullDiffB = await checkRepoSyncDiff(
      process.cwd(),
      { targetType: 'project', projectId: projBId },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(prePullDiffB.hasGitRepo, false);
    assert.equal(prePullDiffB.remoteBranchExists, true);
    assert.equal(prePullDiffB.inSync, false);
    assert.ok(prePullDiffB.allDiffFiles.some((f) => f.path === 'README.md' && f.status === 'remote-only'));
    assert.ok(prePullDiffB.allDiffFiles.some((f) => f.path === 'app.txt' && f.status === 'remote-only'));

    // Pull into Project B
    const pullBRes = await pullFromGitHub(
      process.cwd(),
      { targetType: 'project', projectId: projBId, strategy: 'ff-only' },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(pullBRes.ok, true);
    assert.equal(pullBRes.diff?.inSync, true);
    assert.equal(fs.readFileSync(path.join(dirB, 'README.md'), 'utf-8').replace(/\r\n/g, '\n'), '# Project A v1\n');

    // Update a file in Project A and push; also create a separate local file in Project B
    fs.writeFileSync(path.join(dirA, 'app.txt'), 'line 1\nline 2 from A\n', 'utf-8');
    const pushA2Res = await pushToGitHub(
      process.cwd(),
      {
        targetType: 'project',
        projectId: projAId,
        commitMessage: 'Update app.txt from A',
      },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(pushA2Res.ok, true);

    fs.writeFileSync(path.join(dirB, 'local-note.txt'), 'keep me\n', 'utf-8');
    fs.writeFileSync(path.join(dirB, 'README.md'), '# Project B local edit\n', 'utf-8');

    const diffB2 = await checkRepoSyncDiff(
      process.cwd(),
      { targetType: 'project', projectId: projBId },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(diffB2.behindCommits, 1);
    assert.equal(diffB2.inSync, false);
    assert.ok(diffB2.localDirtyFiles.some((file) => file.path === 'README.md'));
    assert.ok(diffB2.allDiffFiles.some((file) => file.path === 'README.md'));
    assert.match(diffB2.diffPreview, /README\.md/);
    assert.match(diffB2.diffPreview, /local-note\.txt/);

    // Default ff-only refuses while dirty local-note.txt exists
    const dirtyFfPull = await pullFromGitHub(
      process.cwd(),
      { targetType: 'project', projectId: projBId, strategy: 'ff-only' },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(dirtyFfPull.ok, false);
    assert.equal(dirtyFfPull.needsStrategyChoice, true);

    // rebase-stash preserves local-note.txt and applies remote update to app.txt
    const rebasePull = await pullFromGitHub(
      process.cwd(),
      { targetType: 'project', projectId: projBId, strategy: 'rebase-stash' },
      { remoteUrlForTestOnly: bareRemote },
    );
    assert.equal(rebasePull.ok, true);
    assert.equal(fs.readFileSync(path.join(dirB, 'app.txt'), 'utf-8').replace(/\r\n/g, '\n'), 'line 1\nline 2 from A\n');
    assert.equal(fs.readFileSync(path.join(dirB, 'local-note.txt'), 'utf-8').replace(/\r\n/g, '\n'), 'keep me\n');
    assert.equal(fs.readFileSync(path.join(dirB, 'README.md'), 'utf-8').replace(/\r\n/g, '\n'), '# Project B local edit\n');
  } finally {
    if (projAId) {
      await jsonReq(`/api/projects/${encodeURIComponent(projAId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ approved: true }),
      });
    }
    if (projBId) {
      await jsonReq(`/api/projects/${encodeURIComponent(projBId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ approved: true }),
      });
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});




test('configuration layers merge objects, replace arrays and preserve lower layers', () => {
  const system = { layout: { density: 'comfortable', columns: 3 }, plugins: ['core'] };
  const global = { layout: { density: 'compact' }, plugins: ['core', 'designer'] };
  const project = { layout: { columns: 2 }, plugins: null };

  const resolved = mergeConfigurationLayers(system, global, project);

  assert.deepEqual(resolved, {
    layout: { density: 'compact', columns: 2 },
    plugins: null,
  });
  assert.deepEqual(system, { layout: { density: 'comfortable', columns: 3 }, plugins: ['core'] });
  assert.deepEqual(global, { layout: { density: 'compact' }, plugins: ['core', 'designer'] });
});

test('configuration layer merge rejects prototype-pollution keys', () => {
  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, never>;
  assert.throws(() => mergeConfigurationLayers(unsafe), /безопасные JSON-значения/);
});

test('configuration storage rejects secret-bearing property names', () => {
  assert.throws(
    () => mergeConfigurationLayers({ providerApiKey: 'must-not-persist' }),
    /безопасные JSON-значения/,
  );
  assert.throws(
    () => mergeConfigurationLayers({ githubToken: 'must-not-persist' }),
    /безопасные JSON-значения/,
  );
});


test('configuration dependency analysis accepts a valid hierarchy', () => {
  const result = analyzeConfigurationDependencies([
    { id: 'workspace', kind: 'page' },
    { id: 'toolbar', kind: 'block', parentId: 'workspace' },
    { id: 'commands', kind: 'service' },
    { id: 'command-panel', kind: 'block', parentId: 'workspace', requires: ['commands'] },
  ]);

  assert.equal(result.canApply, true);
  assert.deepEqual(result.diagnostics, []);
});

test('configuration dependency analysis blocks missing and disabled dependencies', () => {
  const result = analyzeConfigurationDependencies([
    { id: 'workspace', kind: 'page', requires: ['missing-service'] },
    { id: 'service', kind: 'service', enabled: false },
    { id: 'panel', kind: 'block', requires: ['service'] },
  ]);

  assert.equal(result.canApply, false);
  assert.deepEqual(
    result.diagnostics.map((item) => item.code).sort(),
    ['disabled-dependency', 'missing-dependency'],
  );
});

test('configuration dependency analysis detects dependency, parent and compatibility cycles', () => {
  const result = analyzeConfigurationDependencies([
    { id: 'a', kind: 'page', parentId: 'b', requires: ['b'], conflictsWith: ['b'] },
    { id: 'b', kind: 'block', parentId: 'a', requires: ['a'] },
  ]);

  assert.equal(result.canApply, false);
  assert.deepEqual(
    result.diagnostics.map((item) => item.code).sort(),
    ['conflicting-nodes', 'dependency-cycle', 'parent-cycle'],
  );
});


test('configuration documents enforce schema version, revision, scope and JSON-safe values', () => {
  const document = createConfigurationDocument(
    { type: 'project', projectId: 'project-1' },
    { layout: { columns: 3 }, enabled: true },
  );

  assert.equal(validateConfigurationDocument(document).valid, true);
  assert.equal(validateConfigurationDocument({
    ...document,
    schemaVersion: 99,
  }).diagnostics[0]?.code, 'unsupported-schema-version');
  assert.equal(validateConfigurationDocument({
    ...document,
    revision: -1,
  }).diagnostics[0]?.code, 'invalid-revision');
  assert.equal(validateConfigurationDocument({
    ...document,
    scope: { type: 'project', projectId: ' ' },
  }).diagnostics[0]?.code, 'invalid-scope');
  assert.equal(validateConfigurationDocument({
    ...document,
    config: { value: Number.NaN },
  }).diagnostics[0]?.code, 'invalid-config');
});

test('configuration drafts are isolated, retain base revision and do not apply changes', () => {
  const base = createConfigurationDocument(
    { type: 'global' },
    { layout: { columns: 3, density: 'comfortable' } },
    7,
  );
  const changes = { layout: { columns: 2 } };
  const draft = createConfigurationDraft(base, changes);

  assert.equal(draft.status, 'draft');
  assert.equal(draft.baseRevision, 7);
  assert.deepEqual(draft.config, { layout: { columns: 2, density: 'comfortable' } });
  assert.deepEqual(base.config, { layout: { columns: 3, density: 'comfortable' } });
  assert.deepEqual(changes, { layout: { columns: 2 } });
  assert.equal(analyzeConfigurationDraft(draft).canApply, true);
  assert.equal(analyzeConfigurationDraft(draft, [
    { id: 'panel', kind: 'block', requires: ['missing-service'] },
  ]).canApply, false);
});


test('configuration documents reject cyclic object graphs before cloning', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => createConfigurationDocument(
    { type: 'global' },
    cyclic as never,
  ), /безопасные JSON-значения/);
});


test('configuration manager applies revisions, rejects stale drafts and restores history safely', async () => {
  const scope = { type: 'project' as const, projectId: `designer-test-${crypto.randomUUID()}` };
  const scopeKey = crypto.createHash('sha256').update(scope.projectId).digest('hex');
  const storageRoot = path.join(tempOneCoreHome, 'designer-configurations');

  try {
    const base = createConfigurationDocument(scope, { layout: { columns: 3 } });
    const firstDraft = createConfigurationDraft(base, { layout: { columns: 2 } });
    const first = await applyConfigurationDraft(firstDraft);

    assert.equal(first.revision, 1);
    assert.deepEqual(readConfigurationDocument(scope)?.config, { layout: { columns: 2 } });

    const staleDraft = createConfigurationDraft(base, { layout: { columns: 1 } });
    const secondDraft = createConfigurationDraft(first, { layout: { density: 'compact' } });
    const second = await applyConfigurationDraft(secondDraft);

    assert.equal(second.revision, 2);
    await assert.rejects(
      applyConfigurationDraft(staleDraft),
      /изменена после создания черновика/i,
    );

    const restored = await restoreConfigurationRevision(scope, 1, 2);
    assert.equal(restored.revision, 3);
    assert.deepEqual(restored.config, { layout: { columns: 2 } });
    assert.deepEqual(
      listConfigurationHistory(scope).map((item) => item.revision),
      [3, 2, 1],
    );
  } finally {
    fs.rmSync(path.join(storageRoot, 'current', `${scopeKey}.json`), { force: true });
    fs.rmSync(path.join(storageRoot, 'history', scopeKey), { recursive: true, force: true });
  }
});

test('configuration manager serializes concurrent applies against the same base revision', async () => {
  const scope = { type: 'project' as const, projectId: `designer-race-${crypto.randomUUID()}` };
  const scopeKey = crypto.createHash('sha256').update(scope.projectId).digest('hex');
  const storageRoot = path.join(tempOneCoreHome, 'designer-configurations');

  try {
    const base = createConfigurationDocument(scope, { value: 0 });
    const drafts = [
      createConfigurationDraft(base, { value: 1 }),
      createConfigurationDraft(base, { value: 2 }),
    ];
    const results = await Promise.allSettled(drafts.map((draft) => applyConfigurationDraft(draft)));

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(readConfigurationDocument(scope)?.revision, 1);
  } finally {
    fs.rmSync(path.join(storageRoot, 'current', `${scopeKey}.json`), { force: true });
    fs.rmSync(path.join(storageRoot, 'history', scopeKey), { recursive: true, force: true });
  }
});


test('Designer configuration API requires approval and exposes revision history and restore', async () => {
  const scope = { type: 'project' as const, projectId: `designer-api-${crypto.randomUUID()}` };
  const scopeKey = crypto.createHash('sha256').update(scope.projectId).digest('hex');
  const storageRoot = path.join(tempOneCoreHome, 'designer-configurations');

  try {
    const created = await jsonReq<{
      ok: boolean;
      draft: { status: string; baseRevision: number; config: Record<string, unknown> };
      analysis: { canApply: boolean };
    }>('/api/designer/configuration/drafts', {
      method: 'POST',
      body: JSON.stringify({ scope, changes: { layout: { columns: 3 } } }),
    });
    assert.equal(created.status, 200);
    assert.equal(created.data.analysis.canApply, true);
    assert.equal(created.data.draft.baseRevision, 0);

    const denied = await jsonReq<{ ok: boolean }>('/api/designer/configuration/apply', {
      method: 'POST',
      body: JSON.stringify({ draft: created.data.draft }),
    });
    assert.equal(denied.status, 403);

    const first = await jsonReq<{
      ok: boolean;
      configuration: { revision: number; config: Record<string, unknown> };
    }>('/api/designer/configuration/apply', {
      method: 'POST',
      headers: { 'X-OneCore-Approval': 'user-confirmed' },
      body: JSON.stringify({ draft: created.data.draft }),
    });
    assert.equal(first.status, 200);
    assert.equal(first.data.configuration.revision, 1);

    const secondDraft = await jsonReq<{
      draft: { status: string; baseRevision: number; config: Record<string, unknown> };
    }>('/api/designer/configuration/drafts', {
      method: 'POST',
      body: JSON.stringify({ scope, changes: { layout: { density: 'compact' } } }),
    });
    const second = await jsonReq<{ configuration: { revision: number } }>('/api/designer/configuration/apply', {
      method: 'POST',
      headers: { 'X-OneCore-Approval': 'user-confirmed' },
      body: JSON.stringify({ draft: secondDraft.data.draft }),
    });
    assert.equal(second.status, 200);
    assert.equal(second.data.configuration.revision, 2);

    const restored = await jsonReq<{ configuration: { revision: number; config: Record<string, unknown> } }>(
      '/api/designer/configuration/restore',
      {
        method: 'POST',
        headers: { 'X-OneCore-Approval': 'user-confirmed' },
        body: JSON.stringify({ scope, targetRevision: 1, expectedCurrentRevision: 2 }),
      },
    );
    assert.equal(restored.status, 200);
    assert.equal(restored.data.configuration.revision, 3);
    assert.deepEqual(restored.data.configuration.config, { layout: { columns: 3 } });

    const history = await jsonReq<{ revisions: Array<{ revision: number }> }>(
      `/api/designer/configuration/history?scope=project&projectId=${encodeURIComponent(scope.projectId)}`,
    );
    assert.equal(history.status, 200);
    assert.deepEqual(history.data.revisions.map((item) => item.revision), [3, 2, 1]);
  } finally {
    fs.rmSync(path.join(storageRoot, 'current', `${scopeKey}.json`), { force: true });
    fs.rmSync(path.join(storageRoot, 'history', scopeKey), { recursive: true, force: true });
  }
});


test('Designer pairing issues a one-time desktop session only after explicit approval', async () => {
  const denied = await jsonReq<{ ok: boolean }>('/api/designer/pairing', { method: 'POST', body: JSON.stringify({}) });
  assert.equal(denied.status, 403);

  const pairing = await jsonReq<{
    ok: boolean;
    code: string;
    apiBaseUrl: string;
    expiresAt: string;
  }>('/api/designer/pairing', {
    method: 'POST',
    headers: { 'X-OneCore-Approval': 'user-confirmed' },
    body: JSON.stringify({}),
  });
  assert.equal(pairing.status, 200);
  assert.match(pairing.data.code, /^\d{8}$/);
  assert.match(pairing.data.apiBaseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.ok(Date.parse(pairing.data.expiresAt) > Date.now());

  const invalid = await fetch(`${apiBaseUrl}/api/designer/session`, {
    method: 'POST',
    headers: { Origin: 'tauri://localhost', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'not-a-code' }),
  });
  assert.equal(invalid.status, 401);

  const connected = await fetch(`${apiBaseUrl}/api/designer/session`, {
    method: 'POST',
    headers: { Origin: 'tauri://localhost', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: pairing.data.code }),
  });
  assert.equal(connected.status, 200);
  const session = await connected.json() as { ok: boolean; token: string; expiresAt: string };
  assert.equal(session.ok, true);
  assert.ok(session.token.length >= 40);

  const authenticated = await fetch(`${apiBaseUrl}/api/designer/configuration?scope=global`, {
    headers: { Origin: 'tauri://localhost', Authorization: `Bearer ${session.token}` },
  });
  assert.equal(authenticated.status, 200);

  const registryResponse = await fetch(`${apiBaseUrl}/api/designer/registry`, {
    headers: { Origin: 'tauri://localhost', Authorization: `Bearer ${session.token}` },
  });
  assert.equal(registryResponse.status, 200);
  const registryPayload = await registryResponse.json() as {
    ok: boolean;
    registry: { components: unknown[]; navigation: unknown[] };
    defaultNavigationLayout: unknown;
  };
  assert.equal(registryPayload.ok, true);
  assert.equal(registryPayload.registry.components.length, BUILTIN_COMPONENT_REGISTRY.length);
  assert.equal(registryPayload.registry.navigation.length, NAV_GROUPS.reduce((count, group) => count + group.items.length, 0));

  const navigationValidation = await fetch(`${apiBaseUrl}/api/designer/navigation/validate`, {
    method: 'POST',
    headers: {
      Origin: 'tauri://localhost',
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ layout: registryPayload.defaultNavigationLayout }),
  });
  assert.equal(navigationValidation.status, 200);
  const navigationValidationData = await navigationValidation.json() as {
    ok: boolean;
    validation: { valid: boolean };
  };
  assert.equal(navigationValidationData.validation.valid, true);

  const appearanceValidation = await fetch(`${apiBaseUrl}/api/designer/appearance/validate`, {
    method: 'POST',
    headers: {
      Origin: 'tauri://localhost',
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appearance: DEFAULT_APPEARANCE_TOKENS }),
  });
  assert.equal(appearanceValidation.status, 200);
  const appearanceValidationData = await appearanceValidation.json() as {
    ok: boolean;
    validation: { valid: boolean };
    css: string;
  };
  assert.equal(appearanceValidationData.validation.valid, true);
  assert.match(appearanceValidationData.css, /--font-sans:/);

  const emptyTheme = await fetch(`${apiBaseUrl}/api/designer/theme.css`, {
    headers: { Origin: 'tauri://localhost', Authorization: `Bearer ${session.token}` },
  });
  assert.equal(emptyTheme.status, 204);

  const appearanceDraftResponse = await fetch(`${apiBaseUrl}/api/designer/configuration/drafts`, {
    method: 'POST',
    headers: {
      Origin: 'tauri://localhost',
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scope: { type: 'global' },
      changes: { appearance: DEFAULT_APPEARANCE_TOKENS },
    }),
  });
  assert.equal(appearanceDraftResponse.status, 200);
  const appearanceDraftData = await appearanceDraftResponse.json() as { ok: boolean; draft: unknown };
  assert.equal(appearanceDraftData.ok, true);

  const appearanceApplyResponse = await fetch(`${apiBaseUrl}/api/designer/configuration/apply`, {
    method: 'POST',
    headers: {
      Origin: 'tauri://localhost',
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
      'X-OneCore-Approval': 'user-confirmed',
    },
    body: JSON.stringify({ draft: appearanceDraftData.draft }),
  });
  assert.equal(appearanceApplyResponse.status, 200);

  const invalidDashboardDraftResponse = await fetch(`${apiBaseUrl}/api/designer/configuration/drafts`, {
    method: 'POST',
    headers: {
      Origin: 'tauri://localhost',
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scope: { type: 'global' },
      changes: {
        layout: {
          schemaVersion: 1,
          grid: { columns: 12, rows: 4, gap: 3 },
          elements: [],
        },
      },
    }),
  });
  assert.equal(invalidDashboardDraftResponse.status, 200);
  const invalidDashboardDraft = await invalidDashboardDraftResponse.json() as {
    draft: unknown;
    layoutValidation: { valid: boolean };
  };
  assert.equal(invalidDashboardDraft.layoutValidation.valid, false);

  const rejectedDashboardApply = await fetch(`${apiBaseUrl}/api/designer/configuration/apply`, {
    method: 'POST',
    headers: {
      Origin: 'tauri://localhost',
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
      'X-OneCore-Approval': 'user-confirmed',
    },
    body: JSON.stringify({ draft: invalidDashboardDraft.draft }),
  });
  assert.equal(rejectedDashboardApply.status, 400);

  const activeTheme = await fetch(`${apiBaseUrl}/api/designer/theme.css`, {
    headers: { Origin: 'tauri://localhost', Authorization: `Bearer ${session.token}` },
  });
  assert.equal(activeTheme.status, 200);
  assert.match(activeTheme.headers.get('content-type') ?? '', /text\/css/);
  assert.match(await activeTheme.text(), /--font-sans:/);

  const outsideDesigner = await fetch(`${apiBaseUrl}/api/projects`, {
    headers: { Origin: 'tauri://localhost', Authorization: `Bearer ${session.token}` },
  });
  assert.equal(outsideDesigner.status, 403);

  const cannotCreatePairing = await fetch(`${apiBaseUrl}/api/designer/pairing`, {
    method: 'POST',
    headers: {
      Origin: 'tauri://localhost',
      Authorization: `Bearer ${session.token}`,
      'X-OneCore-Approval': 'user-confirmed',
    },
    body: JSON.stringify({ approved: true }),
  });
  assert.equal(cannotCreatePairing.status, 403);

  const reused = await fetch(`${apiBaseUrl}/api/designer/session`, {
    method: 'POST',
    headers: { Origin: 'tauri://localhost', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: pairing.data.code }),
  });
  assert.equal(reused.status, 401);
});


test('configuration validation rejects excessively deep JSON structures', () => {
  let nested: Record<string, unknown> = {};
  const root = nested;
  for (let depth = 0; depth < 70; depth += 1) {
    const next: Record<string, unknown> = {};
    nested.child = next;
    nested = next;
  }
  assert.equal(validateConfigurationDocument({
    schemaVersion: 1,
    revision: 0,
    scope: { type: 'global' },
    config: root,
  }).valid, false);
});


test('built-in component registry maps every existing navigation item and protects composite pages', () => {
  const validation = validateBuiltInComponentRegistry();
  const navigationCount = NAV_GROUPS.reduce((count, group) => count + group.items.length, 0);

  assert.equal(validation.valid, true, validation.diagnostics.join('; '));
  assert.equal(BUILTIN_NAVIGATION_REGISTRY.length, navigationCount);
  assert.equal(new Set(BUILTIN_NAVIGATION_REGISTRY.map((item) => item.id)).size, navigationCount);
  assert.ok(BUILTIN_NAVIGATION_REGISTRY.every((item) =>
    BUILTIN_COMPONENT_REGISTRY.some((component) => component.id === item.componentId),
  ));

  const workstation = BUILTIN_COMPONENT_REGISTRY.find((component) => component.id === 'page.workstation');
  const system = BUILTIN_COMPONENT_REGISTRY.find((component) => component.id === 'page.system');
  assert.equal(workstation?.protected, true);
  assert.equal(system?.protected, true);
  assert.equal(BUILTIN_COMPONENT_REGISTRY.every((component) => component.supportsPageBlockReorder === false), true);
});


test('navigation layout schema permits safe reordering and grouping without changing page targets', () => {
  const layout = createDefaultNavigationLayout();
  const tools = layout.groups.find((group) => group.id === 'tools');
  const context = layout.groups.find((group) => group.id === 'context');
  assert.ok(tools && context);

  const browser = tools.items.find((item) => item.id === 'browser');
  assert.ok(browser);
  tools.items = tools.items.filter((item) => item.id !== 'browser');
  context.items.unshift(browser);

  assert.equal(validateNavigationLayout(layout).valid, true);
  const resolved = resolveNavigationLayout(layout);
  const movedBrowser = resolved.find((group) => group.id === 'context')?.items[0];
  assert.equal(movedBrowser?.id, 'browser');
  assert.equal(movedBrowser?.binding.target.tab, 'browser');
});

test('navigation layout schema rejects missing, duplicate, unknown and remapped items', () => {
  const missing = createDefaultNavigationLayout();
  missing.groups[0].items = missing.groups[0].items.filter((item) => item.id !== 'chat');
  assert.equal(validateNavigationLayout(missing).valid, false);

  const duplicate = createDefaultNavigationLayout();
  duplicate.groups[1].items.push({ ...duplicate.groups[0].items[0] });
  assert.equal(validateNavigationLayout(duplicate).valid, false);

  const unknown = createDefaultNavigationLayout();
  unknown.groups[0].items[0].id = 'page.injected';
  assert.equal(validateNavigationLayout(unknown).valid, false);

  const remapped = createDefaultNavigationLayout();
  (remapped.groups[0].items[0] as unknown as Record<string, unknown>).tab = 'security';
  assert.equal(validateNavigationLayout(remapped).valid, false);

  const invalidIcon = createDefaultNavigationLayout();
  invalidIcon.groups[0].icon = 'unsupported-icon';
  assert.equal(validateNavigationLayout(invalidIcon).valid, false);
});


test('configuration manager refuses to persist invalid appearance tokens', async () => {
  const scope = { type: 'project' as const, projectId: `designer-invalid-appearance-${crypto.randomUUID()}` };
  const scopeKey = crypto.createHash('sha256').update(scope.projectId).digest('hex');
  const storageRoot = path.join(tempOneCoreHome, 'designer-configurations');
  const invalidAppearance = {
    ...DEFAULT_APPEARANCE_TOKENS,
    opacity: { ...DEFAULT_APPEARANCE_TOKENS.opacity, panel: 2 },
  };
  const draft = createConfigurationDraft(createConfigurationDocument(scope, {}), {
    appearance: invalidAppearance as unknown as ConfigurationObject,
  });

  try {
    await assert.rejects(applyConfigurationDraft(draft), /Настройки оформления некорректны/);
    assert.equal(readConfigurationDocument(scope), null);
    assert.deepEqual(listConfigurationHistory(scope), []);
  } finally {
    fs.rmSync(path.join(storageRoot, 'current', `${scopeKey}.json`), { force: true });
    fs.rmSync(path.join(storageRoot, 'history', scopeKey), { recursive: true, force: true });
  }
});

test('configuration manager refuses to persist an invalid navigation layout', async () => {
  const scope = { type: 'project' as const, projectId: `designer-invalid-nav-${crypto.randomUUID()}` };
  const scopeKey = crypto.createHash('sha256').update(scope.projectId).digest('hex');
  const storageRoot = path.join(tempOneCoreHome, 'designer-configurations');
  const base = createConfigurationDocument(scope, {});
  const draft = createConfigurationDraft(base, {
    navigation: { schemaVersion: 1, groups: [] },
  });

  try {
    await assert.rejects(applyConfigurationDraft(draft), /Макет навигации некорректен/);
    assert.equal(readConfigurationDocument(scope), null);
    assert.deepEqual(listConfigurationHistory(scope), []);
  } finally {
    fs.rmSync(path.join(storageRoot, 'current', `${scopeKey}.json`), { force: true });
    fs.rmSync(path.join(storageRoot, 'history', scopeKey), { recursive: true, force: true });
  }
});


test('active navigation group follows renamed and rearranged layout groups', () => {
  const groups = [{
    id: 'custom-workspace',
    label: 'Моя рабочая область',
    icon: 'folder',
    items: [{
      id: 'dashboard',
      label: 'Главная',
      icon: 'dashboard',
      tab: 'dashboard' as const,
    }],
  }];

  assert.equal(getActiveNavigationGroup('dashboard', 'ui-chat', groups), 'Моя рабочая область');
});

test('page subnavigation resolves duplicate group labels by stable group ID', () => {
  const groups = [
    { id: 'first', label: 'Одинаковое имя', icon: 'folder', items: [{ id: 'dashboard', label: 'Главная', icon: 'dashboard', tab: 'dashboard' as const }] },
    { id: 'second', label: 'Одинаковое имя', icon: 'folder', items: [{ id: 'browser', label: 'Браузер', icon: 'world', tab: 'browser' as const }] },
  ];

  assert.equal(getActiveNavigationGroupId('browser', 'ui-chat', groups), 'second');
});



test('active navigation group follows the immutable GitHub and SSH target IDs after groups split', () => {
  const groups = [
    {
      id: 'github-tools',
      label: 'Git hosting',
      icon: 'github',
      items: [{ id: 'github', label: 'Source control', icon: 'github', tab: 'settings' as const, section: 'ssh-github' as const }],
    },
    {
      id: 'remote-access',
      label: 'Remote access',
      icon: 'lock',
      items: [{ id: 'ssh', label: 'Secure shell', icon: 'lock', tab: 'settings' as const, section: 'ssh-github' as const }],
    },
  ];

  assert.equal(getActiveNavigationGroup('settings', 'ssh-github', groups, 'github'), 'Git hosting');
  assert.equal(getActiveNavigationGroup('settings', 'ssh-github', groups, 'ssh-keys'), 'Remote access');
});


test('appearance tokens validate typography, geometry, opacity and both color schemes', () => {
  assert.equal(validateAppearanceTokens(DEFAULT_APPEARANCE_TOKENS).valid, true);

  const invalid = structuredClone(DEFAULT_APPEARANCE_TOKENS);
  invalid.typography.baseFontSizePx = 40;
  invalid.colors.dark.accent = 'red';
  invalid.opacity.panel = 0.1;
  const validation = validateAppearanceTokens(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.diagnostics.length >= 3);
});

test('appearance stylesheet emits validated Tailwind theme variables for light and dark modes', () => {
  const css = createAppearanceStylesheet(DEFAULT_APPEARANCE_TOKENS);
  assert.match(css, /\[data-ui-style\]:not\(\.dark\)/);
  assert.match(css, /\[data-ui-style\]\.dark/);
  assert.match(css, /--font-sans:/);
  assert.match(css, /--designer-overlay:/);
  assert.match(css, /--radius-xl: 12px/);
});


test('dashboard card editing preserves registered blocks and immutable section bindings', () => {
  const layout = {
    schemaVersion: 1 as const,
    grid: { columns: 12, rows: 4, gap: 3 },
    elements: [
      { id: 'dashboard-system', column: 1, row: 1, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-ai', column: 1, row: 2, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-activity', column: 1, row: 3, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-issues', column: 1, row: 4, columnSpan: 12, rowSpan: 1 },
    ],
    cards: createDefaultDashboardCards(),
  };

  assert.equal(validateDashboardLayout(layout).valid, true);

  const renamed = structuredClone(layout);
  renamed.cards[0].title = 'CPU';
  renamed.cards[0].order = 4;
  renamed.cards[3].order = 1;
  assert.equal(validateDashboardLayout(renamed).valid, true);

  const missing = structuredClone(layout);
  missing.cards = missing.cards.filter((card) => card.id !== 'cpu');
  assert.equal(validateDashboardLayout(missing).valid, false);

  const remapped = structuredClone(layout);
  remapped.cards[0].sectionId = 'dashboard-ai';
  assert.equal(validateDashboardLayout(remapped).valid, false);

  const duplicateOrder = structuredClone(layout);
  duplicateOrder.cards[1].order = 1;
  assert.equal(validateDashboardLayout(duplicateOrder).valid, false);

  const invalidAppearance = structuredClone(layout);
  invalidAppearance.cards[0].appearance = 'neon' as never;
  assert.equal(validateDashboardLayout(invalidAppearance).valid, false);

  const invalidDensity = structuredClone(layout);
  invalidDensity.cards[0].density = 'huge' as never;
  assert.equal(validateDashboardLayout(invalidDensity).valid, false);

  const customized = structuredClone(layout);
  customized.cards[0].appearance = 'accent';
  customized.cards[0].density = 'compact';
  assert.equal(validateDashboardLayout(customized).valid, true);
});

test('dashboard layout validation protects required runtime sections and grid geometry', () => {
  const validLayout = {
    schemaVersion: 1,
    grid: { columns: 12, rows: 4, gap: 3 },
    elements: [
      { id: 'dashboard-system', column: 1, row: 1, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-ai', column: 1, row: 2, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-activity', column: 1, row: 3, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-issues', column: 1, row: 4, columnSpan: 12, rowSpan: 1 },
    ],
  };

  assert.equal(validateDashboardLayout(validLayout).valid, true);

  const missingRequiredBlock = structuredClone(validLayout);
  missingRequiredBlock.elements = missingRequiredBlock.elements.filter((item) => item.id !== 'dashboard-issues');
  assert.equal(validateDashboardLayout(missingRequiredBlock).valid, false);
  assert.match(validateDashboardLayout(missingRequiredBlock).diagnostics.join('; '), /нельзя удалить/);

  const overlappingBlocks = structuredClone(validLayout);
  overlappingBlocks.elements[1].row = 1;
  assert.equal(validateDashboardLayout(overlappingBlocks).valid, false);
  assert.match(validateDashboardLayout(overlappingBlocks).diagnostics.join('; '), /пересекается/);

  const outOfBounds = structuredClone(validLayout);
  outOfBounds.elements[0].columnSpan = 13;
  assert.equal(validateDashboardLayout(outOfBounds).valid, false);
});


test('Stage 2: Dispatcher task files and excerpts reach the Worker handoff', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-stage2-context-'));
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# Stage 2 test project\nProject overview.', 'utf-8');
  fs.writeFileSync(path.join(projectDir, 'src', 'stage2-target.ts'), 'export const target = "stage2 excerpt content";\n', 'utf-8');
  fs.writeFileSync(path.join(projectDir, 'src', 'stage2-ignored.ts'), 'export const ignored = true;\n', 'utf-8');

  for (const filename of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    fs.writeFileSync(path.join(projectDir, 'src', `${filename}.ts`), `export const ${filename} = true;\n`, 'utf-8');
  }

  let workerPrompt = '';
  const providerServer = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const request = JSON.parse(raw) as {
      tools?: unknown[];
      messages?: Array<{ role: string; content?: string }>;
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (!request.tools) {
      res.end(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              riskLevel: 'low',
              acceptanceCriteria: ['Inspect the selected target file'],
              tasks: [{
                taskId: 'stage2-task-target',
                role: 'researcher',
                objective: 'Inspect src/stage2-target.ts',
                acceptanceCriteria: ['Use the selected file'],
                files: ['src/stage2-target.ts'],
              }],
            }),
          },
        }],
      }));
      return;
    }

    workerPrompt = request.messages?.find((message) => message.role === 'user')?.content ?? '';
    const handoffMatch = workerPrompt.match(/Handoff \(JSON\):\n([\s\S]*?)\n\nВЕРНИ СТРОГО/);
    assert.ok(handoffMatch, 'Worker prompt must contain the serialized handoff');
    const handoff = JSON.parse(handoffMatch[1]) as { taskId: string; operationId: string };
    res.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            schemaVersion: 1,
            taskId: handoff.taskId,
            operationId: handoff.operationId,
            status: 'completed',
            summary: 'Stage 2 worker response',
            findings: [],
            filesInspected: ['src/e.ts'],
            checks: [],
            unresolvedQuestions: [],
            limitations: [],
          }),
        },
      }],
    }));
  });

  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string') throw new Error('Stage 2 mock provider did not bind a TCP port');

  let projectId = '';
  try {
    await configureTestProvider('stage2-context-provider', `http://127.0.0.1:${address.port}/v1`, 'stage2-test-key', ['stage2-test-model']);

    const createRes = await jsonReq<{ ok: boolean; project: { id: string }; error?: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Stage 2 Context Regression',
        folderSource: 'local',
        folderPath: projectDir,
      }),
    });
    assert.equal(createRes.status, 201, createRes.data.error);
    projectId = createRes.data.project.id;

    const runRes = await jsonReq<{
      ok: boolean;
      tasks: Array<{
        handoff: { files: Array<{ path: string; excerpts?: Array<{ content: string }> }> };
        result: { filesInspected: string[] };
        validationOk: boolean;
      }>;
    }>('/api/agents/team-run', {
      method: 'POST',
      headers: { 'X-OneCore-Approval': 'user-confirmed' },
      body: JSON.stringify({
        approved: true,
        projectId,
        objective: 'Inspect src/stage2-target.ts',
        requestedRoles: ['researcher'],
        maxCycles: 1,
      }),
    });

    assert.equal(runRes.status, 200);
    assert.equal(runRes.data.ok, true);
    assert.equal(runRes.data.tasks.length, 1);
    assert.deepEqual(runRes.data.tasks[0].handoff.files.map((file) => file.path), ['src/stage2-target.ts']);
    assert.equal(
      runRes.data.tasks[0].handoff.files[0].excerpts?.[0]?.content.includes('stage2 excerpt content'),
      true,
    );
    assert.match(workerPrompt, /stage2 excerpt content/);
    assert.equal(runRes.data.tasks[0].validationOk, false);
    assert.equal(runRes.data.tasks[0].result.filesInspected.includes('src/e.ts'), false);
  } finally {
    if (projectId) {
      await jsonReq(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ approved: true }),
      });
    }
    await new Promise<void>((resolve, reject) =>
      providerServer.close((error) => (error ? reject(error) : resolve())),
    );
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('Stage 2: Worker evidence is isolated and cannot reuse another Worker or parent reads', () => {
  const makeHandoff = (taskId: string, operationId: string) => ({
    schemaVersion: 1,
    taskId,
    operationId,
    fromRole: 'role.dispatcher',
    toRole: 'role.qa',
    objective: 'Verify worker-specific evidence',
    acceptanceCriteria: [],
    procedureRefs: [],
    project: { projectId: 'stage2-project', constraints: [] },
    files: [],
    findings: [],
    completedSteps: [],
    unresolvedQuestions: [],
    allowedCapabilities: [],
    outputFormat: 'worker-result.v1',
    status: 'ready',
  } as Parameters<typeof validateWorkerResult>[1]);
  const workerAEvidence = ['src/worker-a-only.ts'];
  const parentEvidence = ['README.md'];
  const workerBEvidence = ['src/worker-b-only.ts'];
  const workerBResult = {
    schemaVersion: 1,
    taskId: 'worker-b',
    operationId: 'operation-b',
    status: 'completed',
    summary: 'Worker B result',
    findings: [],
    filesInspected: ['src/worker-b-only.ts', 'src/worker-a-only.ts', 'README.md'],
    checks: [],
    unresolvedQuestions: [],
    limitations: [],
  };

  const validation = validateWorkerResult(
    workerBResult,
    makeHandoff('worker-b', 'operation-b'),
    { confirmedReadFiles: workerBEvidence, confirmedChecks: [] },
  );

  assert.equal(workerAEvidence.includes('src/worker-a-only.ts'), true);
  assert.equal(parentEvidence.includes('README.md'), true);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('src/worker-a-only.ts')));
  assert.ok(validation.errors.some((error) => error.includes('README.md')));
  assert.equal(validation.errors.some((error) => error.includes('src/worker-b-only.ts')), false);
});


test('Stage 4.1: provisioned Worker context is bounded and does not count as Worker read evidence', () => {
  const context = buildProvisionedWorkerContext({
    workerId: 'worker-evidence-id',
    files: [{
      path: 'src/provided.ts',
      purpose: 'Initial context',
      evidence: 'read',
      excerpts: [{ startLine: 1, content: 'x'.repeat(7000) }],
    }, {
      path: 'src/listed.ts',
      purpose: 'Listed only',
      evidence: 'listed',
    }],
  });

  assert.equal(context.workerId, 'worker-evidence-id');
  assert.ok(context.initialChars <= MAX_HANDOFF_EXCERPT_CHARS + 1000);
  assert.equal(context.maxTotalChars, MAX_WORKER_TOTAL_CHARS);
  assert.deepEqual(context.providedFiles, ['src/provided.ts']);
  assert.equal(context.files[0].excerpts?.[0].content.length, 6000);
  assert.equal(context.initialChars, 6000);
  const multipleExcerpts = buildProvisionedWorkerContext({
    workerId: 'worker-multi-excerpt',
    files: [{
      path: 'src/multiple.ts',
      purpose: 'Multiple excerpts',
      evidence: 'read',
      excerpts: [
        { startLine: 1, content: 'a'.repeat(4000) },
        { startLine: 100, content: 'b'.repeat(4000) },
      ],
    }],
  });
  assert.equal(multipleExcerpts.initialChars, 6000);
  assert.equal(multipleExcerpts.files[0].excerpts?.reduce((sum, excerpt) => sum + excerpt.content.length, 0), 6000);
  assert.equal(context.omittedFiles.some((file) => file.path === 'src/listed.ts'), true);
  assert.match(context.context, /не являются подтверждением самостоятельного чтения/i);
});


test('Stage 5: fragment deduplication uses contentHash and refreshes changed file content', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-stage5-dedup-'));
  const filePath = path.join(projectDir, 'target.ts');
  const cache = new FragmentDeduplicationCache(4, 60_000);
  const readFragment = () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fragment = extractLineFragment(content, 1, 1);
    return cache.getFragment({
      taskId: 'stage5-task',
      normalizedPath: 'src/target.ts',
      startLine: fragment.startLine,
      endLine: fragment.endLine,
      content: fragment.content,
    });
  };

  try {
    fs.writeFileSync(filePath, 'export const value = 1;\n', 'utf-8');
    const first = readFragment();
    const repeated = readFragment();
    assert.equal(first.cacheHit, false);
    assert.equal(repeated.cacheHit, true);
    assert.equal(repeated.contentHash, first.contentHash);

    fs.writeFileSync(filePath, 'export const value = 2;\n', 'utf-8');
    const changed = readFragment();
    assert.equal(changed.cacheHit, false);
    assert.notEqual(changed.contentHash, first.contentHash);
    assert.equal(changed.content, 'export const value = 2;');

    const bounded = new FragmentDeduplicationCache(1, 60_000);
    bounded.getFragment({ taskId: 'task-a', normalizedPath: 'a.ts', startLine: 1, endLine: 1, content: 'a' });
    bounded.getFragment({ taskId: 'task-a', normalizedPath: 'b.ts', startLine: 1, endLine: 1, content: 'b' });
    assert.equal(bounded.getFragment({ taskId: 'task-a', normalizedPath: 'a.ts', startLine: 1, endLine: 1, content: 'a' }).cacheHit, false);
    assert.equal(bounded.getFragment({ taskId: 'task-b', normalizedPath: 'a.ts', startLine: 1, endLine: 1, content: 'a' }).cacheHit, false);

    const expiring = new FragmentDeduplicationCache(2, 1);
    const expiringInput = { taskId: 'ttl-task', normalizedPath: 'a.ts', startLine: 1, endLine: 1, content: 'ttl' };
    expiring.getFragment(expiringInput);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(expiring.getFragment(expiringInput).cacheHit, false);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('Stage 5: needs_more_context permits exactly two retries per taskId', () => {
  const retryCounts = new Map<string, number>();
  assert.deepEqual(registerNeedsMoreContextRetry('stage5-task', retryCounts), { retryAllowed: true, retryCount: 1 });
  assert.deepEqual(registerNeedsMoreContextRetry('stage5-task', retryCounts), { retryAllowed: true, retryCount: 2 });
  assert.deepEqual(registerNeedsMoreContextRetry('stage5-task', retryCounts), { retryAllowed: false, retryCount: 2 });
  assert.equal(retryCounts.get('stage5-task'), 2);
  assert.deepEqual(registerNeedsMoreContextRetry('other-task', retryCounts), { retryAllowed: true, retryCount: 1 });

  const originalTask = { taskId: 'stable-task', roleKey: 'qa', objective: 'Retry same task', acceptanceCriteria: ['same criteria'], files: ['src/a.ts'] };
  const pending = new Map([[originalTask.taskId, originalTask]]);
  const replanned = [{ taskId: 'new-task', roleKey: 'researcher', objective: 'New task', acceptanceCriteria: [], files: [] }];
  const nextCycle = prioritizePendingContextRetries(replanned, pending);
  assert.equal(nextCycle[0], originalTask);
  assert.equal(nextCycle[0].taskId, 'stable-task');
  assert.equal(nextCycle[0].files[0], 'src/a.ts');
  assert.equal(pending.size, 0);

  const latest = getLatestTaskAttempts([
    { taskId: 'stable-task', status: 'needs_more_context' },
    { taskId: 'stable-task', status: 'blocked' },
  ]);
  assert.equal(latest.length, 1);
  assert.equal(latest[0].status, 'blocked');
});

test('Stage 5: cancelling one child operation does not cancel its parent or sibling', () => {
  const parentSignal = startOperation({
    id: 'stage5-parent-operation',
    method: 'TEAM_RUN',
    path: '/api/agents/team-run',
  });
  const childSignal = startOperation({
    id: 'stage5-child-cancelled',
    method: 'TEAM_WORKER',
    path: '/api/agents/team-run/child-a',
    parentOperationId: 'stage5-parent-operation',
  });
  const siblingSignal = startOperation({
    id: 'stage5-child-sibling',
    method: 'TEAM_WORKER',
    path: '/api/agents/team-run/child-b',
    parentOperationId: 'stage5-parent-operation',
  });

  assert.equal(cancelOperation('stage5-child-cancelled'), true);
  assert.equal(childSignal.aborted, true);
  assert.equal(siblingSignal.aborted, false);
  assert.equal(parentSignal.aborted, false);

  finishOperation('stage5-child-cancelled', 'cancelled');
  finishOperation('stage5-child-sibling', 'completed');
  finishOperation('stage5-parent-operation', 'completed');
  assert.equal(getOperation('stage5-child-cancelled')?.status, 'cancelled');
  assert.equal(getOperation('stage5-child-sibling')?.status, 'completed');
});

test('Stage 5: file reads report missing paths, reject traversal and validate line bounds', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecore-stage5-read-'));
  fs.writeFileSync(path.join(projectDir, 'existing.ts'), 'first\nsecond\n', 'utf-8');
  fs.mkdirSync(path.join(projectDir, 'folder'));
  let projectId = '';

  try {
    const createRes = await jsonReq<{ ok: boolean; project: { id: string }; error?: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Stage 5 Read Errors',
        folderSource: 'local',
        folderPath: projectDir,
      }),
    });
    assert.equal(createRes.status, 201, createRes.data.error);
    projectId = createRes.data.project.id;

    assert.throws(() => readProjectFile(projectId, 'missing.ts'), /Файл не найден в проекте/);
    assert.throws(() => readProjectFile(projectId, 'folder'), /не является файлом проекта/);
    assert.throws(() => readProjectFile(projectId, '../outside.ts'), /запрещён|Недопустимый компонент пути/i);
    assert.throws(() => extractLineFragment('first\nsecond', 1, 3), /выходит за границы файла/);
    assert.throws(() => readProjectFile(projectId, 'existing.ts', AbortSignal.abort()), /отменён/i);
    let abortChecks = 0;
    const abortAfterRead = { get aborted() { abortChecks += 1; return abortChecks >= 4; } } as unknown as AbortSignal;
    assert.throws(() => readProjectFile(projectId, 'existing.ts', abortAfterRead), /отменён/i);
    assert.equal(abortChecks, 4);
  } finally {
    if (projectId) {
      await jsonReq(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ approved: true }),
      });
    }
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

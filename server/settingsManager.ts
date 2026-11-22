import fs from 'fs';
import { getDefaultModelsDir, getSettingsManifestPath } from './paths';
import { deleteSecret, getSecret, setSecret } from './vault';
import type { PersistedAppSettings } from '../src/types/onecore';
import { normalizeSystemConfig } from '../src/data/systemConfig';

interface SettingsManifest {
  settings: PersistedAppSettings;
  savedAt: string;
}

const CLOUD_FALLBACK_KEY = 'settings:cloud-fallback-key';
const GITHUB_TOKEN = 'settings:github-access-token';

function readSettingsManifest(): SettingsManifest | null {
  const filePath = getSettingsManifestPath();
  if (!fs.existsSync(filePath)) return null;

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SettingsManifest;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.settings ||
    typeof parsed.settings !== 'object' ||
    !Array.isArray(parsed.settings.freeProviders) ||
    !Array.isArray(parsed.settings.gateways)
  ) {
    throw new Error('Файл настроек имеет неверный формат');
  }

  const configuredModelsDir = parsed.settings.appSettings?.modelsDir?.trim() || '';
  const legacyModelDirs = new Set([
    '~/.onecore-ai/models',
    '~/.onecoreai/models',
    '%APPDATA%\\OneCoreAI\\models\\',
    '%APPDATA%\\OneCoreAI\\models',
  ]);
  if (!configuredModelsDir || legacyModelDirs.has(configuredModelsDir)) {
    parsed.settings.appSettings = {
      ...parsed.settings.appSettings,
      modelsDir: getDefaultModelsDir(),
    };
  }
  return parsed;
}

function writeSettingsManifest(manifest: SettingsManifest): void {
  const filePath = getSettingsManifestPath();
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // chmod may be a no-op on Windows
  }
}

async function saveSecret(reference: string, value: string): Promise<void> {
  // Empty values mean unchanged; deletion is an explicit security action.
  if (value.trim()) await setSecret(reference, value);
}

export async function readInternalAppSettings(): Promise<SettingsManifest | null> {
  const manifest = readSettingsManifest();
  if (!manifest) return null;

  const settings = manifest.settings;
  const [cloudFallbackKey, githubToken, providers, subagentProviders, roleSubagentProviders, gateways] = await Promise.all([
    getSecret(CLOUD_FALLBACK_KEY),
    getSecret(GITHUB_TOKEN),
    Promise.all(
      settings.freeProviders.map(async (provider) => ({
        id: provider.id,
        apiKey: await getSecret(`settings:provider:${provider.id}`),
      })),
    ),
    Promise.all(
      (settings.subagentConfig?.providers ?? []).map(async (provider) => ({
        id: provider.id,
        apiKey: await getSecret(`settings:subagent-provider:${provider.id}`),
      })),
    ),
    Promise.all(
      Object.entries(settings.subagentConfig?.providerProfilesByRole ?? {}).flatMap(([roleId, profile]) =>
        profile.providers.map(async (provider) => ({
          roleId,
          id: provider.id,
          apiKey: await getSecret(`settings:subagent-provider:${roleId}:${provider.id}`),
        })),
      ),
    ),
    Promise.all(
      settings.gateways.map(async (gateway) => ({
        id: gateway.id,
        botToken: await getSecret(`settings:gateway:${gateway.id}`),
      })),
    ),
  ]);
  const providerKeys = new Map(providers.map(({ id, apiKey }) => [id, apiKey]));
  const subagentProviderKeys = new Map(subagentProviders.map(({ id, apiKey }) => [id, apiKey]));
  const roleSubagentProviderKeys = new Map<string, string | null>(
    roleSubagentProviders.map(({ roleId, id, apiKey }) => [`${roleId}:${id}`, apiKey]),
  );
  const gatewayTokens = new Map(gateways.map(({ id, botToken }) => [id, botToken]));

  return {
    ...manifest,
    settings: {
      ...settings,
      appSettings: { ...settings.appSettings, cloudFallbackKey: cloudFallbackKey ?? '' },
      githubAccess: { ...settings.githubAccess, tokenInput: githubToken ?? '' },
      freeProviders: settings.freeProviders.map((provider) => ({
        ...provider,
        apiKey: providerKeys.get(provider.id) ?? '',
      })),
      subagentConfig: settings.subagentConfig
        ? {
            ...settings.subagentConfig,
            providers: (settings.subagentConfig.providers ?? []).map((provider) => ({
              ...provider,
              apiKey: subagentProviderKeys.get(provider.id) ?? '',
            })),
            providerProfilesByRole: Object.fromEntries(
              Object.entries(settings.subagentConfig.providerProfilesByRole ?? {}).map(([roleId, profile]) => [
                roleId,
                {
                  ...profile,
                  providers: profile.providers.map((provider) => ({
                    ...provider,
                    apiKey: roleSubagentProviderKeys.get(`${roleId}:${provider.id}`) ?? '',
                  })),
                },
              ]),
            ),
          }
        : settings.subagentConfig,
      gateways: settings.gateways.map((gateway) => ({
        ...gateway,
        botToken: gatewayTokens.get(gateway.id) ?? '',
      })),
    },
  };
}


export async function readAppSettings(): Promise<SettingsManifest | null> {
  const manifest = await readInternalAppSettings();
  if (!manifest) return null;
  const settings = manifest.settings;
  const [cloudFallbackKey, githubToken, providerKeys, subagentKeys, roleKeys, gatewayTokens] = await Promise.all([
    getSecret(CLOUD_FALLBACK_KEY),
    getSecret(GITHUB_TOKEN),
    Promise.all(settings.freeProviders.map(async (p) => [p.id, await getSecret(`settings:provider:${p.id}`)] as const)),
    Promise.all((settings.subagentConfig?.providers ?? []).map(async (p) => [p.id, await getSecret(`settings:subagent-provider:${p.id}`)] as const)),
    Promise.all(Object.entries(settings.subagentConfig?.providerProfilesByRole ?? {}).flatMap(([roleId, profile]) =>
      profile.providers.map(async (p) => [`${roleId}:${p.id}`, await getSecret(`settings:subagent-provider:${roleId}:${p.id}`)] as const))),
    Promise.all(settings.gateways.map(async (g) => [g.id, await getSecret(`settings:gateway:${g.id}`)] as const)),
  ]);
  const providerMap = new Map(providerKeys);
  const subagentMap = new Map(subagentKeys);
  const roleMap = new Map(roleKeys);
  const gatewayMap = new Map(gatewayTokens);
  return {
    ...manifest,
    settings: {
      ...settings,
      appSettings: { ...settings.appSettings, cloudFallbackKey: '' },
      githubAccess: { ...settings.githubAccess, tokenInput: '' },
      freeProviders: settings.freeProviders.map((p) => ({ ...p, apiKey: '', secretConfigured: Boolean(providerMap.get(p.id)) })),
      subagentConfig: settings.subagentConfig ? {
        ...settings.subagentConfig,
        providers: (settings.subagentConfig.providers ?? []).map((p) => ({ ...p, apiKey: '', secretConfigured: Boolean(subagentMap.get(p.id)) })),
        providerProfilesByRole: Object.fromEntries(Object.entries(settings.subagentConfig.providerProfilesByRole ?? {}).map(([roleId, profile]) => [
          roleId, { ...profile, providers: profile.providers.map((p) => ({ ...p, apiKey: '', secretConfigured: Boolean(roleMap.get(`${roleId}:${p.id}`)) })) },
        ])),
      } : settings.subagentConfig,
      gateways: settings.gateways.map((g) => ({ ...g, botToken: '', secretConfigured: Boolean(gatewayMap.get(g.id)) })),
      security: { cloudFallbackConfigured: Boolean(cloudFallbackKey), githubTokenConfigured: Boolean(githubToken) },
    } as SettingsManifest['settings'],
  };
}

export async function getProviderConnection(providerId: string, scope: 'primary' | 'subagent' = 'primary', roleId?: string): Promise<{ baseUrl: string; apiKey: string | null } | null> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(providerId)) return null;
  const manifest = readSettingsManifest();
  if (!manifest) return null;
  let provider: { id: string; baseUrl: string } | undefined;
  let secretRef = '';
  if (scope === 'primary') {
    provider = manifest.settings.freeProviders.find((item) => item.id === providerId);
    secretRef = `settings:provider:${providerId}`;
  } else {
    const roleKey = roleId && /^[a-zA-Z0-9._:-]{1,128}$/.test(roleId) ? roleId : '';
    if (roleKey) {
      provider = manifest.settings.subagentConfig?.providerProfilesByRole?.[roleKey]?.providers.find((item) => item.id === providerId);
      secretRef = `settings:subagent-provider:${roleKey}:${providerId}`;
    } else {
      provider = manifest.settings.subagentConfig?.providers?.find((item) => item.id === providerId);
      secretRef = `settings:subagent-provider:${providerId}`;
    }
  }
  if (!provider || typeof provider.baseUrl !== 'string' || !provider.baseUrl.trim()) return null;
  return { baseUrl: provider.baseUrl.trim().replace(/\/+$/, ''), apiKey: await getSecret(secretRef) };
}
export async function getProviderSecret(providerId: string, scope: 'primary' | 'subagent' = 'primary', roleId?: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(providerId)) return null;
  const manifest = readSettingsManifest();
  if (!manifest) return null;
  if (scope === 'primary') {
    if (!manifest.settings.freeProviders.some((provider) => provider.id === providerId)) return null;
    return getSecret(`settings:provider:${providerId}`);
  }
  const roleKey = roleId && /^[a-zA-Z0-9._:-]{1,128}$/.test(roleId) ? roleId : '';
  if (roleKey) {
    if (!manifest.settings.subagentConfig?.providerProfilesByRole?.[roleKey]?.providers.some((provider) => provider.id === providerId)) return null;
    return getSecret(`settings:subagent-provider:${roleKey}:${providerId}`);
  }
  if (!manifest.settings.subagentConfig?.providers?.some((provider) => provider.id === providerId)) return null;
  return getSecret(`settings:subagent-provider:${providerId}`);
}
export async function getIntegrationSecret(kind: 'github' | 'cloud-fallback' | 'gateway', id = 'default'): Promise<string | null> {
  if (kind === 'github') return getSecret(GITHUB_TOKEN);
  if (kind === 'cloud-fallback') return getSecret(CLOUD_FALLBACK_KEY);
  const manifest = readSettingsManifest();
  if (!manifest?.settings.gateways.some((gateway) => gateway.id === id)) return null;
  return getSecret(`settings:gateway:${id}`);
}

export async function setIntegrationSecret(kind: 'github' | 'cloud-fallback' | 'gateway', id: string, value: string): Promise<void> {
  if (!value.trim() || value.length > 8192) throw new Error('Некорректное значение секрета');
  if (kind === 'github') { await setSecret(GITHUB_TOKEN, value.trim()); return; }
  if (kind === 'cloud-fallback') { await setSecret(CLOUD_FALLBACK_KEY, value.trim()); return; }
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(id)) throw new Error('Некорректный идентификатор шлюза');
  const manifest = readSettingsManifest();
  if (!manifest?.settings.gateways.some((gateway) => gateway.id === id)) throw new Error('Шлюз не найден');
  await setSecret(`settings:gateway:${id}`, value.trim());
}

export async function clearIntegrationSecret(kind: 'github' | 'cloud-fallback' | 'gateway', id: string): Promise<void> {
  if (kind === 'github') { await deleteSecret(GITHUB_TOKEN); return; }
  if (kind === 'cloud-fallback') { await deleteSecret(CLOUD_FALLBACK_KEY); return; }
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(id)) throw new Error('Некорректный идентификатор шлюза');
  const manifest = readSettingsManifest();
  if (!manifest?.settings.gateways.some((gateway) => gateway.id === id)) throw new Error('Шлюз не найден');
  await deleteSecret(`settings:gateway:${id}`);
}

export async function setProviderSecret(providerId: string, value: string): Promise<void> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(providerId) || !value.trim() || value.length > 8192) {
    throw new Error('Некорректный API-ключ провайдера');
  }
  const manifest = readSettingsManifest();
  if (!manifest?.settings.freeProviders.some((provider) => provider.id === providerId)) {
    throw new Error('Провайдер не найден в настройках');
  }
  await setSecret(`settings:provider:${providerId}`, value.trim());
}

export async function setSubagentProviderSecret(providerId: string, value: string, roleId?: string): Promise<void> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(providerId) || !value.trim() || value.length > 8192) throw new Error('Некорректный API-ключ субагента');
  const manifest = readSettingsManifest();
  if (!manifest) throw new Error('Настройки не найдены');
  const roleKey = roleId && /^[a-zA-Z0-9._:-]{1,128}$/.test(roleId) ? roleId : '';
  if (roleKey) {
    if (!manifest.settings.subagentConfig?.providerProfilesByRole?.[roleKey]?.providers.some((p) => p.id === providerId)) throw new Error('Профиль субагента не найден');
    await setSecret(`settings:subagent-provider:${roleKey}:${providerId}`, value.trim()); return;
  }
  if (!manifest.settings.subagentConfig?.providers?.some((p) => p.id === providerId)) throw new Error('Провайдер субагента не найден');
  await setSecret(`settings:subagent-provider:${providerId}`, value.trim());
}

export async function clearSubagentProviderSecret(providerId: string, roleId?: string): Promise<void> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(providerId)) throw new Error('Некорректный идентификатор провайдера');
  const manifest = readSettingsManifest();
  if (!manifest) throw new Error('Настройки не найдены');
  const roleKey = roleId && /^[a-zA-Z0-9._:-]{1,128}$/.test(roleId) ? roleId : '';
  if (roleKey) {
    if (!manifest.settings.subagentConfig?.providerProfilesByRole?.[roleKey]?.providers.some((p) => p.id === providerId)) throw new Error('Профиль субагента не найден');
    await deleteSecret(`settings:subagent-provider:${roleKey}:${providerId}`); return;
  }
  if (!manifest.settings.subagentConfig?.providers?.some((p) => p.id === providerId)) throw new Error('Провайдер субагента не найден');
  await deleteSecret(`settings:subagent-provider:${providerId}`);
}

export async function clearProviderSecret(providerId: string): Promise<void> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(providerId)) throw new Error('Некорректный идентификатор провайдера');
  const manifest = readSettingsManifest();
  if (!manifest?.settings.freeProviders.some((provider) => provider.id === providerId)) throw new Error('Провайдер не найден в настройках');
  await deleteSecret(`settings:provider:${providerId}`);
}

export async function saveAppSettings(settings: PersistedAppSettings): Promise<SettingsManifest> {
  if (
    !settings ||
    typeof settings !== 'object' ||
    !settings.appSettings ||
    typeof settings.appSettings.cloudFallbackKey !== 'string' ||
    !settings.githubAccess ||
    typeof settings.githubAccess.tokenInput !== 'string' ||
    !Number.isInteger(settings.appNavigationWidth) ||
    settings.appNavigationWidth < 220 ||
    settings.appNavigationWidth > 380 ||
    !Array.isArray(settings.freeProviders) ||
    !Array.isArray(settings.gateways) ||
    settings.freeProviders.some(
      (provider) => typeof provider.id !== 'string' || typeof provider.apiKey !== 'string',
    ) ||
    (settings.subagentConfig?.providers ?? []).some(
      (provider) => typeof provider.id !== 'string' || typeof provider.apiKey !== 'string',
    ) ||
    Object.values(settings.subagentConfig?.providerProfilesByRole ?? {}).some(
      (profile) =>
        !Array.isArray(profile.providers) ||
        profile.providers.some((provider) => typeof provider.id !== 'string' || typeof provider.apiKey !== 'string'),
    ) ||
    settings.gateways.some(
      (gateway) => typeof gateway.id !== 'string' || typeof gateway.botToken !== 'string',
    )
  ) {
    throw new Error('Проверьте параметры настроек');
  }

  await saveSecret(CLOUD_FALLBACK_KEY, settings.appSettings.cloudFallbackKey);
  await saveSecret(GITHUB_TOKEN, settings.githubAccess.tokenInput);
  for (const provider of settings.freeProviders) {
    await saveSecret(`settings:provider:${provider.id}`, provider.apiKey);
  }
  for (const provider of settings.subagentConfig?.providers ?? []) {
    await saveSecret(`settings:subagent-provider:${provider.id}`, provider.apiKey);
  }
  for (const [roleId, profile] of Object.entries(settings.subagentConfig?.providerProfilesByRole ?? {})) {
    for (const provider of profile.providers) {
      await saveSecret(`settings:subagent-provider:${roleId}:${provider.id}`, provider.apiKey);
    }
  }
  for (const gateway of settings.gateways) {
    await saveSecret(`settings:gateway:${gateway.id}`, gateway.botToken);
  }

  const savedAt = new Date().toISOString();
  const safeSettings: PersistedAppSettings = {
    ...settings,
    systemConfig: normalizeSystemConfig(settings.systemConfig),
    appSettings: { ...settings.appSettings, cloudFallbackKey: '' },
    githubAccess: { ...settings.githubAccess, tokenInput: '' },
    freeProviders: settings.freeProviders.map((provider) => ({ ...provider, apiKey: '' })),
    subagentConfig: settings.subagentConfig
      ? {
          ...settings.subagentConfig,
          providers: (settings.subagentConfig.providers ?? []).map((provider) => ({
            ...provider,
            apiKey: '',
          })),
          providerProfilesByRole: Object.fromEntries(
            Object.entries(settings.subagentConfig.providerProfilesByRole ?? {}).map(([roleId, profile]) => [
              roleId,
              {
                ...profile,
                providers: profile.providers.map((provider) => ({ ...provider, apiKey: '' })),
              },
            ]),
          ),
        }
      : settings.subagentConfig,
    gateways: settings.gateways.map((gateway) => ({ ...gateway, botToken: '' })),
  };
  const manifest = { settings: safeSettings, savedAt };
  writeSettingsManifest(manifest);
  return { ...manifest, settings: safeSettings };
}

import fs from 'fs';
import { getSettingsManifestPath } from './paths';
import { deleteSecret, getSecret, setSecret } from './vault';
import type { PersistedAppSettings } from '../src/types/onecore';

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
  if (value) {
    await setSecret(reference, value);
  } else {
    await deleteSecret(reference);
  }
}

export async function readAppSettings(): Promise<SettingsManifest | null> {
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
  return { ...manifest, settings };
}

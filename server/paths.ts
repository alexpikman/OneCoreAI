import fs from 'fs';
import os from 'os';
import path from 'path';

export function getOneCoreHome(): string {
  const configuredHome = process.env.ONECORE_HOME?.trim();
  return path.resolve(configuredHome || path.join(os.homedir(), '.onecoreai'));
}

export function getDefaultModelsDir(): string {
  return path.join(getOneCoreHome(), 'models');
}

export function expandUserPath(value: string): string {
  const home = os.homedir();
  const expanded = value.trim()
    .replace(/^~(?=$|[\\/])/, home)
    .replace(/%USERPROFILE%/gi, home)
    .replace(/%HOME%/gi, home)
    .replace(/%APPDATA%/gi, process.env.APPDATA || path.join(home, 'AppData', 'Roaming'))
    .replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'))
    .replaceAll('$HOME', home);
  return path.resolve(expanded);
}

export function ensureOneCoreDirs(): {
  home: string;
  modelsDir: string;
  reposDir: string;
  workspacesDir: string;
  logsDir: string;
} {
  const buildPaths = (baseHome: string) => ({
    home: baseHome,
    modelsDir: path.join(baseHome, 'models'),
    reposDir: path.join(baseHome, 'repos'),
    workspacesDir: path.join(baseHome, 'workspaces'),
    logsDir: path.join(baseHome, 'logs'),
  });

  const configuredHome = process.env.ONECORE_HOME?.trim();
  const primary = buildPaths(getOneCoreHome());
  try {
    for (const dir of [primary.home, primary.modelsDir, primary.reposDir, primary.workspacesDir, primary.logsDir]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return primary;
  } catch (error) {
    if (configuredHome) throw error;
    const fallback = buildPaths(path.join(os.tmpdir(), '.onecoreai'));
    for (const dir of [fallback.home, fallback.modelsDir, fallback.reposDir, fallback.workspacesDir, fallback.logsDir]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return fallback;
  }
}

export function getModelsManifestPath(): string {
  return path.join(ensureOneCoreDirs().home, 'models.json');
}

export function getProjectsManifestPath(): string {
  return path.join(ensureOneCoreDirs().home, 'projects.json');
}

export function getSettingsManifestPath(): string {
  return path.join(ensureOneCoreDirs().home, 'settings.json');
}

export function getVaultPath(): string {
  return path.join(ensureOneCoreDirs().home, 'vault.enc.json');
}

export function getNotesManifestPath(): string {
  return path.join(ensureOneCoreDirs().home, 'notes.json');
}

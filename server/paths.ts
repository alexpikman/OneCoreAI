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
  const home = getOneCoreHome();
  const modelsDir = getDefaultModelsDir();
  const reposDir = path.join(home, 'repos');
  const workspacesDir = path.join(home, 'workspaces');
  const logsDir = path.join(home, 'logs');

  for (const dir of [home, modelsDir, reposDir, workspacesDir, logsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return { home, modelsDir, reposDir, workspacesDir, logsDir };
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

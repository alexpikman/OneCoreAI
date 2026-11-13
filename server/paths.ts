import fs from 'fs';
import os from 'os';
import path from 'path';

export function getOneCoreHome(): string {
  const configuredHome = process.env.ONECORE_HOME?.trim() || process.env.KOVA_HOME?.trim();
  const legacyHome = path.join(os.homedir(), '.kova-studio');
  const base =
    configuredHome ||
    (fs.existsSync(legacyHome) ? legacyHome : path.join(os.homedir(), '.onecore-ai'));
  return path.resolve(base);
}

export function ensureOneCoreDirs(): {
  home: string;
  modelsDir: string;
  reposDir: string;
  workspacesDir: string;
  logsDir: string;
} {
  const home = getOneCoreHome();
  const modelsDir = path.join(home, 'models');
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

export function getVaultPath(): string {
  return path.join(ensureOneCoreDirs().home, 'vault.enc.json');
}

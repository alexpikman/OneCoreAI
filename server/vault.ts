import { execFile, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
import { getOneCoreHome, getVaultPath } from './paths';

const execFileAsync = promisify(execFile);

async function runSecretTool(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('secret-tool', args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.replace(/\r?\n$/, ''));
      } else {
        reject(new Error(stderr.trim() || `secret-tool exited with code ${code}`));
      }
    });
    child.stdin.end(input ?? '');
  });
}
// Keep these identifiers stable so existing encrypted vaults and keychain entries remain usable.
const SERVICE_NAME = 'com.onecoreai.app';

const WINDOWS_CREDENTIAL_BRIDGE = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class OneCoreCredentialBridge
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct Credential
    {
        public UInt32 Flags;
        public UInt32 Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("Advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWrite(ref Credential credential, UInt32 flags);

    [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

    [DllImport("Advapi32.dll", EntryPoint = "CredFree")]
    private static extern void CredFree(IntPtr buffer);

    [DllImport("Advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

    public static bool Write(string target, string userName, string secret)
    {
        byte[] blob = Encoding.UTF8.GetBytes(secret);
        if (blob.Length > 5120) return false;
        IntPtr buffer = Marshal.AllocHGlobal(blob.Length);
        try
        {
            Marshal.Copy(blob, 0, buffer, blob.Length);
            Credential credential = new Credential
            {
                Type = 1,
                TargetName = target,
                UserName = userName,
                CredentialBlobSize = (UInt32)blob.Length,
                CredentialBlob = buffer,
                Persist = 2
            };
            return CredWrite(ref credential, 0);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    public static string Read(string target)
    {
        IntPtr buffer;
        if (!CredRead(target, 1, 0, out buffer)) return null;
        try
        {
            Credential credential = Marshal.PtrToStructure<Credential>(buffer);
            byte[] blob = new byte[checked((int)credential.CredentialBlobSize)];
            Marshal.Copy(credential.CredentialBlob, blob, 0, blob.Length);
            return Encoding.UTF8.GetString(blob);
        }
        finally
        {
            CredFree(buffer);
        }
    }

    public static bool Delete(string target)
    {
        return CredDelete(target, 1, 0);
    }
}
`;

async function runWindowsCredentialBridge(
  operation: 'write' | 'read' | 'delete',
  account: string,
  secret = '',
): Promise<string | null> {
  const target = `${SERVICE_NAME}:${account}`;
  const command = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -TypeDefinition @'",
    WINDOWS_CREDENTIAL_BRIDGE,
    "'@",
    operation === 'write'
      ? "if (-not [OneCoreCredentialBridge]::Write($env:ONECORE_CREDENTIAL_TARGET, $env:USERNAME, $env:ONECORE_CREDENTIAL_SECRET)) { exit 1 }"
      : operation === 'read'
        ? "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $value = [OneCoreCredentialBridge]::Read($env:ONECORE_CREDENTIAL_TARGET); if ($null -eq $value) { exit 1 }; [Console]::Out.Write($value)"
        : "[OneCoreCredentialBridge]::Delete($env:ONECORE_CREDENTIAL_TARGET) | Out-Null",
   ].join("\r\n");

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      windowsHide: true,
      env: {
        ...process.env,
        ONECORE_CREDENTIAL_TARGET: target,
        ONECORE_CREDENTIAL_SECRET: secret,
      },
      maxBuffer: 1024 * 1024,
    },
  );
  return operation === 'read' ? stdout : null;
}

interface VaultEntry {
  iv: string;
  tag: string;
  data: string;
}

interface VaultStore {
  version?: number;
  kdf?: { algorithm: 'scrypt'; salt: string; cost: number };
  entries: Record<string, VaultEntry>;
}

const VAULT_VERSION = 2;
const VAULT_SCRYPT_COST = 32768;

function vaultKeySeed(): string {
  return `${os.hostname()}|${os.userInfo().username}|${getOneCoreHome()}|onecoreai-v1`;
}

function deriveVaultKey(salt: string): Buffer {
  return crypto.scryptSync(vaultKeySeed(), salt, 32, { N: VAULT_SCRYPT_COST, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function encryptVaultEntry(key: Buffer, plaintext: string): VaultEntry {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: encrypted.toString('hex') };
}

function decryptVaultEntry(key: Buffer, entry: VaultEntry): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(entry.data, 'hex')), decipher.final()]).toString('utf-8');
}

function readEncryptedVault(): VaultStore {
  const vaultPath = getVaultPath();
  if (!fs.existsSync(vaultPath)) {
    return { entries: {} };
  }
  const raw = fs.readFileSync(vaultPath, 'utf-8');
  const parsed = JSON.parse(raw) as VaultStore;
  if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) {
    throw new Error('Хранилище секретов повреждено: неверный формат. Исходный файл сохранён без изменений.');
  }
  return parsed;
}

function ensureCurrentVault(store: VaultStore): { store: VaultStore; key: Buffer } {
  if (store.version === VAULT_VERSION && store.kdf?.algorithm === 'scrypt' && /^[a-f0-9]{64}$/i.test(store.kdf.salt)) {
    return { store, key: deriveVaultKey(store.kdf.salt) };
  }
  if (store.version !== undefined || Object.keys(store.entries).length > 0) {
    throw new Error('Формат хранилища секретов не поддерживается. Исходный файл сохранён без изменений.');
  }
  const salt = crypto.randomBytes(32).toString('hex');
  return {
    store: {
      version: VAULT_VERSION,
      kdf: { algorithm: 'scrypt', salt, cost: VAULT_SCRYPT_COST },
      entries: {},
    },
    key: deriveVaultKey(salt),
  };
}
function writeEncryptedVault(store: VaultStore): void {
  const vaultPath = getVaultPath();
  const tmpPath = `${vaultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, vaultPath);
  try {
    fs.chmodSync(vaultPath, 0o600);
  } catch {
    // chmod may be a no-op on Windows
  }
}

async function tryOsKeychainSet(account: string, secret: string): Promise<boolean> {
  if (process.env.ONECORE_TEST_DISABLE_OS_KEYCHAIN === '1') return false;
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      await execFileAsync('security', [
        'add-generic-password',
        '-a',
        account,
        '-s',
        SERVICE_NAME,
        '-w',
        secret,
        '-U',
      ]);
      return true;
    }
    if (platform === 'win32') {
      await runWindowsCredentialBridge('write', account, secret);
      return true;
    }
    if (platform === 'linux' && process.env.DBUS_SESSION_BUS_ADDRESS) {
      await execFileAsync('which', ['secret-tool']);
      await runSecretTool(
        ['store', '--label=ONE CORE AI', 'service', SERVICE_NAME, 'account', account],
        secret,
      );
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function tryOsKeychainGet(account: string): Promise<string | null> {
  if (process.env.ONECORE_TEST_DISABLE_OS_KEYCHAIN === '1') return null;
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-a',
        account,
        '-s',
        SERVICE_NAME,
        '-w',
      ]);
      return stdout.replace(/\r?\n$/, '');
    }
    if (platform === 'linux' && process.env.DBUS_SESSION_BUS_ADDRESS) {
      await execFileAsync('which', ['secret-tool']);
      return await runSecretTool(['lookup', 'service', SERVICE_NAME, 'account', account]);
    }
    if (platform === 'win32') {
      return await runWindowsCredentialBridge('read', account);
    }
  } catch {
    return null;
  }
  return null;
}

async function tryOsKeychainDelete(account: string): Promise<void> {
  if (process.env.ONECORE_TEST_DISABLE_OS_KEYCHAIN === '1') return;
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      await execFileAsync('security', [
        'delete-generic-password',
        '-a',
        account,
        '-s',
        SERVICE_NAME,
      ]);
    } else if (platform === 'win32') {
      await runWindowsCredentialBridge('delete', account);
    } else if (platform === 'linux' && process.env.DBUS_SESSION_BUS_ADDRESS) {
      await runSecretTool(['clear', 'service', SERVICE_NAME, 'account', account]);
    }
  } catch {
    // ignore missing keychain entries
  }
}

export async function setSecret(account: string, plaintext: string): Promise<{ backend: 'os-keychain' | 'aes-256-gcm-vault' }> {
  const osSaved = await tryOsKeychainSet(account, plaintext);
  if (osSaved) {
    return { backend: 'os-keychain' };
  }

  setEncryptedVaultSecret(account, plaintext);
  return { backend: 'aes-256-gcm-vault' };
}

export function setEncryptedVaultSecret(account: string, plaintext: string): void {
  const current = ensureCurrentVault(readEncryptedVault());
  current.store.entries[account] = encryptVaultEntry(current.key, plaintext);
  writeEncryptedVault(current.store);
}

export async function getSecret(account: string): Promise<string | null> {
  const fromOs = await tryOsKeychainGet(account);
  if (fromOs !== null) return fromOs;
  const store = readEncryptedVault();
  if (!store.entries[account]) return null;
  const current = ensureCurrentVault(store);
  try {
    return decryptVaultEntry(current.key, current.store.entries[account]);
  } catch {
    throw new Error('Не удалось расшифровать секрет из локального хранилища. Файл сохранён без изменений.');
  }
}

export async function deleteSecret(account: string): Promise<void> {
  await tryOsKeychainDelete(account);
  const store = readEncryptedVault();
  if (store.entries[account]) {
    delete store.entries[account];
    writeEncryptedVault(store);
  }
}

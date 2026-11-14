import { execFile, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
import { getVaultPath } from './paths';

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
const SERVICE_NAME = 'kova-studio';

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

interface VaultStore {
  entries: Record<string, { iv: string; tag: string; data: string }>;
}

function deriveVaultKey(): Buffer {
  const seed = `${os.hostname()}|${os.userInfo().username}|${process.env.ONECORE_HOME || process.env.KOVA_HOME || os.homedir()}|kova-vault-v1`;
  return crypto.scryptSync(seed, 'kova-studio-local-vault-salt', 32);
}

function readEncryptedVault(): VaultStore {
  const vaultPath = getVaultPath();
  if (!fs.existsSync(vaultPath)) {
    return { entries: {} };
  }
  try {
    const raw = fs.readFileSync(vaultPath, 'utf-8');
    const parsed = JSON.parse(raw) as VaultStore;
    return parsed && typeof parsed.entries === 'object' ? parsed : { entries: {} };
  } catch {
    return { entries: {} };
  }
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
  const key = deriveVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const store = readEncryptedVault();
  store.entries[account] = {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
  writeEncryptedVault(store);
}

export async function getSecret(account: string): Promise<string | null> {
  const fromOs = await tryOsKeychainGet(account);
  if (fromOs !== null) {
    return fromOs;
  }

  const store = readEncryptedVault();
  const entry = store.entries[account];
  if (!entry) return null;

  try {
    const key = deriveVaultKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(entry.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(entry.data, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf-8');
  } catch {
    return null;
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

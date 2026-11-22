import { invoke } from '@tauri-apps/api/core';

let backendUrl: Promise<string> | undefined;
let sessionToken: Promise<string> | undefined;

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return false;
  return window.location.protocol === 'tauri:' || window.location.hostname === 'tauri.localhost';
}

async function getBackendUrl(): Promise<string> {
  if (!backendUrl) {
    backendUrl = invoke<string>('get_backend_url').catch((error: unknown) => {
      backendUrl = undefined;
      throw new Error(`Не удалось подключиться к локальному API: ${String(error)}`);
    });
  }
  return backendUrl;
}

async function getSessionToken(apiBaseUrl?: string): Promise<string> {
  if (!sessionToken) {
    sessionToken = (async () => {
      if (isTauriRuntime()) {
        const nativeToken = await invoke<string | null>('get_backend_session_token');
        if (nativeToken) return nativeToken;
      }

      const sessionUrl = apiBaseUrl ? new URL('/api/auth/session', apiBaseUrl) : '/api/auth/session';
      const response = await fetch(sessionUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as { ok?: boolean; token?: string; error?: string };
      if (!response.ok || !payload.ok || typeof payload.token !== 'string') {
        throw new Error(payload.error || `Не удалось создать API-сессию: HTTP ${response.status}`);
      }
      return payload.token;
    })().catch((error: unknown) => {
      sessionToken = undefined;
      throw error;
    });
  }
  return sessionToken;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isApiPath = typeof input === 'string' && input.startsWith('/api/');
  if (!isApiPath) return fetch(input, init);

  const tauri = isTauriRuntime();
  const apiBaseUrl = tauri ? await getBackendUrl() : undefined;
  const requestInput = tauri ? new URL(input as string, apiBaseUrl) : input;

  const send = async (): Promise<Response> => {
    const token = await getSessionToken(apiBaseUrl);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(requestInput, { ...init, headers });
  };

  let response = await send();
  if (response.status === 401) {
    sessionToken = undefined;
    response = await send();
  }
  return response;
}

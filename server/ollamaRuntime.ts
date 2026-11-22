import { readAppSettings } from './settingsManager';

interface OllamaProviderConfig {
  id: string;
  kind: string;
  baseUrl: string;
  selectedModel: string;
}

const WARMUP_TIMEOUT_MS = 120_000;
const MODEL_KEEP_ALIVE = '30m';
const warmups = new Map<string, Promise<void>>();

function getOllamaApiBase(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = parsed.pathname.replace(/\/(?:v1)\/?$/i, '').replace(/\/$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export async function warmOllamaModel(
  provider: OllamaProviderConfig,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (provider.kind !== 'ollama') return;
  const model = provider.selectedModel.trim();
  if (!model) throw new Error('Для Ollama не выбрана модель');

  const base = getOllamaApiBase(provider.baseUrl);
  const key = `${base}|${model}`;
  const existing = warmups.get(key);
  if (existing) return existing;

  const warmup = (async () => {
    const response = await fetcher(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model,
        prompt: '',
        stream: false,
        keep_alive: MODEL_KEEP_ALIVE,
      }),
      signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(body || `Ollama warm-up failed: HTTP ${response.status}`);
    }
  })();

  warmups.set(key, warmup);
  try {
    await warmup;
  } finally {
    warmups.delete(key);
  }
}

export async function warmConfiguredOllama(): Promise<void> {
  const manifest = await readAppSettings();
  const provider = manifest?.settings.freeProviders.find(
    (item) => item.kind === 'ollama' && item.selectedModel?.trim(),
  );
  if (!provider) return;
  await warmOllamaModel(provider);
}

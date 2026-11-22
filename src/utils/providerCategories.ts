import type { AiProviderCategory, FreeProviderKind } from '../types/onecore';

export function getProviderCategory(kind: FreeProviderKind): AiProviderCategory {
  if (kind === 'ollama' || kind === 'lmstudio') return 'local';
  if (kind === 'custom') return 'compatible';
  if (kind === 'llama-cpp') return 'llama-server';
  return 'cloud';
}

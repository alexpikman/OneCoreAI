import React, { useEffect, useState } from 'react';
import { Play, RefreshCw, Terminal } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { PageContent } from '../layout/PageContent';
import { PageHeader } from '../layout/PageHeader';
import { AIResourcePageLayout as PageLayout } from '../layout/AIResourcePageLayout';

export const LlamaServerApiConsoleView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { freeProviders } = useOneCoreStore();
  const llamaProvider = freeProviders.find((provider) => provider.kind === 'llama-cpp');
  const providerId = llamaProvider?.id ?? '';
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [prompt, setPrompt] = useState('Проверь, что локальный OpenAI-compatible API отвечает. Кратко опиши возможности текущей модели.');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<{ prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null>(null);
  const loadModels = async () => {
    try {
      if (!providerId) throw new Error('Провайдер LlamaServer не настроен.');
      const response = await apiFetch('/api/providers/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'llama-cpp', providerId }) });
      const data = await response.json() as { ok?: boolean; models?: string[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setModels(data.models ?? []);
      setModel((current) => (data.models ?? []).includes(current) ? current : (llamaProvider?.selectedModel && data.models?.includes(llamaProvider.selectedModel) ? llamaProvider.selectedModel : data.models?.[0] ?? 'local-model'));
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось получить модели API.'); }
  };
  useEffect(() => { void loadModels(); }, [providerId]);
  const execute = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(null); setOutput(''); setUsage(null);
    try {
      if (!providerId) throw new Error('Провайдер LlamaServer не настроен.');
      const response = await apiFetch('/api/providers/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, model, temperature: 0.7, stream: false, messages: [
          ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt.trim() }] : []),
          { role: 'user', content: prompt.trim() },
        ] }),
      });
      const data = await response.json() as { ok?: boolean; content?: string; promptTokens?: number; completionTokens?: number; totalTokens?: number; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setOutput(data.content ?? ''); setUsage({ prompt_tokens: data.promptTokens ?? undefined, completion_tokens: data.completionTokens ?? undefined, total_tokens: data.totalTokens ?? undefined });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка OpenAI API запроса.'); }
    finally { setBusy(false); }
  };
  const body = (
    <form onSubmit={execute} className={embedded ? 'space-y-4' : 'mx-auto max-w-4xl space-y-4 py-5'}>
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            OpenAI API · Console
          </div>
          <button
            type="button"
            onClick={() => void loadModels()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Обновить модели
          </button>
        </div>
      )}
      {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">Model ID<select value={model} onChange={(event) => setModel(event.target.value)} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">{models.length ? models.map((item) => <option key={item} value={item}>{item}</option>) : <option value="local-model">local-model</option>}</select></label><div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">Endpoint<div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">POST /api/providers/chat</div></div></div>
      <label className="block space-y-1 text-xs text-zinc-600 dark:text-zinc-400">System prompt<textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={3} className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" /></label>
      <label className="block space-y-1 text-xs text-zinc-600 dark:text-zinc-400">User prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} required className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" /></label>
      <button type="submit" disabled={busy || !prompt.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"><Play className="h-3.5 w-3.5" />{busy ? 'Выполняется…' : 'Отправить запрос'}</button>
      {output && <section className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40"><div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Ответ модели</div><pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">{output}</pre>{usage && <div className="border-t border-zinc-100 pt-2 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">Prompt: {usage.prompt_tokens ?? '—'} · Completion: {usage.completion_tokens ?? '—'} · Total: {usage.total_tokens ?? '—'}</div>}</section>}
    </form>
  );

  if (embedded) return body;

  return <PageLayout>
    <PageHeader
      showSave={false}
      actions={[
        {
          id: 'refresh-openai-api-models',
          label: 'Обновить',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          onClick: () => void loadModels(),
          variant: 'secondary',
        },
      ]}
    >
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
        <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-semibold">OpenAI API · Console</h1>
      </div>
    </PageHeader>
    <PageContent>{body}</PageContent>
  </PageLayout>;
};

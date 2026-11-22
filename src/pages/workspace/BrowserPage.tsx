import React, { useState } from 'react';
import { ExternalLink, Globe, Loader2, Search } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export const BrowserPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);

  const [urlInput, setUrlInput] = useState('');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [pageText, setPageText] = useState('');

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const resp = await apiFetch(`/api/browser/search?q=${encodeURIComponent(q)}`, {
        headers: { 'X-OneCore-Approval': 'user-confirmed' },
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        results?: SearchResultItem[];
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      setResults(data.results ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Ошибка поиска');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleOpenUrl = async (targetUrl?: string) => {
    const raw = (targetUrl ?? urlInput).trim();
    if (!raw) return;
    setUrlInput(raw);
    setReading(true);
    setReadError(null);
    try {
      const resp = await apiFetch(`/api/browser/read?url=${encodeURIComponent(raw)}`, {
        headers: { 'X-OneCore-Approval': 'user-confirmed' },
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        title?: string;
        url?: string;
        text?: string;
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      setPageTitle(data.title || raw);
      setPageUrl(data.url || raw);
      setPageText(data.text || '');
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Не удалось загрузить страницу');
      setPageText('');
    } finally {
      setReading(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader showSave={false}>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Браузер</h1>
        </div>
      </PageHeader>

      <PageContent contentClassName="space-y-4 py-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск в интернете (DuckDuckGo HTML)…"
              className="h-8 min-w-0 flex-1 bg-transparent text-xs text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {searching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Найти</span>
            </button>
          </form>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleOpenUrl();
            }}
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              type="url"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="https://example.com — открыть и извлечь текст…"
              className="h-8 min-w-0 flex-1 bg-transparent font-mono text-xs text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={reading || !urlInput.trim()}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {reading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Открыть</span>
            </button>
          </form>
        </div>

        {(searchError || readError) && (
          <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {searchError || readError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="lg:col-span-5 space-y-2 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Результаты поиска</h2>
              <span className="text-[11px] tabular-nums text-zinc-400">{results.length}</span>
            </div>
            {results.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-500">
                Введите запрос, чтобы выполнить реальный поиск в сети.
              </div>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {results.map((item, idx) => (
                  <button
                    key={`${item.url}-${idx}`}
                    type="button"
                    onClick={() => void handleOpenUrl(item.url)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-colors',
                      pageUrl === item.url
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                        : 'border-zinc-200/80 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/70',
                    )}
                  >
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-blue-600 dark:text-blue-400">
                      {item.url}
                    </div>
                    {item.snippet && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {item.snippet}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-7 space-y-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2.5 dark:border-zinc-800">
              <div className="min-w-0">
                <h2 className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {pageTitle || 'Содержимое страницы'}
                </h2>
                {pageUrl && (
                  <div className="truncate font-mono text-[10px] text-zinc-500">{pageUrl}</div>
                )}
              </div>
              {pageUrl && (
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span>Внешний переход</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {reading ? (
              <div className="py-12 text-center text-xs text-zinc-500">Чтение и извлечение текста страницы…</div>
            ) : pageText ? (
              <div className="max-h-[540px] overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {pageText}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-zinc-500">
                Выберите результат поиска или введите URL, чтобы прочитать извлечённый текст страницы.
              </div>
            )}
          </section>
        </div>
      </PageContent>
    </PageLayout>
  );
};

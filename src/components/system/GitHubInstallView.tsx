import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Github } from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

export const GitHubInstallView: React.FC = () => {
  const { githubAccess, updateGitHubAccess, uiStyle } = useOneCoreStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tokens = getPageUiTokens(uiStyle);
  const cleanRepo =
    githubAccess.repoOwnerSlashName.trim().replace(/^https?:\/\//, '').replace(/\.git$/, '') ||
    'alexpikman/OneCoreAI';
  const installPs1Cmd = `irm "https://raw.githubusercontent.com/${cleanRepo}/${githubAccess.defaultBranch || 'main'}/scripts/install.ps1" | iex`;
  const cloneAndRunCmd = `git clone https://github.com/${cleanRepo}.git\ncd OneCoreAI\nnpm install --legacy-peer-deps\nnpm run dev`;

  const copyText = (id: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className={cn('p-6 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Установка приложения ({cleanRepo})
            </h2>
          </div>
          <a href={`https://github.com/${cleanRepo}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
            <span>Открыть репозиторий</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Репозиторий (owner/repo)</label>
            <input type="text" value={githubAccess.repoOwnerSlashName} onChange={(e) => updateGitHubAccess({ repoOwnerSlashName: e.target.value })} className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)} />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Ветка</label>
            <input type="text" value={githubAccess.defaultBranch} onChange={(e) => updateGitHubAccess({ defaultBranch: e.target.value })} className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)} />
          </div>
        </div>
        <div className={cn('p-3.5 bg-zinc-950 text-zinc-100 space-y-2', tokens.cardRadius)}>
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
            <span>PowerShell 1-клик (без локальной сборки MSVC)</span>
            <button type="button" onClick={() => copyText('ps1-cmd', installPs1Cmd)} className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1">
              {copiedId === 'ps1-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId === 'ps1-cmd' ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>
          <div className="font-mono text-xs break-all select-all">{installPs1Cmd}</div>
        </div>
        <div className={cn('p-3.5 bg-zinc-950 text-zinc-100 space-y-2', tokens.cardRadius)}>
          <div className="flex items-center justify-between text-[11px] font-mono text-blue-400">
            <span>Альтернатива: клонирование и запуск локально (без MSVC)</span>
            <button type="button" onClick={() => copyText('git-cmd', cloneAndRunCmd)} className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1">
              {copiedId === 'git-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId === 'git-cmd' ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>
          <pre className="font-mono text-xs whitespace-pre-wrap">{cloneAndRunCmd}</pre>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={`https://github.com/${cleanRepo}/releases`} target="_blank" rel="noopener noreferrer" className={cn('h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5', tokens.cardRadius)}>
            <span>GitHub Releases (.exe / .msi)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a href={`https://github.com/${cleanRepo}/actions/workflows/build-windows.yml`} target="_blank" rel="noopener noreferrer" className={cn('h-9 px-3.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5', tokens.cardRadius)}>
            <span>GitHub Actions (облачная сборка)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a href="/install.ps1" download="install-onecore-ai.ps1" className={cn('h-9 px-3.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5', tokens.cardRadius)}>
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Скачать install.ps1</span>
          </a>
        </div>
      </div>
    </div>
  );
};

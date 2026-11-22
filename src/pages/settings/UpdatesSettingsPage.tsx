import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderGit2,
  GitBranch,
  GitCompareArrows,
  Github,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { APP_VERSION } from '../../utils/appUpdates';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

type RepoSyncTargetType = 'app' | 'project';
type RepoSyncAuthMethod = 'pat' | 'ssh' | 'public';
type RepoPullStrategy = 'ff-only' | 'rebase-stash' | 'overwrite-from-remote';

interface RepoSyncConfigState {
  targetType: RepoSyncTargetType;
  projectId?: string;
  targetLabel: string;
  targetPath: string;
  repo: string;
  branch: string;
  authMethod: RepoSyncAuthMethod;
  gitUserName: string;
  gitUserEmail: string;
  tokenConfigured: boolean;
  globalTokenConfigured: boolean;
  gitAvailable: boolean;
  hasGitRepo: boolean;
  currentBranch: string | null;
  currentOrigin: string | null;
}

interface RepoSyncFileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'remote-only' | 'local-only';
  source: 'local' | 'remote' | 'both';
  label: string;
}

interface RepoSyncCommitSummary {
  hash: string;
  subject: string;
}

interface RepoSyncDiffReport {
  checkedAt: string;
  targetType: RepoSyncTargetType;
  projectId?: string;
  targetPath: string;
  repo: string;
  branch: string;
  hasGitRepo: boolean;
  remoteBranchExists: boolean;
  localHead: string | null;
  remoteHead: string | null;
  aheadCommits: number;
  behindCommits: number;
  incomingCommits: RepoSyncCommitSummary[];
  outgoingCommits: RepoSyncCommitSummary[];
  localDirtyFiles: RepoSyncFileDiff[];
  remoteDiffFiles: RepoSyncFileDiff[];
  allDiffFiles: RepoSyncFileDiff[];
  inSync: boolean;
  diffPreview: string;
  summary: string;
}

interface RepoSyncMutationResult {
  ok: boolean;
  action: 'pull' | 'push';
  message: string;
  needsStrategyChoice?: boolean;
  remoteAhead?: boolean;
  behindCommits?: number;
  commitHash?: string;
  initializedGitRepo?: boolean;
  diff?: RepoSyncDiffReport;
}

const FILE_STATUS_BADGES: Record<RepoSyncFileDiff['status'], string> = {
  'remote-only': 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'local-only': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  untracked: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  added: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  modified: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  renamed: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  deleted: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export const UpdatesSettingsPage: React.FC = () => {
  const {
    uiStyle,
    latestUpdate,
    updateCheckStatus,
    updateCheckError,
    checkForUpdates,
    projects,
    activeProjectId,
    githubAccess,
    updateGitHubAccess,
    saveSettings,
    refreshProjects,
    refreshProjectFiles,
    refreshProjectLogs,
  } = useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);

  const localProjects = useMemo(
    () => projects.filter((project) => project.folderSource !== 'ssh'),
    [projects],
  );

  const [targetKey, setTargetKey] = useState<string>(() => {
    const activeLocal = projects.find((p) => p.id === activeProjectId && p.folderSource !== 'ssh');
    return activeLocal ? `project:${activeLocal.id}` : 'app';
  });

  const targetParams = useMemo<{ targetType: RepoSyncTargetType; projectId?: string }>(() => {
    if (targetKey.startsWith('project:')) {
      const pid = targetKey.slice('project:'.length);
      if (localProjects.some((p) => p.id === pid)) {
        return { targetType: 'project', projectId: pid };
      }
    }
    return { targetType: 'app' };
  }, [targetKey, localProjects]);

  const [syncConfig, setSyncConfig] = useState<RepoSyncConfigState | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  const [repoInput, setRepoInput] = useState(githubAccess.repoOwnerSlashName || 'alexpikman/OneCoreAI');
  const [branchInput, setBranchInput] = useState(githubAccess.defaultBranch || 'main');
  const [authMethodInput, setAuthMethodInput] = useState<RepoSyncAuthMethod>(
    githubAccess.authMethod === 'ssh' ? 'ssh' : 'pat',
  );
  const [gitUserNameInput, setGitUserNameInput] = useState(githubAccess.gitUserName || 'OneCore Developer');
  const [gitUserEmailInput, setGitUserEmailInput] = useState(githubAccess.gitUserEmail || 'dev@onecore-ai.local');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [savingConfig, setSavingConfig] = useState(false);
  const [checkingDiff, setCheckingDiff] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [pullStrategy, setPullStrategy] = useState<RepoPullStrategy>('ff-only');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Обновление файлов из локальной копии');
  const [forcePush, setForcePush] = useState(false);

  const [diffReport, setDiffReport] = useState<RepoSyncDiffReport | null>(null);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const loadTargetConfig = useCallback(async (params: { targetType: RepoSyncTargetType; projectId?: string }) => {
    setConfigLoading(true);
    setDiffReport(null);
    setSyncNotice(null);
    setShowDiffPreview(false);
    setConfirmOverwrite(false);
    try {
      const qs = new URLSearchParams({ targetType: params.targetType });
      if (params.projectId) qs.set('projectId', params.projectId);
      const res = await fetch(`/api/repo-sync/config?${qs.toString()}`, { cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; config?: RepoSyncConfigState; error?: string };
      if (!res.ok || !data.ok || !data.config) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSyncConfig(data.config);
      setRepoInput(data.config.repo);
      setBranchInput(data.config.branch);
      setAuthMethodInput(data.config.authMethod);
      setGitUserNameInput(data.config.gitUserName);
      setGitUserEmailInput(data.config.gitUserEmail);
      setTokenInput('');
    } catch (err) {
      setSyncConfig(null);
      setSyncNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Не удалось загрузить параметры синхронизации.',
      });
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTargetConfig(targetParams);
  }, [loadTargetConfig, targetParams]);

  const handleSaveConfig = async (options?: { clearToken?: boolean }): Promise<RepoSyncConfigState | null> => {
    setSavingConfig(true);
    setSyncNotice(null);
    try {
      const res = await fetch('/api/repo-sync/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: targetParams.targetType,
          projectId: targetParams.projectId,
          repo: repoInput.trim(),
          branch: branchInput.trim(),
          authMethod: authMethodInput,
          gitUserName: gitUserNameInput.trim(),
          gitUserEmail: gitUserEmailInput.trim(),
          ...(tokenInput.trim() ? { token: tokenInput.trim() } : {}),
          ...(options?.clearToken ? { clearToken: true } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; config?: RepoSyncConfigState; error?: string };
      if (!res.ok || !data.ok || !data.config) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSyncConfig(data.config);
      setRepoInput(data.config.repo);
      setBranchInput(data.config.branch);
      setAuthMethodInput(data.config.authMethod);
      setGitUserNameInput(data.config.gitUserName);
      setGitUserEmailInput(data.config.gitUserEmail);
      setTokenInput('');

      if (targetParams.targetType === 'app') {
        updateGitHubAccess({
          repoOwnerSlashName: data.config.repo,
          defaultBranch: data.config.branch,
          authMethod: data.config.authMethod === 'ssh' ? 'ssh' : 'pat',
          gitUserName: data.config.gitUserName,
          gitUserEmail: data.config.gitUserEmail,
        });
        await saveSettings();
      } else {
        await refreshProjects();
      }

      setSyncNotice({
        tone: 'success',
        text: options?.clearToken
          ? 'Токен удалён из хранилища, параметры синхронизации сохранены.'
          : 'Параметры синхронизации с GitHub сохранены.',
      });
      return data.config;
    } catch (err) {
      setSyncNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Не удалось сохранить настройки синхронизации.',
      });
      return null;
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCheckDiff = async () => {
    setCheckingDiff(true);
    setSyncNotice(null);
    try {
      if (tokenInput.trim()) {
        const saved = await handleSaveConfig();
        if (!saved) {
          setCheckingDiff(false);
          return;
        }
      }
      const res = await fetch('/api/repo-sync/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: targetParams.targetType,
          projectId: targetParams.projectId,
          repo: repoInput.trim(),
          branch: branchInput.trim(),
          authMethod: authMethodInput,
          approved: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; diff?: RepoSyncDiffReport; error?: string };
      if (!res.ok || !data.ok || !data.diff) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setDiffReport(data.diff);
      setSyncNotice({
        tone: data.diff.inSync ? 'success' : 'warning',
        text: data.diff.summary,
      });
    } catch (err) {
      setSyncNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Не удалось проверить изменения и различия с GitHub.',
      });
    } finally {
      setCheckingDiff(false);
    }
  };

  const handlePull = async () => {
    if (pullStrategy === 'overwrite-from-remote' && !confirmOverwrite) {
      setSyncNotice({
        tone: 'warning',
        text: 'Подтвердите перезапись локальных файлов флагом под выбором режима перед обновлением с GitHub.',
      });
      return;
    }
    setPulling(true);
    setSyncNotice(null);
    try {
      if (tokenInput.trim()) {
        const saved = await handleSaveConfig();
        if (!saved) {
          setPulling(false);
          return;
        }
      }
      const res = await fetch('/api/repo-sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: targetParams.targetType,
          projectId: targetParams.projectId,
          repo: repoInput.trim(),
          branch: branchInput.trim(),
          authMethod: authMethodInput,
          strategy: pullStrategy,
          gitUserName: gitUserNameInput.trim(),
          gitUserEmail: gitUserEmailInput.trim(),
          approved: true,
        }),
      });
      const data = (await res.json()) as RepoSyncMutationResult & { error?: string };
      if (data.diff) {
        setDiffReport(data.diff);
      }
      if (!res.ok || !data.ok) {
        if (data.needsStrategyChoice && pullStrategy === 'ff-only') {
          setPullStrategy('rebase-stash');
        }
        setSyncNotice({
          tone: data.needsStrategyChoice ? 'warning' : 'error',
          text: data.message || data.error || `HTTP ${res.status}`,
        });
        return;
      }

      setConfirmOverwrite(false);
      setSyncNotice({ tone: 'success', text: data.message });
      await loadTargetConfig(targetParams);
      if (data.diff) setDiffReport(data.diff);
      setSyncNotice({ tone: 'success', text: data.message });
      if (targetParams.projectId) {
        await Promise.all([
          refreshProjectFiles(targetParams.projectId),
          refreshProjectLogs(targetParams.projectId),
        ]);
      }
    } catch (err) {
      setSyncNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при обновлении файлов с GitHub.',
      });
    } finally {
      setPulling(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    setSyncNotice(null);
    try {
      if (tokenInput.trim()) {
        const saved = await handleSaveConfig();
        if (!saved) {
          setPushing(false);
          return;
        }
      }
      const res = await fetch('/api/repo-sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: targetParams.targetType,
          projectId: targetParams.projectId,
          repo: repoInput.trim(),
          branch: branchInput.trim(),
          authMethod: authMethodInput,
          gitUserName: gitUserNameInput.trim(),
          gitUserEmail: gitUserEmailInput.trim(),
          commitMessage: commitMessage.trim(),
          forcePush,
          approved: true,
        }),
      });
      const data = (await res.json()) as RepoSyncMutationResult & { error?: string };
      if (data.diff) {
        setDiffReport(data.diff);
      }
      if (!res.ok || !data.ok) {
        setSyncNotice({
          tone: data.remoteAhead ? 'warning' : 'error',
          text: data.message || data.error || `HTTP ${res.status}`,
        });
        return;
      }

      setForcePush(false);
      await loadTargetConfig(targetParams);
      if (data.diff) setDiffReport(data.diff);
      setSyncNotice({ tone: 'success', text: data.message });
      if (targetParams.projectId) {
        await refreshProjectLogs(targetParams.projectId);
      }
    } catch (err) {
      setSyncNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при выгрузке обновлений на GitHub.',
      });
    } finally {
      setPushing(false);
    }
  };

  const busy = configLoading || savingConfig || checkingDiff || pulling || pushing;

  return (
    <PageLayout>
      <PageHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold">Обновления</h1>
          </div>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-5 py-6">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Текущая версия: <span className="font-mono">v{APP_VERSION}</span>
        </p>

        {/* 1. Release Check Card */}
        <div className={cn('p-6 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Доступные обновления
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Проверка выполняется по публичным GitHub Releases без API-ключа.
              </p>
            </div>
            <button
              type="button"
              disabled={updateCheckStatus === 'checking'}
              onClick={() => void checkForUpdates()}
              className={cn(
                'h-9 px-3.5 border text-xs font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap',
                tokens.cardRadius,
                tokens.accentButton,
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', updateCheckStatus === 'checking' && 'animate-spin')} />
              <span>{updateCheckStatus === 'checking' ? 'Проверяем…' : 'Проверить обновления'}</span>
            </button>
          </div>

          {updateCheckStatus === 'error' && (
            <div className="p-3 border border-rose-500/30 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-300">
              {updateCheckError || 'Не удалось проверить обновления.'}
            </div>
          )}

          {updateCheckStatus === 'current' && (
            <div className="p-3 border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-300">
              Установлена последняя версия{latestUpdate ? ` (v${latestUpdate.version})` : ''}.
            </div>
          )}

          {latestUpdate?.isNewer && (
            <div className="p-4 border border-blue-500/30 bg-blue-500/5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Доступна версия v{latestUpdate.version}
                  </div>
                  {latestUpdate.publishedAt && (
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Опубликована {new Date(latestUpdate.publishedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <a
                  href={latestUpdate.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap',
                    tokens.cardRadius,
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать установщик</span>
                </a>
              </div>
              {latestUpdate.notes && (
                <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap line-clamp-8">
                  {latestUpdate.notes}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={latestUpdate.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Примечания к релизу <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-[11px] text-zinc-500">
                  Установку нужно подтвердить в загруженном установщике. Фоновая автоустановка требует подписи обновлений.
                </span>
              </div>
            </div>
          )}

          {updateCheckStatus === 'idle' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Проверка версии запускается автоматически при старте приложения.
            </p>
          )}
        </div>

        {/* 2. GitHub Repository Files Sync Card */}
        <div className={cn('p-6 border space-y-5', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Синхронизация файлов с GitHub
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Проверка изменений и различий, обновление файлов из репозитория GitHub и выгрузка локальных правок обратно на GitHub.
              </p>
            </div>
            <button
              type="button"
              disabled={busy || (syncConfig ? !syncConfig.gitAvailable : false)}
              onClick={() => void handleCheckDiff()}
              className={cn(
                'h-9 px-3.5 border text-xs font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap',
                tokens.cardRadius,
                tokens.accentButton,
              )}
            >
              {checkingDiff ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitCompareArrows className="w-3.5 h-3.5" />
              )}
              <span>{checkingDiff ? 'Проверяем различия…' : 'Актуализировать'}</span>
            </button>
          </div>

          {/* Target & Path Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-5">
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Объект синхронизации
              </label>
              <select
                value={targetParams.projectId ? `project:${targetParams.projectId}` : 'app'}
                onChange={(e) => setTargetKey(e.target.value)}
                disabled={busy}
                className={cn(
                  'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                  tokens.inputRadius,
                )}
              >
                <option value="app">Локальная копия приложения (OneCoreAI)</option>
                {localProjects.map((project) => (
                  <option key={project.id} value={`project:${project.id}`}>
                    Проект: {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-7">
              <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-full">
                  {syncConfig?.targetPath || 'Загрузка пути…'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {syncConfig && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded border text-[10px] font-medium',
                        syncConfig.hasGitRepo
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {syncConfig.hasGitRepo
                        ? `Git: ${syncConfig.currentBranch || 'HEAD'}`
                        : 'Без .git (сравнение файлов)'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {syncConfig && !syncConfig.gitAvailable && (
            <div className="p-3 border border-rose-500/30 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-300">
              Системный бинарник <span className="font-mono">git</span> не найден в PATH. Установите Git для синхронизации файлов с GitHub.
            </div>
          )}

          {/* Settings Fields */}
          <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 rounded-xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  Репозиторий GitHub (owner/repo)
                </label>
                <div className="relative">
                  <Github className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="owner/repo"
                    className={cn(
                      'w-full h-9 pl-8 pr-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                      tokens.inputRadius,
                    )}
                  />
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">Ветка</label>
                <div className="relative">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="main"
                    className={cn(
                      'w-full h-9 pl-8 pr-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                      tokens.inputRadius,
                    )}
                  />
                </div>
              </div>
              <div className="md:col-span-4">
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  Метод авторизации
                </label>
                <select
                  value={authMethodInput}
                  onChange={(e) => setAuthMethodInput(e.target.value as RepoSyncAuthMethod)}
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                    tokens.inputRadius,
                  )}
                >
                  <option value="pat">Токен GitHub (PAT / HTTPS)</option>
                  <option value="ssh">SSH-ключ (git@github.com)</option>
                  <option value="public">Публичный доступ (только загрузка)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {authMethodInput === 'pat' && (
                <div className="md:col-span-6">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                      GitHub Personal Access Token (PAT)
                    </label>
                    {syncConfig?.tokenConfigured && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <KeyRound className="w-3 h-3" />
                        Токен сохранён в сейфе
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder={
                          syncConfig?.tokenConfigured
                            ? '•••••••• (оставьте пустым, чтобы использовать сохранённый)'
                            : 'ghp_... или github_pat_...'
                        }
                        className={cn(
                          'w-full h-9 pl-3 pr-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                          tokens.inputRadius,
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((v) => !v)}
                        aria-label="Показать или скрыть токен"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {syncConfig?.tokenConfigured && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveConfig({ clearToken: true })}
                        className={cn(
                          'h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 whitespace-nowrap disabled:opacity-50',
                          tokens.inputRadius,
                        )}
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className={authMethodInput === 'pat' ? 'md:col-span-3' : 'md:col-span-4'}>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  Git user.name
                </label>
                <input
                  type="text"
                  value={gitUserNameInput}
                  onChange={(e) => setGitUserNameInput(e.target.value)}
                  placeholder="OneCore Developer"
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                    tokens.inputRadius,
                  )}
                />
              </div>

              <div className={authMethodInput === 'pat' ? 'md:col-span-3' : 'md:col-span-5'}>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  Git user.email
                </label>
                <input
                  type="email"
                  value={gitUserEmailInput}
                  onChange={(e) => setGitUserEmailInput(e.target.value)}
                  placeholder="dev@onecore-ai.local"
                  className={cn(
                    'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                    tokens.inputRadius,
                  )}
                />
              </div>

              {authMethodInput !== 'pat' && (
                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveConfig()}
                    className={cn(
                      'w-full h-9 px-3 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-100 inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50',
                      tokens.cardRadius,
                    )}
                  >
                    {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Сохранить параметры</span>
                  </button>
                </div>
              )}
            </div>

            {authMethodInput === 'pat' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSaveConfig()}
                  className={cn(
                    'h-9 px-3.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-100 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50',
                    tokens.cardRadius,
                  )}
                >
                  {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Сохранить параметры</span>
                </button>
              </div>
            )}
          </div>

          {/* Status / Notice Banner */}
          {syncNotice && (
            <div
              className={cn(
                'p-3 border text-xs flex items-start gap-2.5 rounded-lg',
                syncNotice.tone === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                  : syncNotice.tone === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300',
              )}
            >
              {syncNotice.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              )}
              <span className="leading-relaxed">{syncNotice.text}</span>
            </div>
          )}

          {/* Diff Report Panel */}
          {diffReport && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/70 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Состояние файлов: {diffReport.repo} ({diffReport.branch})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
                    Локально: {diffReport.localHead ?? 'нет HEAD'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
                    GitHub: {diffReport.remoteHead ?? 'ветка не создана'}
                  </span>
                  {diffReport.behindCommits > 0 && (
                    <span className="px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                      С GitHub: +{diffReport.behindCommits}
                    </span>
                  )}
                  {diffReport.aheadCommits > 0 && (
                    <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      На отправку: +{diffReport.aheadCommits}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500">
                  Проверено: {new Date(diffReport.checkedAt).toLocaleTimeString('ru-RU')}
                </span>
              </div>

              <div className="p-4 space-y-3 bg-white dark:bg-zinc-950/60">
                {(diffReport.incomingCommits.length > 0 || diffReport.outgoingCommits.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {diffReport.incomingCommits.length > 0 && (
                      <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1.5">
                        <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                          Новые коммиты на GitHub
                        </div>
                        <ul className="space-y-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                          {diffReport.incomingCommits.slice(0, 6).map((c) => (
                            <li key={c.hash} className="truncate">
                              <span className="text-blue-500 mr-1.5">{c.hash}</span>
                              {c.subject}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {diffReport.outgoingCommits.length > 0 && (
                      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                        <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Локальные коммиты к выгрузке
                        </div>
                        <ul className="space-y-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                          {diffReport.outgoingCommits.slice(0, 6).map((c) => (
                            <li key={c.hash} className="truncate">
                              <span className="text-emerald-500 mr-1.5">{c.hash}</span>
                              {c.subject}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {diffReport.allDiffFiles.length === 0 ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Различий в файлах между локальной копией и веткой {diffReport.branch} не обнаружено.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Различающиеся и изменённые файлы ({diffReport.allDiffFiles.length}):
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      {diffReport.allDiffFiles.slice(0, 200).map((file) => (
                        <div
                          key={`${file.status}:${file.path}`}
                          className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 truncate">
                            {file.path}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded border text-[10px] font-medium shrink-0',
                              FILE_STATUS_BADGES[file.status],
                            )}
                          >
                            {file.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {diffReport.diffPreview && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowDiffPreview((v) => !v)}
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {showDiffPreview ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          <span>{showDiffPreview ? 'Скрыть детали diff' : 'Показать детали различий (diff)'}</span>
                        </button>
                        {showDiffPreview && (
                          <pre className="mt-2 p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-[11px] leading-5 overflow-x-auto max-h-72 overflow-y-auto">
                            {diffReport.diffPreview}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync Actions: Pull & Push */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pull from GitHub */}
            <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <ArrowDownToLine className="w-4 h-4 text-blue-500" />
                  <span>Обновиться с GitHub</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Загружает файлы из выбранной ветки GitHub в локальную копию.
                </p>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Режим обновления при локальных изменениях
                  </label>
                  <select
                    value={pullStrategy}
                    onChange={(e) => {
                      setPullStrategy(e.target.value as RepoPullStrategy);
                      setConfirmOverwrite(false);
                    }}
                    className={cn(
                      'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100',
                      tokens.inputRadius,
                    )}
                  >
                    <option value="ff-only">Безопасно (только fast-forward)</option>
                    <option value="rebase-stash">Сохранить локальные правки и обновить (stash + rebase)</option>
                    <option value="overwrite-from-remote">Перезаписать локальные файлы из GitHub</option>
                  </select>
                </div>

                {pullStrategy === 'overwrite-from-remote' && (
                  <label className="flex items-start gap-2 p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[11px] text-rose-700 dark:text-rose-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmOverwrite}
                      onChange={(e) => setConfirmOverwrite(e.target.checked)}
                      className="mt-0.5 accent-rose-600"
                    />
                    <span>
                      Подтверждаю перезапись локальных незафиксированных файлов версией с GitHub (файлы из .gitignore, такие как .env и node_modules, не затрагиваются).
                    </span>
                  </label>
                )}
              </div>

              <button
                type="button"
                disabled={busy || (syncConfig ? !syncConfig.gitAvailable : false)}
                onClick={() => void handlePull()}
                className={cn(
                  'w-full h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50',
                  tokens.cardRadius,
                )}
              >
                {pulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
                <span>{pulling ? 'Обновляем с GitHub…' : 'Обновиться с GitHub'}</span>
              </button>
            </div>

            {/* Push to GitHub */}
            <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <ArrowUpFromLine className="w-4 h-4 text-emerald-500" />
                  <span>Выгрузить на GitHub</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Фиксирует локальные изменения (commit) и отправляет их в выбранную ветку GitHub (push).
                </p>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Сообщение коммита
                  </label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Обновление файлов из локальной копии"
                    className={cn(
                      'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500',
                      tokens.inputRadius,
                    )}
                  />
                </div>
                <label className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forcePush}
                    onChange={(e) => setForcePush(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  <span>Принудительная отправка (--force-with-lease), если ветки разошлись</span>
                </label>
              </div>

              <button
                type="button"
                disabled={busy || authMethodInput === 'public' || (syncConfig ? !syncConfig.gitAvailable : false)}
                onClick={() => void handlePush()}
                className={cn(
                  'w-full h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50',
                  tokens.cardRadius,
                )}
              >
                {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpFromLine className="w-3.5 h-3.5" />}
                <span>
                  {pushing
                    ? 'Выгружаем на GitHub…'
                    : authMethodInput === 'public'
                      ? 'Для выгрузки выберите PAT или SSH'
                      : 'Выгрузить на GitHub'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

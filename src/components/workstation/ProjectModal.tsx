import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  GitBranch,
  KeyRound,
  Loader2,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { useOneCoreStore, type SaveProjectPayload } from '../../store/useOneCoreStore';
import type { ProjectFolderSource, ProjectRecord } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { ProjectModalTabs } from './ProjectModalTabs';
import { requestDeleteWarning } from '../../utils/deleteWarning';

interface ProjectModalProps {
  open: boolean;
  editingProject: ProjectRecord | null;
  onClose: () => void;
}

const TOOL_OPTIONS = [
  { id: 'read_file', label: 'Чтение файлов' },
  { id: 'write_file', label: 'Запись / Правка файлов' },
  { id: 'search_code', label: 'Поиск по коду' },
  { id: 'run_command', label: 'Запуск команд (Shell)' },
  { id: 'git', label: 'Git операции' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({ open, editingProject, onClose }) => {
  const { localModels, freeProviders, saveProject, deleteProject, connectProject, projects } = useOneCoreStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folderSource, setFolderSource] = useState<ProjectFolderSource>('local');
  const [folderPath, setFolderPath] = useState('');
  const [allowedTools, setAllowedTools] = useState<string[]>([
    'read_file',
    'write_file',
    'search_code',
    'run_command',
    'git',
  ]);
  const [defaultModelId, setDefaultModelId] = useState('');

  // SSH fields
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('');
  const [sshRemotePath, setSshRemotePath] = useState('');
  const [sshAuthType, setSshAuthType] = useState<'key' | 'agent' | 'password'>('key');
  const [sshKeyPath, setSshKeyPath] = useState('~/.ssh/id_ed25519');
  const [sshPassword, setSshPassword] = useState('');
  const [sshTestStatus, setSshTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sshTesting, setSshTesting] = useState(false);

  // GitHub fields
  const [ghRepo, setGhRepo] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghAuthMethod, setGhAuthMethod] = useState<'public' | 'pat' | 'ssh'>('public');
  const [ghToken, setGhToken] = useState('');
  const [ghLocalClonePath, setGhLocalClonePath] = useState('');
  const [ghTestStatus, setGhTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ghTesting, setGhTesting] = useState(false);

  const [nativePickerNote, setNativePickerNote] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'project' | 'files' | 'tasks' | 'actions'>('project');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Show existing projects to connect to when creating a new modal (no editingProject)
  const existingProjects = projects.filter((p) => p.id !== editingProject?.id);

  const handleConnectExisting = async (pid: string) => {
    await connectProject(pid);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setActiveTab('project');
    setNativePickerNote(null);
    setSshTestStatus(null);
    setGhTestStatus(null);

    if (editingProject) {
      setName(editingProject.name);
      setDescription(editingProject.description || '');
      setFolderSource(editingProject.folderSource);
      setFolderPath(editingProject.folderPath);
      setAllowedTools(editingProject.allowedTools.map((tool) => tool === 'exec_command' ? 'run_command' : tool));
      setDefaultModelId(editingProject.defaultModelId || '');
      if (editingProject.sshConfig) {
        setSshHost(editingProject.sshConfig.host);
        setSshPort(editingProject.sshConfig.port);
        setSshUser(editingProject.sshConfig.user);
        setSshRemotePath(editingProject.sshConfig.remotePath);
        setSshAuthType(editingProject.sshConfig.authType);
        setSshKeyPath(editingProject.sshConfig.keyPath || '');
      }
      if (editingProject.githubConfig) {
        setGhRepo(editingProject.githubConfig.repo);
        setGhBranch(editingProject.githubConfig.branch);
        setGhAuthMethod(editingProject.githubConfig.authMethod);
        setGhLocalClonePath(editingProject.folderPath || '');
      }
    } else {
      setName('');
      setDescription('');
      setFolderSource('local');
      setFolderPath('');
      setAllowedTools(['read_file', 'write_file', 'search_code', 'run_command', 'git']);
      setDefaultModelId('');
      setSshHost('');
      setSshPort(22);
      setSshUser('');
      setSshRemotePath('');
      setSshAuthType('key');
      setSshKeyPath('~/.ssh/id_ed25519');
      setSshPassword('');
      setGhRepo('');
      setGhBranch('main');
      setGhAuthMethod('public');
      setGhToken('');
      setGhLocalClonePath('');
    }
  }, [open, editingProject]);

  if (!open) return null;

  const toggleTool = (toolId: string) => {
    setAllowedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const handleNativePick = async () => {
    setNativePickerNote(null);
    try {
      const res = await fetch('/api/fs/pick-native', { method: 'POST' });
      const data = (await res.json()) as { supported?: boolean; path?: string; reason?: string };
      if (data.supported && data.path) {
        setFolderPath(data.path);
      } else {
        setNativePickerNote(
          data.reason || 'Системный диалог недоступен в этом окружении; укажите путь к папке вручную.',
        );
      }
    } catch (err) {
      setNativePickerNote(err instanceof Error ? err.message : 'Ошибка вызова системного диалога');
    }
  };

  const handleTestSsh = async () => {
    setSshTesting(true);
    setSshTestStatus(null);
    try {
      const res = await fetch('/api/ssh/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: sshHost.trim(),
          port: sshPort,
          user: sshUser.trim(),
          remotePath: sshRemotePath.trim(),
          authType: sshAuthType,
          identityFile: sshKeyPath.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; latencyMs?: number };
      setSshTestStatus({
        ok: Boolean(data.ok),
        msg: data.ok
          ? `SSH соединение и каталог подтверждены (${data.latencyMs ?? 0} мс)`
          : data.error || 'Ошибка SSH',
      });
    } catch (err) {
      setSshTestStatus({
        ok: false,
        msg: err instanceof Error ? err.message : 'Сетевая ошибка SSH',
      });
    } finally {
      setSshTesting(false);
    }
  };

  const handleVerifyGithub = async () => {
    setGhTesting(true);
    setGhTestStatus(null);
    try {
      const res = await fetch('/api/github/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: ghRepo.trim(), token: ghToken.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        repo?: { fullName: string; defaultBranch: string; isPrivate: boolean };
      };
      if (!res.ok || !data.ok || !data.repo) {
        setGhTestStatus({ ok: false, msg: data.error || `HTTP ${res.status}` });
      } else {
        setGhTestStatus({
          ok: true,
          msg: `Доступ подтверждён: ${data.repo.fullName} (${data.repo.isPrivate ? 'приватный' : 'публичный'}, ветка ${data.repo.defaultBranch})`,
        });
        if (!ghBranch.trim()) {
          setGhBranch(data.repo.defaultBranch);
        }
      }
    } catch (err) {
      setGhTestStatus({ ok: false, msg: err instanceof Error ? err.message : 'Ошибка GitHub API' });
    } finally {
      setGhTesting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Укажите название проекта.');
      return;
    }

    if (folderSource === 'local' && !folderPath.trim()) {
      setErrorMsg('Обязательно выберите или укажите локальную папку проекта.');
      return;
    }
    if (folderSource === 'ssh' && (!sshHost.trim() || !sshUser.trim() || !sshRemotePath.trim())) {
      setErrorMsg('Укажите SSH host, user и удалённый путь к папке проекта.');
      return;
    }
    if (folderSource === 'github' && !ghRepo.trim()) {
      setErrorMsg('Укажите GitHub репозиторий в формате owner/repo.');
      return;
    }

    const payload: SaveProjectPayload = {
      id: editingProject?.id,
      name: name.trim(),
      description: description.trim(),
      folderSource,
      folderPath: folderPath.trim(),
      allowedTools,
      defaultModelId,
    };

    if (folderSource === 'ssh') {
      payload.sshConfig = {
        host: sshHost.trim(),
        port: Number(sshPort) || 22,
        user: sshUser.trim(),
        remotePath: sshRemotePath.trim(),
        authType: sshAuthType,
        keyPath: sshKeyPath.trim() || undefined,
        password: sshPassword || undefined,
      };
    } else if (folderSource === 'github') {
      payload.githubConfig = {
        repo: ghRepo.trim(),
        branch: ghBranch.trim() || 'main',
        authMethod: ghAuthMethod,
        token: ghToken.trim() || undefined,
        localClonePath: ghLocalClonePath.trim() || undefined,
      };
    }

    setSaving(true);
    const result = await saveProject(payload);
    setSaving(false);

    if (!result.ok) {
      setErrorMsg(result.error || 'Не удалось сохранить проект.');
      return;
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!editingProject) return;
    const confirmed = await requestDeleteWarning({ variant: 'confirmation', title: 'Удалить проект?', description: 'Будут удалены проект, его план, задачи, разрешения, журнал действий и связанные записи журнала AI. Файлы в папке проекта на диске останутся.', itemName: editingProject.name, confirmLabel: 'Удалить проект' });
    if (!confirmed) return;
    setSaving(true);
    const result = await deleteProject(editingProject.id);
    setSaving(false);
    if (!result.ok) {
      setErrorMsg('Не удалось удалить проект. Проверьте соединение и повторите попытку.');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative flex h-[min(84vh,780px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {editingProject ? `Настройки проекта «${editingProject.name}»` : 'Новый рабочий проект'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Без подтверждённой папки (локальной, SSH или GitHub) проект не сохраняется.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>Сохранить</span>
            </button>
            {editingProject && (
              <button type="button" onClick={() => void handleDelete()} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 text-xs font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-400">
                <Trash2 className="h-3.5 w-3.5" />
                <span>Удалить</span>
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!editingProject && existingProjects.length > 0 && (
          <div className="max-h-[30%] shrink-0 space-y-3 overflow-y-auto border-b border-zinc-200 p-5 pb-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Подключить существующий проект
              </span>
            </div>
            <div className="space-y-1">
              {existingProjects.map((proj) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => void handleConnectExisting(proj.id)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-500 dark:hover:border-blue-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{proj.name}</span>
                    <span className="text-[10px] text-zinc-500">{proj.folderSource}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                    {proj.folderPath}
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
              <span className="text-[10px] text-zinc-500 italic">
                Или создайте новый проект ниже
              </span>
            </div>
          </div>
        )}

        <ProjectModalTabs project={editingProject} activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'project' && <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Название проекта *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: My Python Service"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Модель по умолчанию
              </label>
              <select
                value={defaultModelId}
                onChange={(e) => setDefaultModelId(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Текущий активный провайдер</option>
                {localModels
                  .filter((m) => m.status === 'ready')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      GGUF: {m.name} ({m.quant})
                    </option>
                  ))}
                {freeProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    API: {p.name} ({p.selectedModel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Описание проекта
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко о задачах проекта и стеке..."
              className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Выбор папки</label>
            <div className="flex items-center gap-2">
              <input type="text" value={folderPath} onChange={(event) => setFolderPath(event.target.value)} placeholder="Путь к папке проекта" className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              <button type="button" onClick={() => void handleNativePick()} className="h-9 shrink-0 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:border-blue-500 dark:border-zinc-700 dark:text-zinc-200">Выбрать</button>
            </div>
            {nativePickerNote && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{nativePickerNote}</p>}
          </div>

          </>}
          {activeTab === 'files' && <>
          {/* Folder Source Switcher */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Источник папки проекта *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'local', label: 'Локальная папка', icon: FolderOpen },
                  { id: 'ssh', label: 'Удалённо по SSH', icon: Server },
                  { id: 'github', label: 'GitHub Clone', icon: GitBranch },
                ] as const
              ).map((src) => {
                const Icon = src.icon;
                const active = folderSource === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setFolderSource(src.id)}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                      active
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{src.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Local project files are displayed in the Files tab. */}

          {/* Source 2: SSH */}
          {folderSource === 'ssh' && (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="Host / IP (e.g. 192.168.1.10)"
                  className="sm:col-span-2 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
                <input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(Number(e.target.value) || 22)}
                  placeholder="22"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="Пользователь (user)"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
                <input
                  type="text"
                  value={sshRemotePath}
                  onChange={(e) => setSshRemotePath(e.target.value)}
                  placeholder="Удалённый путь (/home/dev/app)"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={sshAuthType}
                  onChange={(e) => setSshAuthType(e.target.value as 'key' | 'agent' | 'password')}
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                >
                  <option value="key">SSH ключ</option>
                  <option value="agent">ssh-agent</option>
                  <option value="password">Пароль (в системный vault)</option>
                </select>
                {sshAuthType === 'key' ? (
                  <input
                    type="text"
                    value={sshKeyPath}
                    onChange={(e) => setSshKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_ed25519"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                  />
                ) : sshAuthType === 'password' ? (
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="SSH пароль (шифруется в vault)"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                  />
                ) : (
                  <div className="h-8 px-2.5 flex items-center text-[11px] text-zinc-500">
                    Используется SSH_AUTH_SOCK
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={sshTesting}
                  onClick={handleTestSsh}
                  className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 hover:border-blue-500"
                >
                  {sshTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                  <span>Проверить SSH и права на папку</span>
                </button>
                {sshTestStatus && (
                  <span
                    className={cn(
                      'text-[11px] truncate max-w-[260px]',
                      sshTestStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
                    )}
                    title={sshTestStatus.msg}
                  >
                    {sshTestStatus.msg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Source 3: GitHub */}
          {folderSource === 'github' && (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={ghRepo}
                  onChange={(e) => setGhRepo(e.target.value)}
                  placeholder="owner/repo"
                  className="sm:col-span-2 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
                <input
                  type="text"
                  value={ghBranch}
                  onChange={(e) => setGhBranch(e.target.value)}
                  placeholder="main"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={ghAuthMethod}
                  onChange={(e) => setGhAuthMethod(e.target.value as 'public' | 'pat' | 'ssh')}
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                >
                  <option value="public">Публичный HTTPS</option>
                  <option value="pat">Personal Access Token (в vault)</option>
                  <option value="ssh">Git over SSH</option>
                </select>
                {ghAuthMethod === 'pat' ? (
                  <input
                    type="password"
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    placeholder="ghp_... (сохраняется в vault)"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                  />
                ) : (
                  <input
                    type="text"
                    value={ghLocalClonePath}
                    onChange={(e) => setGhLocalClonePath(e.target.value)}
                    placeholder="Папка клона (опц., иначе ~/.onecore-ai/repos)"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={ghTesting || !ghRepo.trim()}
                  onClick={handleVerifyGithub}
                  className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 hover:border-blue-500 disabled:opacity-45"
                >
                  {ghTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>Проверить доступ GitHub API</span>
                </button>
                {ghTestStatus && (
                  <span
                    className={cn(
                      'text-[11px] truncate max-w-[280px]',
                      ghTestStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
                    )}
                    title={ghTestStatus.msg}
                  >
                    {ghTestStatus.msg}
                  </span>
                )}
              </div>
            </div>
          )}

          </>}
          {activeTab === 'project' && <>
          {/* Allowed Tools */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Разрешённые инструменты агента
            </label>
            <div className="flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((t) => {
                const checked = allowedTools.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors',
                      checked
                        ? 'border-blue-500/60 bg-blue-500/10 text-zinc-900 dark:text-zinc-100'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTool(t.id)}
                      className="accent-blue-600"
                    />
                    <span>{t.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          </>}
        </div>
        </ProjectModalTabs>
      </div>
    </div>
  );
};

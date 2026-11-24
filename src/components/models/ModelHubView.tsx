import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  ExternalLink,
  FolderInput,
  FolderOpen,
  HardDrive,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { CURATED_GGUF_MODELS } from '../../data/curatedModels';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { GgufFileVariant, LocalModel, ModelCatalogItem, ModelRecommendation } from '../../types/onecore';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';
import { AIResourcePageLayout as PageLayout } from '../layout/AIResourcePageLayout';
import { PageContent } from '../layout/PageContent';
import { PageHeader } from '../layout/PageHeader';
import { SecondaryTabBar } from '../layout/SecondaryTabBar';

type HubSubTab = 'search' | 'library' | 'import';
type InstallTargetMode = 'global' | 'project';
type SourceFilter = 'all' | 'huggingface' | 'curated';
type QuantFilter = 'ALL' | 'Q4_K_M' | 'Q5_K_M' | 'Q8_0' | 'IQ4_XS';
type SortOption = 'downloads' | 'likes' | 'size-asc' | 'fits-vram';

const QUICK_SEARCH_PRESETS: Array<{ label: string; query: string }> = [
  { label: 'Qwen 2.5 Coder', query: 'Qwen2.5-Coder GGUF' },
  { label: 'DeepSeek R1', query: 'DeepSeek-R1 GGUF' },
  { label: 'Llama 3.3', query: 'Llama-3.3 GGUF' },
  { label: 'Phi-4', query: 'phi-4 GGUF' },
  { label: 'Gemma 3', query: 'gemma-3 GGUF' },
  { label: 'Mistral', query: 'Mistral GGUF' },
  { label: 'Nomic Embed', query: 'nomic-embed GGUF' },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatEta(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}с`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}м ${secs}с`;
}

function joinProjectModelsDir(folderPath: string): string {
  const clean = folderPath.replace(/[\\/]+$/, '');
  const sep = clean.includes('\\') && !clean.includes('/') ? '\\' : '/';
  return `${clean}${sep}models`;
}

export const ModelHubView: React.FC<{ title?: string }> = ({ title = 'Поиск моделей' }) => {
  const {
    hardwareProfile,
    appSettings,
    updateAppSettings,
    refreshLocalModels,
    localModels,
    localModelsError,
    activeModelId,
    selectLocalModel,
    deleteLocalModel,
    startDownload,
    startDownloadFromCatalog,
    togglePauseDownload,
    importLocalModelFile,
    pullOllamaModel,
    projects,
    activeProjectId,
    projectMemoryModelPaths,
    fetchProjectMemoryModels,
    installModelToProjectMemory,
    removeModelFromProjectMemory,
    settingsError,
    setActiveTab,
    ggufHubTab,
    setGgufHubTab,
    setSettingsSection,
    setLlamaModelsSection,
  } = useOneCoreStore();

  const hubTab = ggufHubTab;
  const setHubTab = setGgufHubTab;
  const [installMode, setInstallMode] = useState<InstallTargetMode>('global');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || projects[0]?.id || '');

  const [query, setQuery] = useState('Qwen 2.5 Coder GGUF');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [quantFilter, setQuantFilter] = useState<QuantFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('downloads');
  const [hideTooHeavy, setHideTooHeavy] = useState(false);

  const [hfModels, setHfModels] = useState<ModelCatalogItem[]>([]);
  const [hfLoading, setHfLoading] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);
  const [recommendationsMap, setRecommendationsMap] = useState<Record<string, ModelRecommendation>>({});

  const [expandedRepoId, setExpandedRepoId] = useState<string | null>(null);
  const [repoFilesMap, setRepoFilesMap] = useState<Record<string, GgufFileVariant[]>>({});
  const [loadingFilesFor, setLoadingFilesFor] = useState<string | null>(null);

  const [directUrl, setDirectUrl] = useState('');
  const [ollamaModelName, setOllamaModelName] = useState('');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://127.0.0.1:11434');
  const [importFilePath, setImportFilePath] = useState('');
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);
  const [scanningDisk, setScanningDisk] = useState(false);
  const [memoryBusyId, setMemoryBusyId] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (selectedProjectId && projects.some((p) => p.id === selectedProjectId)) return;
    setSelectedProjectId(activeProjectId || projects[0]?.id || '');
  }, [activeProjectId, projects, selectedProjectId]);

  const targetProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const registeredMemoryPaths = useMemo(
    () => (targetProject ? projectMemoryModelPaths[targetProject.id] ?? [] : []),
    [projectMemoryModelPaths, targetProject],
  );

  useEffect(() => {
    if (targetProject?.id) {
      void fetchProjectMemoryModels(targetProject.id);
    }
  }, [targetProject?.id, fetchProjectMemoryModels]);

  const fetchHuggingFace = useCallback(
    async (searchText: string, remoteSort: 'downloads' | 'likes' = 'downloads') => {
      setHfLoading(true);
      setHfError(null);
      try {
        const res = await fetch(
          `/api/hf/models?q=${encodeURIComponent(searchText.trim() || 'coder gguf')}&mode=llama.cpp&sort=${remoteSort}`,
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setHfModels(Array.isArray(data.models) ? data.models : []);
      } catch (err) {
        setHfError(
          err instanceof Error
            ? `Hugging Face API недоступен (${err.message}). Показан локальный каталог метаданных.`
            : 'Ошибка запроса к Hugging Face API',
        );
      } finally {
        setHfLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refreshLocalModels();
  }, [refreshLocalModels]);

  useEffect(() => {
    void fetchHuggingFace('Qwen2.5-Coder GGUF', sortBy === 'likes' ? 'likes' : 'downloads');
  }, [fetchHuggingFace, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceFilter !== 'curated') {
      void fetchHuggingFace(query, sortBy === 'likes' ? 'likes' : 'downloads');
    }
  };

  const handlePresetClick = (presetQuery: string) => {
    setQuery(presetQuery);
    if (sourceFilter === 'curated') {
      setSourceFilter('all');
    }
    void fetchHuggingFace(presetQuery, sortBy === 'likes' ? 'likes' : 'downloads');
  };

  const baseCatalogList = useMemo(() => {
    const qLower = query.trim().toLowerCase();
    const curatedFiltered = CURATED_GGUF_MODELS.filter((m) => {
      if (!qLower) return true;
      const tokens = qLower.split(/\s+/).filter(Boolean);
      const hay = `${m.name} ${m.author} ${m.tags.join(' ')} ${m.description ?? ''}`.toLowerCase();
      return tokens.some((t) => hay.includes(t)) || qLower === 'qwen 2.5 coder gguf';
    });

    let list: ModelCatalogItem[] = [];
    if (sourceFilter === 'curated') {
      list = curatedFiltered;
    } else if (sourceFilter === 'huggingface') {
      list = hfModels;
    } else {
      const seen = new Set<string>();
      for (const item of [...hfModels, ...curatedFiltered]) {
        if (!seen.has(item.repoId)) {
          seen.add(item.repoId);
          list.push(item);
        }
      }
    }

    return list.filter((m) => {
      if (quantFilter !== 'ALL' && !m.quantizations.includes(quantFilter)) {
        return false;
      }
      return true;
    });
  }, [hfModels, query, sourceFilter, quantFilter]);

  // Ask backend hardware recommender for exact 3-tier classification
  useEffect(() => {
    if (!hardwareProfile || baseCatalogList.length === 0) return;
    let cancelled = false;

    const runRecommend = async () => {
      try {
        const res = await fetch('/api/hardware/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hardware: hardwareProfile,
            models: baseCatalogList.map((m) => ({
              id: m.repoId,
              name: m.name,
              quant: quantFilter === 'ALL' ? m.defaultQuant : quantFilter,
              sizeGb: m.sizeGb,
              minVramGb: m.minVramGb,
              minRamGb: m.minRamGb,
            })),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          recommendations?: ModelRecommendation[];
        };
        if (!cancelled && res.ok && data.ok && Array.isArray(data.recommendations)) {
          const nextMap: Record<string, ModelRecommendation> = {};
          for (const rec of data.recommendations) {
            nextMap[rec.id] = rec;
          }
          setRecommendationsMap(nextMap);
        }
      } catch {
        // ignore transient errors
      }
    };

    void runRecommend();
    return () => {
      cancelled = true;
    };
  }, [hardwareProfile, baseCatalogList, quantFilter]);

  const combinedCatalog = useMemo(() => {
    const filtered = !hideTooHeavy
      ? baseCatalogList
      : baseCatalogList.filter((m) => {
          const rec = recommendationsMap[m.repoId];
          return !rec || rec.category !== 'too-heavy';
        });

    const sorted = [...filtered];
    if (sortBy === 'likes') {
      sorted.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    } else if (sortBy === 'size-asc') {
      sorted.sort((a, b) => a.sizeGb - b.sizeGb);
    } else if (sortBy === 'fits-vram') {
      const rank = (repoId: string) => {
        const cat = recommendationsMap[repoId]?.category;
        return cat === 'fits-vram' ? 0 : cat === 'fits-ram' ? 1 : 2;
      };
      sorted.sort((a, b) => rank(a.repoId) - rank(b.repoId) || b.downloads - a.downloads);
    } else {
      sorted.sort((a, b) => b.downloads - a.downloads);
    }
    return sorted;
  }, [baseCatalogList, hideTooHeavy, recommendationsMap, sortBy]);

  const activeDownloads = useMemo(
    () =>
      localModels.filter(
        (m) => m.status === 'downloading' || m.status === 'queued' || m.status === 'verifying' || m.status === 'paused',
      ),
    [localModels],
  );

  const installOptions = useMemo(() => {
    if (installMode === 'project' && targetProject) {
      return {
        targetDir: joinProjectModelsDir(targetProject.folderPath),
        projectId: targetProject.id,
      };
    }
    return undefined;
  }, [installMode, targetProject]);

  const inspectRepoFiles = async (item: ModelCatalogItem) => {
    if (expandedRepoId === item.repoId) {
      setExpandedRepoId(null);
      return;
    }
    setExpandedRepoId(item.repoId);

    if (repoFilesMap[item.repoId]) return;
    if (item.files && item.files.length > 0) {
      setRepoFilesMap((prev) => ({ ...prev, [item.repoId]: item.files! }));
    }

    setLoadingFilesFor(item.repoId);
    try {
      const res = await fetch(`/api/hf/model?repoId=${encodeURIComponent(item.repoId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.files) && data.files.length > 0) {
        setRepoFilesMap((prev) => ({ ...prev, [item.repoId]: data.files }));
      }
    } catch {
      // keep existing metadata if offline
    } finally {
      setLoadingFilesFor(null);
    }
  };

  const handleToggleProjectMemory = async (model: LocalModel) => {
    if (!targetProject) {
      setActionBanner({ ok: false, msg: 'Сначала создайте или выберите проект в разделе «Проекты».' });
      return;
    }
    setMemoryBusyId(model.id);
    setActionBanner(null);
    try {
      const isRegistered = registeredMemoryPaths.includes(model.localPath);
      const res = isRegistered
        ? await removeModelFromProjectMemory(model.localPath, targetProject.id)
        : await installModelToProjectMemory(model.id, targetProject.id);
      if (!res.ok) {
        setActionBanner({ ok: false, msg: res.error || 'Не удалось обновить память проекта.' });
      } else {
        setActionBanner({
          ok: true,
          msg: isRegistered
            ? `Модель «${model.name}» удалена из MEMORY.md проекта «${targetProject.name}».`
            : `Модель «${model.name}» записана в память проекта «${targetProject.name}» (MEMORY.md).`,
        });
      }
    } finally {
      setMemoryBusyId(null);
    }
  };

  const handleDirectUrlDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    const trimmed = directUrl.trim();
    if (!trimmed) return;
    const rawName = trimmed.split('/').pop()?.split('?')[0] || 'model.gguf';
    const filename = rawName.endsWith('.gguf') ? rawName : `${rawName}.gguf`;
    const res = await startDownload({
      repoId: `direct/${filename}`,
      name: filename.replace(/\.gguf$/i, ''),
      quant: 'GGUF',
      filename,
      downloadUrl: trimmed,
      sizeGb: 0,
      minVramGb: 0,
      minRamGb: 0,
      license: 'direct-url',
      sha256: null,
      targetDir: installOptions?.targetDir,
      projectId: installOptions?.projectId,
    });
    if (res.ok) {
      setDirectUrl('');
      setActionBanner({
        ok: true,
        msg:
          installOptions?.projectId && targetProject
            ? `Потоковая загрузка ${filename} запущена в папку проекта «${targetProject.name}» с автозаписью в MEMORY.md.`
            : `Потоковая загрузка ${filename} запущена на диск.`,
      });
    } else {
      setActionBanner({ ok: false, msg: res.error || 'Не удалось запустить загрузку по URL' });
    }
  };

  const handleOllamaPull = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    if (!ollamaModelName.trim()) return;
    const res = await pullOllamaModel(ollamaModelName.trim(), ollamaBaseUrl.trim() || undefined);
    if (res.ok) {
      setActionBanner({
        ok: true,
        msg: `Запущен pull модели ${ollamaModelName.trim()} через Ollama (${ollamaBaseUrl}).`,
      });
      setOllamaModelName('');
    } else {
      setActionBanner({ ok: false, msg: res.error || 'Ошибка подключения к Ollama' });
    }
  };

  const handleLocalImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    if (!importFilePath.trim()) return;
    const res = await importLocalModelFile(importFilePath.trim());
    if (res.ok) {
      setActionBanner({ ok: true, msg: `Файл ${importFilePath.trim()} проверен и добавлен в библиотеку.` });
      setImportFilePath('');
    } else {
      setActionBanner({ ok: false, msg: res.error || 'Ошибка импорта файла модели' });
    }
  };

  const handleChooseModelsFolder = async () => {
    setFolderPickerLoading(true);
    try {
      const res = await fetch('/api/fs/pick-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        supported?: boolean;
        selectedPath?: string;
        cancelled?: boolean;
        reason?: string;
      };
      if (!res.ok) throw new Error(data.reason || `HTTP ${res.status}`);
      if (data.selectedPath) {
        updateAppSettings({ modelsDir: data.selectedPath });
        setActionBanner({ ok: true, msg: 'Папка сохранения выбрана. Нажмите «Сохранить», чтобы записать настройку.' });
      } else if (!data.cancelled) {
        setActionBanner({ ok: false, msg: data.reason || 'Системный выбор папки недоступен. Укажите путь вручную.' });
      }
    } catch (err) {
      setActionBanner({ ok: false, msg: err instanceof Error ? err.message : 'Не удалось выбрать папку' });
    } finally {
      setFolderPickerLoading(false);
    }
  };

  const handleScanDisk = async () => {
    setScanningDisk(true);
    try {
      await refreshLocalModels();
      if (targetProject?.id) {
        await fetchProjectMemoryModels(targetProject.id);
      }
    } finally {
      setScanningDisk(false);
    }
  };

  const handleDownloadCatalogItem = async (item: ModelCatalogItem, rec?: ModelRecommendation) => {
    setActionBanner(null);
    const chosenQuant = quantFilter === 'ALL' ? item.defaultQuant : quantFilter;
    const res = await startDownloadFromCatalog(item, chosenQuant, installOptions);
    if (!res.ok) {
      setActionBanner({ ok: false, msg: res.error || 'Не удалось запустить скачивание' });
      return;
    }
    if (rec?.category === 'too-heavy') {
      setActionBanner({
        ok: true,
        msg: `Загрузка ${item.name} запущена вручную с предупреждением: модель превышает текущую память (${rec.reason}).`,
      });
    } else if (installOptions?.projectId && targetProject) {
      setActionBanner({
        ok: true,
        msg: `Установка ${item.name} (${chosenQuant}) в папку проекта «${targetProject.name}» запущена. По завершении запись появится в MEMORY.md.`,
      });
    } else {
      setActionBanner({
        ok: true,
        msg: `Загрузка ${item.name} (${chosenQuant}) добавлена в очередь.`,
      });
    }
  };

  const handleDownloadSpecificFile = async (item: ModelCatalogItem, f: GgufFileVariant) => {
    setActionBanner(null);
    const res = await startDownload({
      repoId: item.repoId,
      name: item.name,
      quant: f.quant,
      filename: f.filename,
      downloadUrl: f.downloadUrl,
      sizeGb: f.sizeGb || item.sizeGb,
      totalBytes: f.sizeBytes,
      minVramGb: Number(((f.sizeGb || item.sizeGb) * 1.15 + 0.7).toFixed(1)),
      minRamGb: Number(((f.sizeGb || item.sizeGb) * 1.2 + 1.2).toFixed(1)),
      license: item.license,
      sha256: f.sha256 ?? null,
      targetDir: installOptions?.targetDir,
      projectId: installOptions?.projectId,
    });
    if (!res.ok) {
      setActionBanner({ ok: false, msg: res.error || 'Ошибка загрузки файла' });
    } else if (installOptions?.projectId && targetProject) {
      setActionBanner({
        ok: true,
        msg: `Файл ${f.filename} загружается в проект «${targetProject.name}» с автозаписью в MEMORY.md.`,
      });
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Cpu className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </PageHeader>

      <PageContent scrollable={false} contentClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <SecondaryTabBar
            ariaLabel="Разделы центра GGUF"
            selectedId={hubTab}
            onSelect={(id) => setHubTab(id as HubSubTab)}
            items={[
              { id: 'search', label: 'Каталог' },
              { id: 'library', label: 'Библиотека' },
              { id: 'import', label: 'Импорт' },
            ]}
            footer={
              <div className="mt-2 pb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Локальных моделей:{' '}
                    <strong className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                      {localModels.length}
                    </strong>
                  </span>
                  {hardwareProfile && (
                    <span>
                      Оборудование:{' '}
                      <strong className="font-mono font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                        VRAM {hardwareProfile.totalVramGb} GB · RAM {hardwareProfile.ram.totalGb} GB
                      </strong>
                    </span>
                  )}
                  <span>
                    Назначение:{' '}
                    <strong className="font-medium text-zinc-700 dark:text-zinc-200">
                      {installMode === 'project' && targetProject ? `Проект «${targetProject.name}»` : 'Общая библиотека'}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLlamaModelsSection('launch');
                    setSettingsSection('llama-models');
                    setActiveTab('models');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                >
                  <Play className="h-3 w-3" />
                  <span>Управление запуском</span>
                </button>
              </div>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-5 space-y-5">
            {settingsError && (
              <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                {settingsError}
              </p>
            )}

            {actionBanner && (
              <div
                role={actionBanner.ok ? 'status' : 'alert'}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs',
                  actionBanner.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                )}
              >
                <span>{actionBanner.msg}</span>
                <button
                  type="button"
                  onClick={() => setActionBanner(null)}
                  className="shrink-0 text-[11px] font-medium underline"
                >
                  Скрыть
                </button>
              </div>
            )}

            {/* Persistent Install Target & Project Memory Selector */}
            <section className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#111114]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                    Установка моделей:
                  </span>
                  <div className="inline-flex items-center rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => setInstallMode('global')}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                        installMode === 'global'
                          ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                      )}
                    >
                      Общая библиотека
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallMode('project')}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                        installMode === 'project'
                          ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                      )}
                    >
                      В папку и память проекта
                    </button>
                  </div>

                  {projects.length > 0 ? (
                    <select
                      aria-label="Целевой проект для памяти и установки"
                      value={targetProject?.id ?? ''}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-800 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          Проект: {project.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('projects')}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Создать проект для привязки MEMORY.md →
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="max-w-[360px] truncate font-mono">
                    {installMode === 'project' && targetProject
                      ? `${joinProjectModelsDir(targetProject.folderPath)} · + MEMORY.md`
                      : appSettings.modelsDir}
                  </span>
                  {targetProject && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        В памяти проекта: <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{registeredMemoryPaths.length}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('memory')}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                      >
                        Открыть MEMORY.md
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Live Active Downloads Strip (visible across all tabs) */}
            {activeDownloads.length > 0 && (
              <section className="rounded-xl border border-blue-500/30 bg-blue-50/40 p-3.5 dark:border-blue-500/30 dark:bg-blue-950/15">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Активные загрузки и проверка SHA256 ({activeDownloads.length})
                  </h2>
                  {hubTab !== 'library' && (
                    <button
                      type="button"
                      onClick={() => setHubTab('library')}
                      className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Открыть библиотеку →
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {activeDownloads.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/70"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{m.name}</span>
                          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                            {m.quant} · {m.status === 'verifying' ? 'Проверка SHA256…' : m.status === 'paused' ? `Пауза (${m.progressPct}%)` : `${m.progressPct}% · ${m.speedMbps} MB/s · ETA ${formatEta(m.etaSeconds)}`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                          <div
                            className={cn(
                              'h-full transition-all duration-200',
                              m.status === 'paused' ? 'bg-amber-500' : m.status === 'verifying' ? 'bg-emerald-500' : 'bg-blue-600',
                            )}
                            style={{ width: `${Math.max(2, Math.min(100, m.progressPct))}%` }}
                          />
                        </div>
                      </div>
                      {m.downloadUrl && (
                        <button
                          type="button"
                          onClick={() => void togglePauseDownload(m.id)}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {m.status === 'downloading' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          <span>{m.status === 'downloading' ? 'Пауза' : 'Докачать'}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TAB 1: SEARCH & DISCOVERY */}
            {hubTab === 'search' && (
              <div className="space-y-4">
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114] space-y-3">
                  <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Поиск GGUF на Hugging Face (например: Qwen2.5-Coder 7B, DeepSeek-R1, Llama-3.3)…"
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-9 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:bg-zinc-900"
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => setQuery('')}
                          aria-label="Очистить поиск"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={hfLoading}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', hfLoading && 'animate-spin')} />
                      <span>Найти GGUF</span>
                    </button>
                  </form>

                  {/* Quick Discovery Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Быстрый поиск:
                    </span>
                    {QUICK_SEARCH_PRESETS.map((preset) => {
                      const isCurrent = query.toLowerCase() === preset.query.toLowerCase();
                      return (
                        <button
                          key={preset.query}
                          type="button"
                          onClick={() => handlePresetClick(preset.query)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
                            isCurrent
                              ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700',
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Filter & Sort Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
                        {(
                          [
                            { id: 'all', label: 'Все источники' },
                            { id: 'huggingface', label: 'Hugging Face Live' },
                            { id: 'curated', label: 'Каталог моделей' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSourceFilter(tab.id)}
                            className={cn(
                              'rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                              sourceFilter === tab.id
                                ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="inline-flex items-center rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
                        {(['ALL', 'Q4_K_M', 'Q5_K_M', 'Q8_0', 'IQ4_XS'] as const).map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setQuantFilter(q)}
                            className={cn(
                              'rounded-md px-2.5 py-1 font-mono text-xs transition-colors whitespace-nowrap',
                              quantFilter === q
                                ? 'bg-white font-semibold text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                            )}
                          >
                            {q === 'ALL' ? 'Все квант.' : q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        aria-label="Сортировка моделей"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-700 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        <option value="downloads">Сначала популярные</option>
                        <option value="likes">По лайкам сообщества</option>
                        <option value="fits-vram">Подходящие под мою GPU</option>
                        <option value="size-asc">Сначала лёгкие по размеру</option>
                      </select>

                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={hideTooHeavy}
                          onChange={(e) => setHideTooHeavy(e.target.checked)}
                          className="rounded accent-blue-600"
                        />
                        <span>Скрыть «Слишком тяжело»</span>
                      </label>
                    </div>
                  </div>
                </section>

                {hfError && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                    {hfError}
                  </div>
                )}

                {hfLoading && combinedCatalog.length === 0 ? (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {[1, 2, 3, 4].map((skeleton) => (
                      <div
                        key={skeleton}
                        className="h-44 animate-pulse rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111114]"
                      />
                    ))}
                  </div>
                ) : combinedCatalog.length === 0 ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-[#111114]">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      По текущим фильтрам модели не найдены
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Сбросьте фильтр квантизации или выберите один из пресетов поиска выше.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {combinedCatalog.map((item) => {
                      const rec = recommendationsMap[item.repoId];
                      const isExpanded = expandedRepoId === item.repoId;
                      const files = repoFilesMap[item.repoId] ?? item.files ?? [];
                      const matchingLocal = localModels.find((m) => m.repoId === item.repoId);
                      const isReadyLocal = matchingLocal?.status === 'ready';
                      const isInProjectMemory = Boolean(
                        matchingLocal && targetProject && registeredMemoryPaths.includes(matchingLocal.localPath),
                      );

                      const targetQuant = quantFilter === 'ALL' ? item.defaultQuant : quantFilter;
                      const budgetGb =
                        rec?.category === 'fits-vram' && hardwareProfile?.totalVramGb
                          ? hardwareProfile.totalVramGb
                          : hardwareProfile?.ram.totalGb ?? 16;
                      const fitPct = Math.min(100, Math.round((item.sizeGb / Math.max(1, budgetGb)) * 100));

                      return (
                        <article
                          key={item.repoId}
                          className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#111114] dark:hover:border-zinc-700"
                        >
                          <div className="space-y-3">
                            {/* Title & Hardware Compatibility Text Label */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex max-w-full items-center gap-1.5 font-display text-base font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                                >
                                  <span className="truncate">{item.name}</span>
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                </a>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                  <span>{item.author}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{item.source === 'huggingface' ? 'Hugging Face' : 'Каталог'}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono">{item.license}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatCount(item.downloads)} скачиваний</span>
                                  {typeof item.likes === 'number' && item.likes > 0 && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{formatCount(item.likes)} лайков</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {rec && (
                                <span
                                  className={cn(
                                    'shrink-0 text-xs font-semibold whitespace-nowrap',
                                    rec.category === 'fits-vram'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : rec.category === 'fits-ram'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-rose-600 dark:text-rose-400',
                                  )}
                                >
                                  {rec.categoryLabel}
                                </span>
                              )}
                            </div>

                            {item.description && (
                              <p className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                                {item.description}
                              </p>
                            )}

                            {/* Hardware Specs & Memory Gauge */}
                            <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
                              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                                <span>
                                  ~{item.sizeGb} GB ({targetQuant})
                                </span>
                                <span className="text-zinc-500 dark:text-zinc-400">
                                  VRAM ≥ {rec?.requiredVramGb ?? item.minVramGb} GB · RAM ≥ {rec?.requiredRamGb ?? item.minRamGb} GB
                                </span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80">
                                <div
                                  className={cn(
                                    'h-full transition-all',
                                    rec?.category === 'fits-vram'
                                      ? 'bg-emerald-500'
                                      : rec?.category === 'fits-ram'
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500',
                                  )}
                                  style={{ width: `${Math.max(6, fitPct)}%` }}
                                />
                              </div>
                              {rec && (
                                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{rec.reason}</p>
                              )}
                              {rec?.warning && (
                                <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <span>{rec.warning}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => void inspectRepoFiles(item)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
                            >
                              <span>Файлы GGUF</span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>

                            <div className="flex flex-wrap items-center gap-2">
                              {isReadyLocal && matchingLocal && targetProject && (
                                <button
                                  type="button"
                                  disabled={memoryBusyId === matchingLocal.id}
                                  onClick={() => void handleToggleProjectMemory(matchingLocal)}
                                  className={cn(
                                    'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50',
                                    isInProjectMemory
                                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
                                  )}
                                >
                                  {isInProjectMemory ? (
                                    <BookmarkCheck className="h-3.5 w-3.5" />
                                  ) : (
                                    <BookmarkPlus className="h-3.5 w-3.5" />
                                  )}
                                  <span>{isInProjectMemory ? 'В памяти проекта' : 'В память проекта'}</span>
                                </button>
                              )}

                              {matchingLocal ? (
                                <button
                                  type="button"
                                  onClick={() => setHubTab('library')}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-200 px-3.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 whitespace-nowrap"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>{isReadyLocal ? 'В библиотеке' : 'В очереди'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleDownloadCatalogItem(item, rec)}
                                  className={cn(
                                    'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium text-white transition-colors whitespace-nowrap',
                                    rec?.category === 'too-heavy'
                                      ? 'bg-amber-600 hover:bg-amber-500'
                                      : 'bg-blue-600 hover:bg-blue-500',
                                  )}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>
                                    {installMode === 'project' && targetProject
                                      ? `В проект (${targetQuant})`
                                      : rec?.category === 'too-heavy'
                                        ? `Скачать вручную (${targetQuant})`
                                        : `Скачать ${targetQuant}`}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded GGUF files */}
                          {isExpanded && (
                            <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                              {loadingFilesFor === item.repoId ? (
                                <div className="font-mono text-xs text-zinc-500">
                                  Загрузка списка .gguf и LFS SHA256 с Hugging Face...
                                </div>
                              ) : files.length === 0 ? (
                                <div className="text-xs text-zinc-500">
                                  Не удалось получить список файлов репозитория с Hugging Face.
                                </div>
                              ) : (
                                <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                                  {files.slice(0, 10).map((f) => (
                                    <div
                                      key={f.filename}
                                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-900/50"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate font-mono text-[11.5px] text-zinc-900 dark:text-zinc-100">
                                          {f.filename}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[10.5px] tabular-nums text-zinc-500">
                                          {f.quant} · {f.sizeGb} GB
                                          {f.sha256 ? ` · SHA256 ${f.sha256.slice(0, 12)}…` : ''}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => void handleDownloadSpecificFile(item, f)}
                                        className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 whitespace-nowrap"
                                      >
                                        {installMode === 'project' && targetProject ? 'В проект' : 'Скачать'}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: LOCAL LIBRARY & PROJECT MEMORY */}
            {hubTab === 'library' && (
              <div className="space-y-4">
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-zinc-500" />
                      <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Локальные модели на диске ({localModels.length})
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-zinc-500">Манифест: models.json</span>
                      <button
                        type="button"
                        onClick={() => void handleScanDisk()}
                        disabled={scanningDisk}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', scanningDisk && 'animate-spin')} />
                        <span>Сканировать диск</span>
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Папка сохранения моделей
                      </span>
                      <input
                        type="text"
                        value={appSettings.modelsDir}
                        onChange={(event) => updateAppSettings({ modelsDir: event.target.value })}
                        placeholder="Путь к папке моделей"
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs text-zinc-800 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleChooseModelsFolder()}
                      disabled={folderPickerLoading}
                      className="mt-[19px] inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      {folderPickerLoading ? 'Открытие…' : 'Выбрать папку'}
                    </button>
                  </div>

                  {localModelsError && (
                    <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300">
                      Не удалось загрузить список моделей: {localModelsError}
                    </div>
                  )}

                  {localModels.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
                      <p>На диске пока нет локальных моделей. Найдите и скачайте GGUF из каталога или импортируйте файл.</p>
                      <button
                        type="button"
                        onClick={() => setHubTab('search')}
                        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span>Перейти к поиску GGUF</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {localModels.map((m) => {
                        const isActive = m.id === activeModelId;
                        const isCorruptOrErr = m.status === 'corrupt' || m.status === 'error';
                        const isInProjectMemory = Boolean(
                          targetProject && registeredMemoryPaths.includes(m.localPath),
                        );

                        return (
                          <div
                            key={m.id}
                            className={cn(
                              'flex flex-col justify-between gap-2.5 rounded-lg border p-3.5',
                              isCorruptOrErr
                                ? 'border-rose-500/50 bg-rose-500/5'
                                : isActive
                                  ? 'border-blue-500/60 bg-blue-500/5'
                                  : 'border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40',
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {m.name}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                  <span>{m.quant}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {m.totalBytes > 0
                                      ? `${formatBytes(m.downloadedBytes)} / ${formatBytes(m.totalBytes)}`
                                      : `${m.sizeGb} GB`}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {m.status === 'ready'
                                      ? m.sha256Verified
                                        ? 'SHA256 OK'
                                        : 'Готова'
                                      : m.status === 'verifying'
                                        ? 'Проверка SHA256...'
                                        : m.status === 'corrupt'
                                          ? 'Файл повреждён (SHA256 mismatch)'
                                          : m.status === 'error'
                                            ? 'Ошибка загрузки'
                                            : m.status === 'paused'
                                              ? `Пауза (${m.progressPct}%)`
                                              : `${m.progressPct}% · ${m.speedMbps} MB/s · ETA ${formatEta(m.etaSeconds)}`}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                {(m.status === 'downloading' || m.status === 'paused' || m.status === 'error') &&
                                  m.downloadUrl && (
                                    <button
                                      type="button"
                                      onClick={() => void togglePauseDownload(m.id)}
                                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      {m.status === 'downloading' ? (
                                        <>
                                          <Pause className="h-3.5 w-3.5" />
                                          <span>Пауза</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="h-3.5 w-3.5" />
                                          <span>Докачать</span>
                                        </>
                                      )}
                                    </button>
                                  )}

                                {m.status === 'ready' && targetProject && (
                                  <button
                                    type="button"
                                    disabled={memoryBusyId === m.id}
                                    onClick={() => void handleToggleProjectMemory(m)}
                                    className={cn(
                                      'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50',
                                      isInProjectMemory
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
                                    )}
                                  >
                                    {isInProjectMemory ? (
                                      <BookmarkCheck className="h-3.5 w-3.5" />
                                    ) : (
                                      <BookmarkPlus className="h-3.5 w-3.5" />
                                    )}
                                    <span>{isInProjectMemory ? 'В памяти проекта' : 'В память проекта'}</span>
                                  </button>
                                )}

                                {m.status === 'ready' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await selectLocalModel(m.id);
                                      if (!res.ok) {
                                        setActionBanner({ ok: false, msg: res.error || 'Не удалось активировать модель' });
                                      } else {
                                        setActiveTab('workstation');
                                      }
                                    }}
                                    className={cn(
                                      'h-8 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap',
                                      isActive
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-900 text-white hover:bg-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-blue-500 dark:hover:text-white',
                                    )}
                                  >
                                    {isActive ? 'Активна в агенте' : 'Активировать'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={async () => {
                                    const confirmed = await requestDeleteWarning({
                                      variant: 'confirmation',
                                      title: 'Удалить локальную модель?',
                                      description: 'Файл модели будет удалён с диска и запись о ней будет удалена из каталога.',
                                      itemName: m.name,
                                      confirmLabel: 'Удалить модель',
                                    });
                                    if (confirmed) void deleteLocalModel(m.id);
                                  }}
                                  title="Удалить файл с диска и из манифеста"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {m.errorMessage && (
                              <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                <span>{m.errorMessage}</span>
                              </div>
                            )}

                            {m.status !== 'ready' ? (
                              <div className="space-y-1">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                  <div
                                    className={cn(
                                      'h-full transition-all duration-200',
                                      isCorruptOrErr
                                        ? 'bg-rose-500'
                                        : m.status === 'verifying'
                                          ? 'bg-emerald-500'
                                          : m.status === 'paused'
                                            ? 'bg-amber-500'
                                            : 'bg-blue-600',
                                    )}
                                    style={{ width: `${Math.max(0, Math.min(100, m.progressPct))}%` }}
                                  />
                                </div>
                                <div className="truncate font-mono text-[10.5px] text-zinc-500">{m.localPath}</div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 truncate font-mono text-[10.5px] text-zinc-500">
                                <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
                                <span className="truncate">
                                  {m.computedSha256 ? `SHA256: ${m.computedSha256.slice(0, 20)}… · ` : ''}
                                  {m.localPath}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 3: DIRECT URL / OLLAMA / FILE IMPORT */}
            {hubTab === 'import' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <form
                  onSubmit={handleDirectUrlDownload}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <Link2 className="h-4 w-4 text-blue-500" />
                      <span>Прямая ссылка (HTTP Range)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Потоковая загрузка .gguf с поддержкой паузы и докачки в выбранную библиотеку или папку проекта.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={directUrl}
                      onChange={(e) => setDirectUrl(e.target.value)}
                      placeholder="https://.../model.gguf"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 font-mono text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
                    />
                    <button
                      type="submit"
                      disabled={!directUrl.trim()}
                      className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-45 whitespace-nowrap"
                    >
                      Скачать
                    </button>
                  </div>
                </form>

                <form
                  onSubmit={handleOllamaPull}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="inline-flex items-center gap-1.5">
                        <Server className="h-4 w-4 text-emerald-500" />
                        <span>Ollama Pull</span>
                      </span>
                      <input
                        type="text"
                        value={ollamaBaseUrl}
                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                        aria-label="Адрес сервера Ollama"
                        className="h-6 w-36 rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[10.5px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Выгрузка модели напрямую через локальный демон Ollama по имени и тегу квантования.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ollamaModelName}
                      onChange={(e) => setOllamaModelName(e.target.value)}
                      placeholder="qwen2.5-coder:7b"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 font-mono text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
                    />
                    <button
                      type="submit"
                      disabled={!ollamaModelName.trim()}
                      className="h-9 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-45 dark:bg-zinc-100 dark:text-zinc-900 whitespace-nowrap"
                    >
                      Pull
                    </button>
                  </div>
                </form>

                <form
                  onSubmit={handleLocalImport}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <FolderInput className="h-4 w-4 text-amber-500" />
                      <span>Импорт локального файла</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Регистрация уже скачанного на диск файла .gguf или .safetensors с проверкой заголовка и SHA256.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={importFilePath}
                      onChange={(e) => setImportFilePath(e.target.value)}
                      placeholder="/path/to/model.gguf или .safetensors"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 font-mono text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
                    />
                    <button
                      type="submit"
                      disabled={!importFilePath.trim()}
                      className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-medium hover:border-blue-500 disabled:opacity-45 dark:border-zinc-700 whitespace-nowrap"
                    >
                      Импорт
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

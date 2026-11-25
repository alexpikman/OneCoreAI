import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cloud,
  Cpu,
  FolderKanban,
  HardDrive,
  MemoryStick,
  Monitor,
  Server,
  Workflow,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { apiFetch } from '../../utils/apiFetch';
import { createDefaultDashboardCards, validateDashboardLayout, type DashboardLayoutConfig } from '../../data/dashboardLayout';

const gridColumns: Record<number, string> = {
  1: 'grid-cols-1 xl:grid-cols-1', 2: 'grid-cols-1 xl:grid-cols-2', 3: 'grid-cols-1 xl:grid-cols-3', 4: 'grid-cols-1 xl:grid-cols-4',
  5: 'grid-cols-1 xl:grid-cols-5', 6: 'grid-cols-1 xl:grid-cols-6', 7: 'grid-cols-1 xl:grid-cols-7', 8: 'grid-cols-1 xl:grid-cols-8',
  9: 'grid-cols-1 xl:grid-cols-9', 10: 'grid-cols-1 xl:grid-cols-10', 11: 'grid-cols-1 xl:grid-cols-11', 12: 'grid-cols-1 xl:grid-cols-12',
};
const gridGaps: Record<number, string> = {
  1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5', 6: 'gap-6',
};
const gridStarts: Record<number, string> = {
  1: 'xl:col-start-1', 2: 'xl:col-start-2', 3: 'xl:col-start-3', 4: 'xl:col-start-4',
  5: 'xl:col-start-5', 6: 'xl:col-start-6', 7: 'xl:col-start-7', 8: 'xl:col-start-8',
  9: 'xl:col-start-9', 10: 'xl:col-start-10', 11: 'xl:col-start-11', 12: 'xl:col-start-12',
};
const gridSpans: Record<number, string> = {
  1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4',
  5: 'xl:col-span-5', 6: 'xl:col-span-6', 7: 'xl:col-span-7', 8: 'xl:col-span-8',
  9: 'xl:col-span-9', 10: 'xl:col-span-10', 11: 'xl:col-span-11', 12: 'xl:col-span-12',
};
const gridRowStarts: Record<number, string> = {
  1: 'xl:row-start-1', 2: 'xl:row-start-2', 3: 'xl:row-start-3', 4: 'xl:row-start-4',
  5: 'xl:row-start-5', 6: 'xl:row-start-6', 7: 'xl:row-start-7', 8: 'xl:row-start-8',
  9: 'xl:row-start-9', 10: 'xl:row-start-10', 11: 'xl:row-start-11', 12: 'xl:row-start-12',
};
const gridRowSpans: Record<number, string> = {
  1: 'xl:row-span-1', 2: 'xl:row-span-2', 3: 'xl:row-span-3', 4: 'xl:row-span-4',
  5: 'xl:row-span-5', 6: 'xl:row-span-6', 7: 'xl:row-span-7', 8: 'xl:row-span-8',
};

const defaultDashboardLayout: DashboardLayoutConfig = {
  schemaVersion: 1,
  grid: { columns: 12, rows: 4, gap: 3 },
  cards: createDefaultDashboardCards(),
  elements: [
    { id: 'dashboard-system', title: 'Состояние системы', column: 1, row: 1, columnSpan: 12, rowSpan: 1 },
    { id: 'dashboard-ai', title: 'AI-инфраструктура', column: 1, row: 2, columnSpan: 12, rowSpan: 1 },
    { id: 'dashboard-activity', title: 'Рабочая активность', column: 1, row: 3, columnSpan: 12, rowSpan: 1 },
    { id: 'dashboard-issues', title: 'Требует внимания', column: 1, row: 4, columnSpan: 12, rowSpan: 1 },
  ],
};

const dashboardSectionTitle = (layout: DashboardLayoutConfig, id: string, fallback: string): string =>
  layout.elements.find((element) => element.id === id)?.title?.trim() || fallback;

const dashboardCardTitle = (layout: DashboardLayoutConfig, id: string, fallback: string): string =>
  (layout.cards ?? createDefaultDashboardCards()).find((card) => card.id === id)?.title ?? fallback;

const dashboardCardAppearanceClass = (layout: DashboardLayoutConfig, id: string): string => {
  const appearance = (layout.cards ?? createDefaultDashboardCards()).find((card) => card.id === id)?.appearance ?? 'default';
  return ({
    default: 'border-zinc-200/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/70',
    muted: 'border-zinc-200/60 bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-950/60',
    accent: 'border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/30',
  } as const)[appearance];
};

const dashboardCardDensityClass = (layout: DashboardLayoutConfig, id: string): string => {
  const density = (layout.cards ?? createDefaultDashboardCards()).find((card) => card.id === id)?.density ?? 'normal';
  return ({
    compact: 'p-3 [&_[data-card-value]]:mt-2 [&_[data-card-value]]:text-xl',
    normal: 'p-4',
    spacious: 'p-5 [&_[data-card-value]]:mt-5 [&_[data-card-value]]:text-3xl',
  } as const)[density];
};

const dashboardCardOrderClass = (layout: DashboardLayoutConfig, id: string): string => {
  const order = (layout.cards ?? createDefaultDashboardCards()).find((card) => card.id === id)?.order ?? 1;
  return ({ 1: 'order-1', 2: 'order-2', 3: 'order-3', 4: 'order-4' } as Record<number, string>)[order] ?? 'order-1';
};

const dashboardSectionClass = (layout: DashboardLayoutConfig, id: string): string => {
  const item = layout.elements.find((element) => element.id === id)
    ?? defaultDashboardLayout.elements.find((element) => element.id === id)!;
  return [
    gridStarts[item.column] ?? 'xl:col-start-1',
    gridSpans[item.columnSpan] ?? 'xl:col-span-12',
    gridRowStarts[item.row] ?? 'xl:row-start-1',
    gridRowSpans[item.rowSpan] ?? 'xl:row-span-1',
  ].join(' ');
};

const formatGb = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} ГБ` : '—';

interface DashboardCardProps {
  title: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  status?: 'good' | 'warning' | 'neutral';
  orderClass: string;
  appearanceClass: string;
  densityClass: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  detail,
  icon: Icon,
  onClick,
  status = 'neutral',
  orderClass,
  appearanceClass,
  densityClass,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`group min-w-0 ${orderClass} ${densityClass} rounded-2xl border ${appearanceClass} text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:border-blue-700`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</span>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <div data-card-value className="mt-4 truncate text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">
      {value}
    </div>
    <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
      <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{detail}</span>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          status === 'good' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
        aria-hidden="true"
      />
    </div>
  </button>
);

export const DashboardPage: React.FC = () => {
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayoutConfig>(defaultDashboardLayout);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch('/api/designer/configuration?scope=global', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json() as {
          configuration?: { config?: { layout?: DashboardLayoutConfig } } | null;
        };
        const saved = payload.configuration?.config?.layout;
        if (saved && validateDashboardLayout(saved).valid) {
          setDashboardLayout(saved);
        }
        return null;
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const hardware = useOneCoreStore((state) => state.hardwareProfile);
  const hardwareError = useOneCoreStore((state) => state.hardwareError);
  const hardwareLoading = useOneCoreStore((state) => state.hardwareLoading);
  const localModels = useOneCoreStore((state) => state.localModels);
  const localModelsError = useOneCoreStore((state) => state.localModelsError);
  const activeModelId = useOneCoreStore((state) => state.activeModelId);
  const serverStatus = useOneCoreStore((state) => state.serverStatus);
  const freeProviders = useOneCoreStore((state) => state.freeProviders);
  const activeProviderId = useOneCoreStore((state) => state.activeProviderId);
  const projects = useOneCoreStore((state) => state.projects);
  const projectWorkspace = useOneCoreStore((state) => state.projectWorkspace);
  const subagentRuns = useOneCoreStore((state) => state.subagentRuns);
  const agentActivity = useOneCoreStore((state) => state.agentActivity);
  const sshHosts = useOneCoreStore((state) => state.sshHosts);
  const gateways = useOneCoreStore((state) => state.gateways);
  const githubAccess = useOneCoreStore((state) => state.githubAccess);
  const setActiveTab = useOneCoreStore((state) => state.setActiveTab);
  const setSettingsSection = useOneCoreStore((state) => state.setSettingsSection);
  const setSshGithubSection = useOneCoreStore((state) => state.setSshGithubSection);

  const readyModels = localModels.filter((model) => model.status === 'ready').length;
  const activeModel = localModels.find((model) => model.id === activeModelId);
  const connectedProviders = freeProviders.filter((provider) => provider.status === 'connected').length;
  const activeProvider = freeProviders.find((provider) => provider.id === activeProviderId);
  const activeAgents =
    subagentRuns.filter((run) => run.status === 'running' || run.status === 'queued').length +
    Number(agentActivity !== 'idle');
  const failedAgents = subagentRuns.filter((run) => run.status === 'failed').length;
  const tasks = projectWorkspace.tasks;
  const activeTasks = tasks.filter((task) => task.status === 'in-progress').length;
  const pendingTasks = tasks.filter((task) => task.status === 'todo').length;
  const connectedSsh = sshHosts.filter((host) => host.status === 'connected').length;
  const connectedGateways = gateways.filter((gateway) => gateway.enabled && gateway.status === 'connected').length;
  const connectedGithub = githubAccess.lastVerifyStatus === 'ok' ? 1 : 0;
  const connectedIntegrations = connectedProviders + connectedSsh + connectedGateways + connectedGithub;
  const providerErrors = freeProviders.filter((provider) => provider.status === 'error').length;
  const issueCount =
    Number(Boolean(hardwareError)) + Number(Boolean(localModelsError)) + providerErrors + failedAgents;
  const systemReady = !hardwareError && !localModelsError && serverStatus !== 'error';

  const openSystem = () => setActiveTab('system');
  const openModels = () => {
    setSettingsSection('providers');
    setActiveTab('models');
  };
  const openRoles = () => {
    setSettingsSection('roles-pipeline');
    setActiveTab('models');
  };
  const openProjects = () => setActiveTab('projects');
  const openTasks = () => setActiveTab('tasks');
  const openProcesses = () => setActiveTab('processes');
  const openOperations = () => setActiveTab('operations-log');
  const openIntegrations = () => {
    setSettingsSection('ssh-github');
    setSshGithubSection('github');
    setActiveTab('settings');
  };

  return (
    <PageLayout>
      <PageHeader
        showSave={false}
        showSubNavigation={false}
        status={{ label: systemReady ? 'Система доступна' : 'Есть проблемы', variant: systemReady ? 'success' : 'warning' }}
      >
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Дашборд</h1>
        </div>
      </PageHeader>

      <PageContent>
        <div className={`grid auto-rows-min ${gridColumns[dashboardLayout.grid.columns] ?? gridColumns[12]} ${gridGaps[dashboardLayout.grid.gap] ?? gridGaps[3]} py-5`}>
          <section className={`space-y-3 ${dashboardSectionClass(dashboardLayout, 'dashboard-system')}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{dashboardSectionTitle(dashboardLayout, 'dashboard-system', 'Состояние системы')}</h2>
              <button
                type="button"
                onClick={openSystem}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Подробнее
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'cpu', 'Процессор')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'cpu')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'cpu')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'cpu')}
                value={hardwareLoading && !hardware ? 'Загрузка…' : hardware ? `${hardware.cpu.cores} ядер` : 'Нет данных'}
                detail={hardware?.cpu.model || hardwareError || 'Аппаратный профиль не получен'}
                icon={Cpu}
                onClick={openSystem}
                status={hardware ? 'good' : 'warning'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'ram', 'Оперативная память')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'ram')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'ram')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'ram')}
                value={hardware ? formatGb(hardware.ram.totalGb - hardware.ram.freeGb) : 'Нет данных'}
                detail={
                  hardware
                    ? `из ${formatGb(hardware.ram.totalGb)} · свободно ${formatGb(hardware.ram.freeGb)}`
                    : hardwareError || 'Нет данных'
                }
                icon={MemoryStick}
                onClick={openSystem}
                status={hardware ? 'good' : 'warning'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'gpu', 'Графический процессор')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'gpu')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'gpu')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'gpu')}
                value={
                  hardware?.gpuDetected
                    ? formatGb(hardware.totalVramGb - hardware.freeVramGb)
                    : hardware
                      ? 'Не обнаружен'
                      : 'Нет данных'
                }
                detail={
                  hardware?.gpuDetected
                    ? `VRAM из ${formatGb(hardware.totalVramGb)} · свободно ${formatGb(hardware.freeVramGb)}`
                    : hardware?.cpu.model || hardwareError || 'Нет данных'
                }
                icon={Monitor}
                onClick={openSystem}
                status={hardware?.gpuDetected ? 'good' : 'neutral'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'disk', 'Диск')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'disk')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'disk')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'disk')}
                value={hardware ? formatGb(hardware.disk.freeGb) : 'Нет данных'}
                detail={hardware ? `свободно из ${formatGb(hardware.disk.totalGb)}` : hardwareError || 'Нет данных'}
                icon={HardDrive}
                onClick={openSystem}
                status={hardware ? 'good' : 'warning'}
              />
            </div>
          </section>

          <section className={`space-y-3 ${dashboardSectionClass(dashboardLayout, 'dashboard-ai')}`}>
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{dashboardSectionTitle(dashboardLayout, 'dashboard-ai', 'AI-инфраструктура')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'models', 'Локальные модели')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'models')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'models')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'models')}
                value={String(readyModels)}
                detail={activeModel ? `Активна: ${activeModel.name}` : `${localModels.length} моделей · активная не выбрана`}
                icon={Server}
                onClick={openModels}
                status={localModelsError ? 'warning' : readyModels > 0 ? 'good' : 'neutral'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'providers', 'Провайдеры')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'providers')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'providers')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'providers')}
                value={String(connectedProviders)}
                detail={activeProvider ? `Выбран: ${activeProvider.name}` : `${freeProviders.length} настроено`}
                icon={Cloud}
                onClick={openModels}
                status={providerErrors > 0 ? 'warning' : connectedProviders > 0 ? 'good' : 'neutral'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'agents', 'Агенты')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'agents')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'agents')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'agents')}
                value={String(activeAgents)}
                detail={agentActivity === 'idle' ? 'Основной агент не выполняет задачу' : 'Основной агент занят'}
                icon={Bot}
                onClick={openRoles}
                status={activeAgents > 0 || agentActivity !== 'idle' ? 'good' : 'neutral'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'inference', 'Среда моделей')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'inference')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'inference')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'inference')}
                value={
                  serverStatus === 'ready'
                    ? 'Готова'
                    : serverStatus === 'generating'
                      ? 'Генерация'
                      : serverStatus === 'loading'
                        ? 'Загрузка'
                        : serverStatus === 'error'
                          ? 'Ошибка'
                          : 'Остановлена'
                }
                detail="Состояние локального inference-сервера"
                icon={Activity}
                onClick={openModels}
                status={
                  serverStatus === 'error'
                    ? 'warning'
                    : serverStatus === 'ready' || serverStatus === 'generating'
                      ? 'good'
                      : 'neutral'
                }
              />
            </div>
          </section>

          <section className={`space-y-3 ${dashboardSectionClass(dashboardLayout, 'dashboard-activity')}`}>
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{dashboardSectionTitle(dashboardLayout, 'dashboard-activity', 'Рабочая активность')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'projects', 'Проекты')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'projects')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'projects')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'projects')}
                value={String(projects.length)}
                detail="Созданные рабочие проекты"
                icon={FolderKanban}
                onClick={openProjects}
                status={projects.length > 0 ? 'good' : 'neutral'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'tasks', 'Задачи в работе')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'tasks')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'tasks')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'tasks')}
                value={String(activeTasks)}
                detail={`${pendingTasks} ожидают выполнения в активном проекте`}
                icon={CheckCircle2}
                onClick={openTasks}
                status={activeTasks > 0 ? 'good' : 'neutral'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'processes', 'Процессы')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'processes')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'processes')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'processes')}
                value={String(activeAgents + activeTasks)}
                detail="Активные агенты и задачи проекта"
                icon={Workflow}
                onClick={openProcesses}
                status={activeAgents + activeTasks > 0 ? 'good' : 'neutral'}
              />
              <DashboardCard
                title={dashboardCardTitle(dashboardLayout, 'integrations', 'Подключения')}
                orderClass={dashboardCardOrderClass(dashboardLayout, 'integrations')}
                appearanceClass={dashboardCardAppearanceClass(dashboardLayout, 'integrations')}
                densityClass={dashboardCardDensityClass(dashboardLayout, 'integrations')}
                value={String(connectedIntegrations)}
                detail="Провайдеры, SSH, шлюзы и GitHub"
                icon={Cloud}
                onClick={openIntegrations}
                status={connectedIntegrations > 0 ? 'good' : 'neutral'}
              />
            </div>
          </section>

          <section className={`rounded-2xl border border-zinc-200/80 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 ${dashboardSectionClass(dashboardLayout, 'dashboard-issues')}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${issueCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{dashboardSectionTitle(dashboardLayout, 'dashboard-issues', 'Требует внимания')}</h2>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {issueCount > 0 ? `${issueCount} проблем` : 'Активных проблем не обнаружено'}
              </span>
            </div>
            {issueCount > 0 ? (
              <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                {hardwareError && <p>• Ошибка получения аппаратного профиля: {hardwareError}</p>}
                {localModelsError && <p>• Ошибка получения списка моделей: {localModelsError}</p>}
                {providerErrors > 0 && <p>• Провайдеров с ошибкой подключения: {providerErrors}</p>}
                {failedAgents > 0 && <p>• Неуспешных запусков субагентов: {failedAgents}</p>}
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Ошибок в доступных источниках состояния нет. Это не заменяет проверку полного журнала операций.
              </p>
            )}
            <button
              type="button"
              onClick={openOperations}
              className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Открыть журнал операций
            </button>
          </section>
        </div>
      </PageContent>
    </PageLayout>
  );
};

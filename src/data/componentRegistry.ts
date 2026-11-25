import { NAV_GROUPS } from './appNavigation';
import type {
  AiProviderCategory,
  AppTab,
  GgufHubTabId,
  LlamaModelsSectionId,
  ProjectsSectionId,
  SettingsSectionId,
  SshGithubSectionId,
  ToolsHooksSectionId,
} from '../types/onecore';

export interface BuiltinPageComponent {
  id: string;
  kind: 'page';
  label: string;
  renderer: string;
  category: string;
  variant?: string;
  protected: boolean;
  protectedReason?: string;
  constraints: string[];
  supportsNavigationPlacement: true;
  supportsPageBlockReorder: false;
}

export interface BuiltinNavigationBinding {
  id: string;
  groupId: string;
  groupLabel: string;
  label: string;
  icon: string;
  componentId: string;
  target: {
    tab: AppTab;
    section?: SettingsSectionId;
    providerCategory?: AiProviderCategory;
    sshGithubSection?: SshGithubSectionId;
    ggufTab?: GgufHubTabId;
    llamaModelsSection?: LlamaModelsSectionId;
    projectsSection?: ProjectsSectionId;
    toolsHooksSection?: ToolsHooksSectionId;
  };
  supportsGroupMove: true;
  supportsItemReorder: true;
}

const NAVIGATION_COMPONENT_IDS: Record<string, string> = {
  dashboard: 'page.dashboard',
  chat: 'page.workstation',
  terminal: 'page.terminal',
  browser: 'page.browser',
  notes: 'page.notes',
  projects: 'page.projects',
  tasks: 'page.tasks',
  processes: 'page.processes',
  files: 'page.files',
  'project-history': 'page.project-history',
  'provider-local': 'page.providers',
  'llama-settings': 'page.llama-settings',
  'llama-gguf': 'page.llama-gguf',
  'llama-models': 'page.llama-models',
  'gguf-catalog': 'page.gguf-catalog',
  'gguf-library': 'page.gguf-library',
  'gguf-import': 'page.gguf-import',
  'agent-roles': 'page.agent-roles',
  'subagents-delegation': 'page.subagents-delegation',
  skills: 'page.skills',
  instructions: 'page.instructions',
  'intelligence-library': 'page.intelligence-library',
  directories: 'page.directories',
  'remote-connection': 'page.remote-connection',
  github: 'page.github',
  ssh: 'page.ssh',
  'messenger-gateway': 'page.gateway',
  'execution-env': 'page.execution-env',
  'hooks-item': 'page.hooks',
  mcp: 'page.mcp',
  interface: 'page.interface',
  permissions: 'page.permissions',
  security: 'page.security',
  system: 'page.system',
  updates: 'page.updates',
  'operations-log': 'page.operations-log',
  'error-log': 'page.error-log',
  memory: 'page.memory',
  'tasks-history': 'page.tasks-history',
  'agent-history': 'page.agent-history',
  'debug-flow': 'page.debug-flow',
};

export const BUILTIN_NAVIGATION_ICON_IDS: readonly string[] = Array.from(new Set(
  NAV_GROUPS.flatMap((group) => [group.icon, ...group.items.map((item) => item.icon)]),
));

export const BUILTIN_COMPONENT_REGISTRY: readonly BuiltinPageComponent[] = [
  { id: 'page.dashboard', kind: 'page', label: 'Дашборд', renderer: 'DashboardPage', category: 'workspace', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.workstation', kind: 'page', label: 'Рабочая станция', renderer: 'WorkstationPage', category: 'workspace', protected: true, protectedReason: 'Составная рабочая область: CenterAgentPane и RightInspectorPane связаны общим контекстом.', constraints: ['composite-page', 'keep-center-and-inspector-together'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.terminal', kind: 'page', label: 'Терминал', renderer: 'TerminalPage', category: 'workspace', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.browser', kind: 'page', label: 'Браузер', renderer: 'BrowserPage', category: 'workspace', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.notes', kind: 'page', label: 'Заметки', renderer: 'NotesPage', category: 'workspace', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.projects', kind: 'page', label: 'Проекты', renderer: 'ProjectsPage', category: 'context', protected: true, protectedReason: 'Страница связана с модальным окном плана проекта.', constraints: ['requires-plan-modal-state', 'requires-plan-modal-close-handler'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.tasks', kind: 'page', label: 'Задачи', renderer: 'TasksPage', category: 'context', protected: true, protectedReason: 'Страница получает фильтр проекта и callbacks синхронизации списка.', constraints: ['requires-project-filter-state', 'requires-project-filter-handler', 'requires-project-count-handler'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.processes', kind: 'page', label: 'Процессы', renderer: 'ProcessesPage', category: 'context', protected: true, protectedReason: 'Страница получает фильтр проекта и callbacks синхронизации списка.', constraints: ['requires-project-filter-state', 'requires-project-filter-handler', 'requires-project-count-handler'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.files', kind: 'page', label: 'Файлы', renderer: 'FilesPage', category: 'context', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.project-history', kind: 'page', label: 'История проекта', renderer: 'ProjectHistoryPage', category: 'context', protected: true, protectedReason: 'Страница получает фильтр проекта и callbacks синхронизации списка.', constraints: ['requires-project-filter-state', 'requires-project-filter-handler', 'requires-project-count-handler'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.providers', kind: 'page', label: 'Провайдеры', renderer: 'ProvidersPage', category: 'ai-tools', protected: false, constraints: ['settings-section:providers'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.llama-settings', kind: 'page', label: 'Настройки LlamaServer', renderer: 'LlamaServerSettingsPage', category: 'ai-tools', protected: false, constraints: ['settings-section:engine-paths'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.llama-gguf', kind: 'page', label: 'Центр GGUF', renderer: 'ModelHubView', category: 'ai-tools', variant: 'title:Центр GGUF', protected: false, constraints: ['settings-section:llama-gguf'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.llama-models', kind: 'page', label: 'Модели и запуск LLAMASERVER', renderer: 'LlamaServerModelsPage', category: 'ai-tools', protected: false, constraints: ['settings-section:llama-models'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.gguf-catalog', kind: 'page', label: 'Каталог GGUF', renderer: 'ModelHubView', category: 'ai-tools', variant: 'ggufTab:search', protected: false, constraints: ['settings-section:llama-gguf'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.gguf-library', kind: 'page', label: 'Библиотека GGUF', renderer: 'ModelHubView', category: 'ai-tools', variant: 'ggufTab:library', protected: false, constraints: ['settings-section:llama-gguf'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.gguf-import', kind: 'page', label: 'Импорт GGUF', renderer: 'ModelHubView', category: 'ai-tools', variant: 'ggufTab:import', protected: false, constraints: ['settings-section:llama-gguf'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.agent-roles', kind: 'page', label: 'General Agent', renderer: 'AgentTeamPage', category: 'agents', variant: 'initialSection:general', protected: false, constraints: ['settings-section:roles-pipeline'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.subagents-delegation', kind: 'page', label: 'SUB Agents', renderer: 'SubAgentsPage', category: 'agents', variant: 'initialSection:subagents', protected: false, constraints: ['settings-section:subagents-delegation'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.skills', kind: 'page', label: 'Библиотека навыков', renderer: 'SkillsDirectoryPage', category: 'knowledge', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.instructions', kind: 'page', label: 'Регламенты и схемы', renderer: 'InstructionsCatalogPage', category: 'knowledge', variant: 'defaultTab:knowledge', protected: false, constraints: ['settings-section:knowledge'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.intelligence-library', kind: 'page', label: 'Intelligence Library', renderer: 'IntelligenceLibraryPage', category: 'knowledge', protected: false, constraints: ['settings-section:intelligence-library'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.directories', kind: 'page', label: 'Справочники', renderer: 'DirectoriesPage', category: 'knowledge', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.remote-connection', kind: 'page', label: 'Remote connection', renderer: 'SshGithubPage', category: 'integrations', protected: false, constraints: ['settings-section:ssh-github'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.github', kind: 'page', label: 'GitHub', renderer: 'SshGithubPage', category: 'integrations', variant: 'sshGithubSection:github', protected: false, constraints: ['requires-ssh-github-section-state'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.ssh', kind: 'page', label: 'SSH', renderer: 'SshGithubPage', category: 'integrations', variant: 'sshGithubSection:ssh-keys', protected: false, constraints: ['requires-ssh-github-section-state'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.gateway', kind: 'page', label: 'Messaging Gateway', renderer: 'GatewayPage', category: 'integrations', protected: false, constraints: ['settings-section:gateway'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.execution-env', kind: 'page', label: 'Execution Environments', renderer: 'ExecutionEnvPage', category: 'integrations', protected: false, constraints: ['settings-section:execution-env'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.mcp', kind: 'page', label: 'MCP', renderer: 'McpPage', category: 'integrations', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.hooks', kind: 'page', label: 'Hooks', renderer: 'ToolsHooksPage', category: 'integrations', variant: 'toolsHooksSection:hooks', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.interface', kind: 'page', label: 'Интерфейс', renderer: 'InterfaceSettingsPage', category: 'settings', protected: false, constraints: ['settings-section:ui-chat'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.permissions', kind: 'page', label: 'Разрешения', renderer: 'PermissionsPage', category: 'settings', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.security', kind: 'page', label: 'Безопасность', renderer: 'SecurityPage', category: 'settings', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.system', kind: 'page', label: 'Система', renderer: 'SystemPage', category: 'settings', protected: true, protectedReason: 'Составная страница с вложенными системными представлениями.', constraints: ['composite-page', 'nested-system-views'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.updates', kind: 'page', label: 'Обновления', renderer: 'UpdatesSettingsPage', category: 'settings', protected: false, constraints: ['settings-section:updates'], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.operations-log', kind: 'page', label: 'Журнал операций', renderer: 'OperationsLogPage', category: 'logs', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.error-log', kind: 'page', label: 'Журнал ошибок', renderer: 'ErrorLogPage', category: 'logs', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.memory', kind: 'page', label: 'Память', renderer: 'MemoryPage', category: 'logs', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.tasks-history', kind: 'page', label: 'История задач', renderer: 'TasksHistoryPage', category: 'logs', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
  { id: 'page.agent-history', kind: 'page', label: 'История агентов', renderer: 'AgentHistoryPage', category: 'logs', protected: false, constraints: [], supportsNavigationPlacement: true, supportsPageBlockReorder: false },
];

export const BUILTIN_NAVIGATION_REGISTRY: readonly BuiltinNavigationBinding[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    id: item.id,
    groupId: group.id,
    groupLabel: group.label,
    label: item.label,
    icon: item.icon,
    componentId: NAVIGATION_COMPONENT_IDS[item.id],
    target: {
      tab: item.tab,
      ...(item.section ? { section: item.section } : {}),
      ...(item.providerCategory ? { providerCategory: item.providerCategory } : {}),
      ...(item.ggufTab ? { ggufTab: item.ggufTab } : {}),
      ...(item.llamaModelsSection ? { llamaModelsSection: item.llamaModelsSection } : {}),
      ...(item.projectsSection ? { projectsSection: item.projectsSection } : {}),
      ...(item.toolsHooksSection ? { toolsHooksSection: item.toolsHooksSection } : {}),
      ...(item.id === 'github' || item.id === 'remote-connection' ? { sshGithubSection: 'github' as const } : {}),
      ...(item.id === 'ssh' ? { sshGithubSection: 'ssh-keys' as const } : {}),
    },
    supportsGroupMove: true as const,
    supportsItemReorder: true as const,
  })),
);

export function getBuiltInComponentRegistry(): {
  schemaVersion: 1;
  components: readonly BuiltinPageComponent[];
  navigation: readonly BuiltinNavigationBinding[];
} {
  return {
    schemaVersion: 1,
    components: BUILTIN_COMPONENT_REGISTRY,
    navigation: BUILTIN_NAVIGATION_REGISTRY,
  };
}


export function validateBuiltInComponentRegistry(): { valid: boolean; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const componentIds = new Set<string>();
  const navigationIds = new Set<string>();

  for (const component of BUILTIN_COMPONENT_REGISTRY) {
    if (componentIds.has(component.id)) diagnostics.push(`Повторный component id: ${component.id}`);
    componentIds.add(component.id);
  }

  for (const item of BUILTIN_NAVIGATION_REGISTRY) {
    if (navigationIds.has(item.id)) diagnostics.push(`Повторный navigation id: ${item.id}`);
    navigationIds.add(item.id);
    if (!componentIds.has(item.componentId)) {
      diagnostics.push(`Для navigation item "${item.id}" не найден компонент "${item.componentId}"`);
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

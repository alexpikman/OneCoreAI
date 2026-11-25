import type {
  AgentTeamFocusId,
  AgentTeamSectionId,
  AiProviderCategory,
  AppTab,
  DirectoriesSectionId,
  GatewayPlatform,
  GeneralAgentTabId,
  GgufHubTabId,
  InstructionsSectionId,
  IntelligenceSectionId,
  LlamaModelsSectionId,
  ProjectsSectionId,
  SettingsSectionId,
  SkillsSectionId,
  SshGithubSectionId,
  SubAgentsTabId,
  ToolsHooksSectionId,
} from '../types/onecore';

export type NavigationSubItem = {
  id: string;
  label: string;
  tab: AppTab;
  section?: SettingsSectionId;
  initialSection?: AgentTeamSectionId;
  generalAgentTab?: GeneralAgentTabId;
  subAgentsTab?: SubAgentsTabId;
  agentFocus?: AgentTeamFocusId;
  providerCategory?: AiProviderCategory;
  sshGithubSection?: SshGithubSectionId;
  ggufTab?: GgufHubTabId;
  llamaModelsSection?: LlamaModelsSectionId;
  projectsSection?: ProjectsSectionId;
  skillsSection?: SkillsSectionId;
  instructionsSection?: InstructionsSectionId;
  intelligenceSection?: IntelligenceSectionId;
  directoriesSection?: DirectoriesSectionId;
  gatewayPlatform?: GatewayPlatform;
  toolsHooksSection?: ToolsHooksSectionId;
};

export type NavigationItem = {
  id: string;
  label: string;
  icon: string;
  tab: AppTab;
  section?: SettingsSectionId;
  providerCategory?: AiProviderCategory;
  ggufTab?: GgufHubTabId;
  llamaModelsSection?: LlamaModelsSectionId;
  projectsSection?: ProjectsSectionId;
  toolsHooksSection?: ToolsHooksSectionId;
  subItems?: NavigationSubItem[];
};

export type NavigationGroup = {
  id: string;
  label: string;
  icon: string;
  description?: string;
  items: NavigationItem[];
};

export const NAV_GROUPS: NavigationGroup[] = [
  {
    id: 'chat-group',
    label: 'Чат',
    icon: 'message',
    items: [
      { id: 'chat', label: 'Чат', icon: 'message', tab: 'workstation' },
    ],
  },
  {
    id: 'tools',
    label: 'Инструменты',
    icon: 'terminal',
    items: [
      { id: 'terminal', label: 'Терминал', icon: 'terminal', tab: 'terminal' },
      { id: 'browser', label: 'Браузер', icon: 'world', tab: 'browser' },
      { id: 'notes', label: 'Заметки', icon: 'book', tab: 'notes' },
    ],
  },
  {
    id: 'context',
    label: 'Контекст',
    icon: 'folder',
    items: [
      {
        id: 'projects',
        label: 'Проекты',
        icon: 'folder',
        tab: 'projects',
        projectsSection: 'list',
        subItems: [
          { id: 'sub-projects-list', label: 'Список проектов', tab: 'projects', projectsSection: 'list' },
          { id: 'sub-projects-tools', label: 'Разрешённые инструменты', tab: 'projects', projectsSection: 'allowed-tools' },
        ],
      },
      { id: 'tasks', label: 'Задачи', icon: 'tasks', tab: 'tasks' },
      { id: 'processes', label: 'Процессы', icon: 'workflow', tab: 'processes' },
      { id: 'files', label: 'Файлы', icon: 'files', tab: 'files' },
      { id: 'project-history', label: 'История проекта', icon: 'history', tab: 'project-history' },
    ],
  },
  {
    id: 'providers-group',
    label: 'Провайдеры',
    icon: 'plug',
    items: [
      {
        id: 'provider-local',
        label: 'Провайдеры',
        icon: 'plug',
        tab: 'models',
        section: 'providers',
        providerCategory: 'local',
        subItems: [
          { id: 'sub-prov-local', label: 'Local', tab: 'models', section: 'providers', providerCategory: 'local' },
          { id: 'sub-prov-cloud', label: 'Cloud', tab: 'models', section: 'providers', providerCategory: 'cloud' },
          { id: 'sub-prov-comp', label: 'Compatible', tab: 'models', section: 'providers', providerCategory: 'compatible' },
        ],
      },
      {
        id: 'llama-settings',
        label: 'LlamaServer',
        icon: 'cpu',
        tab: 'models',
        section: 'engine-paths',
        subItems: [
          { id: 'sub-engine', label: 'Настройки', tab: 'models', section: 'engine-paths' },
          { id: 'sub-paged', label: 'PagedAttention', tab: 'models', section: 'llama-paged-attention' },
          { id: 'sub-api', label: 'API Console', tab: 'models', section: 'llama-openai-api' },
          { id: 'sub-bench', label: 'Бенчмарк', tab: 'models', section: 'llama-benchmark' },
        ],
      },
    ],
  },
  {
    id: 'ai-agents',
    label: 'Агенты OneCore',
    icon: 'robot',
    description: 'General Agent и SUB Agents.',
    items: [
      {
        id: 'agent-roles',
        label: 'General Agent',
        icon: 'robot',
        tab: 'models',
        section: 'roles-pipeline',
        subItems: [
          { id: 'sub-permissions', label: 'Разрешения', tab: 'models', section: 'roles-pipeline', generalAgentTab: 'permissions', initialSection: 'permissions', agentFocus: 'permissions' },
          { id: 'sub-directives', label: 'Системные указания', tab: 'models', section: 'roles-pipeline', generalAgentTab: 'directives', initialSection: 'directives', agentFocus: 'directives' },
          { id: 'sub-instructions', label: 'Инструкции', tab: 'models', section: 'roles-pipeline', generalAgentTab: 'instructions', initialSection: 'instructions', agentFocus: 'general' },
          { id: 'sub-roles', label: 'Роли', tab: 'models', section: 'roles-pipeline', generalAgentTab: 'roles', initialSection: 'roles', agentFocus: 'roles' },
        ],
      },
      {
        id: 'subagents-delegation',
        label: 'SUB Agents',
        icon: 'workflow',
        tab: 'models',
        section: 'subagents-delegation',
        subItems: [
          { id: 'sub-pipeline', label: 'Субагенты и делегирование', tab: 'models', section: 'subagents-delegation', subAgentsTab: 'delegation', initialSection: 'delegation', agentFocus: 'pipeline' },
          { id: 'sub-orchestration', label: 'Командное выполнение', tab: 'models', section: 'subagents-delegation', subAgentsTab: 'team-execution', initialSection: 'team-execution', agentFocus: 'orchestration' },
          { id: 'sub-registry', label: 'Реестр субагентов', tab: 'models', section: 'subagents-delegation', subAgentsTab: 'registry' },
        ],
      },
    ],
  },
  {
    id: 'gguf-center',
    label: 'Центр GGUF',
    icon: 'cpu',
    description: 'Модели GGUF (каталог, библиотека, импорт) и запуск LLAMASERVER.',
    items: [
      {
        id: 'llama-gguf',
        label: 'Модели',
        icon: 'files',
        tab: 'models',
        section: 'llama-gguf',
        ggufTab: 'search',
        subItems: [
          { id: 'sub-gguf-catalog', label: 'Каталог', tab: 'models', section: 'llama-gguf', ggufTab: 'search' },
          { id: 'sub-gguf-library', label: 'Библиотека', tab: 'models', section: 'llama-gguf', ggufTab: 'library' },
          { id: 'sub-gguf-import', label: 'Импорт', tab: 'models', section: 'llama-gguf', ggufTab: 'import' },
        ],
      },
      {
        id: 'llama-models',
        label: 'LLAMASERVER',
        icon: 'cpu',
        tab: 'models',
        section: 'llama-models',
        llamaModelsSection: 'launch',
        subItems: [
          { id: 'sub-gguf-launch', label: 'Управление запуском', tab: 'models', section: 'llama-models', llamaModelsSection: 'launch' },
          { id: 'sub-gguf-installed', label: 'Установленные модели', tab: 'models', section: 'llama-models', llamaModelsSection: 'installed' },
        ],
      },
    ],
  },
  {
    id: 'knowledge',
    label: 'Библиотека знаний',
    icon: 'brain',
    description: 'Навыки, регламенты, схемы, справочники и архитектурные контракты.',
    items: [
      {
        id: 'skills',
        label: 'Библиотека навыков',
        icon: 'brain',
        tab: 'skills',
        subItems: [
          { id: 'sub-skills-cat', label: 'Каталог', tab: 'skills', skillsSection: 'catalog' },
          { id: 'sub-skills-check', label: 'Проверка', tab: 'skills', skillsSection: 'check' },
          { id: 'sub-skills-view', label: 'Просмотр', tab: 'skills', skillsSection: 'view' },
          { id: 'sub-skills-conn', label: 'Подключение', tab: 'skills', skillsSection: 'connect' },
        ],
      },
      {
        id: 'instructions',
        label: 'Регламенты и схемы',
        icon: 'book',
        tab: 'instructions',
        section: 'knowledge',
        subItems: [
          { id: 'sub-inst-cat', label: 'Каталог', tab: 'instructions', section: 'knowledge', instructionsSection: 'catalog' },
          { id: 'sub-inst-view', label: 'Просмотр', tab: 'instructions', section: 'knowledge', instructionsSection: 'view' },
          { id: 'sub-inst-edit', label: 'Редактирование', tab: 'instructions', section: 'knowledge', instructionsSection: 'edit' },
        ],
      },
      {
        id: 'intelligence-library',
        label: 'Intelligence Library',
        icon: 'workflow',
        tab: 'instructions',
        section: 'intelligence-library',
        subItems: [
          { id: 'sub-intel-fund', label: 'Фундамент', tab: 'instructions', section: 'intelligence-library', intelligenceSection: 'fundament' },
          { id: 'sub-intel-exec', label: 'Исполнение', tab: 'instructions', section: 'intelligence-library', intelligenceSection: 'execution' },
          { id: 'sub-intel-deleg', label: 'Делегирование', tab: 'instructions', section: 'intelligence-library', intelligenceSection: 'delegation' },
          { id: 'sub-intel-ctx', label: 'Контекст', tab: 'instructions', section: 'intelligence-library', intelligenceSection: 'context' },
          { id: 'sub-intel-rt', label: 'Runtime', tab: 'instructions', section: 'intelligence-library', intelligenceSection: 'runtime' },
          { id: 'sub-intel-impl', label: 'Реализация', tab: 'instructions', section: 'intelligence-library', intelligenceSection: 'implementation' },
          { id: 'sub-intel-src', label: 'Источники', tab: 'instructions', section: 'intelligence-library', intelligenceSection: 'sources' },
        ],
      },
      {
        id: 'directories',
        label: 'Справочники',
        icon: 'clipboard',
        tab: 'directories',
        subItems: [
          { id: 'sub-dir-data', label: 'Данные', tab: 'directories', directoriesSection: 'data' },
          { id: 'sub-dir-terms', label: 'Термины', tab: 'directories', directoriesSection: 'terms' },
          { id: 'sub-dir-const', label: 'Константы', tab: 'directories', directoriesSection: 'constants' },
          { id: 'sub-dir-search', label: 'Поиск', tab: 'directories', directoriesSection: 'search' },
        ],
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Интеграции',
    icon: 'puzzle',
    items: [
      {
        id: 'remote-connection',
        label: 'Remote connection',
        icon: 'terminal',
        tab: 'settings',
        section: 'ssh-github',
        subItems: [
          { id: 'github', label: 'GitHub', tab: 'settings', section: 'ssh-github', sshGithubSection: 'github' },
          { id: 'ssh-hosts', label: 'SSH-ХОСТЫ', tab: 'settings', section: 'ssh-github', sshGithubSection: 'ssh-hosts' },
          { id: 'ssh', label: 'SSH-Ключи', tab: 'settings', section: 'ssh-github', sshGithubSection: 'ssh-keys' },
          { id: 'ssh-config', label: 'Configuration', tab: 'settings', section: 'ssh-github', sshGithubSection: 'configuration' },
        ],
      },
      {
        id: 'messenger-gateway',
        label: 'Messaging Gateway',
        icon: 'message',
        tab: 'settings',
        section: 'gateway',
        subItems: [
          { id: 'tg-gateway', label: 'Telegram', tab: 'settings', section: 'gateway', gatewayPlatform: 'telegram' },
          { id: 'dc-gateway', label: 'Discord', tab: 'settings', section: 'gateway', gatewayPlatform: 'discord' },
          { id: 'slack-gateway', label: 'Slack', tab: 'settings', section: 'gateway', gatewayPlatform: 'slack' },
        ],
      },
      { id: 'execution-env', label: 'Execution Environments', icon: 'cpu', tab: 'settings', section: 'execution-env' },
      { id: 'hooks-item', label: 'Hooks', icon: 'hook', tab: 'tools-hooks', toolsHooksSection: 'hooks' },
      { id: 'mcp', label: 'MCP', icon: 'plug', tab: 'mcp' },
    ],
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings',
    items: [
      { id: 'interface', label: 'Интерфейс', icon: 'palette', tab: 'settings', section: 'ui-chat' },
      { id: 'permissions', label: 'Разрешения', icon: 'shield', tab: 'permissions' },
      { id: 'security', label: 'Безопасность', icon: 'lock', tab: 'security' },
      { id: 'system', label: 'Система', icon: 'settings', tab: 'system' },
      { id: 'updates', label: 'Обновления', icon: 'refresh', tab: 'settings', section: 'updates' },
    ],
  },
  {
    id: 'logs',
    label: 'Журналы',
    icon: 'journal',
    items: [
      { id: 'operations-log', label: 'Журнал операций', icon: 'journal', tab: 'operations-log' },
      { id: 'error-log', label: 'Журнал ошибок', icon: 'alert', tab: 'error-log' },
      { id: 'memory', label: 'Память', icon: 'brain', tab: 'memory' },
      { id: 'tasks-history', label: 'История задач', icon: 'clipboard', tab: 'tasks-history' },
      { id: 'agent-history', label: 'История агентов', icon: 'robot', tab: 'agent-journal' },
    ],
  },
];

export function getActiveNavigationGroupId(
  activeTab: AppTab,
  settingsSection: SettingsSectionId,
  groups: readonly NavigationGroup[] = NAV_GROUPS,
  sshGithubSection: SshGithubSectionId = 'ssh-keys',
  aiSettingsCategory?: AiProviderCategory,
  toolsHooksSection?: ToolsHooksSectionId,
  ggufHubTab: GgufHubTabId = 'search',
): string | null {
  if (activeTab === 'workstation') {
    const chatGroup = groups.find((group) => group.items.some((item) => item.tab === 'workstation'));
    if (chatGroup) return chatGroup.id;
  }
  const activeGroup = groups.find((group) =>
    group.items.some((item) =>
      isNavigationItemActive(item, activeTab, settingsSection, sshGithubSection, aiSettingsCategory, toolsHooksSection, ggufHubTab),
    ),
  );
  if (activeGroup) return activeGroup.id;
  if (activeTab === 'dashboard') return null;
  return groups[0]?.id ?? null;
}

export function getActiveNavigationGroup(
  activeTab: AppTab,
  settingsSection: SettingsSectionId,
  groups: readonly NavigationGroup[] = NAV_GROUPS,
  sshGithubSection: SshGithubSectionId = 'ssh-keys',
  aiSettingsCategory?: AiProviderCategory,
  toolsHooksSection?: ToolsHooksSectionId,
  ggufHubTab: GgufHubTabId = 'search',
): string {
  if (activeTab === 'workstation') {
    const chatGroup = groups.find((group) => group.items.some((item) => item.tab === 'workstation'));
    if (chatGroup) return chatGroup.label;
  }
  const activeGroup = groups.find((group) =>
    group.items.some((item) =>
      isNavigationItemActive(item, activeTab, settingsSection, sshGithubSection, aiSettingsCategory, toolsHooksSection, ggufHubTab),
    ),
  );
  if (activeGroup) return activeGroup.label;
  if (activeTab === 'dashboard') return 'Дашборд';
  return groups[0]?.label ?? 'Чат';
}

export function isNavigationItemActive(
  item: NavigationItem,
  activeTab: AppTab,
  settingsSection: SettingsSectionId,
  sshGithubSection: SshGithubSectionId,
  _aiSettingsCategory?: AiProviderCategory,
  toolsHooksSection?: ToolsHooksSectionId,
  ggufHubTab: GgufHubTabId = 'search',
): boolean {
  if (item.id === 'skills' && activeTab === 'models' && settingsSection === 'skills-memory') {
    return true;
  }
  if (item.id === 'provider-local') {
    return activeTab === 'models' && (settingsSection === 'providers' || settingsSection === 'model-manager');
  }
  if (item.id === 'llama-settings') {
    return (
      (activeTab === 'models' || activeTab === 'settings') &&
      ['engine-paths', 'llama-paged-attention', 'llama-openai-api', 'llama-benchmark'].includes(settingsSection)
    );
  }
  if (item.id === 'llama-gguf') {
    return activeTab === 'models' && (settingsSection === 'llama-gguf' || settingsSection === 'model-search');
  }
  if (item.id === 'llama-models') {
    return activeTab === 'models' && settingsSection === 'llama-models';
  }
  if (item.id === 'agent-roles') {
    return activeTab === 'models' && settingsSection === 'roles-pipeline';
  }
  if (item.id === 'subagents-delegation') {
    return activeTab === 'models' && settingsSection === 'subagents-delegation';
  }
  if (item.id === 'remote-connection') {
    return activeTab === 'settings' && settingsSection === 'ssh-github';
  }
  if (item.tab === 'tools-hooks' && activeTab === 'tools-hooks') {
    return item.id === 'hooks-item';
  }
  if (activeTab !== item.tab) return false;
  if (item.section && settingsSection !== item.section) return false;
  if (item.section === 'ssh-github') {
    if (item.id === 'github') return sshGithubSection === 'github';
    if (item.id === 'ssh') return sshGithubSection !== 'github';
  }
  return true;
}

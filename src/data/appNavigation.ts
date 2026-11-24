import type { AiProviderCategory, AppTab, SettingsSectionId, SshGithubSectionId } from '../types/onecore';

export type NavigationSubItem = {
  id: string;
  label: string;
  tab: AppTab;
  section?: SettingsSectionId;
  initialSection?: 'roles' | 'permissions' | 'pipeline';
  providerCategory?: AiProviderCategory;
};

export type NavigationItem = {
  id: string;
  label: string;
  icon: string;
  tab: AppTab;
  section?: SettingsSectionId;
  providerCategory?: AiProviderCategory;
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
    id: 'workspace',
    label: 'Рабочее пространство',
    icon: 'dashboard',
    items: [
      { id: 'dashboard', label: 'Дашборд', icon: 'dashboard', tab: 'dashboard' },
      { id: 'chat', label: 'Чат', icon: 'message', tab: 'workstation' },
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
      { id: 'projects', label: 'Проекты', icon: 'folder', tab: 'projects' },
      { id: 'tasks', label: 'Задачи', icon: 'tasks', tab: 'tasks' },
      { id: 'processes', label: 'Процессы', icon: 'workflow', tab: 'processes' },
      { id: 'files', label: 'Файлы', icon: 'files', tab: 'files' },
      { id: 'project-history', label: 'История проекта', icon: 'history', tab: 'project-history' },
    ],
  },
  {
    id: 'ai-tools',
    label: 'AI Инструменты',
    icon: 'cpu',
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
          { id: 'sub-prov-llama', label: 'LlamaServer', tab: 'models', section: 'providers', providerCategory: 'llama-server' },
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
      {
        id: 'llama-gguf',
        label: 'Центр GGUF',
        icon: 'files',
        tab: 'models',
        section: 'llama-gguf',
        subItems: [
          { id: 'sub-gguf-cat', label: 'Каталог', tab: 'models', section: 'llama-gguf' },
          { id: 'sub-gguf-lib', label: 'Библиотека', tab: 'models', section: 'llama-models' },
        ],
      },
    ],
  },
  {
    id: 'ai-agents',
    label: 'Агенты',
    icon: 'robot',
    description: 'General Agent, специализации, роли и делегирование ограниченных задач.',
    items: [
      {
        id: 'agent-roles',
        label: 'General Agent и роли',
        icon: 'robot',
        tab: 'models',
        section: 'roles-pipeline',
        subItems: [
          { id: 'sub-roles', label: 'Роли одной модели', tab: 'models', section: 'roles-pipeline', initialSection: 'roles' },
          { id: 'sub-permissions', label: 'Разрешения и указания', tab: 'models', section: 'roles-pipeline', initialSection: 'permissions' },
          { id: 'sub-pipeline', label: 'Субагенты и делегирование', tab: 'models', section: 'roles-pipeline', initialSection: 'pipeline' },
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
      { id: 'skills', label: 'Библиотека навыков', icon: 'brain', tab: 'skills' },
      { id: 'instructions', label: 'Регламенты и схемы', icon: 'book', tab: 'instructions', section: 'knowledge' },
      { id: 'intelligence-library', label: 'Intelligence Library', icon: 'workflow', tab: 'instructions', section: 'intelligence-library' },
      { id: 'directories', label: 'Справочники', icon: 'clipboard', tab: 'directories' },
    ],
  },
  {
    id: 'integrations',
    label: 'Интеграции',
    icon: 'puzzle',
    items: [
      { id: 'github', label: 'GitHub', icon: 'github', tab: 'settings', section: 'ssh-github' },
      { id: 'ssh', label: 'SSH', icon: 'terminal', tab: 'settings', section: 'ssh-github' },
      { id: 'messenger-gateway', label: 'Шлюз мессенджеров', icon: 'message', tab: 'settings', section: 'gateway' },
      { id: 'mcp', label: 'MCP', icon: 'plug', tab: 'mcp' },
      { id: 'tools-hooks', label: 'Инструменты и Hooks', icon: 'tool', tab: 'tools-hooks' },
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
): string | null {
  const activeGroup = groups.find((group) =>
    group.items.some((item) =>
      isNavigationItemActive(item, activeTab, settingsSection, sshGithubSection),
    ),
  );
  return activeGroup?.id ?? groups[0]?.id ?? null;
}

export function getActiveNavigationGroup(
  activeTab: AppTab,
  settingsSection: SettingsSectionId,
  groups: readonly NavigationGroup[] = NAV_GROUPS,
  sshGithubSection: SshGithubSectionId = 'ssh-keys',
): string {
  const activeGroup = groups.find((group) =>
    group.items.some((item) =>
      isNavigationItemActive(item, activeTab, settingsSection, sshGithubSection),
    ),
  );
  return activeGroup?.label ?? groups[0]?.label ?? 'Рабочее пространство';
}

export function isNavigationItemActive(
  item: NavigationItem,
  activeTab: AppTab,
  settingsSection: SettingsSectionId,
  sshGithubSection: SshGithubSectionId,
  _aiSettingsCategory?: AiProviderCategory,
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
      ['engine-paths', 'llama-models', 'llama-paged-attention', 'llama-openai-api', 'llama-benchmark'].includes(settingsSection)
    );
  }
  if (item.id === 'llama-gguf') {
    return activeTab === 'models' && (settingsSection === 'llama-gguf' || settingsSection === 'model-search');
  }
  if (activeTab !== item.tab) return false;
  if (item.section && settingsSection !== item.section) return false;
  if (item.section === 'ssh-github') {
    if (item.id === 'github') return sshGithubSection === 'github';
    if (item.id === 'ssh') return sshGithubSection !== 'github';
  }
  return true;
}

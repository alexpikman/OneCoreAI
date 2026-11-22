export interface VisibilityElement {
  id: string;
  label: string;
  description?: string;
  children?: VisibilityElement[];
}

export interface VisibilityGroup {
  id: string;
  label: string;
  elements: VisibilityElement[];
}

export const LEFT_MENU_VISIBILITY: VisibilityGroup[] = [
  { id: 'brand', label: 'Шапка и бренд', elements: [
    { id: 'brand.logo', label: 'Логотип ONE CORE AI', description: 'Знак приложения и текстовый логотип' },
    { id: 'brand.mascot', label: 'Аватар и маскот агента' },
    { id: 'brand.role', label: 'Текущая роль и статус' },
    { id: 'brand.activity', label: 'Подпись активности агента' },
  ]},
  { id: 'navigation-catalog', label: 'Основная навигация', elements: [
    { id: 'group.workspace', label: 'Рабочее пространство', children: [
      { id: 'item.dashboard', label: 'Дашборд' },
      { id: 'item.chat', label: 'Чат' },
      { id: 'item.terminal', label: 'Терминал' },
      { id: 'item.browser', label: 'Браузер' },
      { id: 'item.notes', label: 'Заметки' },
    ]},
    { id: 'group.context', label: 'Контекст', children: [
      { id: 'item.projects', label: 'Проекты' },
      { id: 'item.tasks', label: 'Задачи' },
      { id: 'item.processes', label: 'Процессы' },
      { id: 'item.files', label: 'Файлы' },
      { id: 'item.project-history', label: 'История проекта' },
    ]},
    { id: 'group.ai-tools', label: 'AI Инструменты', children: [
      { id: 'item.provider-local', label: 'Провайдеры' },
      { id: 'item.llama-settings', label: 'LlamaServer' },
      { id: 'item.llama-gguf', label: 'Центр GGUF' },
    ]},
    { id: 'group.ai-agents', label: 'Агенты и знания', children: [
      { id: 'item.agent-roles', label: 'Агенты и роли' },
      { id: 'item.skills', label: 'Навыки SKILL.md' },
      { id: 'item.instructions', label: 'Регламенты и схемы' },
      { id: 'item.directories', label: 'Справочники' },
    ]},
    { id: 'group.integrations', label: 'Интеграции', children: [
      { id: 'item.github', label: 'GitHub' },
      { id: 'item.ssh', label: 'SSH' },
      { id: 'item.messenger-gateway', label: 'Шлюз мессенджеров' },
      { id: 'item.mcp', label: 'MCP' },
      { id: 'item.tools-hooks', label: 'Инструменты и Hooks' },
    ]},
    { id: 'group.settings', label: 'Настройки', children: [
      { id: 'item.interface', label: 'Интерфейс' },
      { id: 'item.permissions', label: 'Разрешения' },
      { id: 'item.security', label: 'Безопасность' },
      { id: 'item.system', label: 'Система' },
      { id: 'item.updates', label: 'Обновления' },
    ]},
    { id: 'group.logs', label: 'Журналы', children: [
      { id: 'item.operations-log', label: 'Журнал операций' },
      { id: 'item.error-log', label: 'Журнал ошибок' },
      { id: 'item.memory', label: 'Память' },
      { id: 'item.tasks-history', label: 'История задач' },
      { id: 'item.agent-history', label: 'История агентов' },
    ]},
  ]},
  { id: 'workspace-sidebar', label: 'Рабочая область левого меню', elements: [
    { id: 'workspace.project-title', label: 'Заголовок «Проект»' },
    { id: 'workspace.project-edit', label: 'Кнопка настройки проекта' },
    { id: 'workspace.project-create', label: 'Кнопка создания проекта' },
    { id: 'workspace.project-select', label: 'Список выбора проекта' },
    { id: 'workspace.environment', label: 'Переключатель среды выполнения', children: [
      { id: 'workspace.env.local', label: 'Среда «Локально»' },
      { id: 'workspace.env.ssh', label: 'Среда SSH' },
      { id: 'workspace.env.docker', label: 'Среда Docker' },
    ]},
    { id: 'workspace.project-files', label: 'Кнопка «Файлы проекта»' },
    { id: 'workspace.new-file', label: 'Кнопка создания файла' },
    { id: 'workspace.git-status', label: 'Кнопка проверки Git' },
    { id: 'workspace.undo', label: 'Кнопка отката' },
    { id: 'workspace.new-file-form', label: 'Форма создания файла' },
    { id: 'workspace.feedback', label: 'Сообщение результата операции' },
    { id: 'workspace.tasks', label: 'Список задач проекта' },
    { id: 'workspace.action-log', label: 'Журнал действий проекта' },
  ]},
  { id: 'navigation-controls', label: 'Управление меню', elements: [
    { id: 'nav.mobile-toggle', label: 'Кнопка раскрытия подменю' },
    { id: 'nav.mode-switch', label: 'Переключатель PLAN / ACT' },
    { id: 'nav.ai-settings', label: 'Кнопка настроек ИИ' },
    { id: 'nav.context-pane', label: 'Вложенная панель рабочего пространства' },
  ]},
];

export const RIGHT_MENU_VISIBILITY: VisibilityGroup[] = [
  { id: 'right-checkpoints', label: 'Контрольные точки', elements: [
    { id: 'right.checkpoints', label: 'Блок контрольных точек', children: [
      { id: 'right.checkpoints.icon', label: 'Иконка истории' },
      { id: 'right.checkpoints.title', label: 'Заголовок и счётчик' },
      { id: 'right.checkpoints.open', label: 'Кнопка открытия истории' },
    ]},
  ]},
  { id: 'right-quick-actions', label: 'Быстрые действия', elements: [
    { id: 'right.quick-actions', label: 'Блок быстрых действий', children: [
      { id: 'right.quick-actions.title', label: 'Заголовок и иконка' },
      { id: 'right.quick-actions.update', label: 'Кнопка обновления' },
      { id: 'right.quick-actions.install', label: 'Кнопка установки' },
      { id: 'right.quick-actions.chat', label: 'Кнопка перехода в чат' },
      { id: 'right.quick-actions.theme', label: 'Переключатель темы' },
      { id: 'right.quick-actions.tray', label: 'Системный трей и уведомления' },
    ]},
  ]},
  { id: 'right-subagents', label: 'Субагенты', elements: [
    { id: 'right.subagents', label: 'Блок субагентов', children: [
      { id: 'right.subagents.title', label: 'Заголовок и счётчик' },
      { id: 'right.subagents.clear', label: 'Кнопка очистки' },
      { id: 'right.subagents.launch', label: 'Поле и кнопка запуска' },
      { id: 'right.subagents.runs', label: 'Список запусков' },
    ]},
  ]},
  { id: 'right-project', label: 'Проект и доступы', elements: [
    { id: 'right.project', label: 'Блок проекта и доступов', children: [
      { id: 'right.project.title', label: 'Заголовок и иконка' },
      { id: 'right.project.status', label: 'Статус проекта' },
      { id: 'right.project.details', label: 'Имя, путь, задачи и прогресс' },
      { id: 'right.project.tools', label: 'Индикаторы доступных инструментов' },
      { id: 'right.project.hint', label: 'Поясняющая подпись' },
    ]},
  ]},
  { id: 'right-capabilities', label: 'Возможности модели', elements: [
    { id: 'right.capabilities', label: 'Блок возможностей модели', children: [
      { id: 'right.capabilities.title', label: 'Заголовок и иконка' },
      { id: 'right.capabilities.refresh', label: 'Кнопка проверки' },
      { id: 'right.capabilities.report', label: 'Результаты и описание возможностей' },
    ]},
  ]},
  { id: 'right-tokens', label: 'Токены и память', elements: [
    { id: 'right.tokens', label: 'Блок токенов и памяти', children: [
      { id: 'right.tokens.title', label: 'Заголовок и иконка' },
      { id: 'right.tokens.usage', label: 'Использование токенов' },
      { id: 'right.tokens.context', label: 'Оценка контекста' },
      { id: 'right.tokens.memory', label: 'Показатели памяти' },
    ]},
  ]},
  { id: 'right-runtime', label: 'Локальный рантайм', elements: [
    { id: 'right.runtime', label: 'Блок локального рантайма', children: [
      { id: 'right.runtime.title', label: 'Заголовок и иконка' },
      { id: 'right.runtime.power', label: 'Кнопка запуска / остановки' },
      { id: 'right.runtime.model', label: 'Модель и статус' },
      { id: 'right.runtime.telemetry', label: 'Графики VRAM и RAM' },
    ]},
  ]},
  { id: 'right-inference', label: 'Параметры инференса', elements: [
    { id: 'right.inference', label: 'Блок параметров инференса', children: [
      { id: 'right.inference.title', label: 'Заголовок и иконка' },
      { id: 'right.inference.gpu', label: 'Выбор GPU backend' },
      { id: 'right.inference.temperature', label: 'Temperature' },
      { id: 'right.inference.context', label: 'Размер контекста' },
      { id: 'right.inference.layers', label: 'Количество GPU Layers' },
    ]},
  ]},
  { id: 'right-active-context', label: 'Активный контекст', elements: [
    { id: 'right.active-context', label: 'Блок файлов контекста', children: [
      { id: 'right.active-context.title', label: 'Заголовок и иконка' },
      { id: 'right.active-context.tree', label: 'Дерево проекта' },
      { id: 'right.active-context.terminal', label: 'Вывод терминала' },
      { id: 'right.active-context.files', label: 'Список открытых файлов' },
      { id: 'right.active-context.hardware', label: 'Информация об оборудовании' },
    ]},
  ]},
];

export const NAVIGATION_VISIBILITY_GROUPS = [
  { id: 'left', label: 'Левое меню', groups: LEFT_MENU_VISIBILITY },
  { id: 'right', label: 'Правое меню', groups: RIGHT_MENU_VISIBILITY },
];

const flattenElements = (elements: VisibilityElement[]): VisibilityElement[] =>
  elements.flatMap((element) => [element, ...flattenElements(element.children ?? [])]);

const allElements = (groups: VisibilityGroup[]) =>
  groups.flatMap((group) => flattenElements(group.elements));

export const DEFAULT_NAVIGATION_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  NAVIGATION_VISIBILITY_GROUPS.flatMap((panel) =>
    allElements(panel.groups).flatMap((element) => [
      [element.id, true],
      [`${element.id}.icon`, true],
      [`${element.id}.label`, true],
    ]),
  ),
);

export const isNavigationVisibilityEnabled = (settings: Record<string, boolean>, key: string) => settings[key] !== false;

export interface DashboardLayoutElement {
  id: string;
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
  title?: string;
}

export interface DashboardCardLayout {
  id: string;
  sectionId: 'dashboard-system' | 'dashboard-ai' | 'dashboard-activity';
  title: string;
  order: number;
  appearance?: 'default' | 'muted' | 'accent';
  density?: 'compact' | 'normal' | 'spacious';
}

export interface DashboardLayoutConfig {
  schemaVersion: 1;
  grid: { columns: number; rows: number; gap: number };
  elements: DashboardLayoutElement[];
  cards?: DashboardCardLayout[];
}

export const DASHBOARD_CARD_DEFINITIONS: readonly DashboardCardLayout[] = [
  { id: 'cpu', sectionId: 'dashboard-system', title: 'Процессор', order: 1 },
  { id: 'ram', sectionId: 'dashboard-system', title: 'Оперативная память', order: 2 },
  { id: 'gpu', sectionId: 'dashboard-system', title: 'Графический процессор', order: 3 },
  { id: 'disk', sectionId: 'dashboard-system', title: 'Диск', order: 4 },
  { id: 'models', sectionId: 'dashboard-ai', title: 'Локальные модели', order: 1 },
  { id: 'providers', sectionId: 'dashboard-ai', title: 'Провайдеры', order: 2 },
  { id: 'agents', sectionId: 'dashboard-ai', title: 'Агенты', order: 3 },
  { id: 'inference', sectionId: 'dashboard-ai', title: 'Среда моделей', order: 4 },
  { id: 'projects', sectionId: 'dashboard-activity', title: 'Проекты', order: 1 },
  { id: 'tasks', sectionId: 'dashboard-activity', title: 'Задачи в работе', order: 2 },
  { id: 'processes', sectionId: 'dashboard-activity', title: 'Процессы', order: 3 },
  { id: 'integrations', sectionId: 'dashboard-activity', title: 'Подключения', order: 4 },
];

export function createDefaultDashboardCards(): DashboardCardLayout[] {
  return DASHBOARD_CARD_DEFINITIONS.map((card) => ({ ...card, appearance: 'default', density: 'normal' }));
}

export const REQUIRED_DASHBOARD_SECTION_IDS = [
  'dashboard-system',
  'dashboard-ai',
  'dashboard-activity',
  'dashboard-issues',
] as const;

export function validateDashboardLayout(value: unknown): {
  valid: boolean;
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, diagnostics: ['Макет дашборда должен быть объектом'] };
  }

  const layout = value as Partial<DashboardLayoutConfig>;
  const grid = layout.grid;
  if (
    layout.schemaVersion !== 1 ||
    !grid ||
    !Number.isInteger(grid.columns) || grid.columns < 1 || grid.columns > 12 ||
    !Number.isInteger(grid.rows) || grid.rows < 1 || grid.rows > 12 ||
    !Number.isInteger(grid.gap) || grid.gap < 1 || grid.gap > 6 ||
    !Array.isArray(layout.elements)
  ) {
    return { valid: false, diagnostics: ['Версия или параметры сетки дашборда некорректны'] };
  }

  const elements = layout.elements;
  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const element of elements) {
    if (!element || typeof element !== 'object' || typeof element.id !== 'string' || !element.id.trim()) {
      diagnostics.push('Каждый блок дашборда должен иметь идентификатор');
      continue;
    }
    if (ids.has(element.id)) diagnostics.push(`Идентификатор блока "${element.id}" повторяется`);
    ids.add(element.id);

    if (
      !Number.isInteger(element.column) || !Number.isInteger(element.row) ||
      !Number.isInteger(element.columnSpan) || !Number.isInteger(element.rowSpan) ||
      element.column < 1 || element.row < 1 || element.columnSpan < 1 || element.rowSpan < 1 ||
      element.column + element.columnSpan - 1 > grid.columns ||
      element.row + element.rowSpan - 1 > grid.rows ||
      (element.title !== undefined && (typeof element.title !== 'string' || element.title.length > 120))
    ) {
      diagnostics.push(`Блок "${element.id}" выходит за границы сетки или содержит некорректные свойства`);
      continue;
    }

    for (let row = element.row; row < element.row + element.rowSpan; row += 1) {
      for (let column = element.column; column < element.column + element.columnSpan; column += 1) {
        const cell = `${column}:${row}`;
        if (occupied.has(cell)) diagnostics.push(`Блок "${element.id}" пересекается с другим блоком`);
        occupied.add(cell);
      }
    }
  }

  for (const id of REQUIRED_DASHBOARD_SECTION_IDS) {
    if (!ids.has(id)) diagnostics.push(`Обязательный блок "${id}" нельзя удалить`);
  }
  for (const id of ids) {
    if (!(REQUIRED_DASHBOARD_SECTION_IDS as readonly string[]).includes(id)) {
      diagnostics.push(`Блок "${id}" не зарегистрирован в runtime дашборда`);
    }
  }

  if (layout.cards !== undefined) {
    if (!Array.isArray(layout.cards)) {
      diagnostics.push('Список карточек дашборда должен быть массивом');
    } else {
      const cardIds = new Set<string>();
      const cardOrders = new Set<string>();
      for (const card of layout.cards) {
        if (!card || typeof card !== 'object' || typeof card.id !== 'string') {
          diagnostics.push('Карточка дашборда содержит некорректный идентификатор');
          continue;
        }
        const definition = DASHBOARD_CARD_DEFINITIONS.find((item) => item.id === card.id);
        if (!definition) {
          diagnostics.push(`Карточка "${card.id}" не зарегистрирована в runtime дашборда`);
          continue;
        }
        if (cardIds.has(card.id)) diagnostics.push(`Карточка "${card.id}" повторяется`);
        cardIds.add(card.id);
        if (
          card.sectionId !== definition.sectionId ||
          typeof card.title !== 'string' || !card.title.trim() || card.title.length > 80 ||
          !Number.isInteger(card.order) || card.order < 1 || card.order > 4 ||
          (card.appearance !== undefined && !['default', 'muted', 'accent'].includes(card.appearance)) ||
          (card.density !== undefined && !['compact', 'normal', 'spacious'].includes(card.density))
        ) {
          diagnostics.push(`Карточка "${card.id}" содержит недопустимые свойства`);
          continue;
        }
        const orderKey = `${card.sectionId}:${card.order}`;
        if (cardOrders.has(orderKey)) diagnostics.push(`Позиция ${card.order} в секции "${card.sectionId}" занята`);
        cardOrders.add(orderKey);
      }
      for (const definition of DASHBOARD_CARD_DEFINITIONS) {
        if (!cardIds.has(definition.id)) diagnostics.push(`Обязательную карточку "${definition.id}" нельзя удалить`);
      }
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

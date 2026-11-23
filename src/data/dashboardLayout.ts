export interface DashboardLayoutElement {
  id: string;
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
  title?: string;
}

export interface DashboardLayoutConfig {
  schemaVersion: 1;
  grid: { columns: number; rows: number; gap: number };
  elements: DashboardLayoutElement[];
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

  return { valid: diagnostics.length === 0, diagnostics };
}

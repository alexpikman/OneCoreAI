import { NAV_GROUPS } from './appNavigation';
import {
  BUILTIN_NAVIGATION_ICON_IDS,
  BUILTIN_NAVIGATION_REGISTRY,
  type BuiltinNavigationBinding,
} from './componentRegistry';

export const NAVIGATION_LAYOUT_SCHEMA_VERSION = 1 as const;

export interface NavigationLayoutItem {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
}

export interface NavigationLayoutGroup {
  id: string;
  label: string;
  icon: string;
  items: NavigationLayoutItem[];
}

export interface NavigationLayoutConfig {
  schemaVersion: typeof NAVIGATION_LAYOUT_SCHEMA_VERSION;
  groups: NavigationLayoutGroup[];
}

export interface NavigationLayoutDiagnostic {
  code:
    | 'invalid-layout'
    | 'unsupported-version'
    | 'invalid-groups'
    | 'invalid-group'
    | 'duplicate-group'
    | 'invalid-item'
    | 'unknown-item'
    | 'duplicate-item'
    | 'missing-item';
  message: string;
  itemIds: string[];
}

export interface NavigationLayoutValidation {
  valid: boolean;
  diagnostics: NavigationLayoutDiagnostic[];
}

const NAVIGATION_BINDINGS = new Map(
  BUILTIN_NAVIGATION_REGISTRY.map((binding) => [binding.id, binding]),
);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const SAFE_ICON = /^[a-z0-9-]{1,48}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function createDefaultNavigationLayout(): NavigationLayoutConfig {
  return {
    schemaVersion: NAVIGATION_LAYOUT_SCHEMA_VERSION,
    groups: NAV_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      icon: group.icon,
      items: group.items.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        visible: true,
      })),
    })),
  };
}

export function validateNavigationLayout(value: unknown): NavigationLayoutValidation {
  const diagnostics: NavigationLayoutDiagnostic[] = [];
  if (!isRecord(value) || !hasOnlyKeys(value, ['schemaVersion', 'groups'])) {
    return {
      valid: false,
      diagnostics: [{
        code: 'invalid-layout',
        message: 'Макет навигации должен содержать только schemaVersion и groups',
        itemIds: [],
      }],
    };
  }

  if (value.schemaVersion !== NAVIGATION_LAYOUT_SCHEMA_VERSION) {
    diagnostics.push({
      code: 'unsupported-version',
      message: `Версия макета навигации "${String(value.schemaVersion)}" не поддерживается`,
      itemIds: [],
    });
  }

  if (!Array.isArray(value.groups) || value.groups.length < 1 || value.groups.length > 20) {
    diagnostics.push({
      code: 'invalid-groups',
      message: 'Макет должен содержать от 1 до 20 групп навигации',
      itemIds: [],
    });
    return { valid: false, diagnostics };
  }

  const groupIds = new Set<string>();
  const itemIds = new Set<string>();

  for (const rawGroup of value.groups) {
    if (
      !isRecord(rawGroup) ||
      !hasOnlyKeys(rawGroup, ['id', 'label', 'icon', 'items']) ||
      typeof rawGroup.id !== 'string' ||
      !SAFE_ID.test(rawGroup.id) ||
      typeof rawGroup.label !== 'string' ||
      !rawGroup.label.trim() ||
      rawGroup.label.length > 80 ||
      typeof rawGroup.icon !== 'string' ||
      !SAFE_ICON.test(rawGroup.icon) ||
      !BUILTIN_NAVIGATION_ICON_IDS.includes(rawGroup.icon) ||
      !Array.isArray(rawGroup.items)
    ) {
      diagnostics.push({
        code: 'invalid-group',
        message: 'Группа должна иметь безопасный id, название, иконку и список пунктов',
        itemIds: [],
      });
      continue;
    }

    if (groupIds.has(rawGroup.id)) {
      diagnostics.push({
        code: 'duplicate-group',
        message: `Группа "${rawGroup.id}" встречается несколько раз`,
        itemIds: [],
      });
    }
    groupIds.add(rawGroup.id);

    for (const rawItem of rawGroup.items) {
      if (
        !isRecord(rawItem) ||
        !hasOnlyKeys(rawItem, ['id', 'label', 'icon', 'visible']) ||
        typeof rawItem.id !== 'string' ||
        typeof rawItem.label !== 'string' ||
        !rawItem.label.trim() ||
        rawItem.label.length > 80 ||
        typeof rawItem.icon !== 'string' ||
        !SAFE_ICON.test(rawItem.icon) ||
        !BUILTIN_NAVIGATION_ICON_IDS.includes(rawItem.icon) ||
        typeof rawItem.visible !== 'boolean'
      ) {
        diagnostics.push({
          code: 'invalid-item',
          message: `Группа "${rawGroup.id}" содержит некорректный пункт навигации`,
          itemIds: [],
        });
        continue;
      }

      if (!NAVIGATION_BINDINGS.has(rawItem.id)) {
        diagnostics.push({
          code: 'unknown-item',
          message: `Пункт навигации "${rawItem.id}" отсутствует во встроенном реестре`,
          itemIds: [rawItem.id],
        });
      }
      if (itemIds.has(rawItem.id)) {
        diagnostics.push({
          code: 'duplicate-item',
          message: `Пункт навигации "${rawItem.id}" размещён более одного раза`,
          itemIds: [rawItem.id],
        });
      }
      itemIds.add(rawItem.id);
    }
  }

  for (const binding of BUILTIN_NAVIGATION_REGISTRY) {
    if (!itemIds.has(binding.id)) {
      diagnostics.push({
        code: 'missing-item',
        message: `Пункт "${binding.label}" должен оставаться в макете; его можно скрыть через visible=false`,
        itemIds: [binding.id],
      });
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export interface ResolvedNavigationLayoutGroup {
  id: string;
  label: string;
  icon: string;
  items: Array<NavigationLayoutItem & { binding: BuiltinNavigationBinding }>;
}

export function resolveNavigationLayout(value: unknown): ResolvedNavigationLayoutGroup[] {
  const validation = validateNavigationLayout(value);
  if (!validation.valid) {
    throw new Error(validation.diagnostics.map((item) => item.message).join('; '));
  }

  const layout = value as NavigationLayoutConfig;
  return layout.groups.map((group) => ({
    id: group.id,
    label: group.label,
    icon: group.icon,
    items: group.items
      .filter((item) => item.visible)
      .map((item) => ({
        ...item,
        binding: NAVIGATION_BINDINGS.get(item.id)!,
      })),
  }));
}

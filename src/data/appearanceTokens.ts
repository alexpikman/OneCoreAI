export const APPEARANCE_SCHEMA_VERSION = 1 as const;

export type AppearanceFontFamily = 'manrope' | 'dm-mono' | 'system';

export interface AppearancePalette {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentHover: string;
  danger: string;
  warning: string;
  success: string;
}

export interface AppearanceTokens {
  schemaVersion: typeof APPEARANCE_SCHEMA_VERSION;
  typography: {
    fontFamily: AppearanceFontFamily;
    baseFontSizePx: number;
    lineHeight: number;
  };
  shape: {
    radiusSmPx: number;
    radiusMdPx: number;
    radiusLgPx: number;
    radiusXlPx: number;
    spacingScale: number;
  };
  opacity: {
    panel: number;
    overlay: number;
  };
  colors: {
    light: AppearancePalette;
    dark: AppearancePalette;
  };
}

export interface AppearanceValidation {
  valid: boolean;
  diagnostics: string[];
}

const FONT_FAMILIES = new Set<AppearanceFontFamily>(['manrope', 'dm-mono', 'system']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const PALETTE_KEYS = [
  'background', 'surface', 'surfaceRaised', 'text', 'textMuted',
  'border', 'accent', 'accentHover', 'danger', 'warning', 'success',
] as const;

export const DEFAULT_APPEARANCE_TOKENS: AppearanceTokens = {
  schemaVersion: APPEARANCE_SCHEMA_VERSION,
  typography: {
    fontFamily: 'manrope',
    baseFontSizePx: 14,
    lineHeight: 1.5,
  },
  shape: {
    radiusSmPx: 4,
    radiusMdPx: 8,
    radiusLgPx: 12,
    radiusXlPx: 16,
    spacingScale: 1,
  },
  opacity: {
    panel: 0.94,
    overlay: 0.58,
  },
  colors: {
    light: {
      background: '#fafafa',
      surface: '#ffffff',
      surfaceRaised: '#f4f4f5',
      text: '#18181b',
      textMuted: '#71717a',
      border: '#e4e4e7',
      accent: '#2563eb',
      accentHover: '#3b82f6',
      danger: '#dc2626',
      warning: '#ca8a04',
      success: '#16a34a',
    },
    dark: {
      background: '#09090b',
      surface: '#18181b',
      surfaceRaised: '#27272a',
      text: '#f4f4f5',
      textMuted: '#a1a1aa',
      border: '#3f3f46',
      accent: '#2563eb',
      accentHover: '#3b82f6',
      danger: '#ef4444',
      warning: '#eab308',
      success: '#22c55e',
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validatePalette(value: unknown, name: string, diagnostics: string[]): value is AppearancePalette {
  if (!isRecord(value) || !hasOnlyKeys(value, PALETTE_KEYS)) {
    diagnostics.push(`Палитра ${name} должна содержать только поддерживаемые цветовые токены`);
    return false;
  }

  let valid = true;
  for (const key of PALETTE_KEYS) {
    if (typeof value[key] !== 'string' || !HEX_COLOR.test(value[key])) {
      diagnostics.push(`Цвет ${name}.${key} должен быть в формате #RRGGBB`);
      valid = false;
    }
  }
  return valid;
}

export function validateAppearanceTokens(value: unknown): AppearanceValidation {
  const diagnostics: string[] = [];
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['schemaVersion', 'typography', 'shape', 'opacity', 'colors'])
  ) {
    return {
      valid: false,
      diagnostics: ['Настройки оформления содержат неизвестные поля или имеют неверный формат'],
    };
  }

  if (value.schemaVersion !== APPEARANCE_SCHEMA_VERSION) {
    diagnostics.push(`Версия настроек оформления "${String(value.schemaVersion)}" не поддерживается`);
  }

  const typographyKeys = ['fontFamily', 'baseFontSizePx', 'lineHeight'];
  if (!isRecord(value.typography) || !hasOnlyKeys(value.typography, typographyKeys)) {
    diagnostics.push('Блок типографики имеет неверный формат');
  } else {
    if (!FONT_FAMILIES.has(value.typography.fontFamily as AppearanceFontFamily)) {
      diagnostics.push('Выбранный шрифт отсутствует во встроенном реестре');
    }
    if (!isNumberInRange(value.typography.baseFontSizePx, 12, 20)) {
      diagnostics.push('Базовый размер шрифта должен быть от 12 до 20 px');
    }
    if (!isNumberInRange(value.typography.lineHeight, 1.2, 1.8)) {
      diagnostics.push('Межстрочный интервал должен быть от 1.2 до 1.8');
    }
  }

  const shapeKeys = ['radiusSmPx', 'radiusMdPx', 'radiusLgPx', 'radiusXlPx', 'spacingScale'];
  if (!isRecord(value.shape) || !hasOnlyKeys(value.shape, shapeKeys)) {
    diagnostics.push('Блок геометрии имеет неверный формат');
  } else {
    for (const key of shapeKeys.slice(0, 4)) {
      if (!isNumberInRange(value.shape[key], 0, 32)) {
        diagnostics.push(`Радиус ${key} должен быть от 0 до 32 px`);
      }
    }
    if (!isNumberInRange(value.shape.spacingScale, 0.75, 1.5)) {
      diagnostics.push('Масштаб отступов должен быть от 0.75 до 1.5');
    }
  }

  if (!isRecord(value.opacity) || !hasOnlyKeys(value.opacity, ['panel', 'overlay'])) {
    diagnostics.push('Блок прозрачности имеет неверный формат');
  } else {
    if (!isNumberInRange(value.opacity.panel, 0.5, 1)) {
      diagnostics.push('Прозрачность панелей должна быть от 0.5 до 1');
    }
    if (!isNumberInRange(value.opacity.overlay, 0.2, 0.9)) {
      diagnostics.push('Прозрачность затемнения должна быть от 0.2 до 0.9');
    }
  }

  if (!isRecord(value.colors) || !hasOnlyKeys(value.colors, ['light', 'dark'])) {
    diagnostics.push('Блок цветовых схем должен содержать light и dark');
  } else {
    validatePalette(value.colors.light, 'light', diagnostics);
    validatePalette(value.colors.dark, 'dark', diagnostics);
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

function rgba(hex: string, opacity: number): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity.toFixed(3)})`;
}

function paletteCss(
  palette: AppearancePalette,
  panelOpacity: number,
  overlayOpacity: number,
  mode: 'light' | 'dark',
): string {
  const colors = [
    `--designer-surface: ${rgba(palette.surface, panelOpacity)};`,
    `--designer-surface-raised: ${rgba(palette.surfaceRaised, panelOpacity)};`,
    `--designer-overlay: ${rgba('#000000', overlayOpacity)};`,
    `--color-zinc-50: ${palette.background};`,
    `--color-zinc-100: ${mode === 'dark' ? palette.text : rgba(palette.surfaceRaised, panelOpacity)};`,
    `--color-zinc-200: ${palette.border};`,
    `--color-zinc-300: ${palette.textMuted};`,
    `--color-zinc-400: ${palette.textMuted};`,
    `--color-zinc-500: ${palette.textMuted};`,
    `--color-zinc-600: ${palette.textMuted};`,
    `--color-zinc-700: ${mode === 'dark' ? palette.border : palette.textMuted};`,
    `--color-zinc-800: ${mode === 'dark' ? rgba(palette.surfaceRaised, panelOpacity) : palette.text};`,
    `--color-zinc-900: ${mode === 'dark' ? rgba(palette.surface, panelOpacity) : palette.text};`,
    `--color-zinc-950: ${mode === 'dark' ? palette.background : palette.text};`,
    `--color-blue-600: ${palette.accent};`,
    `--color-blue-500: ${palette.accentHover};`,
    `--color-red-600: ${palette.danger};`,
    `--color-yellow-600: ${palette.warning};`,
    `--color-green-600: ${palette.success};`,
  ];
  const modeSelector = mode === 'dark' ? '[data-ui-style].dark' : '[data-ui-style]:not(.dark)';
  return [
    `${modeSelector} {\n${colors.join('\n')}\n}`,
    `${modeSelector} .bg-white { background-color: var(--designer-surface) !important; }`,
    ...(mode === 'dark'
      ? [`${modeSelector} .bg-zinc-100 { background-color: var(--designer-surface-raised) !important; }`]
      : []),
    `${modeSelector} .bg-black { background-color: var(--designer-overlay) !important; }`,
    `${modeSelector} [class*="bg-black/"] { background-color: var(--designer-overlay) !important; }`,
  ].join('\n');
}

export function createAppearanceStylesheet(value: unknown): string {
  const validation = validateAppearanceTokens(value);
  if (!validation.valid) throw new Error(validation.diagnostics.join('; '));
  const tokens = value as AppearanceTokens;
  const fontFamily = tokens.typography.fontFamily === 'manrope'
    ? '"Manrope", ui-sans-serif, system-ui, sans-serif'
    : tokens.typography.fontFamily === 'dm-mono'
      ? '"DM Mono", ui-monospace, monospace'
      : 'ui-sans-serif, system-ui, sans-serif';
  const base = tokens.typography.baseFontSizePx;
  const lineHeight = tokens.typography.lineHeight;
  const common = [
    `--font-sans: ${fontFamily};`,
    'font-family: var(--font-sans);',
    '--font-mono: "DM Mono", ui-monospace, monospace;',
    `--text-xs: ${(base * 0.82).toFixed(2)}px;`,
    `--text-sm: ${base.toFixed(2)}px;`,
    `--text-base: ${(base * 1.14).toFixed(2)}px;`,
    `--text-lg: ${(base * 1.29).toFixed(2)}px;`,
    `--text-xl: ${(base * 1.57).toFixed(2)}px;`,
    `--text-2xl: ${(base * 1.86).toFixed(2)}px;`,
    `--text-xs--line-height: ${lineHeight};`,
    `--text-sm--line-height: ${lineHeight};`,
    `--text-base--line-height: ${lineHeight};`,
    `--text-lg--line-height: ${lineHeight};`,
    `--spacing: ${(4 * tokens.shape.spacingScale).toFixed(2)}px;`,
    `--radius-sm: ${tokens.shape.radiusSmPx}px;`,
    `--radius-md: ${tokens.shape.radiusMdPx}px;`,
    `--radius-lg: ${tokens.shape.radiusLgPx}px;`,
    `--radius-xl: ${tokens.shape.radiusXlPx}px;`,
    `--radius-2xl: ${Math.min(32, tokens.shape.radiusXlPx + 4)}px;`,
  ].join('\n');

  return [
    `[data-ui-style] {\n${common}\n${paletteCss(tokens.colors.light, tokens.opacity.panel, tokens.opacity.overlay, 'light')}\n}`,
    `[data-ui-style].dark {\n${paletteCss(tokens.colors.dark, tokens.opacity.panel, tokens.opacity.overlay, 'dark')}\n}`,
  ].join('\n');
}

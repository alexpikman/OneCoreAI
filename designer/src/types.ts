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
  schemaVersion: number;
  groups: NavigationLayoutGroup[];
}

export interface ComponentRegistry {
  schemaVersion: number;
  components: Array<{
    id: string;
    label: string;
    renderer: string;
    category: string;
    protected: boolean;
    protectedReason?: string;
    supportsPageBlockReorder: boolean;
    constraints: string[];
  }>;
  navigation: Array<{
    id: string;
    groupId: string;
    groupLabel: string;
    label: string;
    componentId: string;
  }>;
}

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
  schemaVersion: number;
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

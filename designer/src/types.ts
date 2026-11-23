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

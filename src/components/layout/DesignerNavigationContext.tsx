import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NAV_GROUPS, type NavigationGroup, type NavigationItem } from '../../data/appNavigation';
import { resolveNavigationLayout } from '../../data/navigationLayout';
import { apiFetch } from '../../utils/apiFetch';

const NavigationGroupsContext = createContext<readonly NavigationGroup[]>(NAV_GROUPS);

interface NavigationConfigurationResponse {
  ok: boolean;
  configuration?: {
    config?: {
      navigation?: unknown;
    };
  } | null;
}

function resolveNavigationGroups(layout: unknown): NavigationGroup[] {
  const resolved = resolveNavigationLayout(layout);
  const originalGroups = new Map(NAV_GROUPS.map((group) => [group.id, group]));
  const originalItems = new Map<string, NavigationItem>(
    NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item] as const)),
  );

  return resolved.map((group) => ({
    id: group.id,
    label: group.label,
    icon: group.icon,
    ...(originalGroups.get(group.id)?.description
      ? { description: originalGroups.get(group.id)?.description }
      : {}),
    items: group.items.map((item) => {
      const original = originalItems.get(item.id);
      if (!original) throw new Error(`Navigation target "${item.id}" is not registered`);
      return { ...original, label: item.label, icon: item.icon };
    }),
  }));
}

export function DesignerNavigationProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<readonly NavigationGroup[]>(NAV_GROUPS);

  useEffect(() => {
    let active = true;
    let requestSequence = 0;

    const loadNavigation = async () => {
      const sequence = ++requestSequence;
      try {
        const response = await apiFetch('/api/designer/configuration?scope=global');
        if (!response.ok) throw new Error('Designer navigation configuration is unavailable');
        const data = await response.json() as NavigationConfigurationResponse;
        const layout = data.configuration?.config?.navigation;
        const nextGroups = layout ? resolveNavigationGroups(layout) : NAV_GROUPS;
        if (active && sequence === requestSequence) setGroups(nextGroups);
      } catch {
        if (active && sequence === requestSequence) setGroups(NAV_GROUPS);
      }
    };

    void loadNavigation();
    window.addEventListener('focus', loadNavigation);
    return () => {
      active = false;
      window.removeEventListener('focus', loadNavigation);
    };
  }, []);

  return (
    <NavigationGroupsContext.Provider value={groups}>
      {children}
    </NavigationGroupsContext.Provider>
  );
}

export function useDesignerNavigationGroups(): readonly NavigationGroup[] {
  return useContext(NavigationGroupsContext);
}

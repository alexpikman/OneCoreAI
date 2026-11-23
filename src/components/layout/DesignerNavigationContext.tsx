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

  return resolved.map((group) => {
    const originalGroup = originalGroups.get(group.id);
    return {
      id: group.id,
      label: group.label,
      icon: group.icon,
      ...(originalGroup?.description && originalGroup.label === group.label
        ? { description: originalGroup.description }
        : {}),
      items: group.items.map((item) => {
        const original = originalItems.get(item.id);
        if (!original) throw new Error(`Navigation target "${item.id}" is not registered`);
        return { ...original, label: item.label, icon: item.icon };
      }),
    };
  });
}

export function DesignerNavigationProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<readonly NavigationGroup[]>(NAV_GROUPS);

  useEffect(() => {
    let active = true;
    let hasLoadedConfiguration = false;
    let requestSequence = 0;
    let themeLink: HTMLLinkElement | null = null;
    let themeObjectUrl: string | null = null;

    const loadNavigation = async () => {
      const sequence = ++requestSequence;
      const [configurationResult, themeResult] = await Promise.allSettled([
        apiFetch('/api/designer/configuration?scope=global'),
        apiFetch('/api/designer/theme.css'),
      ]);

      if (!active || sequence !== requestSequence) return;

      if (configurationResult.status === 'fulfilled' && configurationResult.value.ok) {
        try {
          const data = await configurationResult.value.json() as NavigationConfigurationResponse;
          const layout = data.configuration?.config?.navigation;
          const nextGroups = layout ? resolveNavigationGroups(layout) : NAV_GROUPS;
          if (active && sequence === requestSequence) {
            setGroups(nextGroups);
            hasLoadedConfiguration = true;
          }
        } catch {
          if (active && sequence === requestSequence && !hasLoadedConfiguration) setGroups(NAV_GROUPS);
        }
      } else if (!hasLoadedConfiguration) {
        setGroups(NAV_GROUPS);
      }

      if (themeResult.status !== 'fulfilled' || !themeResult.value.ok && themeResult.value.status !== 204) return;
      if (themeResult.value.status === 204) {
        themeLink?.remove();
        themeLink = null;
        if (themeObjectUrl) URL.revokeObjectURL(themeObjectUrl);
        themeObjectUrl = null;
        return;
      }

      const css = await themeResult.value.text();
      if (!active || sequence !== requestSequence) return;
      if (!css.trim()) {
        themeLink?.remove();
        themeLink = null;
        if (themeObjectUrl) URL.revokeObjectURL(themeObjectUrl);
        themeObjectUrl = null;
        return;
      }

      const nextUrl = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
      const nextLink = document.createElement('link');
      nextLink.rel = 'stylesheet';
      nextLink.href = nextUrl;
      nextLink.dataset.onecoreDesignerTheme = 'true';
      document.head.appendChild(nextLink);

      themeLink?.remove();
      if (themeObjectUrl) URL.revokeObjectURL(themeObjectUrl);
      themeLink = nextLink;
      themeObjectUrl = nextUrl;
    };

    void loadNavigation();
    window.addEventListener('focus', loadNavigation);
    return () => {
      active = false;
      window.removeEventListener('focus', loadNavigation);
      themeLink?.remove();
      if (themeObjectUrl) URL.revokeObjectURL(themeObjectUrl);
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

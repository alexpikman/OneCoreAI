import React from 'react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { getActiveNavigationGroupId, isNavigationItemActive } from '../../data/appNavigation';
import { useDesignerNavigationGroups } from './DesignerNavigationContext';
import { isNavigationVisibilityEnabled } from '../../data/navigationVisibility';
import { NavigationRibbon } from './NavigationRibbon';

export const PageSubNavigation: React.FC = () => {
  const navigationGroups = useDesignerNavigationGroups();
  const {
    activeTab,
    settingsSection,
    setActiveTab,
    setSettingsSection,
    sshGithubSection,
    setSshGithubSection,
    navigationVisibility,
    aiSettingsCategory,
    setAiSettingsCategory,
    toolsHooksSection,
    setToolsHooksSection,
    ggufHubTab,
    setGgufHubTab,
    setLlamaModelsSection,
    setGeneralAgentTab,
    setSubAgentsTab,
    setAgentTeamFocus,
    setActiveNavSubItemId,
  } = useOneCoreStore();

  if (activeTab === 'workstation') return null;

  const activeGroupId = getActiveNavigationGroupId(
    activeTab,
    settingsSection,
    navigationGroups,
    sshGithubSection,
    aiSettingsCategory,
    toolsHooksSection,
    ggufHubTab,
  );
  const group = navigationGroups.find((item) => item.id === activeGroupId);
  if (!group || !isNavigationVisibilityEnabled(navigationVisibility, `group.${group.id}`)) {
    return <div className="h-10 shrink-0" aria-hidden="true" />;
  }

  const visibleItems = group.items.filter((item) =>
    item.tab !== 'workstation' &&
    isNavigationVisibilityEnabled(navigationVisibility, `item.${item.id}`) &&
    isNavigationVisibilityEnabled(navigationVisibility, `item.${item.id}.label`),
  );
  if (visibleItems.length === 0) return <div className="h-10 shrink-0" aria-hidden="true" />;
  const selectedItem = visibleItems.find((item) =>
    isNavigationItemActive(item, activeTab, settingsSection, sshGithubSection, aiSettingsCategory, toolsHooksSection, ggufHubTab),
  );

  return (
    <div className="flex w-full h-10 shrink-0 items-center py-1">
      <NavigationRibbon
        ariaLabel={`Подразделы: ${group.label}`}
        items={visibleItems.map((item) => ({ id: item.id, label: item.label }))}
        selectedId={selectedItem?.id ?? null}
        onSelect={(id) => {
          const item = visibleItems.find((candidate) => candidate.id === id);
          if (!item) return;
          if (item.section) setSettingsSection(item.section);
          if (item.providerCategory) setAiSettingsCategory(item.providerCategory);
          if (item.ggufTab) setGgufHubTab(item.ggufTab);
          if (item.llamaModelsSection) setLlamaModelsSection(item.llamaModelsSection);
          if (item.id === 'agent-roles') {
            setGeneralAgentTab('permissions');
            setAgentTeamFocus('permissions');
          }
          if (item.id === 'subagents-delegation') {
            setSubAgentsTab('delegation');
            setAgentTeamFocus('pipeline');
          }
          if (item.tab === 'tools-hooks') setToolsHooksSection(item.toolsHooksSection ?? 'all');
          if (item.id === 'github') setSshGithubSection('github');
          if (item.id === 'ssh' || item.id === 'remote-connection') setSshGithubSection('ssh-keys');
          setActiveNavSubItemId(item.subItems?.[0]?.id ?? null);
          setActiveTab(item.tab);
        }}
      />
    </div>
  );
};

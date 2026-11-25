import React from 'react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { getActiveNavigationGroupId, isNavigationItemActive } from '../../data/appNavigation';
import { useDesignerNavigationGroups } from './DesignerNavigationContext';
import { isNavigationVisibilityEnabled } from '../../data/navigationVisibility';
import { NavTablerIcon } from './NavTablerIcon';
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
    setProjectsSection,
    setAgentTeamSection,
    setIntelligenceSection,
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

  const visibleItems = group.items.filter((item) => {
    if (item.tab === 'workstation') return false;
    if (!isNavigationVisibilityEnabled(navigationVisibility, `item.${item.id}`)) return false;
    const showIcon = isNavigationVisibilityEnabled(navigationVisibility, `item.${item.id}.icon`);
    const showLabel = isNavigationVisibilityEnabled(navigationVisibility, `item.${item.id}.label`);
    return showIcon || showLabel;
  });
  if (visibleItems.length === 0) return <div className="h-10 shrink-0" aria-hidden="true" />;
  const selectedItem = visibleItems.find((item) =>
    isNavigationItemActive(item, activeTab, settingsSection, sshGithubSection, aiSettingsCategory, toolsHooksSection, ggufHubTab),
  );

  return (
    <div className="flex w-full h-10 shrink-0 items-center py-1">
      <NavigationRibbon
        ariaLabel={`Подразделы: ${group.label}`}
        items={visibleItems.map((item) => {
          const showIcon = isNavigationVisibilityEnabled(navigationVisibility, `item.${item.id}.icon`);
          const showLabel = isNavigationVisibilityEnabled(navigationVisibility, `item.${item.id}.label`);
          return {
            id: item.id,
            label: showLabel ? item.label : '',
            ariaLabel: item.label,
            icon: !showLabel && showIcon ? <NavTablerIcon name={item.icon} className="h-3.5 w-3.5" /> : undefined,
          };
        })}
        selectedId={selectedItem?.id ?? null}
        onSelect={(id) => {
          const item = visibleItems.find((candidate) => candidate.id === id);
          if (!item) return;
          if (item.section) setSettingsSection(item.section);
          if (item.providerCategory) setAiSettingsCategory(item.providerCategory);
          if (item.ggufTab) setGgufHubTab(item.ggufTab);
          if (item.llamaModelsSection) setLlamaModelsSection(item.llamaModelsSection);
          if (item.projectsSection) setProjectsSection(item.projectsSection);
          if (item.id === 'agent-roles') {
            setGeneralAgentTab('permissions');
            setAgentTeamSection('permissions');
            setAgentTeamFocus('permissions');
          }
          if (item.id === 'subagents-delegation') {
            setSubAgentsTab('delegation');
            setAgentTeamSection('delegation');
            setAgentTeamFocus('pipeline');
          }
          if (item.id === 'intelligence-library') {
            setIntelligenceSection('all');
          }
          if (item.tab === 'tools-hooks') setToolsHooksSection(item.toolsHooksSection ?? 'hooks');
          if (item.id === 'github' || item.id === 'remote-connection') setSshGithubSection('github');
          if (item.id === 'ssh') setSshGithubSection('ssh-keys');
          setActiveNavSubItemId(item.id === 'intelligence-library' ? null : item.subItems?.[0]?.id ?? null);
          setActiveTab(item.tab);
        }}
      />
    </div>
  );
};

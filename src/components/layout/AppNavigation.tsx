import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ListTodo,
  Settings,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import {
  getActiveNavigationGroupId,
  isNavigationItemActive,
  type NavigationItem,
  type NavigationSubItem,
} from '../../data/appNavigation';
import { cn } from '../../utils/cn';
import { useDesignerNavigationGroups } from './DesignerNavigationContext';
import { getUiTokens } from '../../utils/uiStyle';
import { ModelMascot } from '../agent/ModelMascot';
import { isNavigationVisibilityEnabled } from '../../data/navigationVisibility';
import { NavTablerIcon } from './NavTablerIcon';
import { NavigationGroupPopup } from './NavigationGroupPopup';
import { WorkspaceControlsModal, type WorkspaceModalSection } from './WorkspaceControlsModal';

export const AppNavigation: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    uiStyle,
    appNavigationWidth,
    chatVisibility,
    navigationVisibility,
    settingsSection,
    setSettingsSection,
    setAiSettingsCategory,
    aiSettingsCategory,
    sshGithubSection,
    setSshGithubSection,
    agentMode,
    setAgentMode,
    roles,
    activeRoleId,
    enabledRoleIds,
    serverStatus,
    agentActivity,
    projects,
    activeProjectId,
    files,
    projectWorkspace,
    projectLogs,
    agentTeamSection,
    setAgentTeamSection,
    generalAgentTab,
    setGeneralAgentTab,
    subAgentsTab,
    setSubAgentsTab,
    activeNavSubItemId,
    setActiveNavSubItemId,
    agentTeamFocus,
    setAgentTeamFocus,
    ggufHubTab,
    setGgufHubTab,
    llamaModelsSection,
    setLlamaModelsSection,
    projectsSection,
    setProjectsSection,
    skillsSection,
    setSkillsSection,
    instructionsSection,
    setInstructionsSection,
    intelligenceSection,
    setIntelligenceSection,
    directoriesSection,
    setDirectoriesSection,
    gatewayPlatform,
    setGatewayPlatform,
    toolsHooksSection,
    setToolsHooksSection,
  } = useOneCoreStore();

  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [activeNavGroup, setActiveNavGroup] = useState('chat-group');
  const [popupGroupId, setPopupGroupId] = useState<string | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceModalSection, setWorkspaceModalSection] = useState<WorkspaceModalSection>('project');

  const navigationGroups = useDesignerNavigationGroups();
  const tokens = getUiTokens(uiStyle);
  const showNav = (key: string) => isNavigationVisibilityEnabled(navigationVisibility, key);
  const activeRole = roles.find((role) => role.id === activeRoleId) ?? roles[0];
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const activeRoleLabel =
    enabledRoleIds.length === 0
      ? 'Общий агент'
      : enabledRoleIds.length === 1
        ? roles.find((role) => role.id === enabledRoleIds[0])?.name ?? 'Общий агент'
        : `Ролей: ${enabledRoleIds.length}`;

  const activityLabel = {
    idle: {
      ready: 'Наблюдает за контекстом',
      generating: 'Пишет ответ и код',
      loading: 'Загружает веса в VRAM',
      stopped: 'Спящий режим',
      error: 'Обнаружена ошибка',
    }[serverStatus],
    thinking: 'Обдумывает задачу',
    reading: 'Читает файлы и источники',
    editing: 'Редактирует проект',
    writing: 'Пишет ответ',
    terminal: 'Работает в терминале',
  }[agentActivity];

  const statusIndicator = {
    ready: { label: 'Агент готов', className: 'bg-emerald-500 agent-status-pulse' },
    generating: { label: 'Агент выполняет задачу', className: 'bg-blue-500 agent-status-pulse' },
    loading: { label: 'Агент загружает модель', className: 'bg-amber-500 agent-status-pulse' },
    stopped: { label: 'Агент остановлен', className: 'bg-zinc-400' },
    error: { label: 'Ошибка агента', className: 'bg-rose-500' },
  }[serverStatus];

  useEffect(() => {
    setMobileExpanded(false);
    setPopupGroupId(null);
  }, [activeTab]);

  useEffect(() => {
    setActiveNavGroup(
      getActiveNavigationGroupId(
        activeTab,
        settingsSection,
        navigationGroups,
        sshGithubSection,
        aiSettingsCategory,
        toolsHooksSection,
        ggufHubTab,
      ) ?? 'chat-group',
    );
  }, [activeTab, settingsSection, navigationGroups, sshGithubSection, aiSettingsCategory, toolsHooksSection, ggufHubTab]);

  const handleSelectNavItem = (item: NavigationItem) => {
    if (item.section) setSettingsSection(item.section);
    if (item.providerCategory) setAiSettingsCategory(item.providerCategory);
    if (item.ggufTab) setGgufHubTab(item.ggufTab);
    if (item.llamaModelsSection) setLlamaModelsSection(item.llamaModelsSection);
    if (item.projectsSection) setProjectsSection(item.projectsSection);
    if (item.tab === 'tools-hooks') setToolsHooksSection(item.toolsHooksSection ?? 'hooks');
    if (item.id === 'github') setSshGithubSection('github');
    if (item.id === 'ssh') setSshGithubSection('ssh-keys');
    if (item.id === 'remote-connection') setSshGithubSection('github');
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
    if (item.id === 'llama-gguf') {
      setGgufHubTab('search');
    }
    if (item.id === 'intelligence-library') {
      setIntelligenceSection('all');
    }
    setActiveNavSubItemId(item.id === 'intelligence-library' ? null : item.subItems?.[0]?.id ?? null);
    setActiveTab(item.tab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setMobileExpanded(false);
  };

  const handleSelectSubItem = (sub: NavigationSubItem) => {
    if (sub.section) setSettingsSection(sub.section);
    if (sub.initialSection) setAgentTeamSection(sub.initialSection);
    if (sub.generalAgentTab) setGeneralAgentTab(sub.generalAgentTab);
    if (sub.subAgentsTab) setSubAgentsTab(sub.subAgentsTab);
    if (sub.agentFocus) setAgentTeamFocus(sub.agentFocus);
    if (sub.providerCategory) setAiSettingsCategory(sub.providerCategory);
    if (sub.sshGithubSection) setSshGithubSection(sub.sshGithubSection);
    else if (sub.id === 'github') setSshGithubSection('github');
    else if (sub.id === 'ssh-hosts') setSshGithubSection('ssh-hosts');
    else if (sub.id === 'ssh-config') setSshGithubSection('configuration');
    else if (sub.id === 'ssh') setSshGithubSection('ssh-keys');
    if (sub.ggufTab) setGgufHubTab(sub.ggufTab);
    if (sub.llamaModelsSection) setLlamaModelsSection(sub.llamaModelsSection);
    if (sub.projectsSection) setProjectsSection(sub.projectsSection);
    if (sub.skillsSection) setSkillsSection(sub.skillsSection);
    if (sub.instructionsSection) setInstructionsSection(sub.instructionsSection);
    if (sub.intelligenceSection) setIntelligenceSection(sub.intelligenceSection);
    if (sub.directoriesSection) setDirectoriesSection(sub.directoriesSection);
    if (sub.gatewayPlatform) setGatewayPlatform(sub.gatewayPlatform);
    if (sub.toolsHooksSection) setToolsHooksSection(sub.toolsHooksSection);
    setActiveNavSubItemId(sub.id);
    setActiveTab(sub.tab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setMobileExpanded(false);
  };

  const popupGroup = navigationGroups.find((group) => group.id === popupGroupId) ?? null;
  const popupItems = popupGroup
    ? popupGroup.items
        .filter((item) => showNav(`item.${item.id}`) && (showNav(`item.${item.id}.icon`) || showNav(`item.${item.id}.label`)))
        .map((item) => ({
          item,
          active: isNavigationItemActive(item, activeTab, settingsSection, sshGithubSection, aiSettingsCategory, toolsHooksSection, ggufHubTab),
          showIcon: showNav(`item.${item.id}.icon`),
          showLabel: showNav(`item.${item.id}.label`),
        }))
    : [];

  const openWorkspaceModal = (section: WorkspaceModalSection) => {
    setWorkspaceModalSection(section);
    setWorkspaceModalOpen(true);
  };

  return (
    <>
      <aside
        className={cn(
          'app-navigation shrink-0 border rounded-2xl px-2 lg:px-3 py-3 flex flex-col overflow-hidden shadow-[0_4px_20px_-2px_rgba(30,41,59,0.06)]',
          uiStyle === 'mica-windows' && 'mica-panel',
          mobileExpanded && 'app-navigation-expanded',
          tokens.sidebarBg,
          tokens.cardBorder,
        )}
        style={{ '--app-navigation-width': `${appNavigationWidth}px` } as React.CSSProperties}
      >
        {/* Top Brand + Mascot + Status + AI Settings */}
        <div className="shrink-0 pb-3">
          {showNav('brand.logo') && (showNav('brand.logo.icon') || showNav('brand.logo.label')) && (
            <div className="flex h-9 items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-2 lg:px-3">
              {showNav('brand.logo.icon') && (
                <Bot className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              )}
              {showNav('brand.logo.label') && (
                <span className={cn('truncate text-sm font-bold tracking-wide text-zinc-900 dark:text-zinc-100', mobileExpanded ? 'inline' : 'hidden lg:inline')}>
                  ONE CORE AI
                </span>
              )}
            </div>
          )}
          <div className="mt-2 flex min-w-0 items-center gap-2 px-2 pt-1 lg:px-3">
            {activeRole && showNav('brand.mascot') && showNav('brand.mascot.icon') && (
              <ModelMascot
                compact
                avatarOnly
                status={serverStatus}
                activity={agentActivity}
                persona={activeRole.persona}
                roleName={activeRoleLabel}
                onClick={() => {
                  setPopupGroupId(null);
                  setActiveTab('workstation');
                }}
              />
            )}
            <div className={cn('min-w-0 flex-1 flex-col gap-0.5', mobileExpanded ? 'flex' : 'hidden lg:flex')}>
              {showNav('brand.role') && (
                <div className="flex min-w-0 items-center gap-1.5">
                  {showNav('brand.role.icon') && (
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', statusIndicator.className)}
                      title={statusIndicator.label}
                      aria-label={statusIndicator.label}
                    />
                  )}
                  {showNav('brand.role.label') && (
                    <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {activeRoleLabel}
                    </span>
                  )}
                </div>
              )}
              {showNav('brand.activity') && showNav('brand.activity.label') && (
                <span className="truncate text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
                  {activityLabel}
                </span>
              )}
            </div>
            {showNav('nav.ai-settings') && showNav('nav.ai-settings.icon') && (
              <button
                type="button"
                onClick={() => {
                  setPopupGroupId(null);
                  window.dispatchEvent(new CustomEvent('onecore:open-model-switcher'));
                }}
                title="Выбор модели ИИ"
                aria-label="Открыть выбор модели ИИ"
                className="ml-1 h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Primary Sections (<=10 groups, <=5 subsections each in NavigationGroupPopup) + Compact Workspace Launcher */}
        <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2.5 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav aria-label="Основные разделы" className="shrink-0 flex flex-col gap-1.5">
            <section className="shrink-0 rounded-2xl border border-zinc-200/70 bg-zinc-50/90 p-1.5 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex flex-col gap-0.5">
                {navigationGroups.map((group) => {
                  const visibleGroupItems = group.items.filter(
                    (item) =>
                      showNav(`item.${item.id}`) &&
                      (showNav(`item.${item.id}.icon`) || showNav(`item.${item.id}.label`)),
                  );
                  if (
                    !showNav(`group.${group.id}`) ||
                    visibleGroupItems.length === 0 ||
                    (!showNav(`group.${group.id}.icon`) && !showNav(`group.${group.id}.label`))
                  ) {
                    return null;
                  }
                  const isDirectChatGroup =
                    group.items.length === 1 &&
                    group.items[0].tab === 'workstation' &&
                    !group.items[0].subItems?.length;
                  const directChatItem = isDirectChatGroup ? group.items[0] : null;
                  const showGroupIcon =
                    showNav(`group.${group.id}.icon`) && (!directChatItem || showNav(`item.${directChatItem.id}.icon`));
                  const showGroupLabel =
                    showNav(`group.${group.id}.label`) && (!directChatItem || showNav(`item.${directChatItem.id}.label`));
                  if (!showGroupIcon && !showGroupLabel) {
                    return null;
                  }
                  const active = activeNavGroup === group.id;
                  const popupOpen = popupGroupId === group.id;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      data-nav-group-trigger="true"
                      onClick={(event) => {
                        if (directChatItem) {
                          handleSelectNavItem(directChatItem);
                          setPopupGroupId(null);
                          return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        setPopupAnchor({ top: rect.top, left: rect.left, width: rect.width });
                        setActiveNavGroup(group.id);
                        setPopupGroupId((current) => (current === group.id ? null : group.id));
                      }}
                      title={group.label}
                      aria-label={group.label}
                      aria-haspopup={isDirectChatGroup ? undefined : 'menu'}
                      aria-expanded={isDirectChatGroup ? undefined : popupOpen}
                      className={cn(
                        'w-full h-8 px-2.5 lg:px-3 inline-flex items-center gap-2 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950',
                        mobileExpanded ? 'justify-between' : 'justify-center lg:justify-between',
                        active || popupOpen
                          ? 'bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-blue-400 dark:ring-zinc-700'
                          : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100',
                      )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        {showGroupIcon && (
                          <NavTablerIcon
                            name={group.icon}
                            className={cn('h-4 w-4 shrink-0', active || popupOpen ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400')}
                          />
                        )}
                        {showGroupLabel && (
                          <span className={cn('truncate', mobileExpanded ? 'inline' : 'hidden lg:inline')}>
                            {group.label}
                          </span>
                        )}
                      </span>
                      {!isDirectChatGroup && (
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 transition-transform',
                            mobileExpanded ? 'block' : 'hidden lg:block',
                            popupOpen ? 'text-blue-500 translate-x-0.5' : 'text-zinc-400',
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {showNav('nav.mobile-toggle') && showNav('nav.mobile-toggle.icon') && (
              <button
                type="button"
                onClick={() => {
                  setPopupGroupId(null);
                  setMobileExpanded((v) => !v);
                }}
                aria-expanded={mobileExpanded}
                aria-label={mobileExpanded ? 'Свернуть панель' : 'Развернуть панель'}
                title={mobileExpanded ? 'Свернуть панель' : 'Развернуть панель'}
                className="mt-0.5 h-8 w-full inline-flex items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100 lg:hidden"
              >
                {mobileExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </nav>

          {/* Compact Workspace Popup Launchers (immediately after menu) */}
          {chatVisibility.showLeftSidebar && showNav('nav.context-pane') && (
            <div className={cn('shrink-0 border-t border-zinc-200 pt-2.5 space-y-1.5 dark:border-zinc-800', !mobileExpanded && 'hidden lg:block')}>
              <button
                type="button"
                onClick={() => openWorkspaceModal('project')}
                className="w-full min-h-9 px-2.5 inline-flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white/80 text-left text-xs transition-colors hover:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <span className="min-w-0 flex-1">
                  {showNav('workspace.project-title') && (
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Проект
                    </span>
                  )}
                  <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {activeProject ? activeProject.name : 'Выбрать проект…'}
                  </span>
                </span>
                <FolderOpen className="h-4 w-4 shrink-0 text-zinc-400" />
              </button>

              {activeProject && (showNav('workspace.project-files') || showNav('workspace.tasks') || showNav('workspace.action-log')) && (
                <div className="flex items-center gap-1">
                  {showNav('workspace.project-files') && (
                    <button
                      type="button"
                      onClick={() => openWorkspaceModal('project')}
                      title="Файлы и действия проекта"
                      className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 text-[11px] font-medium text-zinc-600 hover:border-blue-500 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      {showNav('workspace.project-files.icon') && <FolderOpen className="h-3 w-3 shrink-0" />}
                      <span className="tabular-nums">{files.length}</span>
                    </button>
                  )}
                  {showNav('workspace.tasks') && (
                    <button
                      type="button"
                      onClick={() => openWorkspaceModal('tasks')}
                      title="Задачи проекта"
                      className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 text-[11px] font-medium text-zinc-600 hover:border-blue-500 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      <ListTodo className="h-3 w-3 shrink-0" />
                      <span className="tabular-nums">{projectWorkspace.tasks.length}</span>
                    </button>
                  )}
                  {showNav('workspace.action-log') && (
                    <button
                      type="button"
                      onClick={() => openWorkspaceModal('logs')}
                      title="Журнал действий"
                      className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 text-[11px] font-medium text-zinc-600 hover:border-blue-500 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      <Activity className="h-3 w-3 shrink-0" />
                      <span className="tabular-nums">{projectLogs.length}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PLAN / ACT Switch (pinned at bottom) */}
        <div className="mt-auto shrink-0 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            {showNav('nav.mode-switch') && (
              <button
                type="button"
                onClick={() => setAgentMode(agentMode === 'act' ? 'plan' : 'act')}
                aria-label={`Режим ${agentMode.toUpperCase()}. Переключить ACT / PLAN`}
                aria-pressed={agentMode === 'act'}
                title="Переключить режим ACT / PLAN"
                className={cn(
                  'relative inline-flex h-9 min-w-0 flex-1 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950',
                  agentMode === 'act' ? 'border-blue-500/40 bg-blue-500/10' : 'border-amber-500/40 bg-amber-500/10',
                )}
              >
                <span
                  className={cn(
                    'absolute h-6 w-[calc(50%-4px)] rounded-full shadow-sm transition-transform',
                    agentMode === 'act' ? 'translate-x-[calc(100%+4px)] bg-blue-600' : 'translate-x-1 bg-amber-500',
                  )}
                />
                {showNav('nav.mode-switch.label') && (
                  <>
                    <span className={cn('relative z-10 w-1/2 text-[9px] font-bold', agentMode === 'plan' ? 'text-white' : 'text-zinc-500')}>
                      P<span className={mobileExpanded ? 'inline' : 'hidden lg:inline'}>LAN</span>
                    </span>
                    <span className={cn('relative z-10 w-1/2 text-[9px] font-bold', agentMode === 'act' ? 'text-white' : 'text-zinc-500')}>
                      A<span className={mobileExpanded ? 'inline' : 'hidden lg:inline'}>CT</span>
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </aside>

      <NavigationGroupPopup
        group={popupGroup}
        items={popupItems}
        anchorRect={popupAnchor}
        onSelectItem={handleSelectNavItem}
        onSelectSubItem={handleSelectSubItem}
        onClose={() => setPopupGroupId(null)}
        agentTeamSection={agentTeamSection}
        generalAgentTab={generalAgentTab}
        subAgentsTab={subAgentsTab}
        settingsSection={settingsSection}
        aiSettingsCategory={aiSettingsCategory}
        activeNavSubItemId={activeNavSubItemId}
        agentTeamFocus={agentTeamFocus}
        sshGithubSection={sshGithubSection}
        ggufHubTab={ggufHubTab}
        llamaModelsSection={llamaModelsSection}
        projectsSection={projectsSection}
        skillsSection={skillsSection}
        instructionsSection={instructionsSection}
        intelligenceSection={intelligenceSection}
        directoriesSection={directoriesSection}
        gatewayPlatform={gatewayPlatform}
      />

      <WorkspaceControlsModal
        open={workspaceModalOpen}
        initialSection={workspaceModalSection}
        onClose={() => setWorkspaceModalOpen(false)}
      />
    </>
  );
};

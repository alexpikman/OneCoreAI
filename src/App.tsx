import { useEffect, useState } from 'react';
import { AppNavigation } from './components/layout/AppNavigation';
import { DesignerNavigationProvider } from './components/layout/DesignerNavigationContext';
import { DeleteWarningHost } from './components/layout/DeleteWarningHost';
import { NotificationHost } from './components/layout/NotificationHost';
import { PageContextSidebar } from './components/layout/PageContextSidebar';
import { StartupScreen } from './components/layout/StartupScreen';
import { ModelHubView } from './components/models/ModelHubView';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { ModelSwitcherModal } from './components/workstation/ModelSwitcherModal';
import { AgentTeamPage } from './pages/ai-resources/AgentTeamPage';
import { DirectoriesPage } from './pages/ai-resources/DirectoriesPage';
import { InstructionsCatalogPage } from './pages/ai-resources/InstructionsCatalogPage';
import { IntelligenceLibraryPage } from './pages/ai-resources/IntelligenceLibraryPage';
import { LlamaServerModelsPage } from './pages/ai-resources/LlamaServerModelsPage';
import { LlamaServerSettingsPage } from './pages/ai-resources/LlamaServerSettingsPage';
import { ProvidersPage } from './pages/ai-resources/ProvidersPage';
import { SkillsDirectoryPage } from './pages/ai-resources/SkillsDirectoryPage';
import { SubAgentsPage } from './pages/ai-resources/SubAgentsPage';
import { FilesPage } from './pages/context/FilesPage';
import { ProcessesPage } from './pages/context/ProcessesPage';
import { ProjectHistoryPage } from './pages/context/ProjectHistoryPage';
import { ProjectsPage } from './pages/context/ProjectsPage';
import { TasksPage } from './pages/context/TasksPage';
import { ExecutionEnvPage } from './pages/integrations/ExecutionEnvPage';
import { GatewayPage } from './pages/integrations/GatewayPage';
import { McpPage } from './pages/integrations/McpPage';
import { SshGithubPage } from './pages/integrations/SshGithubPage';
import { ToolsHooksPage } from './pages/integrations/ToolsHooksPage';
import { AgentHistoryPage } from './pages/logs/AgentHistoryPage';
import { ErrorLogPage } from './pages/logs/ErrorLogPage';
import { MemoryPage } from './pages/logs/MemoryPage';
import { OperationsLogPage } from './pages/logs/OperationsLogPage';
import { TasksHistoryPage } from './pages/logs/TasksHistoryPage';
import { InterfaceSettingsPage } from './pages/settings/InterfaceSettingsPage';
import { PermissionsPage } from './pages/settings/PermissionsPage';
import { SecurityPage } from './pages/settings/SecurityPage';
import { SystemPage } from './pages/settings/SystemPage';
import { UpdatesSettingsPage } from './pages/settings/UpdatesSettingsPage';
import { BrowserPage } from './pages/workspace/BrowserPage';
import { DashboardPage } from './pages/workspace/DashboardPage';
import { NotesPage } from './pages/workspace/NotesPage';
import { TerminalPage } from './pages/workspace/TerminalPage';
import { WorkstationPage } from './pages/workspace/WorkstationPage';
import { useOneCoreStore } from './store/useOneCoreStore';
import { cn } from './utils/cn';
import { getUiTokens } from './utils/uiStyle';

export default function App() {
  const {
    activeTab,
    settingsSection,
    setActiveTab,
    setSettingsSection,
    checkpoints,
    rollbackToCheckpoint,
    theme,
    uiStyle,
    hydrated,
    hydrateFromServer,
    chatHistoryLoaded,
    checkForUpdates,
    refreshHardwareProfile,
  } = useOneCoreStore();

  const tokens = getUiTokens(uiStyle);
  const [projectPlanModalOpen, setProjectPlanModalOpen] = useState(false);
  const [projectEntityFilterId, setProjectEntityFilterId] = useState('');
  const [projectListCount, setProjectListCount] = useState(0);

  useEffect(() => {
    void hydrateFromServer();
  }, [hydrateFromServer]);

  useEffect(() => {
    if (hydrated) {
      void checkForUpdates();
      void refreshHardwareProfile();
    }
  }, [hydrated, checkForUpdates, refreshHardwareProfile]);

  useEffect(() => {
    if (!chatHistoryLoaded) return;

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const flushPendingSave = () => {
      if (!saveTimer) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      void useOneCoreStore.getState().saveChatHistory();
    };
    const unsubscribe = useOneCoreStore.subscribe((state, previousState) => {
      if (
        !state.chatHistoryLoaded ||
        (state.sessions === previousState.sessions && state.activeSessionId === previousState.activeSessionId)
      ) {
        return;
      }
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        void state.saveChatHistory();
      }, 500);
    });

    window.addEventListener('pagehide', flushPendingSave);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flushPendingSave);
      flushPendingSave();
    };
  }, [chatHistoryLoaded]);

  useEffect(() => {
    const handler = () => {
      setActiveTab('workstation');
    };
    window.addEventListener('onecore:open-project-modal', handler);
    return () => window.removeEventListener('onecore:open-project-modal', handler);
  }, [setActiveTab]);

  useEffect(() => {
    if (activeTab !== 'tasks' && activeTab !== 'processes' && activeTab !== 'project-history') {
      setProjectEntityFilterId('');
    }
  }, [activeTab]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-style', uiStyle);
  }, [uiStyle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSettingsSection('llama-gguf');
        setActiveTab('models');
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'z') {
        if (checkpoints.length > 0) {
          e.preventDefault();
          rollbackToCheckpoint(checkpoints[0].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [checkpoints, rollbackToCheckpoint, setActiveTab, setSettingsSection]);

  if (!hydrated) return <StartupScreen />;

  const renderModelsTab = () => {
    switch (settingsSection) {
      case 'model-search':
        return <ModelHubView />;
      case 'llama-gguf':
        return <ModelHubView title="Центр GGUF" />;
      case 'llama-models':
        return <LlamaServerModelsPage />;
      case 'llama-paged-attention':
      case 'llama-openai-api':
      case 'llama-benchmark':
      case 'engine-paths':
        return <LlamaServerSettingsPage />;
      case 'roles-pipeline':
        return <AgentTeamPage />;
      case 'subagents-delegation':
        return <SubAgentsPage />;
      case 'skills-memory':
        return <SkillsDirectoryPage />;
      case 'providers':
      case 'model-manager':
      default:
        return <ProvidersPage />;
    }
  };

  const renderSettingsTab = () => {
    switch (settingsSection) {
      case 'updates':
        return <UpdatesSettingsPage />;
      case 'ssh-github':
        return <SshGithubPage />;
      case 'gateway':
        return <GatewayPage />;
      case 'execution-env':
        return <ExecutionEnvPage />;
      case 'engine-paths':
        return <LlamaServerSettingsPage />;
      case 'ui-chat':
      default:
        return <InterfaceSettingsPage />;
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'workstation':
        return <WorkstationPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'browser':
        return <BrowserPage />;
      case 'notes':
        return <NotesPage />;
      case 'projects':
        return (
          <ProjectsPage
            planModalOpen={projectPlanModalOpen}
            onClosePlanModal={() => setProjectPlanModalOpen(false)}
          />
        );
      case 'tasks':
        return (
          <TasksPage
            projectFilterId={projectEntityFilterId}
            onProjectFilterChange={setProjectEntityFilterId}
            onProjectCountChange={setProjectListCount}
          />
        );
      case 'processes':
        return (
          <ProcessesPage
            projectFilterId={projectEntityFilterId}
            onProjectFilterChange={setProjectEntityFilterId}
            onProjectCountChange={setProjectListCount}
          />
        );
      case 'files':
        return <FilesPage />;
      case 'project-history':
        return (
          <ProjectHistoryPage
            projectFilterId={projectEntityFilterId}
            onProjectFilterChange={setProjectEntityFilterId}
            onProjectCountChange={setProjectListCount}
          />
        );
      case 'models':
        return renderModelsTab();
      case 'directories':
        return <DirectoriesPage />;
      case 'skills':
        return <SkillsDirectoryPage />;
      case 'instructions':
        return settingsSection === 'intelligence-library' ? <IntelligenceLibraryPage /> : <InstructionsCatalogPage defaultTab="knowledge" />;
      case 'mcp':
        return <McpPage />;
      case 'tools-hooks':
        return <ToolsHooksPage />;
      case 'settings':
        return renderSettingsTab();
      case 'permissions':
        return <PermissionsPage />;
      case 'security':
        return <SecurityPage />;
      case 'system':
        return <SystemPage />;
      case 'operations-log':
        return <OperationsLogPage />;
      case 'error-log':
        return <ErrorLogPage />;
      case 'memory':
        return <MemoryPage />;
      case 'tasks-history':
        return <TasksHistoryPage />;
      case 'agent-journal':
        return <AgentHistoryPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <DesignerNavigationProvider>
      <div
        data-ui-style={uiStyle}
        className={cn('h-screen w-screen flex flex-col overflow-hidden', tokens.shellBg, theme === 'dark' && 'dark')}
      >
        <div className="flex flex-1 min-h-0 gap-3 overflow-hidden px-3 pt-3 pb-3 lg:px-4 lg:pt-4 lg:pb-4">
          <AppNavigation />
          <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
            {renderActivePage()}
          </main>
          <PageContextSidebar
            projectListCount={projectListCount}
            onOpenPlanModal={() => setProjectPlanModalOpen(true)}
            onSelectProjectTab={(tab, projectId) => {
              setProjectEntityFilterId(projectId);
              setActiveTab(tab);
            }}
          />
        </div>
        <OfflineIndicator />
        <ModelSwitcherModal />
        <DeleteWarningHost />
        <NotificationHost />
      </div>
    </DesignerNavigationProvider>
  );
}

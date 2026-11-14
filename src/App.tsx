import { useEffect } from 'react';
import { AppNavigation } from './components/layout/AppNavigation';
import { TopHeader } from './components/layout/TopHeader';
import { ModelHubView } from './components/models/ModelHubView';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { ProjectsView } from './components/projects/ProjectsView';
import { AiSettingsModal } from './components/settings/AiSettingsModal';
import { SettingsView } from './components/settings/SettingsView';
import { WorkstationView } from './components/workstation/WorkstationView';
import { useOneCoreStore } from './store/useOneCoreStore';
import { cn } from './utils/cn';
import { getUiTokens } from './utils/uiStyle';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    checkpoints,
    rollbackToCheckpoint,
    theme,
    uiStyle,
    hydrated,
    hydrateFromServer,
    checkForUpdates,
  } = useOneCoreStore();

  const tokens = getUiTokens(uiStyle);

  useEffect(() => {
    void hydrateFromServer();
  }, [hydrateFromServer]);

  useEffect(() => {
    if (hydrated) void checkForUpdates();
  }, [hydrated, checkForUpdates]);

  // Global listener: open project connect modal from any tab when agent needs a project
  useEffect(() => {
    const handler = () => {
      // Switch to workstation tab so the user sees the project connection UI
      setActiveTab('workstation');
    };
    window.addEventListener('onecore:open-project-modal', handler);
    return () => window.removeEventListener('onecore:open-project-modal', handler);
  }, [setActiveTab]);

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
  }, [checkpoints, rollbackToCheckpoint, setActiveTab]);

  return (
    <div
      data-ui-style={uiStyle}
      className={cn('h-screen w-screen flex flex-col overflow-hidden', tokens.shellBg)}
    >
      <TopHeader />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AppNavigation />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {activeTab === 'workstation' && <WorkstationView />}
          {activeTab === 'models' && <ModelHubView />}
          {activeTab === 'projects' && <ProjectsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
      <OfflineIndicator />
      <AiSettingsModal />
    </div>
  );
}

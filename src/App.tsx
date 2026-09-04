import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ParameterStore } from './core/parameters/ParameterStore';
import { TalkSimulator } from './core/audio/TalkSimulator';
import { BlinkScheduler } from './core/animation/BlinkScheduler';
import { AudioVAD } from './core/audio/AudioVAD';
import { LiveBroadcaster } from './core/sync/LiveBroadcaster';
import { DEFAULT_PROJECT_MANIFEST } from './core/project/defaultProject';
import { CharacterLayer, ProjectManifest } from './core/project/types';

import { TopMenuBar } from './modules/workspace/TopMenuBar';
import { PreviewPanel } from './modules/workspace/PreviewPanel';
import { ControlsPanel } from './modules/workspace/ControlsPanel';
import { BroadcastPanel } from './modules/workspace/BroadcastPanel';
import { LiveOutputApp } from './modules/live/LiveOutputApp';
import { useDirtyState } from './modules/workspace/useDirtyState';

export const App: React.FC = () => {
  // Check if current route is Live Output (path /live/* or hash #/live/*)
  const isLiveRoute = (): boolean => {
    return (
      window.location.pathname.startsWith('/live') ||
      window.location.hash.startsWith('#/live')
    );
  };

  const [isLiveView, setIsLiveView] = useState<boolean>(isLiveRoute);
  const [manifest, setManifest] = useState<ProjectManifest>(DEFAULT_PROJECT_MANIFEST);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [missingAssetsCount, setMissingAssetsCount] = useState<number>(0);

  const { isDirty, markDirty, markClean } = useDirtyState(false);

  // Core Subsystems
  const storeRef = useRef<ParameterStore>(new ParameterStore());
  const talkSimRef = useRef<TalkSimulator>(new TalkSimulator(storeRef.current));
  const blinkRef = useRef<BlinkScheduler>(new BlinkScheduler(storeRef.current));
  const vadRef = useRef<AudioVAD>(new AudioVAD(storeRef.current));
  const broadcasterRef = useRef<LiveBroadcaster | null>(null);

  // Keep manifestRef synced for closures
  const manifestRef = useRef<ProjectManifest>(manifest);
  manifestRef.current = manifest;

  const isDirtyRef = useRef<boolean>(isDirty);
  isDirtyRef.current = isDirty;

  // Listen to route/hash changes
  useEffect(() => {
    const handleLocationChange = () => {
      setIsLiveView(isLiveRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Desktop Main process integration
  useEffect(() => {
    if (isLiveView) return;

    // In Electron environment, query server info via secure IPC bridge
    if ((window as any).nvlDesktop) {
      (window as any).nvlDesktop
        .getServerInfo()
        .then((info: any) => {
          setServerPort(info.port);
          initBroadcaster(info.port);
        })
        .catch((err: any) => {
          console.warn('[App] Could not get server info from Electron IPC:', err);
          initBroadcaster(17777);
        });
    } else {
      // Fallback for browser testing
      const port = parseInt(window.location.port || '17777', 10);
      setServerPort(port);
      initBroadcaster(port);
    }

    function initBroadcaster(port: number) {
      if (broadcasterRef.current) return;

      const wsUrl = `ws://127.0.0.1:${port}/ws/${manifest.projectId}`;
      const broadcaster = new LiveBroadcaster({
        url: wsUrl,
        projectId: manifest.projectId,
        store: storeRef.current,
      });
      broadcaster.connect();
      broadcasterRef.current = broadcaster;
    }

    return () => {
      if (broadcasterRef.current) {
        broadcasterRef.current.disconnect();
        broadcasterRef.current = null;
      }
    };
  }, [isLiveView, manifest.projectId]);

  // Handle Dirty Confirmation before New/Open
  const confirmSaveIfDirty = async (): Promise<boolean> => {
    if (!isDirtyRef.current) return true;

    if ((window as any).nvlDesktop?.promptSaveChanges) {
      const choice = await (window as any).nvlDesktop.promptSaveChanges();
      if (choice === 'save') {
        const saved = await handleSaveProject();
        return saved;
      } else if (choice === 'discard') {
        return true;
      } else {
        return false; // Cancel
      }
    } else {
      return confirm('You have unsaved changes. Do you want to proceed and discard them?');
    }
  };

  // File Operations
  const handleNewProject = async () => {
    const canProceed = await confirmSaveIfDirty();
    if (!canProceed) return;

    if ((window as any).nvlDesktop?.newProject) {
      const res = await (window as any).nvlDesktop.newProject();
      if (!res.canceled) {
        if (res.error) {
          alert(`Failed to create new project: ${res.error}`);
        } else if (res.manifest) {
          setManifest(res.manifest);
          storeRef.current.reset();
          markClean();
        }
      }
    } else {
      setManifest(DEFAULT_PROJECT_MANIFEST);
      storeRef.current.reset();
      markClean();
    }
  };

  const handleOpenProject = async () => {
    const canProceed = await confirmSaveIfDirty();
    if (!canProceed) return;

    if ((window as any).nvlDesktop?.openProject) {
      const res = await (window as any).nvlDesktop.openProject();
      if (!res.canceled) {
        if (res.error) {
          alert(`Failed to open project: ${res.error}`);
        } else if (res.manifest) {
          setManifest(res.manifest);
          storeRef.current.reset();
          markClean();
        }
      }
    } else {
      alert('Open Project dialog is only available in Electron Desktop app.');
    }
  };

  const handleSaveProject = useCallback(async (): Promise<boolean> => {
    const currentManifest = manifestRef.current;
    if ((window as any).nvlDesktop?.saveProject) {
      const res = await (window as any).nvlDesktop.saveProject(currentManifest);
      if (!res.canceled) {
        if (res.error) {
          alert(`Failed to save project: ${res.error}`);
          return false;
        } else if (res.manifest) {
          setManifest(res.manifest);
          markClean();
          return true;
        }
      }
      return false;
    } else {
      // Browser fallback download
      const blob = new Blob([JSON.stringify(currentManifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentManifest.projectId}.nvl`;
      a.click();
      markClean();
      return true;
    }
  }, [markClean]);

  const handleSaveProjectAs = async () => {
    const currentManifest = manifestRef.current;
    if ((window as any).nvlDesktop?.saveProjectAs) {
      const res = await (window as any).nvlDesktop.saveProjectAs(currentManifest);
      if (!res.canceled) {
        if (res.error) {
          alert(`Failed to save project as: ${res.error}`);
        } else if (res.manifest) {
          setManifest(res.manifest);
          markClean();
        }
      }
    } else {
      handleSaveProject();
    }
  };

  const handleUpdateLayers = (updatedLayers: CharacterLayer[]) => {
    setManifest((prev) => ({
      ...prev,
      layers: updatedLayers,
    }));
    markDirty();
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSaveProject]);

  // Window close interception save trigger
  useEffect(() => {
    if ((window as any).nvlDesktop?.onTriggerSave) {
      const unsubscribe = (window as any).nvlDesktop.onTriggerSave(() => {
        handleSaveProject();
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [handleSaveProject]);

  // If this is the Live Output window / OBS Browser Source, render only the transparent canvas
  if (isLiveView) {
    return <LiveOutputApp projectId={manifest.projectId} />;
  }

  return (
    <div className="desktop-app-container">
      <TopMenuBar
        projectName={manifest.metadata.name}
        isDirty={isDirty}
        missingAssetsCount={missingAssetsCount}
        serverPort={serverPort}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onSaveProjectAs={handleSaveProjectAs}
      />

      <main className="workspace-layout">
        <div className="workspace-main-column">
          <PreviewPanel
            manifest={manifest}
            store={storeRef.current}
            serverPort={serverPort}
            onMissingAssetsChange={(missing) => setMissingAssetsCount(missing.length)}
          />
          <BroadcastPanel serverPort={serverPort} projectId={manifest.projectId} />
        </div>

        <aside className="workspace-sidebar">
          <ControlsPanel
            store={storeRef.current}
            talkSimulator={talkSimRef.current}
            blinkScheduler={blinkRef.current}
            audioVAD={vadRef.current}
            manifest={manifest}
            onUpdateLayers={handleUpdateLayers}
          />
        </aside>
      </main>
    </div>
  );
};
export default App;

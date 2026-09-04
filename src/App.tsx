import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ParameterStore } from './core/parameters/ParameterStore';
import { TalkSimulator } from './core/audio/TalkSimulator';
import { BlinkScheduler } from './core/animation/BlinkScheduler';
import { AudioVAD } from './core/audio/AudioVAD';
import { LiveBroadcaster } from './core/sync/LiveBroadcaster';
import { DEFAULT_PROJECT_MANIFEST } from './core/project/defaultProject';
import { CharacterLayer, ProjectManifest, IdleConfig, BlinkSettings } from './core/project/types';

import { TopMenuBar } from './modules/workspace/TopMenuBar';
import { LayerPanel } from './modules/workspace/LayerPanel';
import { CanvasStage } from './modules/workspace/CanvasStage';
import { LayerInspector } from './modules/workspace/LayerInspector';
import { ControlsPanel } from './modules/workspace/ControlsPanel';
import { BroadcastPanel } from './modules/workspace/BroadcastPanel';
import { LiveOutputApp } from './modules/live/LiveOutputApp';
import { ValidationBanner } from './modules/workspace/ValidationBanner';
import { WelcomeScreen } from './modules/workspace/WelcomeScreen';
import { useDirtyState } from './modules/workspace/useDirtyState';
import { SemanticLayerRole } from './core/project/types';
import {
  createDefaultLayer,
  renameLayer,
  toggleVisibility,
  deleteLayer,
  updateTransform,
} from './core/project/layerOperations';
import {
  assignRole,
  validateRoleMapping,
  autoAssignRoles,
  ROLE_METADATA,
} from './core/project/roleAssignment';

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
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    DEFAULT_PROJECT_MANIFEST.layers[0]?.id || null
  );
  const [activeSidebarTab, setActiveSidebarTab] = useState<'inspector' | 'controls'>('inspector');

  const [isProjectOpen, setIsProjectOpen] = useState<boolean>(false);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(false);
  const [isImportingPng, setIsImportingPng] = useState<boolean>(false);

  const { isDirty, markDirty, markClean } = useDirtyState(false);

  // Core Subsystems
  const storeRef = useRef<ParameterStore>(new ParameterStore());
  const talkSimRef = useRef<TalkSimulator>(new TalkSimulator(storeRef.current));
  const blinkRef = useRef<BlinkScheduler>(new BlinkScheduler(storeRef.current));
  const vadRef = useRef<AudioVAD>(new AudioVAD(storeRef.current));
  const broadcasterRef = useRef<LiveBroadcaster | null>(null);

  // Native message dialog helper
  const showMessage = useCallback(
    async (title: string, message: string, type: 'info' | 'error' | 'warning' = 'info') => {
      if ((window as any).nvlDesktop?.showMessageBox) {
        await (window as any).nvlDesktop.showMessageBox({
          type,
          title,
          message,
        });
      } else {
        alert(`${title}\n\n${message}`);
      }
    },
    []
  );

  // Monitor microphone disconnection
  useEffect(() => {
    const unsub = vadRef.current.onDeviceDisconnected(() => {
      showMessage(
        'Microphone Disconnected',
        'Your active microphone device was disconnected. Voice activity detection has been stopped.',
        'warning'
      );
    });
    return unsub;
  }, [showMessage]);

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

    setIsLoadingProject(true);
    try {
      if ((window as any).nvlDesktop?.newProject) {
        const res = await (window as any).nvlDesktop.newProject();
        if (!res.canceled) {
          if (res.error) {
            await showMessage('Create Project Error', `Failed to create new project: ${res.error}`, 'error');
          } else if (res.manifest) {
            setManifest(res.manifest);
            setSelectedLayerId(res.manifest.layers[0]?.id || null);
            storeRef.current.reset();
            markClean();
            setIsProjectOpen(true);
          }
        }
      } else {
        setManifest(DEFAULT_PROJECT_MANIFEST);
        setSelectedLayerId(DEFAULT_PROJECT_MANIFEST.layers[0]?.id || null);
        storeRef.current.reset();
        markClean();
        setIsProjectOpen(true);
      }
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleOpenProject = async () => {
    const canProceed = await confirmSaveIfDirty();
    if (!canProceed) return;

    setIsLoadingProject(true);
    try {
      if ((window as any).nvlDesktop?.openProject) {
        const res = await (window as any).nvlDesktop.openProject();
        if (!res.canceled) {
          if (res.error) {
            await showMessage('Open Project Error', `Failed to open project: ${res.error}`, 'error');
          } else if (res.manifest) {
            setManifest(res.manifest);
            setSelectedLayerId(res.manifest.layers[0]?.id || null);
            storeRef.current.reset();
            markClean();
            setIsProjectOpen(true);
          }
        }
      } else {
        await showMessage('Open Project', 'Open Project dialog is only available in Electron Desktop app.', 'info');
      }
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleLoadSample = async () => {
    const canProceed = await confirmSaveIfDirty();
    if (!canProceed) return;

    setManifest(DEFAULT_PROJECT_MANIFEST);
    setSelectedLayerId(DEFAULT_PROJECT_MANIFEST.layers[0]?.id || null);
    storeRef.current.reset();
    markClean();
    setIsProjectOpen(true);
  };

  const handleSaveProject = useCallback(async (): Promise<boolean> => {
    const currentManifest = manifestRef.current;
    if ((window as any).nvlDesktop?.saveProject) {
      const res = await (window as any).nvlDesktop.saveProject(currentManifest);
      if (!res.canceled) {
        if (res.error) {
          await showMessage('Save Project Error', `Failed to save project: ${res.error}`, 'error');
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
      URL.revokeObjectURL(url);
      markClean();
      return true;
    }
  }, [markClean, showMessage]);

  const handleSaveProjectAs = async () => {
    const currentManifest = manifestRef.current;
    if ((window as any).nvlDesktop?.saveProjectAs) {
      const res = await (window as any).nvlDesktop.saveProjectAs(currentManifest);
      if (!res.canceled) {
        if (res.error) {
          await showMessage('Save Project Error', `Failed to save project as: ${res.error}`, 'error');
        } else if (res.manifest) {
          setManifest(res.manifest);
          markClean();
        }
      }
    } else {
      handleSaveProject();
    }
  };

  // Layer & Asset Operations
  const handleImportPng = async () => {
    if ((window as any).nvlDesktop?.importPng) {
      setIsImportingPng(true);
      try {
        const res = await (window as any).nvlDesktop.importPng();
        if (res.error) {
          await showMessage('Asset Import Failed', res.error, 'error');
          return;
        }

        if (!res.canceled && res.assets && res.assets.length > 0) {
          let maxZIndex = manifest.layers.reduce((max: number, l: CharacterLayer) => Math.max(max, l.zIndex), -1);
          const newAssets = [...manifest.assets];
          const newLayers = [...manifest.layers];
          let lastCreatedId: string | null = null;

          for (const asset of res.assets) {
            if (!newAssets.some((a) => a.id === asset.id)) {
              newAssets.push(asset);
            }
            maxZIndex += 1;
            const layer = createDefaultLayer(asset, maxZIndex);
            newLayers.push(layer);
            lastCreatedId = layer.id;
          }

          setManifest((prev) => ({
            ...prev,
            assets: newAssets,
            layers: newLayers,
            metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
          }));
          if (lastCreatedId) {
            setSelectedLayerId(lastCreatedId);
            setActiveSidebarTab('inspector');
          }
          markDirty();
        }
      } catch (err: any) {
        await showMessage('Asset Import Error', err.message || 'An error occurred during import', 'error');
      } finally {
        setIsImportingPng(false);
      }
    } else {
      await showMessage('PNG Import', 'PNG Import is available in the NVL Desktop application.', 'info');
    }
  };

  const handleReorderLayers = (updatedLayers: CharacterLayer[]) => {
    setManifest((prev) => ({
      ...prev,
      layers: updatedLayers,
    }));
    markDirty();
  };

  const handleRenameLayer = (layerId: string, newName: string) => {
    setManifest((prev) => ({
      ...prev,
      layers: renameLayer(prev.layers, layerId, newName),
    }));
    markDirty();
  };

  const handleToggleVisibility = (layerId: string) => {
    setManifest((prev) => ({
      ...prev,
      layers: toggleVisibility(prev.layers, layerId),
    }));
    markDirty();
  };

  const handleDeleteLayer = (layerId: string) => {
    setManifest((prev) => ({
      ...prev,
      layers: deleteLayer(prev.layers, layerId),
    }));
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
    markDirty();
  };

  const handleUpdateLayerTransform = (layerId: string, updates: Partial<CharacterLayer>) => {
    setManifest((prev) => ({
      ...prev,
      layers: updateTransform(prev.layers, layerId, updates),
    }));
    markDirty();
  };

  const handleSelectLayer = (layerId: string | null) => {
    setSelectedLayerId(layerId);
    if (layerId) {
      setActiveSidebarTab('inspector');
    }
  };

  const handleAssignRole = (layerId: string, newRole: SemanticLayerRole) => {
    const check = assignRole(manifest.layers, layerId, newRole, false);
    if (check.hasConflict && check.conflictLayer) {
      const roleDef = ROLE_METADATA[newRole];
      const targetLayer = manifest.layers.find((l) => l.id === layerId);
      const confirmMsg = `Role "${roleDef.label}" is already assigned to layer "${check.conflictLayer.name}". Reassign it to "${targetLayer?.name || 'this layer'}"?`;
      if (window.confirm(confirmMsg)) {
        const reassignRes = assignRole(manifest.layers, layerId, newRole, true);
        setManifest((prev) => ({
          ...prev,
          layers: reassignRes.updatedLayers,
        }));
        markDirty();
      }
    } else {
      setManifest((prev) => ({
        ...prev,
        layers: check.updatedLayers,
      }));
      markDirty();
    }
  };

  const handleAutoAssignRoles = () => {
    const result = autoAssignRoles(manifest.layers);
    if (result.assignedCount > 0) {
      setManifest((prev) => ({
        ...prev,
        layers: result.updatedLayers,
      }));
      markDirty();
    } else {
      alert('No matching layer names found for auto-assignment.');
    }
  };

  const handleUpdateIdleConfig = useCallback(
    (idleConfig: IdleConfig) => {
      setManifest((prev) => ({
        ...prev,
        idleConfig,
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      }));
      markDirty();
    },
    [markDirty]
  );

  const handleUpdateBlinkConfig = useCallback(
    (blinkConfig: BlinkSettings) => {
      setManifest((prev) => ({
        ...prev,
        blinkConfig,
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      }));
      blinkRef.current.updateConfig({
        minIntervalMs: blinkConfig.minIntervalMs,
        maxIntervalMs: blinkConfig.maxIntervalMs,
        blinkDurationMs: blinkConfig.durationMs,
      });
      markDirty();
    },
    [markDirty]
  );

  const handleUpdateAudioConfig = useCallback(
    (audioConfig: ProjectManifest['audioConfig']) => {
      setManifest((prev) => ({
        ...prev,
        audioConfig,
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      }));
      vadRef.current.updateConfig(audioConfig);
      markDirty();
    },
    [markDirty]
  );

  const selectedLayer = manifest.layers.find((l) => l.id === selectedLayerId) || null;
  const roleValidation = validateRoleMapping(manifest.layers);

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

      {isLoadingProject && (
        <div className="project-loading-overlay" data-testid="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Loading project...</span>
        </div>
      )}

      {!isProjectOpen ? (
        <WelcomeScreen
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onLoadSample={handleLoadSample}
        />
      ) : (
        <main className="workspace-layout">
          {/* Left Column: Layer Panel */}
          <LayerPanel
            layers={manifest.layers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={handleSelectLayer}
            onReorderLayers={handleReorderLayers}
            onRenameLayer={handleRenameLayer}
            onToggleVisibility={handleToggleVisibility}
            onDeleteLayer={handleDeleteLayer}
            onImportPng={handleImportPng}
            onAutoAssignRoles={handleAutoAssignRoles}
            isImporting={isImportingPng}
          />

        {/* Center Column: Interactive Canvas Stage & Broadcast Panel */}
        <div className="workspace-main-column">
          <ValidationBanner
            warnings={roleValidation.warnings}
            onAutoAssign={handleAutoAssignRoles}
          />
          <CanvasStage
            manifest={manifest}
            store={storeRef.current}
            selectedLayerId={selectedLayerId}
            serverPort={serverPort}
            onSelectLayer={handleSelectLayer}
            onUpdateLayer={handleUpdateLayerTransform}
            onDeleteLayer={handleDeleteLayer}
            onMissingAssetsChange={(missing) => setMissingAssetsCount(missing.length)}
          />
          <BroadcastPanel serverPort={serverPort} projectId={manifest.projectId} />
        </div>

        {/* Right Column: Tabbed Inspector & Live Controls */}
        <aside className="workspace-sidebar">
          <div className="sidebar-tab-bar">
            <button
              className={`sidebar-tab-btn ${activeSidebarTab === 'inspector' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('inspector')}
            >
              🔍 Inspector
            </button>
            <button
              className={`sidebar-tab-btn ${activeSidebarTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('controls')}
            >
              🎙️ Live Controls
            </button>
          </div>

          {activeSidebarTab === 'inspector' ? (
            <LayerInspector
              layer={selectedLayer}
              allLayers={manifest.layers}
              onUpdateTransform={handleUpdateLayerTransform}
              onAssignRole={handleAssignRole}
              onDeleteLayer={handleDeleteLayer}
            />
          ) : (
            <ControlsPanel
              store={storeRef.current}
              talkSimulator={talkSimRef.current}
              blinkScheduler={blinkRef.current}
              audioVAD={vadRef.current}
              manifest={manifest}
              onUpdateLayers={handleReorderLayers}
              onUpdateIdleConfig={handleUpdateIdleConfig}
              onUpdateBlinkConfig={handleUpdateBlinkConfig}
              onUpdateAudioConfig={handleUpdateAudioConfig}
            />
          )}
        </aside>
      </main>
      )}
    </div>
  );
};
export default App;

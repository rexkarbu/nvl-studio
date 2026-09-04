import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ParameterStore } from '../../core/parameters/ParameterStore';
import { CharacterResolver } from '../../core/resolver/CharacterResolver';
import { CanvasAvatarRenderer } from '../../core/renderer/CanvasAvatarRenderer';
import { CharacterLayer, ProjectManifest } from '../../core/project/types';
import { AvatarParameters } from '../../core/parameters/types';
import { IdleBobEngine } from '../../core/animation/IdleBobEngine';
import {
  ViewportState,
  DEFAULT_VIEWPORT,
  screenToCanvas,
  zoomAroundScreenPoint,
} from './canvasNavigation';
import {
  findTopmostLayerAt,
  hitTestHandles,
  applyDragMove,
  applyHandleScale,
  applyHandleRotate,
  nudgeLayer,
  HandleType,
} from './canvasInteractions';

interface CanvasStageProps {
  manifest: ProjectManifest;
  store: ParameterStore;
  selectedLayerId: string | null;
  serverPort?: number | null;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateLayer: (layerId: string, updates: Partial<CharacterLayer>) => void;
  onDeleteLayer: (layerId: string) => void;
  onMissingAssetsChange?: (missing: string[]) => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  manifest,
  store,
  selectedLayerId,
  serverPort,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer,
  onMissingAssetsChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasAvatarRenderer | null>(null);

  const [currentParams, setCurrentParams] = useState<AvatarParameters>(store.getSnapshot());
  const [backgroundMode, setBackgroundMode] = useState<'checker' | 'dark' | 'green'>('checker');
  const [missingAssets, setMissingAssets] = useState<string[]>([]);
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);

  // Interaction State
  const interactionRef = useRef<{
    mode: 'none' | 'pan' | 'drag-layer' | 'handle-scale' | 'handle-rotate';
    startScreen: { x: number; y: number };
    startPan: { x: number; y: number };
    startCanvas: { x: number; y: number };
    activeHandle: HandleType | null;
    initialLayer: CharacterLayer | null;
    baseWidth: number;
    baseHeight: number;
  }>({
    mode: 'none',
    startScreen: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 },
    startCanvas: { x: 0, y: 0 },
    activeHandle: null,
    initialLayer: null,
    baseWidth: 300,
    baseHeight: 300,
  });

  const [spacePressed, setSpacePressed] = useState<boolean>(false);

  // Re-render canvas helper
  const redraw = useCallback(
    (idleBobOffset: number = 0) => {
      if (!rendererRef.current) return;
      const renderer = rendererRef.current;

      // 1. Render character layers with idle bob offset
      const resolved = CharacterResolver.resolve(manifest.layers, store.getSnapshot(), idleBobOffset);
      renderer.render(resolved);

      // 2. Render selection overlay if a layer is selected
      if (selectedLayerId) {
        const selected = manifest.layers.find((l) => l.id === selectedLayerId);
        if (selected && selected.visible) {
          const dims = renderer.getAssetDimensions(selected.assetId) || { width: 300, height: 300 };
          const resolvedLayer = resolved.activeLayers.find((al) => al.layer.id === selected.id);
          const overlayLayer = resolvedLayer ? { ...selected, y: resolvedLayer.y } : selected;
          renderer.drawSelectionOverlay(overlayLayer, dims.width, dims.height);
        }
      }
    },
    [manifest.layers, store, selectedLayerId]
  );

  // Initialize Canvas 2D Renderer & load assets
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new CanvasAvatarRenderer({
      canvas: canvasRef.current,
      virtualWidth: manifest.canvas.width,
      virtualHeight: manifest.canvas.height,
    });
    rendererRef.current = renderer;

    const unsubMissing = renderer.onMissingAssetsChange((missing) => {
      setMissingAssets(missing);
      if (onMissingAssetsChange) {
        onMissingAssetsChange(missing);
      }
    });

    const loadAssets = async () => {
      for (const asset of manifest.assets) {
        const rawPath = asset.path.replace(/^\/+/, '');
        const url = serverPort
          ? `http://127.0.0.1:${serverPort}/${rawPath}?v=${encodeURIComponent(manifest.metadata.updatedAt || '0')}`
          : `/${rawPath.startsWith('assets/') ? 'sample_avatar/' + rawPath : rawPath}`;

        try {
          await renderer.registerAsset(asset.id, url);
        } catch (err) {
          console.error('[CanvasStage] Error loading asset:', err);
        }
      }
      redraw(0);
    };

    loadAssets();

    const unsubscribeStore = store.subscribe((params) => {
      setCurrentParams(params);
      if (!manifest.idleConfig?.enabled) {
        redraw(0);
      }
    });

    return () => {
      unsubMissing();
      unsubscribeStore();
      rendererRef.current = null;
    };
  }, [manifest, store, serverPort, onMissingAssetsChange, redraw]);

  // Dedicated single render loop for Idle Bob animation
  useEffect(() => {
    let animFrameId: number | null = null;
    const isIdleActive = manifest.idleConfig?.enabled && (manifest.idleConfig?.amplitude ?? 0) > 0;

    if (isIdleActive) {
      const loop = (timeMs: number) => {
        const isIdle = !store.getSnapshot().voiceActivity;
        const offset = IdleBobEngine.calculateOffset(timeMs, manifest.idleConfig, isIdle);
        redraw(offset);
        animFrameId = requestAnimationFrame(loop);
      };
      animFrameId = requestAnimationFrame(loop);
    } else {
      redraw(0);
    }

    return () => {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, [manifest.idleConfig, store, redraw]);

  // Handle Pan & Zoom Transformations applied to Canvas wrapper
  const transformStyle: React.CSSProperties = {
    transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
    transformOrigin: 'center center',
    transition: interactionRef.current.mode === 'none' ? 'transform 0.05s ease-out' : 'none',
  };

  // Keyboard navigation & nudges
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space' && !spacePressed) {
        setSpacePressed(true);
      }

      // Reset zoom (Ctrl+0)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setViewport(DEFAULT_VIEWPORT);
      }

      // Layer keyboard nudges
      if (selectedLayerId) {
        const selected = manifest.layers.find((l) => l.id === selectedLayerId);
        if (!selected) return;

        const step = e.shiftKey ? 10 : 1;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const nudged = nudgeLayer(selected, -step, 0);
          onUpdateLayer(selected.id, { x: nudged.x });
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nudged = nudgeLayer(selected, step, 0);
          onUpdateLayer(selected.id, { x: nudged.x });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const nudged = nudgeLayer(selected, 0, -step);
          onUpdateLayer(selected.id, { y: nudged.y });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nudged = nudgeLayer(selected, 0, step);
          onUpdateLayer(selected.id, { y: nudged.y });
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (confirm(`Delete selected layer "${selected.name}"?`)) {
            onDeleteLayer(selected.id);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedLayerId, manifest.layers, onUpdateLayer, onDeleteLayer, spacePressed]);

  // Pointer Down: Hit-testing handles, layer, or start pan
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current || !rendererRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenPt = { x: e.clientX, y: e.clientY };

    const canvasPt = screenToCanvas(
      screenPt,
      rect,
      manifest.canvas.width,
      manifest.canvas.height,
      viewport.zoom,
      viewport.pan
    );

    // 1. Check if Pan mode (Middle mouse click or Space held)
    if (e.button === 1 || spacePressed) {
      interactionRef.current = {
        mode: 'pan',
        startScreen: screenPt,
        startPan: { ...viewport.pan },
        startCanvas: canvasPt,
        activeHandle: null,
        initialLayer: null,
        baseWidth: 0,
        baseHeight: 0,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // 2. If a layer is already selected, check if click hit one of its handles
    if (selectedLayerId) {
      const selected = manifest.layers.find((l) => l.id === selectedLayerId);
      if (selected && selected.visible) {
        const dims = rendererRef.current.getAssetDimensions(selected.assetId) || { width: 300, height: 300 };
        const hitHandle = hitTestHandles(canvasPt, selected, dims.width, dims.height, 14 / viewport.zoom);

        if (hitHandle) {
          interactionRef.current = {
            mode: hitHandle === 'rotation' ? 'handle-rotate' : 'handle-scale',
            startScreen: screenPt,
            startPan: { ...viewport.pan },
            startCanvas: canvasPt,
            activeHandle: hitHandle,
            initialLayer: { ...selected },
            baseWidth: dims.width,
            baseHeight: dims.height,
          };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // 3. Test if clicked directly on any layer
    const dimsMap = new Map<string, { width: number; height: number }>();
    for (const l of manifest.layers) {
      const d = rendererRef.current.getAssetDimensions(l.assetId) || { width: 300, height: 300 };
      dimsMap.set(l.assetId, d);
    }

    const clickedLayer = findTopmostLayerAt(canvasPt, manifest.layers, dimsMap);

    if (clickedLayer) {
      onSelectLayer(clickedLayer.id);
      interactionRef.current = {
        mode: 'drag-layer',
        startScreen: screenPt,
        startPan: { ...viewport.pan },
        startCanvas: canvasPt,
        activeHandle: null,
        initialLayer: { ...clickedLayer },
        baseWidth: dimsMap.get(clickedLayer.assetId)?.width || 300,
        baseHeight: dimsMap.get(clickedLayer.assetId)?.height || 300,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      // Clicked outside on empty canvas
      onSelectLayer(null);
    }
  };

  // Pointer Move: Drag layer, scale, rotate, or pan
  const handlePointerMove = (e: React.PointerEvent) => {
    const inter = interactionRef.current;
    if (inter.mode === 'none' || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentScreen = { x: e.clientX, y: e.clientY };

    if (inter.mode === 'pan') {
      const dx = currentScreen.x - inter.startScreen.x;
      const dy = currentScreen.y - inter.startScreen.y;
      setViewport((prev) => ({
        ...prev,
        pan: {
          x: inter.startPan.x + dx,
          y: inter.startPan.y + dy,
        },
      }));
      return;
    }

    const currentCanvas = screenToCanvas(
      currentScreen,
      rect,
      manifest.canvas.width,
      manifest.canvas.height,
      viewport.zoom,
      viewport.pan
    );

    if (inter.mode === 'drag-layer' && inter.initialLayer) {
      const delta = {
        x: currentCanvas.x - inter.startCanvas.x,
        y: currentCanvas.y - inter.startCanvas.y,
      };
      const moved = applyDragMove(inter.initialLayer, delta);
      onUpdateLayer(inter.initialLayer.id, { x: moved.x, y: moved.y });
    } else if (inter.mode === 'handle-scale' && inter.initialLayer && inter.activeHandle) {
      const { scaleX, scaleY } = applyHandleScale(
        inter.initialLayer,
        inter.activeHandle,
        inter.startCanvas,
        currentCanvas,
        inter.baseWidth,
        inter.baseHeight,
        e.shiftKey // Shift locks aspect ratio
      );
      onUpdateLayer(inter.initialLayer.id, { scaleX, scaleY });
    } else if (inter.mode === 'handle-rotate' && inter.initialLayer) {
      const rotation = applyHandleRotate(inter.initialLayer, currentCanvas);
      onUpdateLayer(inter.initialLayer.id, { rotation });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (interactionRef.current.mode !== 'none') {
      interactionRef.current.mode = 'none';
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Mouse Wheel: Zoom centered on mouse cursor
  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const screenPt = { x: e.clientX, y: e.clientY };
    const zoomDelta = -e.deltaY * 0.0015;

    const nextState = zoomAroundScreenPoint(
      viewport.zoom,
      zoomDelta,
      screenPt,
      rect,
      viewport.pan,
      manifest.canvas.width,
      manifest.canvas.height
    );

    setViewport(nextState);
  };

  // Viewport Control Actions
  const handleZoomIn = () => {
    setViewport((prev) => ({ ...prev, zoom: Math.min(5.0, prev.zoom + 0.25) }));
  };

  const handleZoomOut = () => {
    setViewport((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom - 0.25) }));
  };

  const handleResetView = () => {
    setViewport(DEFAULT_VIEWPORT);
  };

  return (
    <section className="preview-panel canvas-stage-container">
      {/* Stage Toolbar */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Character Creator Stage</span>
          <span className="badge-tag">{Math.round(viewport.zoom * 100)}%</span>
        </div>

        {/* Viewport Zoom & Reset Controls */}
        <div className="stage-nav-toolbar">
          <button className="stage-tool-btn" onClick={handleZoomOut} title="Zoom Out (-)">
            🔍 -
          </button>
          <button className="stage-tool-btn" onClick={handleResetView} title="Reset View (100%)">
            100%
          </button>
          <button className="stage-tool-btn" onClick={handleZoomIn} title="Zoom In (+)">
            🔍 +
          </button>

          <div className="bg-toggle-group" style={{ marginLeft: '12px' }}>
            <button
              className={`toggle-btn ${backgroundMode === 'checker' ? 'active' : ''}`}
              onClick={() => setBackgroundMode('checker')}
              title="Checkerboard (Transparent)"
            >
              Checker
            </button>
            <button
              className={`toggle-btn ${backgroundMode === 'dark' ? 'active' : ''}`}
              onClick={() => setBackgroundMode('dark')}
              title="Dark Background"
            >
              Dark
            </button>
            <button
              className={`toggle-btn ${backgroundMode === 'green' ? 'active' : ''}`}
              onClick={() => setBackgroundMode('green')}
              title="Chroma Green"
            >
              Chroma
            </button>
          </div>
        </div>
      </div>

      {/* Missing Asset Warning */}
      {missingAssets.length > 0 && (
        <div className="error-banner">
          <span>⚠️ {missingAssets.length} asset(s) missing or failed to load. Fallback placeholder rendered.</span>
          <span style={{ fontSize: '10px', opacity: 0.8 }}>({missingAssets.join(', ')})</span>
        </div>
      )}

      {/* Viewport Area */}
      <div
        ref={containerRef}
        className={`canvas-viewport bg-${backgroundMode} ${spacePressed ? 'cursor-grab' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="canvas-transform-wrapper" style={transformStyle}>
          <canvas
            ref={canvasRef}
            className="preview-canvas"
            width={manifest.canvas.width}
            height={manifest.canvas.height}
          />
        </div>

        {/* Live parameter overlay tags */}
        <div className="preview-floating-overlay">
          <div className="state-badge">
            <span className="state-label">Voice:</span>
            <span className={`state-value ${currentParams.voiceActivity ? 'talking' : 'idle'}`}>
              {currentParams.voiceActivity ? 'TALKING' : 'IDLE'}
            </span>
          </div>
          <div className="state-badge">
            <span className="state-label">Eyes:</span>
            <span className={`state-value ${currentParams.blink ? 'blinking' : 'open'}`}>
              {currentParams.blink ? 'BLINKING' : 'OPEN'}
            </span>
          </div>
          <div className="state-badge">
            <span className="state-label">Volume:</span>
            <span className="state-value">{Math.round(currentParams.voiceLevel * 100)}%</span>
          </div>
        </div>
      </div>
    </section>
  );
};

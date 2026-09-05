import React, { useEffect, useRef, useState } from 'react';
import { ParameterStore } from '../../core/parameters/ParameterStore';
import { CharacterResolver } from '../../core/resolver/CharacterResolver';
import { CanvasAvatarRenderer } from '../../core/renderer/CanvasAvatarRenderer';
import { ProjectManifest } from '../../core/project/types';
import { AvatarParameters } from '../../core/parameters/types';

interface PreviewPanelProps {
  manifest: ProjectManifest;
  store: ParameterStore;
  serverPort?: number | null;
  onMissingAssetsChange?: (missing: string[]) => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  manifest,
  store,
  serverPort,
  onMissingAssetsChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasAvatarRenderer | null>(null);

  const [currentParams, setCurrentParams] = useState<AvatarParameters>(store.getSnapshot());
  const [backgroundMode, setBackgroundMode] = useState<'checker' | 'dark' | 'green'>('checker');
  const [missingAssets, setMissingAssets] = useState<string[]>([]);

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
        let rawPath = asset.path.replace(/^\/+/, '');
        // When serverPort is available, fetch from local server to support dynamic project directories
        const url = serverPort
          ? `http://127.0.0.1:${serverPort}/${rawPath}?v=${encodeURIComponent(manifest.metadata.updatedAt || '0')}`
          : `/${rawPath.startsWith('assets/') ? 'sample_avatar/' + rawPath : rawPath}`;

        try {
          await renderer.registerAsset(asset.id, url);
        } catch (err) {
          console.error('[PreviewPanel] Error loading asset:', err);
        }
      }

      // Initial render
      const resolved = CharacterResolver.resolve(
        manifest.layers,
        store.getSnapshot(),
        0,
        manifest.expressionConfig
      );
      renderer.render(resolved);
    };

    loadAssets();

    // Subscribe to store updates
    const unsubscribe = store.subscribe((params) => {
      setCurrentParams(params);
      if (rendererRef.current) {
        const resolved = CharacterResolver.resolve(
          manifest.layers,
          params,
          0,
          manifest.expressionConfig
        );
        rendererRef.current.render(resolved);
      }
    });

    return () => {
      unsubMissing();
      unsubscribe();
      rendererRef.current = null;
    };
  }, [manifest, store, onMissingAssetsChange]);

  return (
    <section className="preview-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Character Preview</span>
          <span className="badge-tag">Deterministic 2D Canvas</span>
        </div>

        <div className="bg-toggle-group">
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

      {missingAssets.length > 0 && (
        <div className="error-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {missingAssets.length} asset(s) missing or failed to load. Fallback placeholder rendered.</span>
          <span style={{ fontSize: '10px', opacity: 0.8 }}>({missingAssets.join(', ')})</span>
        </div>
      )}

      <div className={`canvas-viewport bg-${backgroundMode}`}>
        <canvas
          ref={canvasRef}
          className="preview-canvas"
          width={manifest.canvas.width}
          height={manifest.canvas.height}
        />

        {/* Real-time state indicators */}
        <div className="preview-floating-overlay">
          <div className="state-badge">
            <span className="state-label">Voice State:</span>
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
            <span className="state-value">
              {Math.round(currentParams.voiceLevel * 100)}%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

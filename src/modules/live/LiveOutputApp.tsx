import React, { useEffect, useRef, useState } from 'react';
import './LiveOutput.css';
import { LiveReceiver, ConnectionState } from '../../core/sync/LiveReceiver';
import { CharacterResolver } from '../../core/resolver/CharacterResolver';
import { CanvasAvatarRenderer } from '../../core/renderer/CanvasAvatarRenderer';
import { DEFAULT_PROJECT_MANIFEST } from '../../core/project/defaultProject';
import { ProjectManifest } from '../../core/project/types';
import { AvatarParameters } from '../../core/parameters/types';
import { IdleBobEngine } from '../../core/animation/IdleBobEngine';

interface LiveOutputAppProps {
  projectId?: string;
  initialManifest?: ProjectManifest;
}

export const LiveOutputApp: React.FC<LiveOutputAppProps> = ({
  projectId: propProjectId,
  initialManifest,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasAvatarRenderer | null>(null);
  const receiverRef = useRef<LiveReceiver | null>(null);
  const latestParamsRef = useRef<AvatarParameters>({
    voiceActivity: false,
    voiceLevel: 0,
    blink: false,
  });

  const [manifest, setManifest] = useState<ProjectManifest>(initialManifest || DEFAULT_PROJECT_MANIFEST);
  const manifestRef = useRef<ProjectManifest>(manifest);
  manifestRef.current = manifest;

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSeq, setLastSeq] = useState<number>(0);

  // Helper to load assets into the active renderer
  const loadAssets = async (renderer: CanvasAvatarRenderer, assets: ProjectManifest['assets']) => {
    for (const asset of assets) {
      let rawPath = asset.path.replace(/^\/+/, '');
      if (rawPath.startsWith('assets/')) {
        rawPath = `sample_avatar/${rawPath}`;
      }
      const assetUrl = `/${rawPath}`;
      try {
        await renderer.registerAsset(asset.id, assetUrl);
      } catch (err) {
        console.error(`[LiveOutput] Failed to load asset ${asset.name} from ${assetUrl}:`, err);
      }
    }
  };

  // Helper to re-render current frame with resolved transforms
  const renderCurrentFrame = (offset: number = 0) => {
    if (!rendererRef.current) return;
    const currentManifest = manifestRef.current;
    const resolved = CharacterResolver.resolve(
      currentManifest.layers,
      latestParamsRef.current,
      offset,
      currentManifest.expressionConfig,
      currentManifest.mouthConfig
    );
    rendererRef.current.render(resolved);
  };

  // Sync prop changes if initialManifest is updated externally
  useEffect(() => {
    if (initialManifest) {
      setManifest(initialManifest);
      manifestRef.current = initialManifest;
      if (rendererRef.current) {
        loadAssets(rendererRef.current, initialManifest.assets).then(() => {
          renderCurrentFrame(0);
        });
      }
    }
  }, [initialManifest]);

  // Fetch project manifest from local server (enables OBS Browser Source to load real project data)
  useEffect(() => {
    let isCancelled = false;
    const fetchProjectManifest = async () => {
      try {
        const res = await fetch('/api/project');
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data && data.layers) {
            setManifest(data);
            manifestRef.current = data;
            if (rendererRef.current) {
              await loadAssets(rendererRef.current, data.assets);
              renderCurrentFrame(0);
            }
          }
        }
      } catch {
        // Fall back to initialManifest / DEFAULT_PROJECT_MANIFEST
      }
    };
    fetchProjectManifest();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Extract projectId from props, pathname, or hash
  const getActiveProjectId = (): string => {
    if (propProjectId) return propProjectId;
    const path = window.location.pathname;
    const match = path.match(/\/live\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    const hashMatch = window.location.hash.match(/#\/live\/([a-zA-Z0-9_-]+)/);
    if (hashMatch) return hashMatch[1];

    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('project') || 'default-avatar';
  };

  const projectId = getActiveProjectId();
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';
  const isChroma =
    new URLSearchParams(window.location.search).get('bg') === 'green' ||
    new URLSearchParams(window.location.search).get('chroma') === '1';

  useEffect(() => {
    if (isChroma) {
      document.body.classList.add('bg-chroma-green');
    } else {
      document.body.classList.remove('bg-chroma-green');
    }
    return () => {
      document.body.classList.remove('bg-chroma-green');
    };
  }, [isChroma]);

  // Initialize Canvas 2D Renderer & WebSocket connection once per projectId
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Canvas 2D Renderer
    const renderer = new CanvasAvatarRenderer({
      canvas: canvasRef.current,
      virtualWidth: manifestRef.current.canvas.width,
      virtualHeight: manifestRef.current.canvas.height,
    });
    rendererRef.current = renderer;

    // Preload initial assets
    loadAssets(renderer, manifestRef.current.assets).then(() => {
      renderCurrentFrame(0);
    });

    // Determine WebSocket URL
    const host = window.location.hostname || '127.0.0.1';
    const port = window.location.port || '17777';
    const wsUrl = `ws://${host}:${port}/ws/${projectId}`;

    // Initialize LiveReceiver with backoff & stale sequence protection
    const receiver = new LiveReceiver({
      url: wsUrl,
      initialRetryDelayMs: 600,
      maxRetryDelayMs: 4000,
      backoffMultiplier: 1.5,
    });
    receiverRef.current = receiver;

    receiver.onStateChange((state) => {
      setConnectionState(state);
    });

    receiver.onFrame((parameters: AvatarParameters, sequence: number) => {
      setLastSeq(sequence);
      latestParamsRef.current = parameters;

      // If idle bob is disabled, re-render immediately upon receiving frame
      const currentManifest = manifestRef.current;
      const isIdleActive = currentManifest.idleConfig?.enabled && (currentManifest.idleConfig?.amplitude ?? 0) > 0;
      if (!isIdleActive) {
        renderCurrentFrame(0);
      }
    });

    receiver.connect();

    return () => {
      receiver.disconnect();
      receiverRef.current = null;
      rendererRef.current = null;
    };
  }, [projectId]);

  // Dedicated single render loop for Idle Bob animation
  useEffect(() => {
    const isIdleActive = manifest.idleConfig?.enabled && (manifest.idleConfig?.amplitude ?? 0) > 0;
    if (!isIdleActive) return;

    let animFrameId: number;
    const loop = (timeMs: number) => {
      if (rendererRef.current) {
        const currentManifest = manifestRef.current;
        const params = latestParamsRef.current;
        const isIdle = !params.voiceActivity;
        const offset = IdleBobEngine.calculateOffset(timeMs, currentManifest.idleConfig, isIdle);
        renderCurrentFrame(offset);
      }
      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [manifest.idleConfig?.enabled, manifest.idleConfig?.amplitude, manifest.idleConfig?.speed]);

  return (
    <div className="live-output-container">
      <canvas
        ref={canvasRef}
        className="live-output-canvas"
        width={1920}
        height={1080}
      />
      {isDebugMode && (
        <div className="live-status-pill">
          <span className={`live-status-dot ${connectionState}`} />
          <span>{connectionState} (seq: {lastSeq})</span>
        </div>
      )}
    </div>
  );
};
export default LiveOutputApp;

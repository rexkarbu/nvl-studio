import React, { useCallback, useEffect, useRef, useState } from 'react';
import './LiveOutput.css';
import { LiveReceiver, ConnectionState } from '../../core/sync/LiveReceiver';
import { CharacterResolver } from '../../core/resolver/CharacterResolver';
import { CanvasAvatarRenderer } from '../../core/renderer/CanvasAvatarRenderer';
import { validateManifest } from '../../core/project/manifestSchema';
import { ProjectManifest } from '../../core/project/types';
import { AvatarParameters } from '../../core/parameters/types';
import { IdleBobEngine } from '../../core/animation/IdleBobEngine';
import { resolveAssetUrl } from '../../core/project/assetUrl';

interface LiveOutputAppProps {
  projectId?: string;
  initialManifest?: ProjectManifest;
}

function getRouteProjectId(): string | undefined {
  const routeMatch = window.location.pathname.match(/^\/live\/([a-zA-Z0-9_-]+)(?:\/|$)/)
    ?? window.location.hash.match(/^#\/live\/([a-zA-Z0-9_-]+)(?:[/?]|$)/);
  return routeMatch?.[1] ?? new URLSearchParams(window.location.search).get('project') ?? undefined;
}

export const LiveOutputApp: React.FC<LiveOutputAppProps> = ({ projectId, initialManifest }) => {
  const [routeProjectId, setRouteProjectId] = useState(getRouteProjectId);
  const requestedId = routeProjectId ?? projectId;
  const providedManifest = initialManifest && (!requestedId || initialManifest.projectId === requestedId)
    ? initialManifest : undefined;
  const [loaded, setLoaded] = useState<{ requestedId?: string; manifest: ProjectManifest } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const onLocationChange = () => setRouteProjectId(getRouteProjectId());
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, []);

  useEffect(() => {
    if (providedManifest) return;
    let cancelled = false;
    setLoadError(null);
    setLoaded(null);
    const load = async () => {
      try {
        const response = await fetch('/api/project');
        if (!response.ok) throw new Error('Project manifest could not be loaded');
        const result = validateManifest(await response.json());
        if (!result.valid || !result.manifest) throw new Error(result.error || 'Invalid project manifest');
        if (requestedId && result.manifest.projectId !== requestedId) {
          throw new Error('The requested project is not active in NVL Studio');
        }
        if (!cancelled) setLoaded({ requestedId, manifest: result.manifest });
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Project unavailable');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [requestedId, providedManifest]);

  const manifest = providedManifest ?? (loaded?.requestedId === requestedId ? loaded?.manifest : undefined);
  if (!manifest) {
    return (
      <div className="live-output-container">
        <canvas className="live-output-canvas" width={1920} height={1080} aria-label="Live avatar" />
        {new URLSearchParams(window.location.search).get('debug') === '1' && (
          <div className="live-status-pill" role="status">{loadError ?? 'Loading project...'}</div>
        )}
      </div>
    );
  }
  // A project change resets parameters, renderer caches and the WebSocket together.
  return <LiveOutputCanvas key={manifest.projectId} manifest={manifest} />;
};

const LiveOutputCanvas: React.FC<{ manifest: ProjectManifest }> = ({ manifest }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasAvatarRenderer | null>(null);
  const receiverRef = useRef<LiveReceiver | null>(null);
  const latestParamsRef = useRef<AvatarParameters>({
    voiceActivity: false,
    voiceLevel: 0,
    blink: false,
    expression: 'neutral',
  });

  const manifestRef = useRef<ProjectManifest>(manifest);
  manifestRef.current = manifest;

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSeq, setLastSeq] = useState<number>(0);

  // Helper to re-render current frame with resolved transforms
  const renderCurrentFrame = useCallback((offset: number = 0) => {
    if (!rendererRef.current) return;
    const currentManifest = manifestRef.current;
    const effectiveMouthConfig = {
      ...currentManifest.mouthConfig,
      reactive2Frame: currentManifest.reactive2Frame ?? currentManifest.mouthConfig?.reactive2Frame,
    };
    const resolved = CharacterResolver.resolve(
      currentManifest.layers,
      latestParamsRef.current,
      offset,
      currentManifest.expressionConfig,
      effectiveMouthConfig
    );
    rendererRef.current.render(resolved, currentManifest.idleConfig);
  }, []);

  const projectId = manifest.projectId;
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

  // Asset loading is tied to this renderer and cannot complete into another project.
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    const renderer = new CanvasAvatarRenderer({
      canvas: canvasRef.current,
      virtualWidth: manifest.canvas.width,
      virtualHeight: manifest.canvas.height,
    });
    rendererRef.current = renderer;
    void Promise.all(manifest.assets.map((asset) => renderer.registerAsset(asset.id,
      resolveAssetUrl(asset.path, { version: manifest.metadata.updatedAt })
    ))).then(() => {
      if (!cancelled) renderCurrentFrame(0);
    });
    return () => {
      cancelled = true;
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [manifest.assets, manifest.canvas.width, manifest.canvas.height, manifest.metadata.updatedAt, renderCurrentFrame]);

  useEffect(() => {
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
    };
  }, [projectId, renderCurrentFrame]);

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
  }, [manifest.idleConfig?.enabled, manifest.idleConfig?.amplitude, manifest.idleConfig?.speed, renderCurrentFrame]);

  return (
    <div className="live-output-container">
      <canvas
        ref={canvasRef}
        className="live-output-canvas"
        width={manifest.canvas.width}
        height={manifest.canvas.height}
        aria-label="Live avatar"
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

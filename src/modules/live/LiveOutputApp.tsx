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
}

export const LiveOutputApp: React.FC<LiveOutputAppProps> = ({ projectId: propProjectId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasAvatarRenderer | null>(null);
  const receiverRef = useRef<LiveReceiver | null>(null);
  const latestParamsRef = useRef<AvatarParameters>({
    voiceActivity: false,
    voiceLevel: 0,
    blink: false,
  });

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSeq, setLastSeq] = useState<number>(0);

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

  useEffect(() => {
    if (!canvasRef.current) return;

    const manifest: ProjectManifest = DEFAULT_PROJECT_MANIFEST;

    // Initialize Canvas 2D Renderer
    const renderer = new CanvasAvatarRenderer({
      canvas: canvasRef.current,
      virtualWidth: manifest.canvas.width,
      virtualHeight: manifest.canvas.height,
    });
    rendererRef.current = renderer;

    // Preload all project assets
    const loadAssets = async () => {
      for (const asset of manifest.assets) {
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

      // Initial render with default parameters
      const initialResolved = CharacterResolver.resolve(manifest.layers, {
        voiceActivity: false,
        voiceLevel: 0,
        blink: false,
      });
      renderer.render(initialResolved);
    };

    loadAssets();

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

    let animFrameId: number | null = null;
    const isIdleActive = manifest.idleConfig?.enabled && (manifest.idleConfig?.amplitude ?? 0) > 0;

    receiver.onFrame((parameters: AvatarParameters, sequence: number) => {
      setLastSeq(sequence);
      latestParamsRef.current = parameters;

      // If idle bob is disabled, re-render immediately upon receiving frame
      if (!isIdleActive && rendererRef.current) {
        const resolved = CharacterResolver.resolve(manifest.layers, parameters, 0);
        rendererRef.current.render(resolved);
      }
    });

    if (isIdleActive) {
      const loop = (timeMs: number) => {
        if (rendererRef.current) {
          const params = latestParamsRef.current;
          const isIdle = !params.voiceActivity;
          const offset = IdleBobEngine.calculateOffset(timeMs, manifest.idleConfig, isIdle);
          const resolved = CharacterResolver.resolve(manifest.layers, params, offset);
          rendererRef.current.render(resolved);
        }
        animFrameId = requestAnimationFrame(loop);
      };
      animFrameId = requestAnimationFrame(loop);
    }

    receiver.connect();

    return () => {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      receiver.disconnect();
      rendererRef.current = null;
    };
  }, [projectId]);

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

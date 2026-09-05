import { ResolvedVisualState } from '../resolver/types';
import { IdleConfig } from '../project/types';

export interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  virtualWidth?: number;
  virtualHeight?: number;
}

/**
 * Deterministic Canvas 2D Renderer for NVL avatars.
 * Used identically in Editor Preview and OBS Live Output.
 */
export class CanvasAvatarRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private virtualWidth: number;
  private virtualHeight: number;
  private assetCache: Map<string, HTMLImageElement> = new Map();
  private pendingLoads: Map<string, Promise<HTMLImageElement>> = new Map();

  constructor(options: CanvasRendererOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('[CanvasAvatarRenderer] Unable to get 2D canvas context');
    }
    this.ctx = context;
    this.virtualWidth = options.virtualWidth || 1920;
    this.virtualHeight = options.virtualHeight || 1080;

    this.canvas.width = this.virtualWidth;
    this.canvas.height = this.virtualHeight;
  }

  private missingAssets: Set<string> = new Set();
  private onMissingChangeCbs: Set<(missing: string[]) => void> = new Set();

  /**
   * Preloads or caches an asset image.
   * Path can be a relative URL, data URL, or absolute path.
   */
  public async registerAsset(assetId: string, src: string): Promise<HTMLImageElement> {
    if (this.assetCache.has(assetId)) {
      return this.assetCache.get(assetId)!;
    }

    if (this.pendingLoads.has(assetId)) {
      return this.pendingLoads.get(assetId)!;
    }

    const loadPromise = new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.assetCache.set(assetId, img);
        this.pendingLoads.delete(assetId);
        if (this.missingAssets.has(assetId)) {
          this.missingAssets.delete(assetId);
          this.notifyMissingChange();
        }
        resolve(img);
      };
      img.onerror = () => {
        this.pendingLoads.delete(assetId);
        this.missingAssets.add(assetId);
        this.notifyMissingChange();
        console.warn(`[CanvasAvatarRenderer] Missing asset: ${assetId} (${src})`);
        // Resolve gracefully with placeholder instead of rejecting/crashing
        resolve(img);
      };
      img.src = src;
    });

    this.pendingLoads.set(assetId, loadPromise);
    return loadPromise;
  }

  public setAsset(assetId: string, img: HTMLImageElement): void {
    this.assetCache.set(assetId, img);
    this.missingAssets.delete(assetId);
    this.notifyMissingChange();
  }

  public clearAssets(): void {
    this.assetCache.clear();
    this.pendingLoads.clear();
    this.missingAssets.clear();
    this.notifyMissingChange();
  }

  public getMissingAssets(): string[] {
    return Array.from(this.missingAssets);
  }

  public onMissingAssetsChange(cb: (missing: string[]) => void): () => void {
    this.onMissingChangeCbs.add(cb);
    return () => {
      this.onMissingChangeCbs.delete(cb);
    };
  }

  private notifyMissingChange(): void {
    const list = this.getMissingAssets();
    for (const cb of this.onMissingChangeCbs) {
      cb(list);
    }
  }

  /**
   * Renders the resolved visual state.
   * Guaranteed 100% transparent background with safe placeholder fallback for missing assets.
   * Supports optional idle dimming (darker when silent, full brightness when talking).
   */
  public render(state: ResolvedVisualState, idleConfig?: IdleConfig): void {
    // Clear entire canvas to transparent
    this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

    // Apply idle dimming filter if enabled and avatar is currently silent/idle
    const shouldDim = Boolean(idleConfig?.dimWhenSilent && state.voiceState === 'idle');
    const brightness = Math.max(0.1, Math.min(1.0, idleConfig?.idleBrightness ?? 0.75));
    this.ctx.filter = shouldDim ? `brightness(${Math.round(brightness * 100)}%)` : 'none';

    try {
      for (const item of state.activeLayers) {
        // Performance optimization: skip transformation and drawing for invisible layers
        if (item.layer.visible === false || item.opacity <= 0) {
          continue;
        }

        const img = this.assetCache.get(item.assetId);

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, Math.min(1, item.opacity));

        // Translate to layer center/position
        this.ctx.translate(item.x, item.y);

        // Rotate if specified
        if (item.rotation !== 0) {
          this.ctx.rotate((item.rotation * Math.PI) / 180);
        }

        // Scale if specified
        if (item.scaleX !== 1 || item.scaleY !== 1) {
          this.ctx.scale(item.scaleX, item.scaleY);
        }

        if (img && img.complete && img.naturalWidth > 0) {
          // Draw image centered around (0, 0)
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          this.ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          // Missing asset fallback: render dashed placeholder rectangle with warning label
          const pw = 240;
          const ph = 240;
          this.ctx.fillStyle = 'rgba(255, 84, 112, 0.25)';
          this.ctx.strokeStyle = '#ff5470';
          this.ctx.lineWidth = 4;
          this.ctx.setLineDash([10, 8]);
          this.ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
          this.ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

          this.ctx.setLineDash([]);
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(`Missing Asset:`, 0, -14);
          this.ctx.font = '13px monospace';
          this.ctx.fillStyle = '#ff8499';
          this.ctx.fillText(item.layer.name || item.assetId, 0, 14);
        }

        this.ctx.restore();
      }
    } finally {
      // Guarantee filter is reset to none so overlays, gizmos, and next frames are pristine
      this.ctx.filter = 'none';
    }
  }

  public resize(width: number, height: number): void {
    this.virtualWidth = width;
    this.virtualHeight = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getAssetDimensions(assetId: string): { width: number; height: number } | null {
    const img = this.assetCache.get(assetId);
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    return null;
  }

  /**
   * Draws an interactive selection bounding box, handles, and rotation anchor over the canvas.
   */
  public drawSelectionOverlay(
    layer: { x: number; y: number; scaleX: number; scaleY: number; rotation: number },
    width: number,
    height: number
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.filter = 'none';

    // Translate to layer center
    ctx.translate(layer.x, layer.y);
    if (layer.rotation !== 0) {
      ctx.rotate((layer.rotation * Math.PI) / 180);
    }
    if (layer.scaleX !== 1 || layer.scaleY !== 1) {
      ctx.scale(layer.scaleX, layer.scaleY);
    }

    const halfW = width / 2;
    const halfH = height / 2;

    const baseScale = Math.max(Math.abs(layer.scaleX || 1), Math.abs(layer.scaleY || 1), 0.1);

    // Draw bounding box
    ctx.strokeStyle = '#7f5af0';
    ctx.lineWidth = 2 / baseScale;
    ctx.setLineDash([6 / baseScale, 4 / baseScale]);
    ctx.strokeRect(-halfW, -halfH, width, height);
    ctx.setLineDash([]);

    // Draw rotation stem line & anchor
    const stemLength = 32 / (layer.scaleY || 1);
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, -halfH - stemLength);
    ctx.strokeStyle = '#7f5af0';
    ctx.stroke();

    // Handle styling helper
    const drawHandle = (hx: number, hy: number, isCircle = false) => {
      const handleSize = 9 / baseScale;
      ctx.fillStyle = '#fffffe';
      ctx.strokeStyle = '#7f5af0';
      ctx.lineWidth = 2 / baseScale;

      if (isCircle) {
        ctx.beginPath();
        ctx.arc(hx, hy, handleSize / 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      }
    };

    // 4 Corner handles
    drawHandle(-halfW, -halfH);
    drawHandle(halfW, -halfH);
    drawHandle(-halfW, halfH);
    drawHandle(halfW, halfH);

    // 4 Side handles
    drawHandle(0, -halfH);
    drawHandle(0, halfH);
    drawHandle(-halfW, 0);
    drawHandle(halfW, 0);

    // Rotation handle
    drawHandle(0, -halfH - stemLength, true);

    ctx.restore();
  }
}

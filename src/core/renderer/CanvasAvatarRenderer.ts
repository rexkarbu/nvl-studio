import { ResolvedVisualState } from '../resolver/types';

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
    return () => this.onMissingChangeCbs.delete(cb);
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
   */
  public render(state: ResolvedVisualState): void {
    // Clear entire canvas to transparent
    this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

    for (const item of state.activeLayers) {
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
}

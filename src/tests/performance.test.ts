import { describe, it, expect, vi } from 'vitest';
import { ParameterStore } from '../core/parameters/ParameterStore';
import { CanvasAvatarRenderer } from '../core/renderer/CanvasAvatarRenderer';
import { ResolvedVisualState } from '../core/resolver/types';

describe('STEP 11 Hardening: Performance & Stability', () => {
  it('should handle 1,000 rapid parameter updates without memory leak or listener accumulation', () => {
    const store = new ParameterStore();
    let changeCount = 0;

    const unsubscribe = store.subscribe(() => {
      changeCount++;
    });

    const startTime = performance.now();
    for (let i = 0; i < 1000; i++) {
      store.update({
        voiceLevel: i / 1000,
        voiceActivity: i % 2 === 0,
      });
    }
    const durationMs = performance.now() - startTime;

    expect(changeCount).toBe(1000);
    expect(store.getSnapshot().voiceLevel).toBeCloseTo(0.999);
    expect(store.getSnapshot().voiceActivity).toBe(false);
    expect(durationMs).toBeLessThan(1000); // Must process 1,000 updates in < 1 second

    // Unsubscribe and verify listeners are properly pruned
    unsubscribe();
    store.update({ voiceLevel: 0 });
    expect(changeCount).toBe(1000); // Count should not increment after unsubscribe
  });

  it('should skip canvas transformations and drawing for invisible or 0-opacity layers', () => {
    const saveSpy = vi.fn();
    const restoreSpy = vi.fn();
    const translateSpy = vi.fn();
    const rotateSpy = vi.fn();
    const scaleSpy = vi.fn();
    const drawImageSpy = vi.fn();
    const clearRectSpy = vi.fn();

    const mockCtx: any = {
      save: saveSpy,
      restore: restoreSpy,
      translate: translateSpy,
      rotate: rotateSpy,
      scale: scaleSpy,
      drawImage: drawImageSpy,
      clearRect: clearRectSpy,
      globalAlpha: 1,
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
    };

    const mockCanvas: any = {
      getContext: () => mockCtx,
      width: 1280,
      height: 720,
    };

    const renderer = new CanvasAvatarRenderer({
      canvas: mockCanvas,
      virtualWidth: 1280,
      virtualHeight: 720,
    });

    // Mock asset image in cache
    const mockImg: any = {
      complete: true,
      naturalWidth: 200,
      naturalHeight: 200,
      width: 200,
      height: 200,
    };
    renderer.setAsset('asset-1', mockImg);
    renderer.setAsset('asset-2', mockImg);

    const testState: ResolvedVisualState = {
      activeLayers: [
        {
          layer: {
            id: 'layer-hidden',
            name: 'Hidden Layer',
            type: 'sprite',
            assetId: 'asset-1',
            role: 'custom',
            visible: false,
            opacity: 1,
            zIndex: 1,
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          },
          assetId: 'asset-1',
          opacity: 1,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          zIndex: 1,
        },
        {
          layer: {
            id: 'layer-zero-opacity',
            name: 'Zero Opacity Layer',
            type: 'sprite',
            assetId: 'asset-1',
            role: 'custom',
            visible: true,
            opacity: 0,
            zIndex: 2,
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          },
          assetId: 'asset-1',
          opacity: 0,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          zIndex: 2,
        },
        {
          layer: {
            id: 'layer-visible',
            name: 'Visible Layer',
            type: 'sprite',
            assetId: 'asset-2',
            role: 'body',
            visible: true,
            opacity: 1,
            zIndex: 3,
            x: 50,
            y: 50,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          },
          assetId: 'asset-2',
          opacity: 1,
          x: 50,
          y: 50,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          zIndex: 3,
        },
      ],
      voiceState: 'idle',
      isBlinking: false,
      voiceLevel: 0,
    };

    renderer.render(testState);

    // Only the single visible layer should have triggered save, translate, and drawImage
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(translateSpy).toHaveBeenCalledTimes(1);
    expect(translateSpy).toHaveBeenCalledWith(50, 50);
    expect(drawImageSpy).toHaveBeenCalledTimes(1);
  });
});

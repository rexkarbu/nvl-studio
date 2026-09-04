import { describe, it, expect } from 'vitest';
import { parseAndValidateManifest } from '../core/project/manifestSchema';
import { IdleBobEngine } from '../core/animation/IdleBobEngine';
import { BlinkScheduler } from '../core/animation/BlinkScheduler';
import { ParameterStore } from '../core/parameters/ParameterStore';

describe('STEP 11 Hardening: Backward Compatibility', () => {
  const legacyManifestJson = JSON.stringify({
    schemaVersion: 1,
    projectId: 'legacy-avatar',
    metadata: {
      name: 'Legacy Avatar v1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: '1.0.0',
    },
    canvas: {
      width: 1280,
      height: 720,
      fps: 60,
    },
    assets: [
      { id: 'asset-body', name: 'Body', path: 'assets/body.png', format: 'png' },
      { id: 'asset-eye-open', name: 'Eye Open', path: 'assets/eye-open.png', format: 'png' },
    ],
    layers: [
      {
        id: 'layer-body',
        name: 'Body',
        type: 'sprite',
        assetId: 'asset-body',
        role: 'body',
        x: 640,
        y: 360,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        zIndex: 1,
      },
      {
        id: 'layer-eye',
        name: 'Eye',
        type: 'sprite',
        assetId: 'asset-eye-open',
        role: 'eye_open',
        x: 640,
        y: 360,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        zIndex: 2,
      },
    ],
    // Note: No idleConfig and no blinkConfig present!
    audioConfig: {
      threshold: 0.15,
      sensitivity: 1.0,
    },
    outputConfig: {
      preferredPort: 17777,
      transparent: true,
    },
  });

  it('should validate legacy v1 project manifest without idleConfig or blinkConfig', () => {
    const result = parseAndValidateManifest(legacyManifestJson);
    expect(result.valid).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.manifest?.idleConfig).toBeUndefined();
    expect(result.manifest?.blinkConfig).toBeUndefined();
  });

  it('should gracefully handle undefined idleConfig using IdleBobEngine defaults', () => {
    // When config is undefined or disabled, offset is 0
    const offset = IdleBobEngine.calculateOffset(1000, undefined, true);
    expect(offset).toBe(0);
  });

  it('should initialize BlinkScheduler and operate correctly with default config when none provided', () => {
    const store = new ParameterStore();
    const scheduler = new BlinkScheduler(store);

    const config = scheduler.getConfig();
    expect(config.minIntervalMs).toBe(2500);
    expect(config.maxIntervalMs).toBe(6000);
    expect(config.blinkDurationMs).toBe(140);
  });
});

import { describe, it, expect } from 'vitest';
import { validateManifest } from '../core/project/manifestSchema';
import { DEFAULT_PROJECT_MANIFEST } from '../core/project/defaultProject';

describe('AnimatorConfig & Manifest Schema Integration', () => {
  it('accepts manifest with valid idleConfig and blinkConfig', () => {
    const validManifest = {
      ...DEFAULT_PROJECT_MANIFEST,
      idleConfig: {
        enabled: true,
        amplitude: 12,
        speed: 2.0,
      },
      blinkConfig: {
        enabled: true,
        minIntervalMs: 2500,
        maxIntervalMs: 5000,
        durationMs: 160,
      },
    };

    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest?.idleConfig?.amplitude).toBe(12);
    expect(result.manifest?.blinkConfig?.durationMs).toBe(160);
  });

  it('guarantees backward compatibility: accepts legacy manifest without idleConfig/blinkConfig', () => {
    const legacyManifest: any = { ...DEFAULT_PROJECT_MANIFEST };
    delete legacyManifest.idleConfig;
    delete legacyManifest.blinkConfig;

    const result = validateManifest(legacyManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest?.idleConfig).toBeUndefined();
    expect(result.manifest?.blinkConfig).toBeUndefined();
  });

  it('rejects invalid idleConfig structures and bounds', () => {
    // Non-boolean enabled
    const invalidEnabled = {
      ...DEFAULT_PROJECT_MANIFEST,
      idleConfig: { enabled: 'yes' as any, amplitude: 8, speed: 1.5 },
    };
    expect(validateManifest(invalidEnabled).valid).toBe(false);

    // Negative amplitude
    const negativeAmp = {
      ...DEFAULT_PROJECT_MANIFEST,
      idleConfig: { enabled: true, amplitude: -2, speed: 1.5 },
    };
    expect(validateManifest(negativeAmp).valid).toBe(false);

    // Non-positive speed
    const nonPositiveSpeed = {
      ...DEFAULT_PROJECT_MANIFEST,
      idleConfig: { enabled: true, amplitude: 8, speed: 0 },
    };
    expect(validateManifest(nonPositiveSpeed).valid).toBe(false);
  });

  it('rejects invalid blinkConfig structures and bounds', () => {
    // Non-boolean enabled
    const invalidEnabled = {
      ...DEFAULT_PROJECT_MANIFEST,
      blinkConfig: {
        enabled: 1 as any,
        minIntervalMs: 3000,
        maxIntervalMs: 6000,
        durationMs: 150,
      },
    };
    expect(validateManifest(invalidEnabled).valid).toBe(false);

    // Non-number intervals
    const invalidInterval = {
      ...DEFAULT_PROJECT_MANIFEST,
      blinkConfig: {
        enabled: true,
        minIntervalMs: 'short' as any,
        maxIntervalMs: 6000,
        durationMs: 150,
      },
    };
    expect(validateManifest(invalidInterval).valid).toBe(false);

    // Non-positive duration
    const nonPositiveDuration = {
      ...DEFAULT_PROJECT_MANIFEST,
      blinkConfig: {
        enabled: true,
        minIntervalMs: 3000,
        maxIntervalMs: 6000,
        durationMs: -50,
      },
    };
    expect(validateManifest(nonPositiveDuration).valid).toBe(false);
  });
});

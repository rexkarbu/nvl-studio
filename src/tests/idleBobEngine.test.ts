import { describe, it, expect } from 'vitest';
import { IdleBobEngine } from '../core/animation/IdleBobEngine';
import { CharacterResolver } from '../core/resolver/CharacterResolver';
import { CharacterLayer } from '../core/project/types';

describe('IdleBobEngine', () => {
  const config = {
    enabled: true,
    amplitude: 10,
    speed: 1.0, // 1 Hz = 1 cycle per second
  };

  it('calculates sinusoidal vertical offset matching mathematical formula', () => {
    // Formula: Math.sin(timeSeconds * speed * Math.PI * 2) * amplitude
    // At t = 0s: sin(0) = 0
    expect(IdleBobEngine.calculateOffset(0, config, true)).toBeCloseTo(0, 5);

    // At t = 0.25s (quarter period): sin(pi/2) = 1 -> offset = +10
    expect(IdleBobEngine.calculateOffset(250, config, true)).toBeCloseTo(10, 5);

    // At t = 0.5s (half period): sin(pi) = 0 -> offset = 0
    expect(IdleBobEngine.calculateOffset(500, config, true)).toBeCloseTo(0, 5);

    // At t = 0.75s (three-quarter period): sin(3pi/2) = -1 -> offset = -10
    expect(IdleBobEngine.calculateOffset(750, config, true)).toBeCloseTo(-10, 5);

    // At t = 1.0s (full period): sin(2pi) = 0 -> offset = 0
    expect(IdleBobEngine.calculateOffset(1000, config, true)).toBeCloseTo(0, 5);
  });

  it('scales peak displacement correctly with amplitude', () => {
    const doubleAmp = { ...config, amplitude: 20 };
    const halfAmp = { ...config, amplitude: 5 };

    // At t = 250ms (sin peak = 1)
    expect(IdleBobEngine.calculateOffset(250, doubleAmp, true)).toBeCloseTo(20, 5);
    expect(IdleBobEngine.calculateOffset(250, halfAmp, true)).toBeCloseTo(5, 5);
  });

  it('modulates frequency correctly with speed', () => {
    const fastConfig = { ...config, speed: 2.0 }; // 2 cycles/sec, peak at 125ms

    // At t = 125ms: sin(0.125 * 2 * 2pi) = sin(pi/2) = 1 -> peak offset
    expect(IdleBobEngine.calculateOffset(125, fastConfig, true)).toBeCloseTo(10, 5);
  });

  it('returns 0 when disabled, amplitude 0, or not idle (talking)', () => {
    // Disabled
    expect(IdleBobEngine.calculateOffset(250, { ...config, enabled: false }, true)).toBe(0);

    // Amplitude 0
    expect(IdleBobEngine.calculateOffset(250, { ...config, amplitude: 0 }, true)).toBe(0);

    // Negative amplitude
    expect(IdleBobEngine.calculateOffset(250, { ...config, amplitude: -5 }, true)).toBe(0);

    // Not idle (isIdle = false, avatar talking)
    expect(IdleBobEngine.calculateOffset(250, config, false)).toBe(0);

    // Null or undefined config
    expect(IdleBobEngine.calculateOffset(250, null, true)).toBe(0);
  });

  it('integrates with CharacterResolver: applies offset only to body layer when idle', () => {
    const layers: CharacterLayer[] = [
      {
        id: 'layer-body',
        name: 'Body',
        type: 'sprite',
        assetId: 'asset-body',
        role: 'body',
        x: 100,
        y: 200,
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
        assetId: 'asset-eye',
        role: 'eye_open',
        x: 100,
        y: 200,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        zIndex: 10,
      },
    ];

    // When idle with +8 offset: body is displaced to 208, eye remains at 200
    const idleResolved = CharacterResolver.resolve(
      layers,
      { voiceActivity: false, voiceLevel: 0, blink: false },
      8
    );
    const bodyActive = idleResolved.activeLayers.find((l) => l.layer.role === 'body');
    const eyeActive = idleResolved.activeLayers.find((l) => l.layer.role === 'eye_open');

    expect(bodyActive?.y).toBe(208);
    expect(eyeActive?.y).toBe(200);

    // When talking (voiceActivity: true): idle bob offset is suppressed
    const talkingResolved = CharacterResolver.resolve(
      layers,
      { voiceActivity: true, voiceLevel: 0.8, blink: false },
      8
    );
    const talkingBody = talkingResolved.activeLayers.find((l) => l.layer.role === 'body');
    expect(talkingBody?.y).toBe(200);
  });
});

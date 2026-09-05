import { describe, it, expect } from 'vitest';
import { CharacterResolver } from '../core/resolver/CharacterResolver';
import { CharacterLayer, ExpressionConfig } from '../core/project/types';
import { AvatarParameters } from '../core/parameters/types';

describe('STEP 12: Expression Resolver Extension', () => {
  const mockLayers: CharacterLayer[] = [
    {
      id: 'layer-body',
      name: 'Body',
      type: 'sprite',
      assetId: 'asset-body',
      role: 'body',
      x: 960,
      y: 540,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      visible: true,
      zIndex: 1,
    },
    {
      id: 'layer-eye-open',
      name: 'Eye Open',
      type: 'sprite',
      assetId: 'asset-eye-open',
      role: 'eye_open',
      x: 960,
      y: 540,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      visible: true,
      zIndex: 2,
    },
    {
      id: 'layer-eye-closed',
      name: 'Eye Closed',
      type: 'sprite',
      assetId: 'asset-eye-closed',
      role: 'eye_closed',
      x: 960,
      y: 540,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      visible: true,
      zIndex: 3,
    },
    {
      id: 'layer-mouth-closed',
      name: 'Mouth Closed',
      type: 'sprite',
      assetId: 'asset-mouth-closed',
      role: 'mouth_closed',
      x: 960,
      y: 540,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      visible: true,
      zIndex: 4,
    },
    {
      id: 'layer-mouth-open',
      name: 'Mouth Open',
      type: 'sprite',
      assetId: 'asset-mouth-open',
      role: 'mouth_open',
      x: 960,
      y: 540,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      visible: true,
      zIndex: 5,
    },
  ];

  const mockExpressionConfig: ExpressionConfig = {
    activeExpression: 'happy',
    expressions: [
      {
        id: 'neutral',
        name: 'Neutral',
        layerOverrides: {},
      },
      {
        id: 'happy',
        name: 'Happy',
        layerOverrides: {
          'layer-eye-open': { scaleX: 1.2, scaleY: 1.2, opacity: 0.9 },
          'layer-mouth-closed': { y: 550 },
        },
      },
      {
        id: 'angry',
        name: 'Angry',
        layerOverrides: {
          'layer-eye-open': { rotation: -5 },
        },
      },
    ],
  };

  const baseParams: AvatarParameters = {
    voiceActivity: false,
    voiceLevel: 0,
    blink: false,
    expression: 'happy',
  };

  it('appliesLayerOverridesForActiveExpression: applies scale, position, and opacity overrides additively', () => {
    const resolved = CharacterResolver.resolve(
      mockLayers,
      baseParams,
      0,
      mockExpressionConfig
    );

    const eyeOpen = resolved.activeLayers.find((l) => l.layer.id === 'layer-eye-open');
    expect(eyeOpen).toBeDefined();
    expect(eyeOpen?.scaleX).toBe(1.2);
    expect(eyeOpen?.scaleY).toBe(1.2);
    expect(eyeOpen?.opacity).toBe(0.9);
    // Unchanged properties should retain their original values
    expect(eyeOpen?.x).toBe(960);
    expect(eyeOpen?.rotation).toBe(0);

    const mouthClosed = resolved.activeLayers.find((l) => l.layer.id === 'layer-mouth-closed');
    expect(mouthClosed).toBeDefined();
    expect(mouthClosed?.y).toBe(550);
  });

  it('preservesRoleBasedRenderingDuringExpressionSwitch: ensures blink and talk still work simultaneously while expression is active', () => {
    // 1. Idle state: mouth_closed active, eye_open active
    const idleResolved = CharacterResolver.resolve(
      mockLayers,
      { ...baseParams, voiceActivity: false, blink: false, expression: 'happy' },
      0,
      mockExpressionConfig
    );
    expect(idleResolved.activeLayers.some((l) => l.layer.role === 'mouth_closed')).toBe(true);
    expect(idleResolved.activeLayers.some((l) => l.layer.role === 'mouth_open')).toBe(false);
    expect(idleResolved.activeLayers.some((l) => l.layer.role === 'eye_open')).toBe(true);
    expect(idleResolved.activeLayers.some((l) => l.layer.role === 'eye_closed')).toBe(false);

    // 2. Talking and blinking simultaneously while in happy expression
    const talkingBlinkResolved = CharacterResolver.resolve(
      mockLayers,
      { ...baseParams, voiceActivity: true, blink: true, expression: 'happy' },
      0,
      mockExpressionConfig
    );
    expect(talkingBlinkResolved.activeLayers.some((l) => l.layer.role === 'mouth_closed')).toBe(false);
    expect(talkingBlinkResolved.activeLayers.some((l) => l.layer.role === 'mouth_open')).toBe(true);
    expect(talkingBlinkResolved.activeLayers.some((l) => l.layer.role === 'eye_open')).toBe(false);
    expect(talkingBlinkResolved.activeLayers.some((l) => l.layer.role === 'eye_closed')).toBe(true);

    // Role must never be mutated
    for (const item of talkingBlinkResolved.activeLayers) {
      const original = mockLayers.find((l) => l.id === item.layer.id);
      expect(item.layer.role).toBe(original?.role);
    }
  });

  it('fallsBackToNeutralWhenExpressionConfigMissing: backward compatibility when expressionConfig is undefined', () => {
    const resolved = CharacterResolver.resolve(
      mockLayers,
      { voiceActivity: false, voiceLevel: 0, blink: false, expression: 'happy' },
      0,
      undefined // No expressionConfig
    );

    const eyeOpen = resolved.activeLayers.find((l) => l.layer.id === 'layer-eye-open');
    expect(eyeOpen).toBeDefined();
    // Default values without overrides
    expect(eyeOpen?.scaleX).toBe(1.0);
    expect(eyeOpen?.scaleY).toBe(1.0);
    expect(eyeOpen?.opacity).toBe(1.0);
  });
});

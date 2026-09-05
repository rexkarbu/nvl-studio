import { describe, it, expect } from 'vitest';
import { deriveMouthShape, deriveMouthOpen, resolveActiveMouthRole, DEFAULT_MOUTH_THRESHOLDS } from '../core/audio/MouthShapeMapper';
import { CharacterResolver } from '../core/resolver/CharacterResolver';
import { CharacterLayer, MouthConfig, MouthThresholds } from '../core/project/types';
import { AvatarParameters } from '../core/parameters/types';

describe('STEP 13: Multi-Frame Mouth & Continuous Parameter Mapping', () => {
  const customThresholds: MouthThresholds = {
    closed: 0.05,
    small: 0.25,
    medium: 0.55,
  };

  const mock2FrameLayers: CharacterLayer[] = [
    {
      id: 'layer-body',
      name: 'Body',
      type: 'sprite',
      assetId: 'asset-body',
      role: 'body',
      x: 960,
      y: 540,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
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
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
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
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
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
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
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
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      zIndex: 5,
    },
  ];

  const mock4FrameLayers: CharacterLayer[] = [
    ...mock2FrameLayers.filter((l) => l.role !== 'mouth_open'),
    {
      id: 'layer-mouth-small',
      name: 'Mouth Small',
      type: 'sprite',
      assetId: 'asset-mouth-small',
      role: 'mouth_small',
      x: 960,
      y: 540,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      zIndex: 5,
    },
    {
      id: 'layer-mouth-medium',
      name: 'Mouth Medium',
      type: 'sprite',
      assetId: 'asset-mouth-medium',
      role: 'mouth_medium',
      x: 960,
      y: 540,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      zIndex: 6,
    },
    {
      id: 'layer-mouth-wide',
      name: 'Mouth Wide',
      type: 'sprite',
      assetId: 'asset-mouth-wide',
      role: 'mouth_wide',
      x: 960,
      y: 540,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      zIndex: 7,
    },
  ];

  it('1. derivesCorrectMouthShapeFromVoiceLevel: maps discrete shapes across threshold boundaries', () => {
    // Custom thresholds: closed: 0.05, small: 0.25, medium: 0.55
    expect(deriveMouthShape(0, customThresholds)).toBe('closed');
    expect(deriveMouthShape(0.03, customThresholds)).toBe('closed');
    expect(deriveMouthShape(0.05, customThresholds)).toBe('small');
    expect(deriveMouthShape(0.15, customThresholds)).toBe('small');
    expect(deriveMouthShape(0.25, customThresholds)).toBe('medium');
    expect(deriveMouthShape(0.40, customThresholds)).toBe('medium');
    expect(deriveMouthShape(0.55, customThresholds)).toBe('wide');
    expect(deriveMouthShape(0.70, customThresholds)).toBe('wide');
    expect(deriveMouthShape(1.0, customThresholds)).toBe('wide');

    // Default thresholds: closed: 0.15, small: 0.35, medium: 0.65
    expect(deriveMouthShape(0.10, DEFAULT_MOUTH_THRESHOLDS)).toBe('closed');
    expect(deriveMouthShape(0.25, DEFAULT_MOUTH_THRESHOLDS)).toBe('small');
    expect(deriveMouthShape(0.50, DEFAULT_MOUTH_THRESHOLDS)).toBe('medium');
    expect(deriveMouthShape(0.80, DEFAULT_MOUTH_THRESHOLDS)).toBe('wide');
  });

  it('2. derivesContinuousMouthOpenValue: deadzone below closed threshold and linear scaling to 1.0', () => {
    const thresholds: MouthThresholds = {
      closed: 0.20,
      small: 0.40,
      medium: 0.70,
    };

    // Below or at closed threshold -> deadzone (0.0)
    expect(deriveMouthOpen(0, thresholds)).toBe(0);
    expect(deriveMouthOpen(0.10, thresholds)).toBe(0);
    expect(deriveMouthOpen(0.20, thresholds)).toBe(0);

    // Halfway between closed (0.20) and 1.0 -> (0.60 - 0.20) / 0.80 = 0.50
    expect(deriveMouthOpen(0.60, thresholds)).toBe(0.5);

    // At top boundary
    expect(deriveMouthOpen(1.0, thresholds)).toBe(1.0);

    // Clamping behavior
    expect(deriveMouthOpen(-0.5, thresholds)).toBe(0);
    expect(deriveMouthOpen(1.5, thresholds)).toBe(1.0);
  });

  it('3. resolvesCorrectMouthLayerForEachShape: renders exact mouth layer for 4-frame avatars', () => {
    const defaultMouthConfig: MouthConfig = {
      thresholds: { ...DEFAULT_MOUTH_THRESHOLDS },
      continuousMode: false,
    };

    // Shape: closed
    const paramsClosed: AvatarParameters = {
      voiceActivity: false,
      voiceLevel: 0,
      blink: false,
      mouthShape: 'closed',
      mouthOpen: 0,
    };
    const resClosed = CharacterResolver.resolve(mock4FrameLayers, paramsClosed, 0, undefined, defaultMouthConfig);
    const activeRolesClosed = resClosed.activeLayers.map((l) => l.layer.role);
    expect(activeRolesClosed).toContain('mouth_closed');
    expect(activeRolesClosed).not.toContain('mouth_small');
    expect(activeRolesClosed).not.toContain('mouth_medium');
    expect(activeRolesClosed).not.toContain('mouth_wide');

    // Shape: small
    const paramsSmall: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.25,
      blink: false,
      mouthShape: 'small',
      mouthOpen: 0.2,
    };
    const resSmall = CharacterResolver.resolve(mock4FrameLayers, paramsSmall, 0, undefined, defaultMouthConfig);
    const activeRolesSmall = resSmall.activeLayers.map((l) => l.layer.role);
    expect(activeRolesSmall).toContain('mouth_small');
    expect(activeRolesSmall).not.toContain('mouth_closed');
    expect(activeRolesSmall).not.toContain('mouth_medium');
    expect(activeRolesSmall).not.toContain('mouth_wide');

    // Shape: medium
    const paramsMedium: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.5,
      blink: false,
      mouthShape: 'medium',
      mouthOpen: 0.5,
    };
    const resMedium = CharacterResolver.resolve(mock4FrameLayers, paramsMedium, 0, undefined, defaultMouthConfig);
    const activeRolesMedium = resMedium.activeLayers.map((l) => l.layer.role);
    expect(activeRolesMedium).toContain('mouth_medium');
    expect(activeRolesMedium).not.toContain('mouth_closed');
    expect(activeRolesMedium).not.toContain('mouth_small');
    expect(activeRolesMedium).not.toContain('mouth_wide');

    // Shape: wide
    const paramsWide: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.8,
      blink: false,
      mouthShape: 'wide',
      mouthOpen: 0.9,
    };
    const resWide = CharacterResolver.resolve(mock4FrameLayers, paramsWide, 0, undefined, defaultMouthConfig);
    // Direct resolveActiveMouthRole assertion
    expect(resolveActiveMouthRole(paramsWide, new Set(['mouth_closed', 'mouth_small', 'mouth_medium', 'mouth_wide']), defaultMouthConfig)).toBe('mouth_wide');
    const activeRolesWide = resWide.activeLayers.map((l) => l.layer.role);
    expect(activeRolesWide).toContain('mouth_wide');
    expect(activeRolesWide).not.toContain('mouth_closed');
    expect(activeRolesWide).not.toContain('mouth_small');
    expect(activeRolesWide).not.toContain('mouth_medium');
  });

  it('4. fallsBackToBinaryWhenMouthConfigMissing: legacy 2-frame avatars fallback gracefully', () => {
    // Talking state with non-existent 'mouth_small' -> falls back to 'mouth_open'
    const paramsTalkingSmall: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.25,
      blink: false,
      mouthShape: 'small',
    };
    const resTalking = CharacterResolver.resolve(mock2FrameLayers, paramsTalkingSmall, 0);
    const rolesTalking = resTalking.activeLayers.map((l) => l.layer.role);
    expect(rolesTalking).toContain('mouth_open');
    expect(rolesTalking).not.toContain('mouth_closed');

    // Talking state with 'wide' on 2-frame avatar -> falls back to 'mouth_open'
    const paramsTalkingWide: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.9,
      blink: false,
      mouthShape: 'wide',
    };
    const resWide = CharacterResolver.resolve(mock2FrameLayers, paramsTalkingWide, 0);
    expect(resWide.activeLayers.map((l) => l.layer.role)).toContain('mouth_open');

    // Silent state even with mouthShape='small' -> falls back to 'mouth_closed'
    const paramsSilentSmall: AvatarParameters = {
      voiceActivity: false,
      voiceLevel: 0,
      blink: false,
      mouthShape: 'small',
    };
    const resSilent = CharacterResolver.resolve(mock2FrameLayers, paramsSilentSmall, 0);
    const rolesSilent = resSilent.activeLayers.map((l) => l.layer.role);
    expect(rolesSilent).toContain('mouth_closed');
    expect(rolesSilent).not.toContain('mouth_open');
  });

  it('5. continuousModeFallsBackGracefullyWithOnlyTwoFrames: handles continuous mode without crashing on 2-frame avatars', () => {
    const continuousConfig: MouthConfig = {
      thresholds: { ...DEFAULT_MOUTH_THRESHOLDS },
      continuousMode: true,
    };

    // Talking with mouthOpen > 0.05 on 2-frame avatar -> resolves to mouth_open
    const paramsContinuousOpen: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.6,
      blink: false,
      mouthOpen: 0.55,
    };
    const resOpen = CharacterResolver.resolve(mock2FrameLayers, paramsContinuousOpen, 0, undefined, continuousConfig);
    expect(resOpen.activeLayers.map((l) => l.layer.role)).toContain('mouth_open');
    expect(resOpen.activeLayers.map((l) => l.layer.role)).not.toContain('mouth_closed');

    // Talking with mouthOpen <= 0.05 (near silence) -> resolves to mouth_closed
    const paramsContinuousClosed: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.02,
      blink: false,
      mouthOpen: 0.02,
    };
    const resClosed = CharacterResolver.resolve(mock2FrameLayers, paramsContinuousClosed, 0, undefined, continuousConfig);
    expect(resClosed.activeLayers.map((l) => l.layer.role)).toContain('mouth_closed');
    expect(resClosed.activeLayers.map((l) => l.layer.role)).not.toContain('mouth_open');

    // Edge Case: continuousMode is true but mouthOpen is undefined -> falls back to binary
    const paramsUndefinedOpen: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.5,
      blink: false,
    };
    const resFallback = CharacterResolver.resolve(mock2FrameLayers, paramsUndefinedOpen, 0, undefined, continuousConfig);
    expect(resFallback.activeLayers.map((l) => l.layer.role)).toContain('mouth_open');
  });
});

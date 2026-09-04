import { describe, it, expect } from 'vitest';
import { CharacterResolver } from '../core/resolver/CharacterResolver';
import { CharacterLayer } from '../core/project/types';
import { AvatarParameters } from '../core/parameters/types';

const mockLayers: CharacterLayer[] = [
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
    zIndex: 10,
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
    zIndex: 11,
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
    zIndex: 20,
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
    zIndex: 21,
  },
];

describe('CharacterResolver', () => {
  it('resolves idle state (voiceActivity: false, blink: false)', () => {
    const params: AvatarParameters = {
      voiceActivity: false,
      voiceLevel: 0,
      blink: false,
    };

    const resolved = CharacterResolver.resolve(mockLayers, params);
    const activeRoles = resolved.activeLayers.map((l) => l.layer.role);

    expect(activeRoles).toEqual(['body', 'eye_open', 'mouth_closed']);
    expect(resolved.voiceState).toBe('idle');
    expect(resolved.isBlinking).toBe(false);
  });

  it('resolves talking state (voiceActivity: true, blink: false)', () => {
    const params: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.7,
      blink: false,
    };

    const resolved = CharacterResolver.resolve(mockLayers, params);
    const activeRoles = resolved.activeLayers.map((l) => l.layer.role);

    expect(activeRoles).toEqual(['body', 'eye_open', 'mouth_open']);
    expect(resolved.voiceState).toBe('talking');
    expect(resolved.isBlinking).toBe(false);
  });

  it('resolves blink state while idle (voiceActivity: false, blink: true)', () => {
    const params: AvatarParameters = {
      voiceActivity: false,
      voiceLevel: 0,
      blink: true,
    };

    const resolved = CharacterResolver.resolve(mockLayers, params);
    const activeRoles = resolved.activeLayers.map((l) => l.layer.role);

    expect(activeRoles).toEqual(['body', 'eye_closed', 'mouth_closed']);
    expect(resolved.voiceState).toBe('idle');
    expect(resolved.isBlinking).toBe(true);
  });

  it('resolves non-mutually-exclusive talking AND blink simultaneously', () => {
    // Crucial requirement: voiceActivity = true AND blink = true must render mouth_open + eye_closed
    const params: AvatarParameters = {
      voiceActivity: true,
      voiceLevel: 0.85,
      blink: true,
    };

    const resolved = CharacterResolver.resolve(mockLayers, params);
    const activeRoles = resolved.activeLayers.map((l) => l.layer.role);

    expect(activeRoles).toEqual(['body', 'eye_closed', 'mouth_open']);
    expect(resolved.voiceState).toBe('talking');
    expect(resolved.isBlinking).toBe(true);
  });

  it('sorts active layers strictly by zIndex ascending', () => {
    const unsortedLayers: CharacterLayer[] = [
      { ...mockLayers[3], zIndex: 99 }, // mouth_closed
      { ...mockLayers[0], zIndex: 5 },  // body
      { ...mockLayers[1], zIndex: 12 }, // eye_open
    ];

    const params: AvatarParameters = { voiceActivity: false, voiceLevel: 0, blink: false };
    const resolved = CharacterResolver.resolve(unsortedLayers, params);

    expect(resolved.activeLayers.map((l) => l.zIndex)).toEqual([5, 12, 99]);
  });

  it('excludes invisible layers (visible: false)', () => {
    const layersWithHidden = mockLayers.map((l) =>
      l.role === 'body' ? { ...l, visible: false } : l
    );

    const params: AvatarParameters = { voiceActivity: false, voiceLevel: 0, blink: false };
    const resolved = CharacterResolver.resolve(layersWithHidden, params);
    const activeRoles = resolved.activeLayers.map((l) => l.layer.role);

    expect(activeRoles).toEqual(['eye_open', 'mouth_closed']);
  });
});

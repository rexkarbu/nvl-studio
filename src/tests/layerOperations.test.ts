import { describe, it, expect } from 'vitest';
import {
  reorderLayers,
  moveLayerUp,
  moveLayerDown,
  deleteLayer,
  renameLayer,
  toggleVisibility,
  updateTransform,
} from '../core/project/layerOperations';
import { CharacterLayer } from '../core/project/types';

const mockLayers: CharacterLayer[] = [
  {
    id: 'layer-1',
    name: 'Body',
    type: 'sprite',
    assetId: 'asset-1',
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
    id: 'layer-2',
    name: 'Eyes',
    type: 'sprite',
    assetId: 'asset-2',
    role: 'eye_open',
    x: 960,
    y: 500,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    zIndex: 2,
  },
  {
    id: 'layer-3',
    name: 'Mouth',
    type: 'sprite',
    assetId: 'asset-3',
    role: 'mouth_closed',
    x: 960,
    y: 580,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    zIndex: 3,
  },
];

describe('layerOperations module', () => {
  it('reorderLayers correctly moves layer and recalculates sequential zIndex', () => {
    // Move layer-1 (index 0) to index 2 (top)
    const reordered = reorderLayers(mockLayers, 0, 2);

    expect(reordered.map((l) => l.id)).toEqual(['layer-2', 'layer-3', 'layer-1']);
    expect(reordered[0].zIndex).toBe(1);
    expect(reordered[1].zIndex).toBe(2);
    expect(reordered[2].zIndex).toBe(3);
  });

  it('moveLayerUp and moveLayerDown swap adjacent layers and update zIndex', () => {
    const movedUp = moveLayerUp(mockLayers, 'layer-1');
    expect(movedUp.map((l) => l.id)).toEqual(['layer-2', 'layer-1', 'layer-3']);
    expect(movedUp.find((l) => l.id === 'layer-1')?.zIndex).toBe(2);

    const movedDown = moveLayerDown(movedUp, 'layer-1');
    expect(movedDown.map((l) => l.id)).toEqual(['layer-1', 'layer-2', 'layer-3']);
    expect(movedDown.find((l) => l.id === 'layer-1')?.zIndex).toBe(1);
  });

  it('deleteLayer removes layer and reindexes zIndex', () => {
    const result = deleteLayer(mockLayers, 'layer-2');

    expect(result.length).toBe(2);
    expect(result.map((l) => l.id)).toEqual(['layer-1', 'layer-3']);
    expect(result[0].zIndex).toBe(1);
    expect(result[1].zIndex).toBe(2);
  });

  it('renameLayer updates layer name cleanly', () => {
    const renamed = renameLayer(mockLayers, 'layer-1', 'Base Torso');
    expect(renamed.find((l) => l.id === 'layer-1')?.name).toBe('Base Torso');
    // Ensure original wasn't mutated
    expect(mockLayers[0].name).toBe('Body');
  });

  it('toggleVisibility flips visible flag', () => {
    const toggled = toggleVisibility(mockLayers, 'layer-2');
    expect(toggled.find((l) => l.id === 'layer-2')?.visible).toBe(false);

    const reToggled = toggleVisibility(toggled, 'layer-2');
    expect(reToggled.find((l) => l.id === 'layer-2')?.visible).toBe(true);
  });

  it('updateTransform modifies transform coordinates and scale immutably', () => {
    const updated = updateTransform(mockLayers, 'layer-3', {
      x: 980,
      y: 600,
      scaleX: 1.25,
      rotation: 15,
      opacity: 0.8,
    });

    const mouth = updated.find((l) => l.id === 'layer-3');
    expect(mouth?.x).toBe(980);
    expect(mouth?.y).toBe(600);
    expect(mouth?.scaleX).toBe(1.25);
    expect(mouth?.rotation).toBe(15);
    expect(mouth?.opacity).toBe(0.8);
  });
});

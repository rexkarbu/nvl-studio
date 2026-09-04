import { CharacterLayer, ProjectAssetEntry } from './types';

/**
 * Creates a default CharacterLayer from a newly imported asset.
 * Default center coordinate (960, 540) on the 1920x1080 canvas.
 */
export function createDefaultLayer(asset: ProjectAssetEntry, zIndex: number): CharacterLayer {
  return {
    id: `layer-${asset.id.replace(/^asset-/, '')}`,
    name: asset.name,
    type: 'sprite',
    assetId: asset.id,
    role: 'custom',
    x: 960,
    y: 540,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    zIndex,
  };
}

/**
 * Pure functions for immutable layer operations.
 */

/**
 * Reorders layers and recalculates zIndex sequentially (1, 2, 3, ...).
 * Layers with lower index have lower zIndex (rendered behind).
 */
export function reorderLayers(
  layers: CharacterLayer[],
  fromIndex: number,
  toIndex: number
): CharacterLayer[] {
  if (
    fromIndex < 0 ||
    fromIndex >= layers.length ||
    toIndex < 0 ||
    toIndex >= layers.length ||
    fromIndex === toIndex
  ) {
    return layers;
  }

  const result = [...layers];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);

  // Recalculate zIndex so it matches the array order cleanly (1-based)
  return result.map((layer, index) => ({
    ...layer,
    zIndex: index + 1,
  }));
}

/**
 * Moves a layer one step up in the visual stack (higher zIndex).
 */
export function moveLayerUp(layers: CharacterLayer[], layerId: string): CharacterLayer[] {
  const index = layers.findIndex((l) => l.id === layerId);
  if (index < 0 || index >= layers.length - 1) return layers;
  return reorderLayers(layers, index, index + 1);
}

/**
 * Moves a layer one step down in the visual stack (lower zIndex).
 */
export function moveLayerDown(layers: CharacterLayer[], layerId: string): CharacterLayer[] {
  const index = layers.findIndex((l) => l.id === layerId);
  if (index <= 0) return layers;
  return reorderLayers(layers, index, index - 1);
}

/**
 * Removes a layer by ID and updates remaining zIndices.
 */
export function deleteLayer(layers: CharacterLayer[], layerId: string): CharacterLayer[] {
  return layers
    .filter((l) => l.id !== layerId)
    .map((layer, index) => ({
      ...layer,
      zIndex: index + 1,
    }));
}

/**
 * Renames a layer.
 */
export function renameLayer(layers: CharacterLayer[], layerId: string, newName: string): CharacterLayer[] {
  const trimmed = newName.trim();
  if (!trimmed) return layers;

  return layers.map((layer) =>
    layer.id === layerId ? { ...layer, name: trimmed } : layer
  );
}

/**
 * Toggles the visibility of a layer.
 */
export function toggleVisibility(layers: CharacterLayer[], layerId: string): CharacterLayer[] {
  return layers.map((layer) =>
    layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
  );
}

/**
 * Updates transform properties (x, y, scaleX, scaleY, rotation, opacity, etc.) of a specific layer.
 */
export function updateTransform(
  layers: CharacterLayer[],
  layerId: string,
  updates: Partial<Pick<CharacterLayer, 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity' | 'visible' | 'role'>>
): CharacterLayer[] {
  return layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    return {
      ...layer,
      ...updates,
    };
  });
}

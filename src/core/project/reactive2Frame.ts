import { CharacterLayer, ProjectManifest } from './types';

/** Restore assigned frames first; filename guesses are only for unconfigured rigs. */
export function getReactiveFrameAssetIds(manifest: ProjectManifest): [string, string] {
  const assetIds = new Set(manifest.assets.map((asset) => asset.id));
  const assigned = (role: CharacterLayer['role']) =>
    manifest.layers.find((layer) => layer.role === role && assetIds.has(layer.assetId))?.assetId;
  const eyeAssetIds = new Set(manifest.layers
    .filter((layer) => layer.role === 'eye_open' || layer.role === 'eye_closed')
    .map((layer) => layer.assetId));
  const candidates = manifest.assets.filter((asset) =>
    !eyeAssetIds.has(asset.id) && !/(?:eye|mata|blink)/i.test(asset.name));
  const closed = assigned('mouth_closed') ?? candidates.find((asset) =>
    /(?:closed|tutup|diam|idle|silent|quiet|mingkem|frame[-_ ]?1)/i.test(asset.name))?.id ?? candidates[0]?.id ?? '';
  const open = assigned('mouth_open') ?? candidates.find((asset) =>
    asset.id !== closed && /(?:open|buka|bicara|talk|speak|ngomong|mangap|frame[-_ ]?2)/i.test(asset.name))?.id ??
    candidates.find((asset) => asset.id !== closed)?.id ?? '';
  return [closed, open];
}

/** Reuse primary transforms, deactivate replaced mouths, and leave other layers intact. */
export function applyReactive2FrameLayers(
  layers: CharacterLayer[],
  idleLayer: CharacterLayer,
  talkingLayer: CharacterLayer,
  replaceLayers: boolean
): CharacterLayer[] {
  if (replaceLayers) return [idleLayer, talkingLayer];

  const primaryRoles = new Set<CharacterLayer['role']>();
  const result = layers.map((layer): CharacterLayer => {
    if (layer.role === 'mouth_closed' || layer.role === 'mouth_open') {
      if (!primaryRoles.has(layer.role)) {
        primaryRoles.add(layer.role);
        return { ...layer, assetId: layer.role === 'mouth_closed' ? idleLayer.assetId : talkingLayer.assetId, visible: true };
      }
    } else if (!['mouth_small', 'mouth_medium', 'mouth_wide'].includes(layer.role)) {
      return layer;
    }
    return { ...layer, role: 'custom', visible: false };
  });

  for (const frame of [idleLayer, talkingLayer]) {
    if (!primaryRoles.has(frame.role)) {
      const maxZ = result.reduce((max, layer) => Math.max(max, layer.zIndex), -1);
      result.push({ ...frame, zIndex: maxZ + 1 });
    }
  }
  return result;
}

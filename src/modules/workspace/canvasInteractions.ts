import { CharacterLayer } from '../../core/project/types';
import { Point } from './canvasNavigation';

export type HandleType =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'rotation';

export interface HandleDescriptor {
  type: HandleType;
  x: number; // in canvas coordinates
  y: number; // in canvas coordinates
  cursor: string;
}

export interface LayerBounds {
  x: number;      // Center X
  y: number;      // Center Y
  width: number;  // Base asset width
  height: number; // Base asset height
  scaleX: number;
  scaleY: number;
  rotation: number;
}

/**
 * Transforms a point from world canvas space into the local untransformed coordinate space of a layer.
 * Anchor is assumed to be Center (0, 0) in local space, ranging from [-w/2, -h/2] to [w/2, h/2].
 */
export function pointToLocalSpace(
  point: Point,
  layer: CharacterLayer
): Point {
  const dx = point.x - layer.x;
  const dy = point.y - layer.y;

  const rad = (-layer.rotation * Math.PI) / 180;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

  const sx = layer.scaleX || 1;
  const sy = layer.scaleY || 1;

  const x = Math.abs(rx / sx) < 1e-9 ? 0 : rx / sx;
  const y = Math.abs(ry / sy) < 1e-9 ? 0 : ry / sy;

  return {
    x: Object.is(x, -0) ? 0 : x,
    y: Object.is(y, -0) ? 0 : y,
  };
}

/**
 * Transforms a local point [-w/2..w/2, -h/2..h/2] back to world canvas coordinates.
 */
export function localToCanvasSpace(
  localPoint: Point,
  layer: CharacterLayer
): Point {
  const sx = localPoint.x * (layer.scaleX || 1);
  const sy = localPoint.y * (layer.scaleY || 1);

  const rad = (layer.rotation * Math.PI) / 180;
  const rx = sx * Math.cos(rad) - sy * Math.sin(rad);
  const ry = sx * Math.sin(rad) + sy * Math.cos(rad);

  return {
    x: rx + layer.x,
    y: ry + layer.y,
  };
}

/**
 * Tests whether a point on the canvas hits a given layer.
 */
export function hitTestLayer(
  point: Point,
  layer: CharacterLayer,
  width: number,
  height: number
): boolean {
  if (!layer.visible) return false;

  const local = pointToLocalSpace(point, layer);
  const halfW = width / 2;
  const halfH = height / 2;

  return (
    local.x >= -halfW &&
    local.x <= halfW &&
    local.y >= -halfH &&
    local.y <= halfH
  );
}

/**
 * Finds the topmost layer under the specified canvas point.
 * Checks visible layers in descending zIndex order (top to bottom).
 */
export function findTopmostLayerAt(
  point: Point,
  layers: CharacterLayer[],
  dimensionsMap: Map<string, { width: number; height: number }>
): CharacterLayer | null {
  // Sort descending by zIndex
  const sorted = [...layers]
    .filter((l) => l.visible)
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const layer of sorted) {
    const dims = dimensionsMap.get(layer.assetId) || { width: 300, height: 300 };
    if (hitTestLayer(point, layer, dims.width, dims.height)) {
      return layer;
    }
  }

  return null;
}

/**
 * Calculates handle positions in canvas space for a selected layer.
 */
export function getHandlesForLayer(
  layer: CharacterLayer,
  width: number,
  height: number,
  rotationHandleOffset: number = 32
): HandleDescriptor[] {
  const halfW = width / 2;
  const halfH = height / 2;

  const localHandles: Array<{ type: HandleType; local: Point; cursor: string }> = [
    { type: 'top-left', local: { x: -halfW, y: -halfH }, cursor: 'nwse-resize' },
    { type: 'top-right', local: { x: halfW, y: -halfH }, cursor: 'nesw-resize' },
    { type: 'bottom-left', local: { x: -halfW, y: halfH }, cursor: 'nesw-resize' },
    { type: 'bottom-right', local: { x: halfW, y: halfH }, cursor: 'nwse-resize' },
    { type: 'top', local: { x: 0, y: -halfH }, cursor: 'ns-resize' },
    { type: 'bottom', local: { x: 0, y: halfH }, cursor: 'ns-resize' },
    { type: 'left', local: { x: -halfW, y: 0 }, cursor: 'ew-resize' },
    { type: 'right', local: { x: halfW, y: 0 }, cursor: 'ew-resize' },
    { type: 'rotation', local: { x: 0, y: -halfH - rotationHandleOffset / (layer.scaleY || 1) }, cursor: 'grab' },
  ];

  return localHandles.map((h) => {
    const world = localToCanvasSpace(h.local, layer);
    return {
      type: h.type,
      x: world.x,
      y: world.y,
      cursor: h.cursor,
    };
  });
}

/**
 * Hit tests handles for a selected layer. Returns handle type if within threshold radius.
 */
export function hitTestHandles(
  point: Point,
  layer: CharacterLayer,
  width: number,
  height: number,
  hitRadius: number = 10
): HandleType | null {
  const handles = getHandlesForLayer(layer, width, height);

  for (const h of handles) {
    const distSq = (point.x - h.x) ** 2 + (point.y - h.y) ** 2;
    if (distSq <= hitRadius ** 2) {
      return h.type;
    }
  }

  return null;
}

/**
 * Nudges a layer's position by dx, dy.
 */
export function nudgeLayer(
  layer: CharacterLayer,
  dx: number,
  dy: number
): CharacterLayer {
  return {
    ...layer,
    x: Math.round(layer.x + dx),
    y: Math.round(layer.y + dy),
  };
}

/**
 * Applies drag move delta to a layer.
 */
export function applyDragMove(
  initialLayer: CharacterLayer,
  totalDelta: Point
): CharacterLayer {
  return {
    ...initialLayer,
    x: Math.round(initialLayer.x + totalDelta.x),
    y: Math.round(initialLayer.y + totalDelta.y),
  };
}

/**
 * Calculates updated scale when dragging a resize handle.
 */
export function applyHandleScale(
  initialLayer: CharacterLayer,
  handle: HandleType,
  startMouseCanvas: Point,
  currentMouseCanvas: Point,
  baseWidth: number,
  baseHeight: number,
  lockAspectRatio: boolean = false
): { scaleX: number; scaleY: number } {
  // Convert mouse movement to initial local space
  const startLocal = pointToLocalSpace(startMouseCanvas, initialLayer);
  const currentLocal = pointToLocalSpace(currentMouseCanvas, initialLayer);

  const deltaLocalX = currentLocal.x - startLocal.x;
  const deltaLocalY = currentLocal.y - startLocal.y;

  const halfW = baseWidth / 2 || 1;
  const halfH = baseHeight / 2 || 1;

  let factorX = 1;
  let factorY = 1;

  switch (handle) {
    case 'top-left':
      factorX = 1 - deltaLocalX / halfW;
      factorY = 1 - deltaLocalY / halfH;
      break;
    case 'top-right':
      factorX = 1 + deltaLocalX / halfW;
      factorY = 1 - deltaLocalY / halfH;
      break;
    case 'bottom-left':
      factorX = 1 - deltaLocalX / halfW;
      factorY = 1 + deltaLocalY / halfH;
      break;
    case 'bottom-right':
      factorX = 1 + deltaLocalX / halfW;
      factorY = 1 + deltaLocalY / halfH;
      break;
    case 'left':
      factorX = 1 - deltaLocalX / halfW;
      break;
    case 'right':
      factorX = 1 + deltaLocalX / halfW;
      break;
    case 'top':
      factorY = 1 - deltaLocalY / halfH;
      break;
    case 'bottom':
      factorY = 1 + deltaLocalY / halfH;
      break;
  }

  let nextScaleX = Math.max(0.05, Math.min(10.0, initialLayer.scaleX * factorX));
  let nextScaleY = Math.max(0.05, Math.min(10.0, initialLayer.scaleY * factorY));

  if (lockAspectRatio || handle.includes('-')) {
    // If dragging a corner, maintain proportion
    const avgFactor = (factorX + factorY) / 2;
    nextScaleX = Math.max(0.05, Math.min(10.0, initialLayer.scaleX * avgFactor));
    nextScaleY = Math.max(0.05, Math.min(10.0, initialLayer.scaleY * avgFactor));
  }

  return {
    scaleX: Number(nextScaleX.toFixed(3)),
    scaleY: Number(nextScaleY.toFixed(3)),
  };
}

/**
 * Calculates updated rotation in degrees (-180 to 180) based on mouse position relative to layer center.
 */
export function applyHandleRotate(
  layer: CharacterLayer,
  currentMouseCanvas: Point
): number {
  const dx = currentMouseCanvas.x - layer.x;
  const dy = currentMouseCanvas.y - layer.y;

  // Rotation handle is at top (negative Y), so angle 0 is straight up (-90 deg in standard cartesian)
  let degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  while (degrees > 180) degrees -= 360;
  while (degrees <= -180) degrees += 360;

  return Math.round(degrees);
}

import { describe, it, expect } from 'vitest';
import {
  hitTestLayer,
  findTopmostLayerAt,
  hitTestHandles,
  applyDragMove,
  applyHandleRotate,
  applyHandleScale,
  nudgeLayer,
  pointToLocalSpace,
} from '../modules/workspace/canvasInteractions';
import { screenToCanvas, canvasToScreen } from '../modules/workspace/canvasNavigation';
import { CharacterLayer } from '../core/project/types';

const baseLayer: CharacterLayer = {
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
};

describe('canvasInteractions module', () => {
  it('hitTestLayer accurately detects points inside and outside unrotated layer', () => {
    const width = 400;
    const height = 400;

    // Center point
    expect(hitTestLayer({ x: 960, y: 540 }, baseLayer, width, height)).toBe(true);

    // Near edges (center +/- 190)
    expect(hitTestLayer({ x: 960 + 190, y: 540 + 190 }, baseLayer, width, height)).toBe(true);
    expect(hitTestLayer({ x: 960 - 190, y: 540 - 190 }, baseLayer, width, height)).toBe(true);

    // Outside bounds (center +/- 250)
    expect(hitTestLayer({ x: 960 + 250, y: 540 }, baseLayer, width, height)).toBe(false);
    expect(hitTestLayer({ x: 960, y: 540 + 250 }, baseLayer, width, height)).toBe(false);
  });

  it('hitTestLayer respects rotation when testing local space points', () => {
    // Rotated 90 degrees clockwise
    const rotatedLayer: CharacterLayer = {
      ...baseLayer,
      rotation: 90,
    };
    // Dimensions: 400 wide, 100 tall
    const width = 400;
    const height = 100;

    // In 0 deg, point (960, 540 - 150) is outside height ([-50..50]).
    // But in 90 deg, the 400-wide axis is now vertical!
    expect(hitTestLayer({ x: 960, y: 540 - 150 }, rotatedLayer, width, height)).toBe(true);
    // And horizontal point (960 + 150, 540) is now outside because 100-tall axis is now horizontal!
    expect(hitTestLayer({ x: 960 + 150, y: 540 }, rotatedLayer, width, height)).toBe(false);
  });

  it('findTopmostLayerAt picks highest zIndex layer when overlapping', () => {
    const layer1: CharacterLayer = { ...baseLayer, id: 'back-layer', zIndex: 1 };
    const layer2: CharacterLayer = { ...baseLayer, id: 'front-layer', zIndex: 10 };

    const dimsMap = new Map([
      ['asset-body', { width: 300, height: 300 }],
    ]);

    const top = findTopmostLayerAt({ x: 960, y: 540 }, [layer1, layer2], dimsMap);
    expect(top?.id).toBe('front-layer');
  });

  it('hitTestHandles detects clicks near handles', () => {
    const width = 200;
    const height = 200;

    // Top-left handle is at (960 - 100, 540 - 100) = (860, 440)
    const hit = hitTestHandles({ x: 861, y: 441 }, baseLayer, width, height, 10);
    expect(hit).toBe('top-left');

    // No handle at center
    expect(hitTestHandles({ x: 960, y: 540 }, baseLayer, width, height, 10)).toBeNull();
  });

  it('applyDragMove and nudgeLayer update coordinates', () => {
    const moved = applyDragMove(baseLayer, { x: 25, y: -10 });
    expect(moved.x).toBe(985);
    expect(moved.y).toBe(530);

    const nudged = nudgeLayer(baseLayer, -1, 10);
    expect(nudged.x).toBe(959);
    expect(nudged.y).toBe(550);
  });

  it('pointToLocalSpace translates and unrotates canvas point to local center coordinate', () => {
    // Unrotated layer
    const local1 = pointToLocalSpace({ x: 1000, y: 550 }, baseLayer);
    expect(local1.x).toBe(40);
    expect(local1.y).toBe(10);

    // 90 deg rotated layer
    const rotated: CharacterLayer = { ...baseLayer, rotation: 90 };
    const local2 = pointToLocalSpace({ x: 960, y: 500 }, rotated); // 40px above center
    expect(Math.round(local2.x)).toBe(-40);
    expect(local2.y).toBeCloseTo(0, 5);
  });

  it('applyHandleScale scales dimensions accurately', () => {
    const startCanvas = { x: 960 + 100, y: 540 };
    const currentCanvas = { x: 960 + 200, y: 540 }; // dragged right handle 100px further right

    const res = applyHandleScale(
      baseLayer,
      'right',
      startCanvas,
      currentCanvas,
      200,
      200,
      false
    );

    expect(res.scaleX).toBeGreaterThan(1);
    expect(res.scaleY).toBe(1);
  });

  it('applyHandleRotate computes angle from layer center to pointer', () => {
    // Straight right from center (960, 540) -> (1060, 540)
    // Canvas rotation handle is at top (0 deg is -Y axis), so right (+X) is 90 deg
    const angle = applyHandleRotate(baseLayer, { x: 1060, y: 540 });
    expect(angle).toBe(90);

    // Down from center (+Y) is 180 deg
    const angleDown = applyHandleRotate(baseLayer, { x: 960, y: 640 });
    expect(Math.abs(angleDown)).toBe(180);
  });

  it('screenToCanvas and canvasToScreen transform coordinates accurately', () => {
    const containerRect = { left: 100, top: 50, width: 1920, height: 1080 };
    const canvasPt = { x: 960, y: 540 };

    const screenPt = canvasToScreen(canvasPt, containerRect, 1920, 1080, 1, { x: 0, y: 0 });
    // Screen center should be left + width/2 = 100 + 960 = 1060
    expect(screenPt.x).toBe(1060);
    expect(screenPt.y).toBe(590);

    const backToCanvas = screenToCanvas(screenPt, containerRect, 1920, 1080, 1, { x: 0, y: 0 });
    expect(Math.round(backToCanvas.x)).toBe(960);
    expect(Math.round(backToCanvas.y)).toBe(540);
  });
});

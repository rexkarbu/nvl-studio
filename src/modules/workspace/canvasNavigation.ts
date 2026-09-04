export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  zoom: number; // 0.1 to 5.0 (1.0 = 100%)
  pan: Point;   // Pixel offset relative to viewport center
}

export const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
};

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

/**
 * Converts a screen coordinate (e.g. mouse event clientX/clientY)
 * into virtual canvas coordinates [0..virtualWidth, 0..virtualHeight].
 */
export function screenToCanvas(
  screenPoint: Point,
  containerRect: { left: number; top: number; width: number; height: number },
  virtualWidth: number = 1920,
  virtualHeight: number = 1080,
  zoom: number = 1,
  pan: Point = { x: 0, y: 0 }
): Point {
  // Base fit ratio (contain)
  const baseScale = Math.min(
    containerRect.width / virtualWidth,
    containerRect.height / virtualHeight
  );
  const totalScale = baseScale * zoom;

  const viewportCenterX = containerRect.width / 2 + pan.x;
  const viewportCenterY = containerRect.height / 2 + pan.y;

  const localX = screenPoint.x - containerRect.left;
  const localY = screenPoint.y - containerRect.top;

  const canvasX = (localX - viewportCenterX) / totalScale + virtualWidth / 2;
  const canvasY = (localY - viewportCenterY) / totalScale + virtualHeight / 2;

  return { x: canvasX, y: canvasY };
}

/**
 * Converts virtual canvas coordinates to screen coordinates relative to container.
 */
export function canvasToScreen(
  canvasPoint: Point,
  containerRect: { left: number; top: number; width: number; height: number },
  virtualWidth: number = 1920,
  virtualHeight: number = 1080,
  zoom: number = 1,
  pan: Point = { x: 0, y: 0 }
): Point {
  const baseScale = Math.min(
    containerRect.width / virtualWidth,
    containerRect.height / virtualHeight
  );
  const totalScale = baseScale * zoom;

  const viewportCenterX = containerRect.width / 2 + pan.x;
  const viewportCenterY = containerRect.height / 2 + pan.y;

  const localX = (canvasPoint.x - virtualWidth / 2) * totalScale + viewportCenterX;
  const localY = (canvasPoint.y - virtualHeight / 2) * totalScale + viewportCenterY;

  return {
    x: localX + containerRect.left,
    y: localY + containerRect.top,
  };
}

/**
 * Computes new zoom and adjusted pan offset centered around a specific screen point.
 */
export function zoomAroundScreenPoint(
  currentZoom: number,
  deltaZoom: number,
  screenPoint: Point,
  containerRect: { left: number; top: number; width: number; height: number },
  pan: Point,
  virtualWidth: number = 1920,
  virtualHeight: number = 1080
): ViewportState {
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + deltaZoom));
  if (nextZoom === currentZoom) {
    return { zoom: currentZoom, pan };
  }

  // Virtual point under the cursor before zoom
  const pointOnCanvas = screenToCanvas(
    screenPoint,
    containerRect,
    virtualWidth,
    virtualHeight,
    currentZoom,
    pan
  );

  // New pan offset so the same canvas point stays under screenPoint
  const baseScale = Math.min(
    containerRect.width / virtualWidth,
    containerRect.height / virtualHeight
  );
  const newTotalScale = baseScale * nextZoom;

  const localX = screenPoint.x - containerRect.left;
  const localY = screenPoint.y - containerRect.top;

  const newPanX = localX - (pointOnCanvas.x - virtualWidth / 2) * newTotalScale - containerRect.width / 2;
  const newPanY = localY - (pointOnCanvas.y - virtualHeight / 2) * newTotalScale - containerRect.height / 2;

  return {
    zoom: nextZoom,
    pan: { x: newPanX, y: newPanY },
  };
}

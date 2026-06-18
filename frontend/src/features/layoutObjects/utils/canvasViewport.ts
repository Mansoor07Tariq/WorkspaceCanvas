import { clamp } from "./coordinateHelpers";

/**
 * Local UI camera for the floor map. This is NEVER persisted to the backend
 * (PR 061). Layout object coordinates always remain in floor-map/world space;
 * only this viewport transforms how the world is drawn on screen.
 *
 *   screen = world * scale + offset
 *   world  = (screen - offset) / scale
 */
export interface CanvasViewport {
  scale: number;
  /** Stage x offset in screen px. */
  x: number;
  /** Stage y offset in screen px. */
  y: number;
}

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;
/** Multiplicative zoom step for a single wheel notch / button press. */
export const ZOOM_STEP = 1.15;

export const DEFAULT_VIEWPORT: CanvasViewport = { scale: 1, x: 0, y: 0 };

/** Clamp a scale value into the allowed zoom range. */
export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/**
 * Zoom by `factor` while keeping the world point currently under
 * (focusX, focusY) — screen coordinates — pinned to that same screen position.
 * Used for both cursor-anchored wheel zoom and centre-anchored button zoom.
 *
 * The scale is clamped first; if the clamp prevents any change the viewport is
 * returned with the new (equal) scale so callers stay idempotent at the limits.
 */
export function zoomAroundPoint(
  viewport: CanvasViewport,
  factor: number,
  focusX: number,
  focusY: number
): CanvasViewport {
  const newScale = clampScale(viewport.scale * factor);
  // World point under the focus, before zooming.
  const worldX = (focusX - viewport.x) / viewport.scale;
  const worldY = (focusY - viewport.y) / viewport.scale;
  return {
    scale: newScale,
    x: focusX - worldX * newScale,
    y: focusY - worldY * newScale,
  };
}

/**
 * Convert a wheel deltaY into a zoom factor. Scrolling up (negative deltaY)
 * zooms in; scrolling down zooms out. The magnitude is fixed per event so
 * trackpads and mice behave consistently.
 */
export function wheelZoomFactor(deltaY: number): number {
  return deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
}

/** Format a scale as an integer percentage string, e.g. 1 → "100%". */
export function formatZoomPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

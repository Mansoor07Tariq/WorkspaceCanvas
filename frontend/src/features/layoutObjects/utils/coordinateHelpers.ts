/**
 * Minimum allowed dimension for a layout object on the canvas.
 * The backend validates width/height > 0; we enforce a larger minimum in the UI.
 */
export const MIN_OBJECT_SIZE = 10;

/**
 * Logical canvas dimensions shared across canvas rendering and coordinate clamping.
 * These are the source of truth — FloorMapCanvas.tsx and FloorLayoutPage.tsx both
 * import from here so they cannot diverge.
 */
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 640;

/** Available grid sizes (px). */
export const CANVAS_GRID_SIZES = [10, 20, 40] as const;
/** Default grid size when the editor first opens. */
export const DEFAULT_GRID_SIZE = 20;

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Format a canvas coordinate number as a 2-decimal string for the backend
 * DecimalField API (e.g. 100.5 → "100.50").
 *
 * Returns "0.00" for NaN or non-finite values to avoid sending invalid data.
 */
export function formatCoordinate(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

// ─── Center / top-left conversion ────────────────────────────────────────────

/**
 * Convert a Konva Group's center-point position back to the top-left (x, y)
 * coordinates stored in the backend.
 *
 * PR 033+ renders each Group at the center of its bounding box:
 *   groupX = obj.x + width  / 2
 *   groupY = obj.y + height / 2
 *
 * This function reverses that offset.
 */
export function getTopLeftFromCenterPosition(
  centerX: number,
  centerY: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
  };
}

// ─── Patch builders ───────────────────────────────────────────────────────────

/**
 * Build the PATCH payload for a position-only move (drag / keyboard).
 */
export function buildMovePatch(x: number, y: number) {
  return {
    x: formatCoordinate(x),
    y: formatCoordinate(y),
  };
}

/**
 * Build the PATCH payload for a full transform (resize + rotate + position).
 */
export function buildTransformPatch(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
) {
  return {
    x: formatCoordinate(x),
    y: formatCoordinate(y),
    width: formatCoordinate(width),
    height: formatCoordinate(height),
    rotation: formatCoordinate(rotation),
  };
}

// ─── Transform result ─────────────────────────────────────────────────────────

/**
 * Calculate the corrected layout object dimensions after a Konva Transformer
 * operation.
 *
 * Konva Transformer changes a node's scaleX/scaleY rather than its width/height
 * directly. This helper converts scale back into absolute dimensions and
 * recalculates the top-left position from the node's new center.
 *
 * Usage sequence in a transformend handler:
 *   1. Read node.scaleX() / node.scaleY() into local variables.
 *   2. Reset node.scaleX(1) / node.scaleY(1) imperatively so that React's next
 *      render (which will pass the new width/height) does not double-apply the scale.
 *   3. Call calculateTransformResult with the saved scale values.
 *   4. Pass the returned x/y/width/height/rotation to the persistence callback.
 */
export function calculateTransformResult(
  centerX: number,
  centerY: number,
  oldWidth: number,
  oldHeight: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
  minSize = MIN_OBJECT_SIZE
): { x: number; y: number; width: number; height: number; rotation: number } {
  const newWidth = Math.max(minSize, oldWidth * scaleX);
  const newHeight = Math.max(minSize, oldHeight * scaleY);
  const { x, y } = getTopLeftFromCenterPosition(centerX, centerY, newWidth, newHeight);
  return { x, y, width: newWidth, height: newHeight, rotation };
}

// ─── Boundary clamping ────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to [min, max] inclusive.
 *
 * NaN inputs return min. Infinity/-Infinity are handled correctly by
 * Math.min/Math.max (Infinity clamps to max, -Infinity clamps to min).
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamp an object's top-left position so it stays within the canvas bounds.
 *
 * Uses the unrotated bounding box for simplicity. Precise rotated-boundary
 * collision is deferred to a later PR.
 *
 * When the object is wider/taller than the canvas it is anchored at 0 so it
 * at least remains partially visible.
 */
export function clampObjectPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: clamp(x, 0, Math.max(0, canvasWidth - width)),
    y: clamp(y, 0, Math.max(0, canvasHeight - height)),
  };
}

/**
 * Clamp object dimensions so the object does not exceed the canvas, then clamp
 * position. Returns updated x, y, width, and height.
 *
 * Used after a resize/transform to prevent objects from growing larger than the
 * canvas.
 */
export function clampObjectTransform(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  const clampedWidth = Math.min(width, canvasWidth);
  const clampedHeight = Math.min(height, canvasHeight);
  const { x: cx, y: cy } = clampObjectPosition(
    x,
    y,
    clampedWidth,
    clampedHeight,
    canvasWidth,
    canvasHeight
  );
  return { x: cx, y: cy, width: clampedWidth, height: clampedHeight };
}

// ─── Grid snapping ────────────────────────────────────────────────────────────

/**
 * Snap a single value to the nearest grid increment.
 *
 * - Returns 0 for non-finite value (NaN / Infinity).
 * - Returns value unchanged for non-finite or non-positive gridSize.
 * - Midpoints round up (standard JS Math.round behaviour, e.g. 10 on a 20 px
 *   grid snaps to 20 when the value is exactly 10).
 */
export function snapToGrid(value: number, gridSize: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(gridSize) || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap an object's top-left position (both axes) to the nearest grid point.
 */
export function snapObjectToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/**
 * Snap object dimensions to the nearest grid unit while respecting the minimum
 * allowed size.
 *
 * Snap is applied independently per axis; the result is never below minSize.
 */
export function snapSizeToGrid(
  width: number,
  height: number,
  gridSize: number,
  minSize = MIN_OBJECT_SIZE
): { width: number; height: number } {
  return {
    width: Math.max(minSize, snapToGrid(width, gridSize)),
    height: Math.max(minSize, snapToGrid(height, gridSize)),
  };
}

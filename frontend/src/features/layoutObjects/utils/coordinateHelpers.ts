/**
 * Minimum allowed dimension for a layout object on the canvas.
 * The backend validates width/height > 0; we enforce a larger minimum in the UI.
 */
export const MIN_OBJECT_SIZE = 10;

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

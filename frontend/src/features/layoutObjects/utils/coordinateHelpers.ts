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
 * PR 033 positions each Group at the center of its bounding box:
 *   groupX = obj.x + width  / 2
 *   groupY = obj.y + height / 2
 *
 * After a drag, e.target.x() / e.target.y() return the new center position.
 * This function reverses the offset to recover the top-left.
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

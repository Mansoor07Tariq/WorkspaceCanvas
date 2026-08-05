/**
 * Pure rotated-rectangle geometry shared by the canvas (drag/clamp/snap) and the
 * Tidy engine, so both reason about the SAME footprint for a rotated object.
 *
 * Every layout object is stored as an axis-aligned top-left rect (x, y, width,
 * height) plus a `rotation` in degrees, and Konva rotates it about its CENTRE.
 * These helpers compute the true rotated footprint. No Konva / React / IO.
 */

export interface RGRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RGPoint {
  x: number;
  y: number;
}

/** Local clamp (kept here so this module has no imports and cannot form a cycle). */
function clampNum(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Half-width/half-height of the axis-aligned bounding box that encloses a
 * `width × height` rectangle rotated by `rotationDeg` about its centre.
 *
 * This is EXACT for every angle (not a conservative envelope):
 *   hx = |w/2·cos θ| + |h/2·sin θ|
 *   hy = |w/2·sin θ| + |h/2·cos θ|
 * At 0° it is (w/2, h/2); at 90°/270° it is (h/2, w/2).
 */
export function rotatedAabbHalfExtents(
  width: number,
  height: number,
  rotationDeg: number
): { hx: number; hy: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    hx: (width / 2) * c + (height / 2) * s,
    hy: (width / 2) * s + (height / 2) * c,
  };
}

/** Centre point of a top-left rect. */
export function rectCenter(x: number, y: number, width: number, height: number): RGPoint {
  return { x: x + width / 2, y: y + height / 2 };
}

/**
 * The four corners of a top-left rect rotated `rotationDeg` about its centre,
 * in world coordinates, order: TL, TR, BR, BL (before rotation).
 */
export function rotatedCorners(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number
): RGPoint[] {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = width / 2;
  const hh = height / 2;
  const local = [
    { dx: -hw, dy: -hh },
    { dx: hw, dy: -hh },
    { dx: hw, dy: hh },
    { dx: -hw, dy: hh },
  ];
  return local.map(({ dx, dy }) => ({
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }));
}

/**
 * Axis-aligned bounding box (top-left form) of a rect rotated about its centre.
 * The AABB shares the rect's centre; its size is 2·(hx, hy).
 */
export function rotatedRectExtent(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number
): RGRect {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const { hx, hy } = rotatedAabbHalfExtents(width, height, rotationDeg);
  return { x: cx - hx, y: cy - hy, width: hx * 2, height: hy * 2 };
}

/**
 * Clamp the top-left (x, y) of a rect — rotated `rotationDeg` about its centre —
 * so its rotated bounding box stays fully inside `boundary`.
 *
 * Works in centre space (rotation is about the centre), then converts back to
 * the stored top-left. When the rotated box is larger than the boundary on an
 * axis the box's near edge is anchored to the boundary's near edge (so the object
 * stays visible and the range never inverts) — identical to the previous
 * unrotated clamp's oversize behaviour. At rotation 0 this is byte-for-byte the
 * old axis-aligned clamp.
 */
export function clampRotatedRectToBoundary(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
  boundary: RGRect
): RGPoint {
  const { hx, hy } = rotatedAabbHalfExtents(width, height, rotationDeg);
  const cx = x + width / 2;
  const cy = y + height / 2;

  const minCx = boundary.x + hx;
  const maxCx = boundary.x + boundary.width - hx;
  const minCy = boundary.y + hy;
  const maxCy = boundary.y + boundary.height - hy;

  // Math.max(min, max) so an oversize box (max < min) anchors its near edge to
  // the boundary's near edge rather than inverting the clamp range.
  const clampedCx = clampNum(cx, minCx, Math.max(minCx, maxCx));
  const clampedCy = clampNum(cy, minCy, Math.max(minCy, maxCy));

  return { x: clampedCx - width / 2, y: clampedCy - height / 2 };
}

/**
 * Pure fit-to-view geometry for the compact Today map hero (PR 079 fix-up). No React —
 * deterministic functions of their inputs so the "entire floor visible, scaled to fit both
 * dimensions, centred" behaviour is unit-tested directly.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface FitTransform {
  /** uniform scale so the whole bbox fits both container dimensions */
  scale: number;
  /** translation applied BEFORE scale-from-origin, so the content is centred */
  offsetX: number;
  offsetY: number;
}

/**
 * The bounding box that contains the floor boundary and every object rect, expanded by
 * `padding` on each side. This is the content the hero must show in full.
 */
export function contentBounds(boundary: Rect | null, rects: Rect[], padding = 0): BBox {
  const boxes: Rect[] = [];
  if (boundary) boxes.push(boundary);
  boxes.push(...rects);
  if (boxes.length === 0) {
    return { minX: 0, minY: 0, width: 1, height: 1 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * Scale + offset that fit `bbox` entirely inside `container` (both dimensions) and centre
 * it. `scale = min(cw/bw, ch/bh)` (the smaller ratio → nothing clips); the offsets centre
 * the scaled content and cancel a non-zero bbox origin. Apply as
 * `translate(offsetX, offsetY) scale(scale)` in content coordinates. Degenerate inputs →
 * identity (never NaN/Infinity).
 */
export function fitAndCenter(
  bbox: BBox,
  container: { width: number; height: number }
): FitTransform {
  if (bbox.width <= 0 || bbox.height <= 0 || container.width <= 0 || container.height <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(container.width / bbox.width, container.height / bbox.height);
  const offsetX = (container.width - bbox.width * scale) / 2 - bbox.minX * scale;
  const offsetY = (container.height - bbox.height * scale) / 2 - bbox.minY * scale;
  return { scale, offsetX, offsetY };
}

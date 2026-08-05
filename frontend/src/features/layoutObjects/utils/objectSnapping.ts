import type { LayoutObject, LayoutObjectType } from "../types/layoutObject.types";
import { rotatedAabbHalfExtents } from "./rotatedGeometry";

/**
 * Whether `obstacleType` blocks an object of `draggedType` from overlapping it.
 *
 * Everything blocks everything — including doors/windows, which a desk may not
 * sit on — with ONE exception: a wall carries its own doors/windows, so when the
 * dragged object is a wall, openings do not block it (otherwise a wall could not
 * sit under the very door mounted on it). Doors/windows themselves never reach
 * this path as the dragged object (they have their own on-wall slide handling).
 */
export function blocksDrag(draggedType: LayoutObjectType, obstacleType: LayoutObjectType): boolean {
  if (draggedType === "wall" && (obstacleType === "door" || obstacleType === "window")) {
    return false;
  }
  return true;
}

/**
 * How close (px) a dragged edge must be to a neighbour's edge to snap onto it.
 * Tuned to close the small gaps left by imperfect manual placement so objects
 * connect flush (e.g. a desk dropped a few px off a wall snaps onto it).
 */
export const NEIGHBOR_SNAP_THRESHOLD = 14;

/**
 * How close (px) another object must be, in BOTH axes, to count as "right beside"
 * the dragged object and act as an alignment target. Keeps far-away objects from
 * tugging the dragged one.
 */
export const NEIGHBOR_PROXIMITY = 40;

/** An alignment guide line to draw, in world coordinates. */
export interface SnapGuide {
  /** "x" → vertical line at `position` spanning [from, to] in y; "y" → horizontal. */
  axis: "x" | "y";
  position: number;
  from: number;
  to: number;
}

export interface NeighborSnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

interface Box {
  L: number;
  R: number;
  CX: number;
  T: number;
  B: number;
  CY: number;
}

/**
 * Rotation-aware AABB for a top-left box, using the shared exact rotated-extent
 * primitive (see rotatedGeometry.ts) so the canvas overlap/snap model and the
 * Tidy engine reason about the same footprint for a rotated object.
 */
function aabb(x: number, y: number, w: number, h: number, rotation: number): Box {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const { hx, hy } = rotatedAabbHalfExtents(w, h, rotation);
  return { L: cx - hx, R: cx + hx, CX: cx, T: cy - hy, B: cy + hy, CY: cy };
}

function boxOf(o: LayoutObject): Box | null {
  const w = parseFloat(o.width);
  const h = parseFloat(o.height);
  const x = parseFloat(o.x);
  const y = parseFloat(o.y);
  const rot = parseFloat(o.rotation) || 0;
  if (![w, h, x, y].every(Number.isFinite)) return null;
  return aabb(x, y, w, h, rot);
}

/**
 * Align a dragged object's top-left (x, y) to nearby objects so items placed
 * beside each other line up flush — matching design-tool smart guides, but only
 * for objects that are actually adjacent — and return the guide lines to draw.
 *
 * For each near neighbour we consider edge candidates on each axis (align
 * left/right/centre and butt-adjacent); the closest within `threshold` per axis
 * wins. Axes are independent, so a desk dropped to the right of another snaps
 * flush in X and aligns tops in Y at once. Guides mark every coincident edge
 * after snapping. Pure — no Konva, no IO.
 */
export function computeNeighborSnap(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  objects: LayoutObject[],
  excludeId: number,
  threshold: number = NEIGHBOR_SNAP_THRESHOLD,
  proximity: number = NEIGHBOR_PROXIMITY
): NeighborSnapResult {
  // The dragged object aligns by its rotated footprint (FE-4), not its stored
  // axis-aligned box: rotation is about the centre, so an edge candidate is
  // expressed as the resulting TOP-LEFT (centre ± hx/hy, then − w/2 / h/2). At
  // rotation 0 (hx = w/2, hy = h/2) every candidate below reduces to the old
  // axis-aligned value, so unrotated snapping is unchanged.
  const { hx, hy } = rotatedAabbHalfExtents(w, h, rotation);
  const halfW = w / 2;
  const halfH = h / 2;
  const cx = x + halfW;
  const cy = y + halfH;
  const left = cx - hx;
  const right = cx + hx;
  const top = cy - hy;
  const bottom = cy + hy;

  const neighbours: Box[] = [];
  for (const o of objects) {
    if (o.id === excludeId) continue;
    const b = boxOf(o);
    if (!b) continue;
    // Only neighbours close in BOTH axes count as "right beside" it.
    if (left > b.R + proximity || right < b.L - proximity) continue;
    if (top > b.B + proximity || bottom < b.T - proximity) continue;
    neighbours.push(b);
  }

  // Pass 1 — pick the closest snapping candidate on each axis (align-left,
  // align-right, align-centre, butt-after, butt-before), as a top-left value.
  let snapX = x;
  let bestDX = threshold + 1;
  let snapY = y;
  let bestDY = threshold + 1;
  for (const b of neighbours) {
    for (const candX of [
      b.L + hx - halfW,
      b.R - hx - halfW,
      b.CX - halfW,
      b.R + hx - halfW,
      b.L - hx - halfW,
    ]) {
      const d = Math.abs(candX - x);
      if (d < bestDX) {
        bestDX = d;
        snapX = candX;
      }
    }
    for (const candY of [
      b.T + hy - halfH,
      b.B - hy - halfH,
      b.CY - halfH,
      b.B + hy - halfH,
      b.T - hy - halfH,
    ]) {
      const d = Math.abs(candY - y);
      if (d < bestDY) {
        bestDY = d;
        snapY = candY;
      }
    }
  }

  // Pass 2 — with the snapped box, emit a guide at every coincident AABB edge.
  const EPS = 0.5;
  const scx = snapX + halfW;
  const scy = snapY + halfH;
  const self: Box = {
    L: scx - hx,
    R: scx + hx,
    CX: scx,
    T: scy - hy,
    B: scy + hy,
    CY: scy,
  };
  const xGuides = new Map<number, SnapGuide>();
  const yGuides = new Map<number, SnapGuide>();
  for (const b of neighbours) {
    for (const ex of [self.L, self.R, self.CX]) {
      for (const oex of [b.L, b.R, b.CX]) {
        if (Math.abs(ex - oex) > EPS) continue;
        const key = Math.round(ex);
        const g = xGuides.get(key) ?? { axis: "x", position: ex, from: self.T, to: self.B };
        g.from = Math.min(g.from, self.T, b.T);
        g.to = Math.max(g.to, self.B, b.B);
        xGuides.set(key, g);
      }
    }
    for (const ey of [self.T, self.B, self.CY]) {
      for (const oey of [b.T, b.B, b.CY]) {
        if (Math.abs(ey - oey) > EPS) continue;
        const key = Math.round(ey);
        const g = yGuides.get(key) ?? { axis: "y", position: ey, from: self.L, to: self.R };
        g.from = Math.min(g.from, self.L, b.L);
        g.to = Math.max(g.to, self.R, b.R);
        yGuides.set(key, g);
      }
    }
  }

  return { x: snapX, y: snapY, guides: [...xGuides.values(), ...yGuides.values()] };
}

/**
 * True when a box at (x, y, w, h) overlaps any object that blocks `draggedType`
 * (see `blocksDrag`). Edge-touching is allowed (strict inequality), so
 * flush-aligned neighbours do not count. Obstacles use their rotation-aware
 * bounding box, so a 90° lunch table / vertical wall is matched correctly.
 */
export function overlapsBlockingObject(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  objects: LayoutObject[],
  excludeId: number,
  draggedType: LayoutObjectType
): boolean {
  const self = aabb(x, y, w, h, rotation);
  for (const o of objects) {
    if (o.id === excludeId) continue;
    if (!blocksDrag(draggedType, o.object_type)) continue;
    const b = boxOf(o);
    if (!b) continue;
    if (self.L < b.R && self.R > b.L && self.T < b.B && self.B > b.T) return true;
  }
  return false;
}

/**
 * Resolve overlap by pushing the box out of any blocking object along the axis
 * of least penetration — i.e. it ends up flush against the side it came from
 * (drag from the left → placed on the left), instead of reverting. Iterates so a
 * push out of one object that lands on another keeps resolving. Best-effort: if
 * it cannot fully separate within a few passes it returns the last position.
 */
export function resolveOverlap(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  objects: LayoutObject[],
  excludeId: number,
  draggedType: LayoutObjectType
): { x: number; y: number } {
  const { hx: hw, hy: hh } = rotatedAabbHalfExtents(w, h, rotation);
  let cx = x + w / 2; // work in centre space (rotation is about the centre)
  let cy = y + h / 2;
  for (let iter = 0; iter < 8; iter++) {
    // Push out of the most-overlapping blocking object first.
    let worst: Box | null = null;
    let worstArea = 0;
    for (const o of objects) {
      if (o.id === excludeId) continue;
      if (!blocksDrag(draggedType, o.object_type)) continue;
      const b = boxOf(o);
      if (!b) continue;
      const ox = Math.min(cx + hw, b.R) - Math.max(cx - hw, b.L);
      const oy = Math.min(cy + hh, b.B) - Math.max(cy - hh, b.T);
      if (ox > 0 && oy > 0 && ox * oy > worstArea) {
        worstArea = ox * oy;
        worst = b;
      }
    }
    if (!worst) break;
    // Four ways out; take the smallest displacement (side it entered from). The
    // rotation-aware AABB (hw,hh) is moved flush against the obstacle's edge.
    const penLeft = cx + hw - worst.L; // → cx = worst.L - hw
    const penRight = worst.R - (cx - hw); // → cx = worst.R + hw
    const penUp = cy + hh - worst.T; // → cy = worst.T - hh
    const penDown = worst.B - (cy - hh); // → cy = worst.B + hh
    const min = Math.min(penLeft, penRight, penUp, penDown);
    if (min === penLeft) cx = worst.L - hw;
    else if (min === penRight) cx = worst.R + hw;
    else if (min === penUp) cy = worst.T - hh;
    else cy = worst.B + hh;
  }
  return { x: cx - w / 2, y: cy - h / 2 };
}

/**
 * Decide where a dropped object lands relative to blocking objects:
 *   - 0 overlaps → keep as-is.
 *   - exactly 1 overlap → push aside (flush to the side it came from).
 *   - 2+ overlaps, or a push that still overlaps → `reverted: true` (caller
 *     returns it to its pickup position).
 */
export function resolveDrop(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  objects: LayoutObject[],
  excludeId: number,
  draggedType: LayoutObjectType
): { x: number; y: number; reverted: boolean } {
  const self = aabb(x, y, w, h, rotation);
  let count = 0;
  for (const o of objects) {
    if (o.id === excludeId) continue;
    if (!blocksDrag(draggedType, o.object_type)) continue;
    const b = boxOf(o);
    if (!b) continue;
    if (self.L < b.R && self.R > b.L && self.T < b.B && self.B > b.T) count++;
  }
  if (count === 0) return { x, y, reverted: false };
  if (count >= 2) return { x, y, reverted: true };

  const r = resolveOverlap(x, y, w, h, rotation, objects, excludeId, draggedType);
  if (overlapsBlockingObject(r.x, r.y, w, h, rotation, objects, excludeId, draggedType)) {
    return { x, y, reverted: true };
  }
  return { x: r.x, y: r.y, reverted: false };
}

/** Top-left-only convenience wrapper (used on drag-end persistence). */
export function snapToNeighbors(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  objects: LayoutObject[],
  excludeId: number,
  threshold: number = NEIGHBOR_SNAP_THRESHOLD,
  proximity: number = NEIGHBOR_PROXIMITY
): { x: number; y: number } {
  const { x: sx, y: sy } = computeNeighborSnap(
    x,
    y,
    w,
    h,
    rotation,
    objects,
    excludeId,
    threshold,
    proximity
  );
  return { x: sx, y: sy };
}

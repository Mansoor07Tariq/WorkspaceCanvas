import type { LayoutObject } from "../types/layoutObject.types";
import type { FloorBoundary } from "./coordinateHelpers";

/** A plain axis-aligned rectangle (top-left + size). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPS = 0.01;

/** Pull the cutout objects out of a layout and parse them into rectangles. */
export function getCutoutRects(objects: LayoutObject[]): Rect[] {
  const out: Rect[] = [];
  for (const o of objects) {
    if (o.object_type !== "cutout") continue;
    const x = parseFloat(o.x);
    const y = parseFloat(o.y);
    const width = parseFloat(o.width);
    const height = parseFloat(o.height);
    if (![x, y, width, height].every(Number.isFinite)) continue;
    out.push({ x, y, width, height });
  }
  return out;
}

/**
 * Intersect each cutout with the boundary interior. A cutout only carves the part
 * that lies inside the room; the overhang (it is placed flush to a wall) is
 * ignored. Empty/degenerate intersections are dropped.
 */
export function clipCutoutsToBoundary(boundary: FloorBoundary, cutouts: Rect[]): Rect[] {
  const bx2 = boundary.x + boundary.width;
  const by2 = boundary.y + boundary.height;
  const out: Rect[] = [];
  for (const c of cutouts) {
    const x1 = Math.max(c.x, boundary.x);
    const y1 = Math.max(c.y, boundary.y);
    const x2 = Math.min(c.x + c.width, bx2);
    const y2 = Math.min(c.y + c.height, by2);
    if (x2 - x1 > EPS && y2 - y1 > EPS) {
      out.push({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
    }
  }
  return out;
}

/**
 * Snap a dragged cutout's edges to abut or align with other cutouts, so two
 * cutouts placed side by side touch exactly (and therefore merge into one carved
 * region with no wall between them). Each axis snaps to the nearest candidate
 * within `threshold`.
 */
export function snapCutoutToNeighbors(
  x: number,
  y: number,
  width: number,
  height: number,
  others: Rect[],
  threshold = 14
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  let bestDx = threshold;
  let bestDy = threshold;
  for (const o of others) {
    const ox2 = o.x + o.width;
    const oy2 = o.y + o.height;
    // abut (our left→their right, our right→their left) + align (edges flush)
    for (const v of [ox2, o.x - width, o.x, ox2 - width]) {
      const d = Math.abs(x - v);
      if (d < bestDx) {
        bestDx = d;
        nx = v;
      }
    }
    for (const v of [oy2, o.y - height, o.y, oy2 - height]) {
      const d = Math.abs(y - v);
      if (d < bestDy) {
        bestDy = d;
        ny = v;
      }
    }
  }
  return { x: nx, y: ny };
}

/**
 * Gap (px) up to which a floor sliver between two cutouts is "bridged" — carved
 * away too — so two cutouts placed side by side read as one cut with no wall
 * between them. Larger intentional gaps are kept as real floor (with walls).
 */
export const CUTOUT_BRIDGE_GAP = 48;

interface CarveGrid {
  xs: number[];
  ys: number[];
  /** carved[col][row] — true when the cell is removed from the floor. */
  carved: boolean[][];
}

/**
 * Coordinate-compress the boundary + cutout edges into a cell grid and mark each
 * cell carved/floor. Narrow floor slivers sandwiched between two carved cells
 * (gap ≤ `bridge`) are carved too, so adjacent cutouts merge into one region.
 */
function buildCarveGrid(boundary: FloorBoundary, cutouts: Rect[], bridge: number): CarveGrid {
  const clipped = clipCutoutsToBoundary(boundary, cutouts);
  const bx2 = boundary.x + boundary.width;
  const by2 = boundary.y + boundary.height;

  const xsSet = new Set<number>([boundary.x, bx2]);
  const ysSet = new Set<number>([boundary.y, by2]);
  for (const c of clipped) {
    xsSet.add(c.x);
    xsSet.add(c.x + c.width);
    ysSet.add(c.y);
    ysSet.add(c.y + c.height);
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const ys = [...ysSet].sort((a, b) => a - b);
  const ncols = xs.length - 1;
  const nrows = ys.length - 1;

  const carved: boolean[][] = [];
  for (let i = 0; i < ncols; i++) {
    carved[i] = [];
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < nrows; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      let inCut = false;
      for (const c of clipped) {
        if (cx > c.x && cx < c.x + c.width && cy > c.y && cy < c.y + c.height) {
          inCut = true;
          break;
        }
      }
      carved[i][j] = inCut;
    }
  }

  // Bridge narrow floor columns/rows that sit between two carved cells.
  for (let i = 1; i < ncols - 1; i++) {
    if (xs[i + 1] - xs[i] > bridge) continue;
    for (let j = 0; j < nrows; j++) {
      if (!carved[i][j] && carved[i - 1][j] && carved[i + 1][j]) carved[i][j] = true;
    }
  }
  for (let j = 1; j < nrows - 1; j++) {
    if (ys[j + 1] - ys[j] > bridge) continue;
    for (let i = 0; i < ncols; i++) {
      if (!carved[i][j] && carved[i][j - 1] && carved[i][j + 1]) carved[i][j] = true;
    }
  }

  return { xs, ys, carved };
}

/**
 * The carved-away cells as rectangles (for painting the floor cutouts), including
 * any bridged slivers — so the floor fill matches the rerouted walls exactly.
 */
export function computeFloorCarveRects(
  boundary: FloorBoundary,
  cutouts: Rect[],
  bridge: number = CUTOUT_BRIDGE_GAP
): Rect[] {
  const { xs, ys, carved } = buildCarveGrid(boundary, cutouts, bridge);
  const rects: Rect[] = [];
  for (let i = 0; i < carved.length; i++) {
    for (let j = 0; j < carved[i].length; j++) {
      if (carved[i][j]) {
        rects.push({ x: xs[i], y: ys[j], width: xs[i + 1] - xs[i], height: ys[j + 1] - ys[j] });
      }
    }
  }
  return rects;
}

/**
 * Compute the wall segments that frame the floor = boundary minus the cutouts.
 *
 * A wall sits on every cell edge separating a floor cell from a carved cell (or
 * the room exterior). Colinear contiguous edges on the same floor side merge into
 * one segment. Walls are offset OUTWARD (inner face flush with the floor edge),
 * exactly like the plain rectangular boundary walls — so adding a cutout never
 * shifts the existing walls and doors/windows on them stay aligned. Two cutouts
 * placed side by side share carved cells (and narrow gaps are bridged), so no wall
 * is drawn between them. With no cutouts this returns the four boundary walls,
 * pixel-identical to the simple rectangular case.
 */
export function computeFloorWallSegments(
  boundary: FloorBoundary,
  cutouts: Rect[],
  thickness: number,
  bridge: number = CUTOUT_BRIDGE_GAP
): Rect[] {
  const { xs, ys, carved } = buildCarveGrid(boundary, cutouts, bridge);
  const ncols = xs.length - 1;
  const nrows = ys.length - 1;
  const inside = (i: number, j: number) =>
    i >= 0 && i < ncols && j >= 0 && j < nrows && !carved[i][j];

  // Is the point (px, py) on a floor cell? Used to decide whether a wall end is at
  // a convex corner (corner square outside the floor → safe to extend & fill it)
  // or a concave one (corner square is floor → extending would overflow onto it).
  const cellIndex = (vals: number[], p: number) => {
    for (let k = 0; k < vals.length - 1; k++) if (p >= vals[k] && p < vals[k + 1]) return k;
    return -1;
  };
  const isFloorAt = (px: number, py: number) => {
    const i = cellIndex(xs, px);
    const j = cellIndex(ys, py);
    return i >= 0 && j >= 0 && !carved[i][j];
  };

  const t = thickness;
  const segs: Rect[] = [];

  // Vertical walls at x = xs[i]. side +1 = floor on the right (wall extends left),
  // −1 = floor on the left (wall extends right). Vertical walls are NOT extended
  // along y — the horizontal walls cover the corners.
  for (let i = 0; i <= ncols; i++) {
    let runStart = -1;
    let runSide = 0;
    const flush = (jEnd: number) => {
      if (runStart < 0) return;
      const x = runSide > 0 ? xs[i] - t : xs[i];
      segs.push({ x, y: ys[runStart], width: t, height: ys[jEnd] - ys[runStart] });
      runStart = -1;
      runSide = 0;
    };
    for (let j = 0; j < nrows; j++) {
      const left = inside(i - 1, j);
      const right = inside(i, j);
      const side = left === right ? 0 : right ? 1 : -1;
      if (side === 0) {
        flush(j);
      } else {
        if (runStart >= 0 && side !== runSide) flush(j);
        if (runStart < 0) {
          runStart = j;
          runSide = side;
        }
      }
    }
    flush(nrows);
  }

  // Horizontal walls at y = ys[j]. side +1 = floor below (wall extends up), −1 =
  // floor above (wall extends down). Each end is extended by `t` ONLY at a convex
  // corner (the corner square is outside the floor); at a concave corner the
  // extension is skipped so the wall never pokes onto the floor (desks/rooms).
  for (let j = 0; j <= nrows; j++) {
    let runStart = -1;
    let runSide = 0;
    const flush = (iEnd: number) => {
      if (runStart < 0) return;
      const y = runSide > 0 ? ys[j] - t : ys[j];
      const bandY = runSide > 0 ? ys[j] - t / 2 : ys[j] + t / 2;
      const extendL = !isFloorAt(xs[runStart] - t / 2, bandY);
      const extendR = !isFloorAt(xs[iEnd] + t / 2, bandY);
      const xL = extendL ? xs[runStart] - t : xs[runStart];
      const xR = extendR ? xs[iEnd] + t : xs[iEnd];
      segs.push({ x: xL, y, width: xR - xL, height: t });
      runStart = -1;
      runSide = 0;
    };
    for (let i = 0; i < ncols; i++) {
      const top = inside(i, j - 1);
      const bottom = inside(i, j);
      const side = top === bottom ? 0 : bottom ? 1 : -1;
      if (side === 0) {
        flush(i);
      } else {
        if (runStart >= 0 && side !== runSide) flush(i);
        if (runStart < 0) {
          runStart = i;
          runSide = side;
        }
      }
    }
    flush(ncols);
  }

  return segs;
}

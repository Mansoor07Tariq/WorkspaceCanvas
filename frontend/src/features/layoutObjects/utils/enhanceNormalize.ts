import {
  clampObjectToBoundary,
  formatCoordinate,
  MIN_OBJECT_SIZE,
  DEFAULT_FLOOR_BOUNDARY,
  type FloorBoundary,
} from "./coordinateHelpers";
import { clipCutoutsToBoundary, getCutoutRects, type Rect } from "./floorShape";
import type { LayoutObject } from "../types/layoutObject.types";

/**
 * Enhance normalization (auto-tidy) — runs when Enhance turns on and persists.
 * Desks only (for now).
 *
 *  • Desks within one grid cell (≤10px gap) and aligned connect into a run/grid,
 *    are equalized, and packed edge-to-edge. Desks further apart are left alone.
 *  • A run bounded by walls on BOTH ends is sized to fill the span exactly; a run
 *    touching one wall (or none) is equalized to the AVERAGE size of the run.
 *  • A run/lone desk close to a wall snaps flush to it, and nothing is left
 *    overlapping a wall or cutout (pushed back inside the floor).
 *  • Final safety pass: any desk that still overlaps another object or sits out of
 *    bounds is reverted to where it was.
 *
 * Works in screen-space AABBs, so 90/270 desks pack/align by their on-screen
 * footprint (height × width) and convert back to stored coords on output.
 * Non-desk objects (rooms, furniture, structure) are not touched.
 */

/** Max gap (px) between a desk run edge and a wall to snap flush / fill. */
export const SNAP_WALL_DIST = 20;
/** Max gap (px) between two desks to connect them — one 10px grid cell. */
export const CONNECT_GAP = 10;
/** Max perpendicular centre offset (px) for two desks to count as a row/column. */
export const ALIGN_TOL = 14;
/** One grid cell — desks stretch to a wall only across a gap smaller than this. */
export const GRID_CELL = 10;

const WORKSTATION_TYPES = new Set(["desk", "standing_desk", "hot_desk", "private_desk"]);

interface WRect {
  id: number;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

export interface NormalizationPatch {
  id: number;
  x: string;
  y: string;
  width: string;
  height: string;
  rotation: string;
}

function toWRect(o: LayoutObject): WRect | null {
  const x = parseFloat(o.x);
  const y = parseFloat(o.y);
  const w = parseFloat(o.width);
  const h = parseFloat(o.height);
  const rot = parseFloat(o.rotation) || 0;
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { id: o.id, type: o.object_type, x, y, w, h, rot };
}

const isQuarter = (rot: number) => rot === 90 || rot === 270;

/**
 * Screen-space axis-aligned footprint of a stored rect. For a 90/270 desk the
 * on-screen box is height × width (swapped), centred on the same point. The whole
 * engine works on these AABBs so rotated desks align/pack by what's actually drawn.
 */
function toScreenRect(s: WRect): WRect {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const w = isQuarter(s.rot) ? s.h : s.w;
  const h = isQuarter(s.rot) ? s.w : s.h;
  return { id: s.id, type: s.type, x: cx - w / 2, y: cy - h / 2, w, h, rot: s.rot };
}

/** Convert a screen-space AABB back to stored (x, y, width, height). */
function toStored(a: WRect): { x: number; y: number; width: number; height: number } {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const width = isQuarter(a.rot) ? a.h : a.w;
  const height = isQuarter(a.rot) ? a.w : a.h;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

function isPackableDesk(r: WRect): boolean {
  return (
    WORKSTATION_TYPES.has(r.type) && (r.rot === 0 || r.rot === 90 || r.rot === 180 || r.rot === 270)
  );
}

// ── Wall faces ────────────────────────────────────────────────────────────────

function verticalFaces(
  boundary: FloorBoundary,
  cutouts: Rect[],
  yTop: number,
  yBot: number
): number[] {
  const faces = [boundary.x, boundary.x + boundary.width];
  for (const c of cutouts) {
    if (c.y < yBot && c.y + c.height > yTop) faces.push(c.x, c.x + c.width);
  }
  return faces;
}

function horizontalFaces(
  boundary: FloorBoundary,
  cutouts: Rect[],
  xL: number,
  xR: number
): number[] {
  const faces = [boundary.y, boundary.y + boundary.height];
  for (const c of cutouts) {
    if (c.x < xR && c.x + c.width > xL) faces.push(c.y, c.y + c.height);
  }
  return faces;
}

function nearestBelowOrEqual(faces: number[], v: number, fallback: number): number {
  const cands = faces.filter((f) => f <= v + 0.5);
  return cands.length ? Math.max(...cands) : fallback;
}

function nearestAboveOrEqual(faces: number[], v: number, fallback: number): number {
  const cands = faces.filter((f) => f >= v - 0.5);
  return cands.length ? Math.min(...cands) : fallback;
}

// ── Keep a rect inside the floor and out of cutouts ────────────────────────────

function overlaps(r: WRect, c: Rect): boolean {
  return r.x < c.x + c.width && r.x + r.w > c.x && r.y < c.y + c.height && r.y + r.h > c.y;
}

/**
 * Does `r` interior-overlap any other object? Edge-touching (≤2px) is allowed, so
 * packed desks that sit flush are fine. Thin doors/windows on walls are ignored.
 */
function overlapsAnotherObject(r: WRect, all: WRect[]): boolean {
  const tol = 2;
  for (const o of all) {
    if (o.id === r.id || o.type === "door" || o.type === "window") continue;
    if (
      r.x + tol < o.x + o.w &&
      r.x + r.w - tol > o.x &&
      r.y + tol < o.y + o.h &&
      r.y + r.h - tol > o.y
    ) {
      return true;
    }
  }
  return false;
}

function clampInside(r: WRect, boundary: FloorBoundary, cutouts: Rect[]): void {
  let { x, y } = clampObjectToBoundary(r.x, r.y, r.w, r.h, boundary);
  r.x = x;
  r.y = y;
  for (const c of cutouts) {
    if (!overlaps(r, c)) continue;
    const penLeft = r.x + r.w - c.x; // shift left to exit
    const penRight = c.x + c.width - r.x; // shift right
    const penUp = r.y + r.h - c.y; // shift up
    const penDown = c.y + c.height - r.y; // shift down
    const min = Math.min(penLeft, penRight, penUp, penDown);
    if (min === penLeft) r.x = c.x - r.w;
    else if (min === penRight) r.x = c.x + c.width;
    else if (min === penUp) r.y = c.y - r.h;
    else r.y = c.y + c.height;
    ({ x, y } = clampObjectToBoundary(r.x, r.y, r.w, r.h, boundary));
    r.x = x;
    r.y = y;
  }
}

/** Snap a single rect flush against nearby boundary / cutout walls. */
function snapToWalls(r: WRect, boundary: FloorBoundary, cutouts: Rect[], dist: number): void {
  const bL = boundary.x;
  const bR = boundary.x + boundary.width;
  const bT = boundary.y;
  const bB = boundary.y + boundary.height;
  if (Math.abs(r.x - bL) <= dist) r.x = bL;
  else if (Math.abs(r.x + r.w - bR) <= dist) r.x = bR - r.w;
  if (Math.abs(r.y - bT) <= dist) r.y = bT;
  else if (Math.abs(r.y + r.h - bB) <= dist) r.y = bB - r.h;
  for (const c of cutouts) {
    if (r.y < c.y + c.height && r.y + r.h > c.y) {
      if (Math.abs(r.x - (c.x + c.width)) <= dist) r.x = c.x + c.width;
      else if (Math.abs(r.x + r.w - c.x) <= dist) r.x = c.x - r.w;
    }
    if (r.x < c.x + c.width && r.x + r.w > c.x) {
      if (Math.abs(r.y - (c.y + c.height)) <= dist) r.y = c.y + c.height;
      else if (Math.abs(r.y + r.h - c.y) <= dist) r.y = c.y - r.h;
    }
  }
  clampInside(r, boundary, cutouts);
}

// ── Desk clustering ────────────────────────────────────────────────────────────

function adjacent(a: WRect, b: WRect): boolean {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
  const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
  // Aligned on one axis and within the connect gap (overlaps allowed) on the other.
  const rowAdj = Math.abs(acy - bcy) <= ALIGN_TOL && gapX <= CONNECT_GAP;
  const colAdj = Math.abs(acx - bcx) <= ALIGN_TOL && gapY <= CONNECT_GAP;
  return rowAdj || colAdj;
}

function clusterDesks(desks: WRect[]): WRect[][] {
  const parent = desks.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < desks.length; i++) {
    for (let j = i + 1; j < desks.length; j++) {
      if (adjacent(desks[i], desks[j])) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, WRect[]>();
  desks.forEach((d, i) => {
    const root = find(i);
    const g = groups.get(root) ?? [];
    g.push(d);
    groups.set(root, g);
  });
  return [...groups.values()];
}

/** Common desk size for a run: the AVERAGE width/height of its desks. */
function standardSize(cluster: WRect[]): { w: number; h: number } {
  const n = cluster.length;
  const w = cluster.reduce((s, d) => s + d.w, 0) / n;
  const h = cluster.reduce((s, d) => s + d.h, 0) / n;
  return { w, h };
}

/** Split a cluster into rows by centre-Y. */
function groupRows(cluster: WRect[]): WRect[][] {
  const sorted = [...cluster].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: WRect[][] = [];
  for (const d of sorted) {
    const cy = d.y + d.h / 2;
    const row = rows.find((r) => Math.abs(r[0].y + r[0].h / 2 - cy) <= ALIGN_TOL);
    if (row) row.push(d);
    else rows.push([d]);
  }
  return rows;
}

/** Where a run of `n` items of length `stdLen` starts and how long each is. */
/**
 * Decide a run's layout within the walls bounding it. Returns the start position,
 * each item's length, and the gap between items (0 = touching). "Smart" fill:
 *  • doesn't fit at normal size → shrink to fill (touching);
 *  • anchored to a wall and the leftover is a reasonable niche → stretch to fill
 *    if items stay ≤ MAX_FILL_RATIO× normal, otherwise keep normal size and space
 *    them evenly (equal aisles);
 *  • otherwise (open floor) → snap to the near wall, or keep position, touching.
 */
function fitRun(
  n: number,
  stdLen: number,
  lowWall: number,
  highWall: number,
  lowEdge: number,
  highEdge: number
): { start: number; each: number; gap: number } {
  const lowGap = lowEdge - lowWall;
  const highGap = highWall - highEdge;
  const span = highWall - lowWall;
  const needed = n * stdLen;

  // Doesn't fit at normal size → shrink to fill the span (touching).
  if (span <= needed) return { start: lowWall, each: Math.max(MIN_OBJECT_SIZE, span / n), gap: 0 };

  // Bounded by walls on BOTH sides within a grid cell (<10px) → stretch to fill
  // the span exactly (closes the tiny gaps by widening the desks slightly).
  const reachLow = lowGap >= -0.5 && lowGap < GRID_CELL;
  const reachHigh = highGap >= -0.5 && highGap < GRID_CELL;
  if (reachLow && reachHigh) return { start: lowWall, each: span / n, gap: 0 };

  // Otherwise just snap the whole run flush to a near wall (≤ SNAP), no resizing.
  if (lowGap <= SNAP_WALL_DIST) return { start: lowWall, each: stdLen, gap: 0 };
  if (highGap <= SNAP_WALL_DIST) return { start: highWall - needed, each: stdLen, gap: 0 };
  return { start: lowEdge, each: stdLen, gap: 0 };
}

function normalizeRow(
  row: WRect[],
  std: { w: number; h: number },
  boundary: FloorBoundary,
  cutouts: Rect[]
): void {
  row.sort((a, b) => a.x - b.x);
  const n = row.length;
  const cy = row.reduce((s, d) => s + d.y + d.h / 2, 0) / n;
  const minX = row[0].x;
  const maxX = row[n - 1].x + row[n - 1].w;
  const vf = verticalFaces(boundary, cutouts, cy - std.h / 2, cy + std.h / 2);
  const leftWall = nearestBelowOrEqual(vf, minX, boundary.x);
  const rightWall = nearestAboveOrEqual(vf, maxX, boundary.x + boundary.width);
  const { start, each, gap } = fitRun(n, std.w, leftWall, rightWall, minX, maxX);

  let top = cy - std.h / 2;
  const hf = horizontalFaces(boundary, cutouts, start, start + (each + gap) * n);
  const topWall = nearestBelowOrEqual(hf, top, boundary.y);
  const botWall = nearestAboveOrEqual(hf, top + std.h, boundary.y + boundary.height);
  if (top - topWall <= SNAP_WALL_DIST) top = topWall;
  else if (botWall - (top + std.h) <= SNAP_WALL_DIST) top = botWall - std.h;

  let x = start;
  for (const d of row) {
    d.w = each;
    d.h = std.h;
    d.x = x;
    d.y = top;
    clampInside(d, boundary, cutouts);
    x += each + gap; // step by intended stride (keeps even spacing)
  }
}

function normalizeColumn(
  col: WRect[],
  std: { w: number; h: number },
  boundary: FloorBoundary,
  cutouts: Rect[]
): void {
  col.sort((a, b) => a.y - b.y);
  const n = col.length;
  const cx = col.reduce((s, d) => s + d.x + d.w / 2, 0) / n;
  const minY = col[0].y;
  const maxY = col[n - 1].y + col[n - 1].h;
  const hf = horizontalFaces(boundary, cutouts, cx - std.w / 2, cx + std.w / 2);
  const topWall = nearestBelowOrEqual(hf, minY, boundary.y);
  const botWall = nearestAboveOrEqual(hf, maxY, boundary.y + boundary.height);
  const { start, each, gap } = fitRun(n, std.h, topWall, botWall, minY, maxY);

  let left = cx - std.w / 2;
  const vf = verticalFaces(boundary, cutouts, start, start + (each + gap) * n);
  const leftWall = nearestBelowOrEqual(vf, left, boundary.x);
  const rightWall = nearestAboveOrEqual(vf, left + std.w, boundary.x + boundary.width);
  if (left - leftWall <= SNAP_WALL_DIST) left = leftWall;
  else if (rightWall - (left + std.w) <= SNAP_WALL_DIST) left = rightWall - std.w;

  let y = start;
  for (const d of col) {
    d.w = std.w;
    d.h = each;
    d.x = left;
    d.y = y;
    clampInside(d, boundary, cutouts);
    y += each + gap; // step by intended stride (keeps even spacing)
  }
}

function normalizeGrid(
  rows: WRect[][],
  std: { w: number; h: number },
  boundary: FloorBoundary,
  cutouts: Rect[]
): void {
  const all = rows.flat();
  const leftEdge = Math.min(...all.map((d) => d.x));
  const topEdge = Math.min(...all.map((d) => d.y));
  const rightEdge = Math.max(...all.map((d) => d.x + d.w));
  const botEdge = Math.max(...all.map((d) => d.y + d.h));

  const vf = verticalFaces(boundary, cutouts, topEdge, botEdge);
  const hf = horizontalFaces(boundary, cutouts, leftEdge, rightEdge);
  let leftX = nearestBelowOrEqual(vf, leftEdge, boundary.x);
  let topY = nearestBelowOrEqual(hf, topEdge, boundary.y);
  if (leftEdge - leftX > SNAP_WALL_DIST) leftX = leftEdge; // not near a wall → keep
  if (topEdge - topY > SNAP_WALL_DIST) topY = topEdge;

  rows.sort((a, b) => a[0].y + a[0].h / 2 - (b[0].y + b[0].h / 2));
  let y = topY;
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let x = leftX;
    for (const d of row) {
      d.w = std.w;
      d.h = std.h;
      d.x = x;
      d.y = y;
      clampInside(d, boundary, cutouts);
      x = d.x + std.w;
    }
    y += std.h;
  }
}

function normalizeCluster(cluster: WRect[], boundary: FloorBoundary, cutouts: Rect[]): void {
  const std = standardSize(cluster);
  const rows = groupRows(cluster);
  if (rows.length === 1) {
    normalizeRow(rows[0], std, boundary, cutouts);
  } else if (rows.every((r) => r.length === 1)) {
    normalizeColumn(cluster, std, boundary, cutouts);
  } else {
    normalizeGrid(rows, std, boundary, cutouts);
  }
}

const isAxisAlignedWall = (r: WRect) =>
  r.type === "wall" && (r.rot === 0 || r.rot === 90 || r.rot === 180 || r.rot === 270);

/**
 * Extend an inner wall's ends to connect to a nearby wall when the gap is under a
 * grid cell (<10px). Targets: the boundary, cutout edges, and perpendicular inner
 * walls. Closes the small gaps so partitions read as joined. Works on AABBs.
 */
function extendWallEnds(w: WRect, walls: WRect[], boundary: FloorBoundary, cutouts: Rect[]): void {
  const reachable = (gap: number) => gap > 0.5 && gap < GRID_CELL;
  if (w.w >= w.h) {
    // Horizontal wall — extend left/right to perpendicular (vertical) faces.
    const yTop = w.y;
    const yBot = w.y + w.h;
    const faces = [boundary.x, boundary.x + boundary.width];
    for (const c of cutouts)
      if (c.y < yBot && c.y + c.height > yTop) faces.push(c.x, c.x + c.width);
    for (const o of walls) {
      if (o.id === w.id || o.w >= o.h) continue; // only vertical walls are targets
      if (o.y < yBot && o.y + o.h > yTop) faces.push(o.x, o.x + o.w);
    }
    const left = w.x;
    const lowCands = faces.filter((f) => f <= left && reachable(left - f));
    if (lowCands.length) {
      const f = Math.max(...lowCands);
      w.w += w.x - f;
      w.x = f;
    }
    const right = w.x + w.w;
    const highCands = faces.filter((f) => f >= right && reachable(f - right));
    if (highCands.length) w.w = Math.min(...highCands) - w.x;
  } else {
    // Vertical wall — extend top/bottom to perpendicular (horizontal) faces.
    const xL = w.x;
    const xR = w.x + w.w;
    const faces = [boundary.y, boundary.y + boundary.height];
    for (const c of cutouts) if (c.x < xR && c.x + c.width > xL) faces.push(c.y, c.y + c.height);
    for (const o of walls) {
      if (o.id === w.id || o.h >= o.w) continue; // only horizontal walls are targets
      if (o.x < xR && o.x + o.w > xL) faces.push(o.y, o.y + o.h);
    }
    const top = w.y;
    const lowCands = faces.filter((f) => f <= top && reachable(top - f));
    if (lowCands.length) {
      const f = Math.max(...lowCands);
      w.h += w.y - f;
      w.y = f;
    }
    const bot = w.y + w.h;
    const highCands = faces.filter((f) => f >= bot && reachable(f - bot));
    if (highCands.length) w.h = Math.min(...highCands) - w.y;
  }
}

/**
 * Compute the tidy-up patches for a layout. Returns one patch per object that
 * actually changed. Pure — no I/O.
 */
export function computeEnhanceNormalization(
  objects: LayoutObject[],
  boundary: FloorBoundary = DEFAULT_FLOOR_BOUNDARY,
  cutoutsInput?: Rect[]
): NormalizationPatch[] {
  const cutouts = clipCutoutsToBoundary(boundary, cutoutsInput ?? getCutoutRects(objects));

  // The whole engine works on screen-space AABBs (so 90/270 desks pack by what's
  // drawn); positions convert back to stored coords on output.
  const originals = new Map<number, WRect>();
  const rects: WRect[] = [];
  for (const o of objects) {
    const s = toWRect(o);
    if (!s) continue;
    const r = toScreenRect(s);
    originals.set(o.id, { ...r });
    rects.push(r);
  }

  // Run the tidy pass repeatedly until it reaches a fixed point (no further
  // change), so steps that interact (snap → equalize → safety-revert) settle.
  // Capped to avoid an infinite loop if anything oscillates.
  const snapshot = () =>
    rects
      .map((r) => `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.w.toFixed(2)},${r.h.toFixed(2)}`)
      .join("|");
  const desks = rects.filter(isPackableDesk);
  const walls = rects.filter(isAxisAlignedWall);
  for (let iter = 0; iter < 6; iter++) {
    const before = snapshot();

    // 0) Connect inner walls to nearby walls by closing sub-grid-cell gaps.
    for (const w of walls) extendWallEnds(w, walls, boundary, cutouts);

    // 1) Equalize + arrange every connected desk group (row / column / grid).
    const handled = new Set<number>();
    for (const cluster of clusterDesks(desks)) {
      if (cluster.length >= 2) {
        cluster.forEach((d) => handled.add(d.id));
        normalizeCluster(cluster, boundary, cutouts);
      }
    }

    // 2) Lone desks snap to a nearby wall (kept inside the floor / out of cutouts).
    for (const r of desks) {
      if (handled.has(r.id)) continue;
      snapToWalls(r, boundary, cutouts, SNAP_WALL_DIST);
    }

    // 3) Safety: a desk must not end up overlapping another object or out of
    //    bounds. clampInside already keeps it in the floor; if it still overlaps
    //    anything, revert it so Enhance never introduces an overlap.
    for (const r of desks) {
      if (overlapsAnotherObject(r, rects)) {
        const o = originals.get(r.id);
        if (o) {
          r.x = o.x;
          r.y = o.y;
          r.w = o.w;
          r.h = o.h;
        }
      }
    }

    if (snapshot() === before) break; // converged
  }

  // 4) Emit patches for anything that moved/resized.
  const patches: NormalizationPatch[] = [];
  for (const r of rects) {
    const o = originals.get(r.id);
    if (!o) continue;
    const changed =
      Math.abs(o.x - r.x) > 0.5 ||
      Math.abs(o.y - r.y) > 0.5 ||
      Math.abs(o.w - r.w) > 0.5 ||
      Math.abs(o.h - r.h) > 0.5;
    if (!changed) continue;
    const s = toStored(r);
    patches.push({
      id: r.id,
      x: formatCoordinate(s.x),
      y: formatCoordinate(s.y),
      width: formatCoordinate(s.width),
      height: formatCoordinate(s.height),
      rotation: formatCoordinate(r.rot),
    });
  }
  return patches;
}

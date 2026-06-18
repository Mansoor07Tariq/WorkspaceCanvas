import {
  DEFAULT_FLOOR_BOUNDARY,
  BOUNDARY_WALL_THICKNESS,
  MIN_OBJECT_SIZE,
  type FloorBoundary,
} from "./coordinateHelpers";
import { getDefaultSizeForObjectType } from "./layoutObjectLibrary";
import type { LayoutObject, LayoutObjectType } from "../types/layoutObject.types";

/**
 * Object types that are placed ON a wall (boundary wall or user `wall` object)
 * via hover-to-place, rather than through the manual create form.
 */
export const WALL_MOUNTED_TYPES: ReadonlySet<LayoutObjectType> = new Set<LayoutObjectType>([
  "door",
  "window",
]);

export function isWallMountedType(type: string): type is LayoutObjectType {
  return WALL_MOUNTED_TYPES.has(type as LayoutObjectType);
}

/**
 * A wall a door/window can snap onto, reduced to its centreline so the same
 * projection math serves both the system boundary walls and arbitrary user
 * `wall` objects (any position/rotation).
 *
 * - `angleDeg` is the direction of the wall's long axis (0 = horizontal).
 * - `length` is the span along that axis; `thickness` is the cross dimension.
 */
export interface SnapWall {
  centerX: number;
  centerY: number;
  length: number;
  thickness: number;
  angleDeg: number;
}

export interface WallPlacement {
  /** Centre of the door/window in world coordinates. */
  centerX: number;
  centerY: number;
  /** Rotation (deg) aligning the long axis with the wall. */
  angleDeg: number;
  /** The host wall's thickness, so the opening sits flush over the wall. */
  thickness: number;
}

/** Extra hover slop (px) around a wall's band so it is easy to target. */
const HOVER_TOLERANCE = 14;

/**
 * The four boundary walls as centreline descriptors. The walls are drawn
 * extending OUTWARD from the boundary (thickness `t`), so each centreline sits
 * at the wall's visual centre — half a thickness outside the boundary edge — and
 * a door/window placed on it lands flush over the wall.
 */
export function getBoundaryWalls(boundary: FloorBoundary = DEFAULT_FLOOR_BOUNDARY): SnapWall[] {
  const t = BOUNDARY_WALL_THICKNESS;
  const half = t / 2;
  const midX = boundary.x + boundary.width / 2;
  const midY = boundary.y + boundary.height / 2;
  return [
    // top
    {
      centerX: midX,
      centerY: boundary.y - half,
      length: boundary.width,
      thickness: t,
      angleDeg: 0,
    },
    // bottom
    {
      centerX: midX,
      centerY: boundary.y + boundary.height + half,
      length: boundary.width,
      thickness: t,
      angleDeg: 0,
    },
    // left
    {
      centerX: boundary.x - half,
      centerY: midY,
      length: boundary.height,
      thickness: t,
      angleDeg: 90,
    },
    // right
    {
      centerX: boundary.x + boundary.width + half,
      centerY: midY,
      length: boundary.height,
      thickness: t,
      angleDeg: 90,
    },
  ];
}

/** Build a centreline descriptor from a single user `wall` object (or null). */
export function userWallToSnapWall(obj: LayoutObject): SnapWall | null {
  if (obj.object_type !== "wall") return null;
  const x = parseFloat(obj.x);
  const y = parseFloat(obj.y);
  const w = parseFloat(obj.width);
  const h = parseFloat(obj.height);
  const rotation = parseFloat(obj.rotation) || 0;
  if (![x, y, w, h].every(Number.isFinite)) return null;
  const landscape = w >= h;
  return {
    centerX: x + w / 2,
    centerY: y + h / 2,
    length: landscape ? w : h,
    thickness: landscape ? h : w,
    angleDeg: landscape ? rotation : rotation + 90,
  };
}

/** User-placed `wall` layout objects as centreline descriptors. */
export function getUserWalls(objects: LayoutObject[]): SnapWall[] {
  const walls: SnapWall[] = [];
  for (const obj of objects) {
    const sw = userWallToSnapWall(obj);
    if (sw) walls.push(sw);
  }
  return walls;
}

/**
 * Map a mounted opening through a wall's transform so it scales/rotates with the
 * wall (one entity). The opening's offset and size in the wall's local frame are
 * scaled by the wall's per-axis size change and re-placed under the new wall.
 *
 * `oldWall` is the wall before the transform; `newWall` is its new top-left box +
 * rotation. Returns the opening's new top-left box + rotation.
 */
export function transformOpeningWithWall(
  oldWall: LayoutObject,
  opening: LayoutObject,
  newWall: { x: number; y: number; width: number; height: number; rotation: number }
): { x: number; y: number; width: number; height: number; rotation: number } {
  const ow = parseFloat(oldWall.width);
  const oh = parseFloat(oldWall.height);
  const oRot = parseFloat(oldWall.rotation) || 0;
  const oCx = parseFloat(oldWall.x) + ow / 2;
  const oCy = parseFloat(oldWall.y) + oh / 2;
  const nCx = newWall.x + newWall.width / 2;
  const nCy = newWall.y + newWall.height / 2;
  const sx = ow !== 0 ? newWall.width / ow : 1;
  const sy = oh !== 0 ? newWall.height / oh : 1;

  const opw = parseFloat(opening.width);
  const oph = parseFloat(opening.height);
  const opCx = parseFloat(opening.x) + opw / 2;
  const opCy = parseFloat(opening.y) + oph / 2;

  // Opening centre → wall's OLD local frame (un-rotate), scale, → new world.
  const r1 = (-oRot * Math.PI) / 180;
  const c1 = Math.cos(r1);
  const s1 = Math.sin(r1);
  let lx = (opCx - oCx) * c1 - (opCy - oCy) * s1;
  let ly = (opCx - oCx) * s1 + (opCy - oCy) * c1;
  lx *= sx;
  ly *= sy;
  const r2 = (newWall.rotation * Math.PI) / 180;
  const c2 = Math.cos(r2);
  const s2 = Math.sin(r2);
  const nOpCx = nCx + lx * c2 - ly * s2;
  const nOpCy = nCy + lx * s2 + ly * c2;

  const nOpW = opw * sx;
  const nOpH = oph * sy;
  const nOpRot = (parseFloat(opening.rotation) || 0) + (newWall.rotation - oRot);
  return { x: nOpCx - nOpW / 2, y: nOpCy - nOpH / 2, width: nOpW, height: nOpH, rotation: nOpRot };
}

/**
 * Door/window objects currently mounted on `wall` (centre on its footprint).
 * Used to move openings together with their wall.
 */
export function attachedOpenings(wall: LayoutObject, objects: LayoutObject[]): LayoutObject[] {
  const sw = userWallToSnapWall(wall);
  if (!sw) return [];
  const out: LayoutObject[] = [];
  for (const o of objects) {
    if (o.object_type !== "door" && o.object_type !== "window") continue;
    const ow = parseFloat(o.width);
    const oh = parseFloat(o.height);
    const cx = parseFloat(o.x) + ow / 2;
    const cy = parseFloat(o.y) + oh / 2;
    if (![ow, oh, cx, cy].every(Number.isFinite)) continue;
    if (Math.abs(projectPerp(sw, cx, cy)) > sw.thickness / 2 + 4) continue;
    if (Math.abs(projectAlong(sw, cx, cy)) > sw.length / 2 + 4) continue;
    out.push(o);
  }
  return out;
}

/** All walls a door/window may snap to: boundary + user walls. */
export function getSnapWalls(
  objects: LayoutObject[],
  boundary: FloorBoundary = DEFAULT_FLOOR_BOUNDARY
): SnapWall[] {
  return [...getBoundaryWalls(boundary), ...getUserWalls(objects)];
}

/**
 * Project a world pointer onto the nearest wall and return the snapped
 * placement (centre + rotation), or null when the pointer is not over any wall.
 *
 * `mountLength` is the door/window's span along the wall — the placement is
 * clamped so the whole opening stays within the wall (centred if it is longer
 * than the wall).
 */
export function snapToWall(
  pointerX: number,
  pointerY: number,
  walls: SnapWall[],
  mountLength: number
): WallPlacement | null {
  let best: WallPlacement | null = null;
  let bestPerp = Infinity;

  for (const wall of walls) {
    const rad = (wall.angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = pointerX - wall.centerX;
    const dy = pointerY - wall.centerY;
    // Pointer in the wall's local frame.
    const along = dx * cos + dy * sin;
    const perp = -dx * sin + dy * cos;
    const perpDist = Math.abs(perp);

    const withinBand = perpDist <= wall.thickness / 2 + HOVER_TOLERANCE;
    const withinLength = Math.abs(along) <= wall.length / 2 + HOVER_TOLERANCE;
    if (!withinBand || !withinLength) continue;
    if (perpDist >= bestPerp) continue;

    // Clamp the opening so it stays on the wall (centre it if it overflows).
    const halfFree = Math.max(0, (wall.length - mountLength) / 2);
    const alongClamped = Math.max(-halfFree, Math.min(halfFree, along));

    bestPerp = perpDist;
    best = {
      centerX: wall.centerX + alongClamped * cos,
      centerY: wall.centerY + alongClamped * sin,
      angleDeg: wall.angleDeg,
      thickness: wall.thickness,
    };
  }

  return best;
}

/**
 * Convert a wall placement into the layout-object fields. The stored box is the
 * unrotated (length × wall-thickness) rectangle centred on the placement so the
 * opening sits flush over the wall; `rotation` aligns it to the wall (the canvas
 * renders each object about its centre).
 */
export function placementToObjectFields(
  placement: WallPlacement,
  mountLength: number
): { x: number; y: number; width: number; height: number; rotation: number } {
  return {
    x: placement.centerX - mountLength / 2,
    y: placement.centerY - placement.thickness / 2,
    width: mountLength,
    height: placement.thickness,
    rotation: placement.angleDeg,
  };
}

/**
 * The on-wall span (`length`) and cross dimension (`thickness`) for a
 * wall-mounted type, derived from its library default size (long edge runs along
 * the wall).
 */
export function getMountDimensions(type: LayoutObjectType): { length: number; thickness: number } {
  const { width, height } = getDefaultSizeForObjectType(type);
  return { length: Math.max(width, height), thickness: Math.min(width, height) };
}

// ── Sliding a placed door/window along its wall (no overlap) ────────────────

function wallAxis(wall: SnapWall): { cos: number; sin: number } {
  const rad = (wall.angleDeg * Math.PI) / 180;
  return { cos: Math.cos(rad), sin: Math.sin(rad) };
}

/** Signed offset of (x,y) along the wall's long axis from its centre. */
export function projectAlong(wall: SnapWall, x: number, y: number): number {
  const { cos, sin } = wallAxis(wall);
  return (x - wall.centerX) * cos + (y - wall.centerY) * sin;
}

/** Perpendicular distance of (x,y) from the wall's centreline. */
export function projectPerp(wall: SnapWall, x: number, y: number): number {
  const { cos, sin } = wallAxis(wall);
  return -(x - wall.centerX) * sin + (y - wall.centerY) * cos;
}

/** World point on the wall's centreline at the given along offset. */
export function pointOnWall(wall: SnapWall, along: number): { x: number; y: number } {
  const { cos, sin } = wallAxis(wall);
  return { x: wall.centerX + along * cos, y: wall.centerY + along * sin };
}

/** The wall whose centreline (x,y) is closest to / on, or null if none. */
export function nearestWall(walls: SnapWall[], x: number, y: number): SnapWall | null {
  let best: SnapWall | null = null;
  let bestPerp = Infinity;
  for (const w of walls) {
    const perp = Math.abs(projectPerp(w, x, y));
    if (perp > w.thickness / 2 + HOVER_TOLERANCE) continue;
    if (Math.abs(projectAlong(w, x, y)) > w.length / 2 + HOVER_TOLERANCE) continue;
    if (perp < bestPerp) {
      bestPerp = perp;
      best = w;
    }
  }
  return best;
}

export interface AlongInterval {
  min: number;
  max: number;
}

/** Along-axis intervals occupied by other openings already on `wall`. */
export function openingsOnWall(
  wall: SnapWall,
  objects: LayoutObject[],
  excludeId: number
): AlongInterval[] {
  const out: AlongInterval[] = [];
  for (const obj of objects) {
    if (obj.id === excludeId) continue;
    if (!WALL_MOUNTED_TYPES.has(obj.object_type)) continue;
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    const cx = parseFloat(obj.x) + w / 2;
    const cy = parseFloat(obj.y) + h / 2;
    if (![w, h, cx, cy].every(Number.isFinite)) continue;
    if (Math.abs(projectPerp(wall, cx, cy)) > wall.thickness / 2 + 2) continue;
    const along = projectAlong(wall, cx, cy);
    if (Math.abs(along) > wall.length / 2 + 2) continue;
    out.push({ min: along - w / 2, max: along + w / 2 });
  }
  return out;
}

/** True when an opening of half-length `halfLen` centred at `along` hits nothing. */
export function isAlongFree(along: number, halfLen: number, intervals: AlongInterval[]): boolean {
  return intervals.every((iv) => along <= iv.min - halfLen || along >= iv.max + halfLen);
}

/**
 * Clamp an along offset so the opening (a) stays within the wall ends and (b)
 * stays inside the free gap that currently contains `anchor` (its pre-drag
 * position), so it can never slide through a neighbouring opening.
 */
export function clampAlongWithinGap(
  along: number,
  halfLen: number,
  wallHalfLen: number,
  intervals: AlongInterval[],
  anchor: number
): number {
  let lo = -wallHalfLen + halfLen;
  let hi = wallHalfLen - halfLen;
  if (lo > hi) return 0; // opening longer than the wall — centre it
  for (const iv of intervals) {
    const nLo = iv.min - halfLen; // forbidden centre range (nLo, nHi)
    const nHi = iv.max + halfLen;
    if (nHi <= anchor) lo = Math.max(lo, nHi);
    else if (nLo >= anchor) hi = Math.min(hi, nLo);
  }
  if (lo > hi) return anchor;
  return Math.max(lo, Math.min(hi, along));
}

/**
 * Constrain a door/window RESIZE so only its length-along-the-wall changes: the
 * cross dimension stays the wall thickness, rotation stays the wall's, and the
 * opening is clamped to the free gap on the wall (within the ends, not over a
 * neighbouring opening). `proposedCenter`/`proposedLen` come from the
 * transformer result. Returns the opening's new top-left box + rotation.
 */
export function resizeOpeningOnWall(
  opening: LayoutObject,
  host: SnapWall,
  proposedCenter: { x: number; y: number },
  proposedLen: number,
  objects: LayoutObject[]
): { x: number; y: number; width: number; height: number; rotation: number } {
  const oldCx = parseFloat(opening.x) + parseFloat(opening.width) / 2;
  const oldCy = parseFloat(opening.y) + parseFloat(opening.height) / 2;
  const anchor = projectAlong(host, oldCx, oldCy);

  // Free segment along the wall that currently contains this opening.
  let segLo = -host.length / 2;
  let segHi = host.length / 2;
  for (const iv of openingsOnWall(host, objects, opening.id)) {
    if (iv.max <= anchor) segLo = Math.max(segLo, iv.max);
    else if (iv.min >= anchor) segHi = Math.min(segHi, iv.min);
  }

  const along = projectAlong(host, proposedCenter.x, proposedCenter.y);
  let lo = Math.max(segLo, along - proposedLen / 2);
  let hi = Math.min(segHi, along + proposedLen / 2);
  let len = hi - lo;
  if (len < MIN_OBJECT_SIZE) {
    len = Math.min(MIN_OBJECT_SIZE, segHi - segLo);
    const c = Math.max(segLo + len / 2, Math.min(segHi - len / 2, (lo + hi) / 2));
    lo = c - len / 2;
    hi = c + len / 2;
  }

  const p = pointOnWall(host, (lo + hi) / 2);
  return {
    x: p.x - len / 2,
    y: p.y - host.thickness / 2,
    width: len,
    height: host.thickness,
    rotation: host.angleDeg,
  };
}

/**
 * Constrain a proposed top-left move of a placed door/window so it slides only
 * along its host wall and never overlaps another opening. Returns null if the
 * object is not on any wall (caller should fall back to its normal handling).
 */
export function constrainWallObjectMove(
  obj: LayoutObject,
  rawX: number,
  rawY: number,
  objects: LayoutObject[]
): { x: number; y: number } | null {
  const w = parseFloat(obj.width);
  const h = parseFloat(obj.height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  const ocx = parseFloat(obj.x) + w / 2;
  const ocy = parseFloat(obj.y) + h / 2;
  const host = nearestWall(getSnapWalls(objects), ocx, ocy);
  if (!host) return null;
  const anchor = projectAlong(host, ocx, ocy);
  const along = clampAlongWithinGap(
    projectAlong(host, rawX + w / 2, rawY + h / 2),
    w / 2,
    host.length / 2,
    openingsOnWall(host, objects, obj.id),
    anchor
  );
  const p = pointOnWall(host, along);
  return { x: p.x - w / 2, y: p.y - h / 2 };
}

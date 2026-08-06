import type { FloorBoundary } from "./coordinateHelpers";
import { getLayoutObjectRenderConfig } from "./layoutObjectRenderConfig";
import type { LayoutObject } from "../types/layoutObject.types";

/** A single thin wall segment framing a room/zone, in world coordinates. */
export interface RoomFrameSegment {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Thin walls drawn around rooms/zones in the enhanced/booking view (visual only
 * — gone on revert). Each room edge is a wall segment; edges on a boundary wall
 * are skipped, and colinear edges from adjacent rooms are MERGED so two rooms
 * beside each other share a single wall (no doubling at the shared border).
 *
 * Extracted verbatim from FloorMapCanvas (PR 067). `wallThickness` is the
 * boundary wall thickness (drives the "on the boundary wall" tolerance);
 * `roomWallThickness` is the drawn thickness of each room frame segment.
 */
export function computeRoomFrames(
  objects: LayoutObject[],
  B: FloorBoundary,
  wallThickness: number,
  roomWallThickness: number
): RoomFrameSegment[] {
  const t = roomWallThickness;
  const tol = wallThickness / 2 + 4; // "on the boundary wall" tolerance
  const bL = B.x;
  const bR = B.x + B.width;
  const bT = B.y;
  const bB = B.y + B.height;
  // Raw edges as centre-line segments: v = vertical (line is x), h = horizontal.
  const raw: Array<{ o: "v" | "h"; line: number; lo: number; hi: number }> = [];

  for (const obj of objects) {
    if (getLayoutObjectRenderConfig(obj.object_type).category !== "Rooms & Zones") continue;
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    const x = parseFloat(obj.x);
    const y = parseFloat(obj.y);
    const rot = parseFloat(obj.rotation) || 0;
    if (![w, h, x, y].every(Number.isFinite)) continue;
    // Rotated rooms are rare — skip the per-edge cleanup (would need OBB math).
    if (rot !== 0) continue;

    if (Math.abs(y - bT) > tol) raw.push({ o: "h", line: y, lo: x, hi: x + w });
    if (Math.abs(y + h - bB) > tol) raw.push({ o: "h", line: y + h, lo: x, hi: x + w });
    if (Math.abs(x - bL) > tol) raw.push({ o: "v", line: x, lo: y, hi: y + h });
    if (Math.abs(x + w - bR) > tol) raw.push({ o: "v", line: x + w, lo: y, hi: y + h });
  }

  // Merge segments on the same line (rounded) with overlapping/touching spans —
  // this collapses the two walls at a shared border between adjacent rooms.
  const groups = new Map<string, Array<{ lo: number; hi: number }>>();
  for (const s of raw) {
    const key = `${s.o}:${Math.round(s.line)}`;
    const arr = groups.get(key) ?? [];
    arr.push({ lo: s.lo, hi: s.hi });
    groups.set(key, arr);
  }
  const segs: RoomFrameSegment[] = [];
  let i = 0;
  for (const [key, arr] of groups) {
    const [o, lineStr] = key.split(":");
    const line = Number(lineStr);
    arr.sort((a, b) => a.lo - b.lo);
    let cur = { ...arr[0] };
    const flush = () => {
      if (o === "v") {
        segs.push({
          key: `r${i++}`,
          x: line - t / 2,
          y: cur.lo,
          width: t,
          height: cur.hi - cur.lo,
        });
      } else {
        segs.push({
          key: `r${i++}`,
          x: cur.lo,
          y: line - t / 2,
          width: cur.hi - cur.lo,
          height: t,
        });
      }
    };
    for (let k = 1; k < arr.length; k++) {
      if (arr[k].lo <= cur.hi + 0.5) cur.hi = Math.max(cur.hi, arr[k].hi);
      else {
        flush();
        cur = { ...arr[k] };
      }
    }
    flush();
  }
  return segs;
}

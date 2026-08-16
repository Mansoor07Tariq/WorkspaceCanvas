import type { LayoutObjectType } from "../../types/layoutObject.types";
import { getIsoAssetsByBaseType } from "./isoManifest";
import { pickVariantKey } from "./spriteVariant";

/**
 * Auto-furnishing rules for room-like objects (PR 080 B4). The room SHELL stays geometry (the
 * translucent rect + the grey frame walls from `RoomFramesLayer`), sized to whatever the admin
 * drew; INSIDE it we place interior furniture chosen by the room's floor AREA, so a bigger room
 * gets a bigger set. Everything is deterministic: same id + same dimensions → same furniture.
 */

/** A placed interior sprite: its manifest key + a normalized sub-rectangle of the room box
 * (0..1, padding already baked in) that it is contain-fit into. */
export interface InteriorPiece {
  key: string;
  place: { x: number; y: number; w: number; h: number };
}

// ── Area thresholds (canvas px²) — tunable in ONE place ──────────────────────────────
// Reference: a desk is ~80×50 = 4000 px². Below MIN a room shows the shell alone (no furniture
// rather than an overflowing set). SMALL/MEDIUM gate the table-set size.
export const ROOM_MIN_FURNISH_AREA = 8000;
export const ROOM_AREA_SMALL_MAX = 22000;
export const ROOM_AREA_MEDIUM_MAX = 55000;

/** Centred interior with a uniform padding margin inside the shell. */
const CENTER = { x: 0.12, y: 0.12, w: 0.76, h: 0.76 };

const ROOM_LIKE_SIZED: ReadonlySet<LayoutObjectType> = new Set([
  "room",
  "quiet_room",
  "focus_zone",
  "meeting_pod",
]);

/** The table-set family for a size tier (meeting rooms get the nicer Meeting Room arrangement
 * when large; everything else grades Short→Long table + bench). */
function sizedTableBaseType(type: LayoutObjectType, area: number): string {
  if (area <= ROOM_AREA_SMALL_MAX) return "Short Table with one Bench";
  if (area <= ROOM_AREA_MEDIUM_MAX) return "Long Table with one Bench";
  return type === "meeting_room" ? "Meeting Room" : "Long Table with Benches";
}

function piece(
  objectId: number,
  baseType: string,
  place: InteriorPiece["place"],
  salt: number
): InteriorPiece | null {
  const key = pickVariantKey(objectId, getIsoAssetsByBaseType(baseType), salt);
  return key ? { key, place } : null;
}

/**
 * Plan the interior furniture for a room-like object. Returns [] (→ shell only) when the type
 * isn't furnished or the room is too small for even the smallest set.
 */
export function planRoomInterior(
  type: LayoutObjectType,
  objectId: number,
  width: number,
  height: number
): InteriorPiece[] {
  const area = Math.abs(width * height);
  if (area < ROOM_MIN_FURNISH_AREA) return [];

  if (type === "meeting_room" || ROOM_LIKE_SIZED.has(type)) {
    return [piece(objectId, sizedTableBaseType(type, area), CENTER, 0)].filter(isPiece);
  }
  if (type === "lobby") {
    return [piece(objectId, "Lounge", CENTER, 0)].filter(isPiece);
  }
  if (type === "kitchen") {
    return [
      piece(objectId, "Kitchen Shelf", { x: 0.06, y: 0.05, w: 0.88, h: 0.32 }, 1),
      piece(objectId, "Kitchen Table", { x: 0.16, y: 0.42, w: 0.68, h: 0.5 }, 2),
    ].filter(isPiece);
  }
  if (type === "bathroom") {
    return [
      piece(objectId, "Toilet", { x: 0.08, y: 0.18, w: 0.4, h: 0.64 }, 1),
      piece(objectId, "Toilet Sink", { x: 0.54, y: 0.2, w: 0.38, h: 0.58 }, 2),
    ].filter(isPiece);
  }
  // phone_booth (and any other room-like type): too small / no sensible fit → shell only.
  return [];
}

function isPiece(p: InteriorPiece | null): p is InteriorPiece {
  return p !== null;
}

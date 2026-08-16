import type { LayoutObjectType } from "../types/layoutObject.types";
import { DefaultLayoutObjectRenderer } from "./DefaultLayoutObjectRenderer";
import { DeskRenderer } from "./isometric/DeskRenderer";
import { RoomRenderer } from "./isometric/RoomRenderer";
import { SpriteRenderer } from "./isometric/SpriteRenderer";
import type { LayoutObjectRenderer } from "./types";

export type { LayoutObjectRenderer, LayoutObjectRendererProps } from "./types";
export { DefaultLayoutObjectRenderer };

/**
 * Per-type renderer overrides used ONLY when the canvas is in "enhanced" mode (the Enhance
 * toggle) or the booking map. Three renderers cover the floor (PR 080 B2–B4):
 *  - `DeskRenderer` — desks: booking-state sprite + occupant identity tile;
 *  - `RoomRenderer` — room-like types: geometric shell + area-chosen interior furniture;
 *  - `SpriteRenderer` — single-sprite objects (seating, tables, plants, toilets/sinks,
 *    doors/windows): family from `SINGLE_SPRITE_MAP`, hash-picked variant.
 * Every other type is intentionally absent and resolves to the default shape renderer; the three
 * renderers also fall back to the default box when their asset is missing/loading, so an object is
 * never invisible. Walls/columns/partitions/cutouts stay geometric on purpose (see review/36).
 */
const enhancedRendererRegistry: Partial<Record<LayoutObjectType, LayoutObjectRenderer>> = {
  // Workstations — the desk family shares the desk renderer.
  desk: DeskRenderer,
  standing_desk: DeskRenderer,
  hot_desk: DeskRenderer,
  private_desk: DeskRenderer,
  // Rooms & Zones — shell + interior furniture.
  meeting_room: RoomRenderer,
  room: RoomRenderer,
  lobby: RoomRenderer,
  kitchen: RoomRenderer,
  bathroom: RoomRenderer,
  quiet_room: RoomRenderer,
  focus_zone: RoomRenderer,
  meeting_pod: RoomRenderer,
  phone_booth: RoomRenderer,
  // Single-sprite objects (family resolved inside SpriteRenderer via SINGLE_SPRITE_MAP).
  sofa: SpriteRenderer,
  lounge_chair: SpriteRenderer,
  stool: SpriteRenderer,
  chair_table_set: SpriteRenderer,
  table: SpriteRenderer,
  coffee_table: SpriteRenderer,
  lunch_table: SpriteRenderer,
  boardroom_table: SpriteRenderer,
  toilet: SpriteRenderer,
  sink: SpriteRenderer,
  kitchen_sink: SpriteRenderer,
  door: SpriteRenderer,
  window: SpriteRenderer,
  plant: SpriteRenderer,
};

/**
 * Resolve the renderer for a layout object type. By default every type renders as a simple shape
 * (box/circle). When `enhanced` is true, types with a registered enhanced renderer swap to their
 * isometric asset; all others stay on the default renderer.
 */
export function getLayoutObjectRenderer(
  objectType: LayoutObjectType,
  enhanced = false
): LayoutObjectRenderer {
  if (enhanced) {
    return enhancedRendererRegistry[objectType] ?? DefaultLayoutObjectRenderer;
  }
  return DefaultLayoutObjectRenderer;
}

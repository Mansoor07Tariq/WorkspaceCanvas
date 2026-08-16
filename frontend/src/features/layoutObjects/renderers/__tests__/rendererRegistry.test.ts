import { describe, it, expect } from "vitest";
import { getLayoutObjectRenderer, DefaultLayoutObjectRenderer } from "../index";
import { DeskRenderer } from "../isometric/DeskRenderer";
import { RoomRenderer } from "../isometric/RoomRenderer";
import { SpriteRenderer } from "../isometric/SpriteRenderer";
import { ALL_LAYOUT_OBJECT_TYPES } from "../../utils/layoutObjectRenderConfig";
import type { LayoutObjectType } from "../../types/layoutObject.types";

// The enhanced-mode renderer expected for each type (PR 080 B4). Types absent here stay on the
// default styled box even when enhanced (walls, chairs, cutouts, decor primitives, …).
const ENHANCED: Partial<Record<LayoutObjectType, unknown>> = {
  desk: DeskRenderer,
  standing_desk: DeskRenderer,
  hot_desk: DeskRenderer,
  private_desk: DeskRenderer,
  meeting_room: RoomRenderer,
  room: RoomRenderer,
  lobby: RoomRenderer,
  kitchen: RoomRenderer,
  bathroom: RoomRenderer,
  quiet_room: RoomRenderer,
  focus_zone: RoomRenderer,
  meeting_pod: RoomRenderer,
  phone_booth: RoomRenderer,
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

describe("layout object renderer registry", () => {
  it("resolves a renderer for every known object type without throwing", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      expect(typeof getLayoutObjectRenderer(type)).toBe("function");
      expect(typeof getLayoutObjectRenderer(type, true)).toBe("function");
    }
  });

  it("defaults every type to the simple shape renderer (not enhanced)", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      expect(getLayoutObjectRenderer(type)).toBe(DefaultLayoutObjectRenderer);
      expect(getLayoutObjectRenderer(type, false)).toBe(DefaultLayoutObjectRenderer);
    }
  });

  it("maps each type to its expected enhanced renderer (desk / room / sprite), else the box", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      const expected = ENHANCED[type] ?? DefaultLayoutObjectRenderer;
      expect(getLayoutObjectRenderer(type, true)).toBe(expected);
    }
  });

  it("keeps structural/decor types (wall, cutout, chair, whiteboard) on the box when enhanced", () => {
    for (const type of ["wall", "cutout", "chair", "whiteboard", "column"] as LayoutObjectType[]) {
      expect(getLayoutObjectRenderer(type, true)).toBe(DefaultLayoutObjectRenderer);
    }
  });

  it("falls back to the default renderer for an unknown/unregistered type", () => {
    const unknown = "not_a_real_type" as LayoutObjectType;
    expect(getLayoutObjectRenderer(unknown)).toBe(DefaultLayoutObjectRenderer);
    expect(getLayoutObjectRenderer(unknown, true)).toBe(DefaultLayoutObjectRenderer);
  });
});

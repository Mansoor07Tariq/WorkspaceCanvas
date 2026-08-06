import { describe, it, expect } from "vitest";
import { computeRoomFrames } from "../roomFrames";
import type { FloorBoundary } from "../coordinateHelpers";
import type { LayoutObject } from "../../types/layoutObject.types";

const B: FloorBoundary = { x: 0, y: 0, width: 1000, height: 600 };
const WALL = 20; // boundary wall thickness → tol = 20/2 + 4 = 14
const T = 5; // room-frame thickness

function room(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 1,
    floor: 1,
    object_type: "meeting_room",
    object_type_display: "Meeting room",
    label: "",
    x: "200.00",
    y: "200.00",
    width: "200.00",
    height: "200.00",
    rotation: "0.00",
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("computeRoomFrames", () => {
  it("emits a segment for each interior edge of a free-standing room (4)", () => {
    const segs = computeRoomFrames(
      [room({ x: "200", y: "200", width: "300", height: "200" })],
      B,
      WALL,
      T
    );
    expect(segs).toHaveLength(4);
    // Vertical left edge at x=200 → centred: x = 200 - T/2, full height span.
    const left = segs.find((s) => s.width === T && s.x === 200 - T / 2 && s.height === 200);
    expect(left).toBeDefined();
    // Horizontal top edge at y=200 → spans the room width.
    const top = segs.find((s) => s.height === T && s.y === 200 - T / 2 && s.width === 300);
    expect(top).toBeDefined();
  });

  it("skips an edge that lies on a boundary wall (room flush to the left wall → 3)", () => {
    const segs = computeRoomFrames(
      [room({ x: "0", y: "200", width: "300", height: "200" })],
      B,
      WALL,
      T
    );
    expect(segs).toHaveLength(3);
    // No vertical segment at x≈0 (that edge is the boundary wall).
    expect(segs.some((s) => s.width === T && Math.round(s.x) <= 2)).toBe(false);
  });

  it("merges the shared border between two adjacent rooms into one wall", () => {
    const a = room({ id: 1, x: "200", y: "200", width: "200", height: "200" });
    const b = room({ id: 2, x: "400", y: "200", width: "200", height: "200" });
    const segs = computeRoomFrames([a, b], B, WALL, T);
    // 8 raw edges collapse to 5: shared vertical border at x=400 merges to ONE,
    // and the colinear top/bottom edges merge across both rooms.
    expect(segs).toHaveLength(5);
    const atSharedBorder = segs.filter((s) => s.width === T && s.x === 400 - T / 2);
    expect(atSharedBorder).toHaveLength(1);
  });

  it("ignores rotated rooms (OBB cleanup is skipped)", () => {
    const segs = computeRoomFrames([room({ rotation: "90" })], B, WALL, T);
    expect(segs).toHaveLength(0);
  });

  it("ignores non-room objects", () => {
    const desk = room({ object_type: "desk", object_type_display: "Desk" });
    expect(computeRoomFrames([desk], B, WALL, T)).toHaveLength(0);
  });
});

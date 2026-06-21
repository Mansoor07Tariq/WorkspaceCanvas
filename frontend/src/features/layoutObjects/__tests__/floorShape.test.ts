import { describe, it, expect } from "vitest";
import {
  getCutoutRects,
  clipCutoutsToBoundary,
  computeFloorWallSegments,
  computeFloorCarveRects,
  snapCutoutToNeighbors,
  type Rect,
} from "../utils/floorShape";
import { DEFAULT_FLOOR_BOUNDARY } from "../utils/coordinateHelpers";
import type { LayoutObject } from "../types/layoutObject.types";

const B = DEFAULT_FLOOR_BOUNDARY; // { 48, 48, 904, 544 }
const T = 12;

function obj(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 1,
    floor: 1,
    object_type: "cutout",
    object_type_display: "Cutout",
    label: "",
    x: "48.00",
    y: "48.00",
    width: "200.00",
    height: "150.00",
    rotation: "0.00",
    is_bookable: false,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("getCutoutRects", () => {
  it("extracts only cutout objects as rects", () => {
    const rects = getCutoutRects([
      obj({ id: 1 }),
      obj({ id: 2, object_type: "desk" }),
      obj({ id: 3, x: "100.00", y: "100.00", width: "50.00", height: "60.00" }),
    ]);
    expect(rects).toEqual([
      { x: 48, y: 48, width: 200, height: 150 },
      { x: 100, y: 100, width: 50, height: 60 },
    ]);
  });
});

describe("clipCutoutsToBoundary", () => {
  it("clips an overhanging cutout to the room interior", () => {
    // A cutout placed flush to the left wall but hanging above the top edge.
    const clipped = clipCutoutsToBoundary(B, [{ x: 48, y: 0, width: 200, height: 150 }]);
    expect(clipped).toEqual([{ x: 48, y: 48, width: 200, height: 102 }]);
  });

  it("drops a cutout fully outside the room", () => {
    expect(clipCutoutsToBoundary(B, [{ x: 0, y: 0, width: 10, height: 10 }])).toEqual([]);
  });
});

describe("computeFloorWallSegments", () => {
  it("returns four walls when there are no cutouts, offset outward", () => {
    const segs = computeFloorWallSegments(B, [], T);
    expect(segs).toHaveLength(4);
    // Walls extend OUTWARD: inner face flush with the floor edge. The left wall's
    // right edge sits on x=48; the right wall's left edge sits on x=952.
    const leftWall = segs.find((s) => Math.abs(s.x + s.width - 48) < 0.01 && s.height > 100);
    const rightWall = segs.find((s) => Math.abs(s.x - 952) < 0.01 && s.height > 100);
    expect(leftWall).toBeDefined();
    expect(rightWall).toBeDefined();
    expect(leftWall!.width).toBe(T);
  });

  it("produces an L-shaped (6-segment) outline for a corner cutout", () => {
    const cutout: Rect = { x: 48, y: 48, width: 200, height: 150 }; // top-left corner
    const segs = computeFloorWallSegments(B, [cutout], T);
    expect(segs).toHaveLength(6);
  });

  it("produces an 8-segment outline for an edge notch", () => {
    // A notch in the middle of the top wall (flush to the top, not a corner).
    const notch: Rect = { x: 400, y: 48, width: 120, height: 100 };
    const segs = computeFloorWallSegments(B, [notch], T);
    // Top wall splits in two + three notch edges + three other walls = 8.
    expect(segs).toHaveLength(8);
  });

  it("ignores cutouts that do not reach the interior", () => {
    const segs = computeFloorWallSegments(B, [{ x: 0, y: 0, width: 5, height: 5 }], T);
    expect(segs).toHaveLength(4);
  });

  it("does not overflow a wall onto the floor at a concave corner", () => {
    const cutout: Rect = { x: 48, y: 48, width: 200, height: 150 }; // inner corner at (248,198)
    const segs = computeFloorWallSegments(B, [cutout], T);
    const covers = (px: number, py: number) =>
      segs.some((s) => px >= s.x && px <= s.x + s.width && py >= s.y && py <= s.y + s.height);
    // Just inside the floor, past the cutout's inner corner — must be wall-free.
    expect(covers(254, 192)).toBe(false);
    // The cutout's bottom wall is still present along the carved edge.
    expect(covers(240, 192)).toBe(true);
  });

  it("does not put a wall between two adjacent cutouts (they merge)", () => {
    // Two equal cutouts side by side, flush, on the top wall — one combined notch.
    const a: Rect = { x: 300, y: 48, width: 100, height: 150 };
    const b: Rect = { x: 400, y: 48, width: 100, height: 150 };
    const merged = computeFloorWallSegments(B, [a, b], T);
    // Same outline as a single 200-wide notch → 8 segments. A wall at the shared
    // edge x=400 would push this to 10.
    expect(merged).toHaveLength(8);
    const sharedWall = merged.find(
      (s) => Math.abs(s.x + s.width / 2 - 400) < 1 && s.height > 50 && s.height < 200
    );
    expect(sharedWall).toBeUndefined();
  });

  it("bridges a narrow gap between two cutouts (no wall in the sliver)", () => {
    // 20px gap (≤ bridge) → merged into one notch, same 8 segments.
    const a: Rect = { x: 300, y: 48, width: 100, height: 150 };
    const b: Rect = { x: 420, y: 48, width: 100, height: 150 };
    expect(computeFloorWallSegments(B, [a, b], T)).toHaveLength(8);
  });

  it("keeps a wall when the gap is too wide to bridge", () => {
    // 60px gap (> bridge) → two separate notches with floor (and walls) between.
    const a: Rect = { x: 300, y: 48, width: 100, height: 150 };
    const b: Rect = { x: 460, y: 48, width: 100, height: 150 };
    expect(computeFloorWallSegments(B, [a, b], T).length).toBeGreaterThan(8);
  });
});

describe("computeFloorCarveRects", () => {
  it("includes the bridged sliver so the fill matches the walls", () => {
    const a: Rect = { x: 300, y: 48, width: 100, height: 150 };
    const b: Rect = { x: 420, y: 48, width: 100, height: 150 };
    const rects = computeFloorCarveRects(B, [a, b]);
    // The 20px gap column [400,420] is carved too.
    const sliver = rects.find((r) => Math.abs(r.x - 400) < 0.01 && Math.abs(r.width - 20) < 0.01);
    expect(sliver).toBeDefined();
  });

  it("returns nothing when there are no cutouts", () => {
    expect(computeFloorCarveRects(B, [])).toEqual([]);
  });
});

describe("snapCutoutToNeighbors", () => {
  it("abuts a dragged cutout against a neighbour's edge", () => {
    const neighbour: Rect = { x: 300, y: 48, width: 100, height: 150 }; // right edge x=400
    // Dragged cutout's left edge near x=406 → snaps to 400 (abut).
    const r = snapCutoutToNeighbors(406, 48, 100, 150, [neighbour]);
    expect(r.x).toBe(400);
    expect(r.y).toBe(48);
  });

  it("leaves a far-away cutout untouched", () => {
    const neighbour: Rect = { x: 300, y: 48, width: 100, height: 150 };
    const r = snapCutoutToNeighbors(700, 300, 100, 150, [neighbour]);
    expect(r).toEqual({ x: 700, y: 300 });
  });
});

import { describe, it, expect } from "vitest";
import {
  snapToNeighbors,
  computeNeighborSnap,
  overlapsBlockingObject,
  resolveOverlap,
  resolveDrop,
} from "../utils/objectSnapping";
import type { LayoutObject } from "../types/layoutObject.types";

function obj(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 1,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "",
    x: "100.00",
    y: "100.00",
    width: "80.00",
    height: "50.00",
    rotation: "0.00",
    is_bookable: false,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

// Existing desk A: top-left (100,100), 80×50 → right edge 180, top 100.
const A = obj({ id: 1 });

describe("snapToNeighbors", () => {
  it("leaves the position unchanged when there are no other objects", () => {
    expect(snapToNeighbors(183, 104, 80, 50, [A], 1)).toEqual({ x: 183, y: 104 });
  });

  it("snaps a desk flush to the right of a neighbour and aligns their tops", () => {
    // Dropped just past A's right edge and a few px below its top.
    const r = snapToNeighbors(183, 104, 80, 50, [A], 99);
    expect(r).toEqual({ x: 180, y: 100 }); // left butts A.right (180); tops align (100)
  });

  it("connects objects across a small gap (closes a ~12px gap)", () => {
    // Desk dropped 12px to the right of A's right edge (180) → snaps flush.
    expect(snapToNeighbors(192, 100, 80, 50, [A], 99)).toEqual({ x: 180, y: 100 });
  });

  it("aligns left edges and stacks below when dropped under a neighbour", () => {
    // Below A, slightly off: left near A.left (100), top near A.bottom (150).
    const r = snapToNeighbors(104, 146, 80, 50, [A], 99);
    expect(r).toEqual({ x: 100, y: 150 }); // align-left; butt-below
  });

  it("aligns centres", () => {
    // A centre = (140,125). A new 80×50 box centred near that → top-left (100,100).
    const r = snapToNeighbors(97, 100, 80, 50, [A], 99);
    expect(r.x).toBe(100); // centre-aligned (oCX - w/2 = 100)
  });

  it("does not snap to a far-away object", () => {
    const r = snapToNeighbors(400, 400, 80, 50, [A], 99);
    expect(r).toEqual({ x: 400, y: 400 });
  });

  it("ignores the dragged object itself", () => {
    // Only object present is the one being dragged → no snap.
    expect(snapToNeighbors(183, 104, 80, 50, [A], 1)).toEqual({ x: 183, y: 104 });
  });
});

describe("computeNeighborSnap — guides", () => {
  it("emits guides where the snapped edges meet the neighbour", () => {
    const { x, y, guides } = computeNeighborSnap(183, 104, 80, 50, [A], 99);
    expect({ x, y }).toEqual({ x: 180, y: 100 });
    // Vertical guide where our left (180) meets A's right (180).
    expect(guides.some((g) => g.axis === "x" && Math.round(g.position) === 180)).toBe(true);
    // Horizontal guide where our top (100) meets A's top (100).
    expect(guides.some((g) => g.axis === "y" && Math.round(g.position) === 100)).toBe(true);
  });

  it("emits no guides when nothing is near", () => {
    expect(computeNeighborSnap(400, 400, 80, 50, [A], 99).guides).toHaveLength(0);
  });
});

describe("overlapsBlockingObject", () => {
  it("detects overlap with another object", () => {
    expect(overlapsBlockingObject(150, 120, 80, 50, 0, [A], 99, "desk")).toBe(true);
  });

  it("allows flush edge-touching (not an overlap)", () => {
    // Box butts A's right edge (180) exactly — touching, not overlapping.
    expect(overlapsBlockingObject(180, 100, 80, 50, 0, [A], 99, "desk")).toBe(false);
  });

  it("ignores the object itself", () => {
    expect(overlapsBlockingObject(100, 100, 80, 50, 0, [A], 1, "desk")).toBe(false);
  });

  it("blocks a desk against doors and windows (a desk may not sit on them)", () => {
    const aDoor = obj({ id: 5, object_type: "door" });
    const aWindow = obj({ id: 6, object_type: "window" });
    expect(overlapsBlockingObject(110, 110, 80, 50, 0, [aDoor], 99, "desk")).toBe(true);
    expect(overlapsBlockingObject(110, 110, 80, 50, 0, [aWindow], 99, "desk")).toBe(true);
  });

  it("does NOT block a wall against the doors/windows mounted on it", () => {
    const aDoor = obj({ id: 5, object_type: "door" });
    expect(overlapsBlockingObject(110, 110, 80, 50, 0, [aDoor], 99, "wall")).toBe(false);
  });

  it("blocks against rooms/zones and decor", () => {
    const room = obj({ id: 7, object_type: "meeting_room" });
    const plant = obj({ id: 8, object_type: "plant" });
    expect(overlapsBlockingObject(120, 120, 40, 40, 0, [room], 99, "desk")).toBe(true);
    expect(overlapsBlockingObject(120, 120, 40, 40, 0, [plant], 99, "desk")).toBe(true);
  });

  it("detects overlap with a 90°-rotated obstacle using its rotated bounding box", () => {
    // Lunch table stored 120×45 but rotated 90° → visually 45 wide × 120 tall,
    // centred at (160,170): occupies roughly x[137,182] y[110,230].
    const table = obj({
      id: 9,
      object_type: "lunch_table",
      x: "100.00",
      y: "147.50",
      width: "120.00",
      height: "45.00",
      rotation: "90.00",
    });
    // Rotated AABB ≈ x[137.5,182.5] y[110,230]; unrotated box ≈ y[147.5,192.5].
    // A desk at y 112–142 hits the rotated box but is clear of the unrotated one.
    expect(overlapsBlockingObject(150, 112, 40, 30, 0, [table], 99, "desk")).toBe(true);
  });

  it("uses the DRAGGED object's rotation too (a 90° wall is a thin vertical strip)", () => {
    // Wall stored 200×10 @ 90° → visually 10 wide × 200 tall, centred at (200,5)
    // → x[195,205] y[-95,105]. A desk at (197,50) hits that strip; its unrotated
    // box x[100,300] y[0,10] would NOT.
    const desk = obj({ id: 3, x: "197.00", y: "50.00", width: "80.00", height: "50.00" });
    expect(overlapsBlockingObject(100, 0, 200, 10, 90, [desk], 99, "wall")).toBe(true);
    expect(overlapsBlockingObject(100, 0, 200, 10, 0, [desk], 99, "wall")).toBe(false);
  });
});

describe("resolveOverlap", () => {
  // A: [100,180] x [100,150].
  it("pushes out to the left when entered from the left", () => {
    // B overlaps A from the left → flush to A's left edge (right edge at 100).
    expect(resolveOverlap(60, 100, 80, 50, 0, [A], 99, "desk")).toEqual({ x: 20, y: 100 });
  });

  it("pushes out to the right when entered from the right", () => {
    expect(resolveOverlap(150, 110, 80, 50, 0, [A], 99, "desk")).toEqual({ x: 180, y: 110 });
  });

  it("leaves a non-overlapping box unchanged", () => {
    expect(resolveOverlap(300, 300, 80, 50, 0, [A], 99, "desk")).toEqual({ x: 300, y: 300 });
  });

  it("a wall is not pushed out of its mounted door", () => {
    const aDoor = obj({ id: 5, object_type: "door", x: "100.00", y: "100.00" });
    expect(resolveOverlap(110, 110, 80, 50, 0, [aDoor], 99, "wall")).toEqual({ x: 110, y: 110 });
  });
});

describe("resolveDrop", () => {
  it("keeps a non-overlapping drop", () => {
    expect(resolveDrop(300, 300, 80, 50, 0, [A], 99, "desk")).toEqual({
      x: 300,
      y: 300,
      reverted: false,
    });
  });

  it("pushes aside when overlapping exactly one object", () => {
    expect(resolveDrop(60, 100, 80, 50, 0, [A], 99, "desk")).toEqual({
      x: 20,
      y: 100,
      reverted: false,
    });
  });

  it("reverts when overlapping two objects", () => {
    // A [100,180] and C [200,280]; a box at 150 overlaps both.
    const C = obj({ id: 2, x: "200.00", y: "100.00" });
    const r = resolveDrop(150, 100, 80, 50, 0, [A, C], 99, "desk");
    expect(r.reverted).toBe(true);
    expect({ x: r.x, y: r.y }).toEqual({ x: 150, y: 100 });
  });
});

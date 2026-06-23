import { describe, it, expect } from "vitest";
import { computeEnhanceNormalization } from "../utils/enhanceNormalize";
import { DEFAULT_FLOOR_BOUNDARY } from "../utils/coordinateHelpers";
import type { LayoutObject } from "../types/layoutObject.types";

const B = DEFAULT_FLOOR_BOUNDARY; // { 48, 48, 904, 544 }

function obj(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 1,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "",
    x: "100.00",
    y: "200.00",
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

const byId = (patches: ReturnType<typeof computeEnhanceNormalization>) =>
  new Map(patches.map((p) => [p.id, p]));

describe("computeEnhanceNormalization — snap to wall", () => {
  it("snaps a desk just off the top wall flush against it", () => {
    const d = obj({ id: 1, x: "100.00", y: "52.00" }); // 4px below the top wall (y=48)
    const patches = byId(computeEnhanceNormalization([d], B));
    expect(patches.get(1)?.y).toBe("48.00");
  });

  it("leaves a desk far from any wall untouched", () => {
    const d = obj({ id: 1, x: "300.00", y: "300.00" });
    expect(computeEnhanceNormalization([d], B)).toHaveLength(0);
  });

  it("snaps a desk flush against a cutout's carved wall", () => {
    // Cutout carves the top-left; a desk just right of its right edge (x=248).
    const cutout = obj({
      id: 9,
      object_type: "cutout",
      x: "48.00",
      y: "48.00",
      width: "200.00",
      height: "150.00",
    });
    const d = obj({ id: 1, x: "256.00", y: "100.00" }); // 8px right of the cut edge
    const patches = byId(computeEnhanceNormalization([cutout, d], B));
    expect(patches.get(1)?.x).toBe("248.00"); // flush to the carved wall
  });

  it("leaves a wall alone when it has nothing nearby to connect to", () => {
    const wall = obj({
      id: 1,
      object_type: "wall",
      x: "300.00",
      y: "300.00",
      width: "10.00",
      height: "120.00",
    });
    const patches = computeEnhanceNormalization([wall], B);
    expect(patches.find((p) => p.id === 1)).toBeUndefined();
  });

  it("extends an inner wall to the boundary across a sub-grid-cell gap", () => {
    // Horizontal wall whose right end (946) is 6px short of the right wall (952).
    const wall = obj({
      id: 1,
      object_type: "wall",
      x: "700.00",
      y: "300.00",
      width: "246.00",
      height: "10.00",
    });
    const patches = byId(computeEnhanceNormalization([wall], B));
    expect(patches.get(1)?.width).toBe("252.00"); // 700 → 952
    expect(patches.get(1)?.x).toBe("700.00"); // left end unchanged
  });

  it("does not extend a wall when the gap is a full grid cell or more", () => {
    const wall = obj({
      id: 1,
      object_type: "wall",
      x: "700.00",
      y: "300.00",
      width: "236.00", // right end 936 → 16px from the wall → no extend
      height: "10.00",
    });
    expect(computeEnhanceNormalization([wall], B)).toHaveLength(0);
  });
});

describe("computeEnhanceNormalization — connect + equalize desks", () => {
  it("connects a near row edge-to-edge, aligned and same size", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "190.00", y: "202.00", width: "80.00", height: "50.00" }); // 10px gap, 2px off
    const patches = byId(computeEnhanceNormalization([a, b], B));
    const pa = patches.get(1);
    const pb = patches.get(2);
    // Same row line, same size, touching (b.x === a.x + width).
    expect(pb?.x).toBe("180.00");
    expect(pa?.y).toBe(pb?.y);
    expect(pb?.width).toBe("80.00");
    expect(pb?.height).toBe("50.00");
  });

  it("equalizes a connected row (no bounding walls) to the average size", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "188.00", y: "200.00", width: "90.00", height: "56.00" }); // 8px gap
    const patches = byId(computeEnhanceNormalization([a, b], B));
    // Average of 80/90 = 85, 50/56 = 53 → both 85×53.
    expect(patches.get(1)?.width).toBe("85.00");
    expect(patches.get(2)?.width).toBe("85.00");
    expect(patches.get(2)?.height).toBe("53.00");
  });

  it("equalizes two connected desks with a large size difference (centres offset)", () => {
    // 80×50 next to 120×90, top-aligned: their centres are 20px apart vertically,
    // beyond the centre tolerance — they must still connect (by edge overlap) and
    // be averaged to one size, kept side-by-side.
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "182.00", y: "200.00", width: "120.00", height: "90.00" }); // 2px gap
    const patches = byId(computeEnhanceNormalization([a, b], B));
    // Average: width (80+120)/2 = 100, height (50+90)/2 = 70 → both 100×70.
    expect(patches.get(1)?.width).toBe("100.00");
    expect(patches.get(2)?.width).toBe("100.00");
    expect(patches.get(1)?.height).toBe("70.00");
    expect(patches.get(2)?.height).toBe("70.00");
    // Stay in one row, touching, same top (not stacked into a column).
    expect(patches.get(1)?.y).toBe(patches.get(2)?.y);
    expect(patches.get(2)?.x).toBe("200.00"); // 100 + 100, edge-to-edge
  });

  it("equalizes a 3-desk run to the average size", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const odd = obj({ id: 2, x: "182.00", y: "200.00", width: "110.00", height: "70.00" }); // 2px gap
    const c = obj({ id: 3, x: "296.00", y: "200.00", width: "80.00", height: "50.00" }); // 4px gap
    const patches = byId(computeEnhanceNormalization([a, odd, c], B));
    // Average width (80+110+80)/3 = 90 → all 90 wide.
    expect(patches.get(2)?.width).toBe("90.00");
    expect(patches.get(1)?.width).toBe("90.00");
  });

  it("keeps a row together and snaps it to the wall as one unit (no orphan)", () => {
    // wall(48) — 10px gap — D D D. The whole row should move flush to the wall.
    const a = obj({ id: 1, x: "58.00", y: "200.00" });
    const b = obj({ id: 2, x: "138.00", y: "200.00" });
    const c = obj({ id: 3, x: "218.00", y: "200.00" });
    const patches = byId(computeEnhanceNormalization([a, b, c], B));
    expect(patches.get(1)?.x).toBe("48.00"); // first desk flush to the wall
    expect(patches.get(2)?.x).toBe("128.00"); // touching, no middle gap
    expect(patches.get(3)?.x).toBe("208.00");
  });

  it("stretches to fill when a run is bounded by walls on both sides within a grid cell", () => {
    const narrow = { x: 48, y: 48, width: 240, height: 544 }; // walls at x=48 and x=288
    const a = obj({ id: 1, x: "52.00", y: "200.00", width: "76.00", height: "50.00" }); // leftGap 4
    const b = obj({ id: 2, x: "128.00", y: "200.00", width: "76.00", height: "50.00" });
    const c = obj({ id: 3, x: "204.00", y: "200.00", width: "76.00", height: "50.00" }); // rightGap 8
    const patches = byId(computeEnhanceNormalization([a, b, c], narrow));
    // Both gaps < 10 → fill 240px wall-to-wall → 80px each, last edge on the wall.
    expect(patches.get(1)?.x).toBe("48.00");
    expect(patches.get(1)?.width).toBe("80.00");
    expect(patches.get(3)?.width).toBe("80.00");
    const p3 = patches.get(3)!;
    expect(parseFloat(p3.x) + parseFloat(p3.width)).toBeCloseTo(288, 1);
  });

  it("does NOT stretch when the wall gap is a full grid cell or more (snaps flush instead)", () => {
    const narrow = { x: 48, y: 48, width: 240, height: 544 }; // walls at x=48 and x=288
    // rightGap = 288 - (52+72+72+72=268) = 20 → not < 10 → no stretch; run snaps
    // flush to the left wall at normal size instead.
    const a = obj({ id: 1, x: "52.00", y: "200.00", width: "72.00", height: "50.00" });
    const b = obj({ id: 2, x: "124.00", y: "200.00", width: "72.00", height: "50.00" });
    const c = obj({ id: 3, x: "196.00", y: "200.00", width: "72.00", height: "50.00" });
    const patches = byId(computeEnhanceNormalization([a, b, c], narrow));
    expect(patches.get(1)?.x).toBe("48.00");
    expect(patches.get(1)?.width).toBe("72.00"); // unchanged size — no stretch
  });

  it("leaves an already-tidy row unchanged (idempotent)", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "180.00", y: "200.00", width: "80.00", height: "50.00" }); // already touching
    expect(computeEnhanceNormalization([a, b], B)).toHaveLength(0);
  });

  it("does not connect desks that are far apart", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00" });
    const b = obj({ id: 2, x: "400.00", y: "200.00" }); // big gap
    expect(computeEnhanceNormalization([a, b], B)).toHaveLength(0);
  });

  it("arranges a 2-D desk grid into a clean aligned grid", () => {
    // 2×2 grid in mid-room, slightly off — columns/rows should align & touch.
    const grid = [
      obj({ id: 1, x: "300.00", y: "300.00" }),
      obj({ id: 2, x: "382.00", y: "300.00" }),
      obj({ id: 3, x: "300.00", y: "352.00" }),
      obj({ id: 4, x: "382.00", y: "352.00" }),
    ];
    const patches = byId(computeEnhanceNormalization(grid, B));
    expect(patches.get(2)?.x).toBe("380.00"); // column 2 aligns at 300+80
    expect(patches.get(3)?.y).toBe("350.00"); // row 2 aligns at 300+50
    expect(patches.get(4)?.x).toBe("380.00");
    expect(patches.get(4)?.y).toBe("350.00");
  });

  it("connects a run flush to the wall through tiny (≤10px) gaps", () => {
    const a = obj({ id: 1, x: "48.00", y: "200.00" }); // already on the left wall
    const b = obj({ id: 2, x: "136.00", y: "200.00" }); // 8px gap after a (a right=128)
    const c = obj({ id: 3, x: "216.00", y: "200.00" }); // touching b (b right=216)
    const patches = byId(computeEnhanceNormalization([a, b, c], B));
    expect(patches.get(2)?.x).toBe("128.00"); // pulled in flush to a
    expect(patches.get(3)?.x).toBe("208.00");
  });

  it("does NOT connect desks more than 10px apart", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00" });
    const b = obj({ id: 2, x: "192.00", y: "200.00" }); // 12px gap (a right=180) → no connect
    expect(computeEnhanceNormalization([a, b], B)).toHaveLength(0);
  });

  it("does not touch rooms or other non-desk objects (desks only)", () => {
    const room = obj({
      id: 1,
      object_type: "meeting_room",
      x: "70.00",
      y: "120.00",
      width: "200.00",
      height: "150.00",
    });
    expect(computeEnhanceNormalization([room], B)).toHaveLength(0);
  });

  it("reverts a desk if tidying it would overlap another object", () => {
    const desk = obj({ id: 1, x: "100.00", y: "56.00" }); // 8px off the top wall → would snap to y=48
    const plant = obj({
      id: 2,
      object_type: "plant",
      x: "100.00",
      y: "48.00",
      width: "80.00",
      height: "50.00",
    }); // occupies the snapped spot
    const patches = byId(computeEnhanceNormalization([desk, plant], B));
    expect(patches.get(1)).toBeUndefined(); // desk reverted, no overlap introduced
  });

  it("arranges 90° rotated desks by their on-screen footprint (rotation preserved)", () => {
    // Rotated 90° → on-screen footprint is 50×80. These two are ~5px apart on
    // screen, so they connect and desk b pulls flush to a.
    const a = obj({
      id: 1,
      x: "100.00",
      y: "200.00",
      width: "80.00",
      height: "50.00",
      rotation: "90.00",
    });
    const b = obj({
      id: 2,
      x: "155.00",
      y: "200.00",
      width: "80.00",
      height: "50.00",
      rotation: "90.00",
    });
    const patches = byId(computeEnhanceNormalization([a, b], B));
    expect(patches.get(2)).toBeDefined();
    expect(patches.get(2)?.rotation).toBe("90.00");
  });

  it("does not connect rotated desks that are more than 10px apart on screen", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", rotation: "90.00" });
    const b = obj({ id: 2, x: "190.00", y: "200.00", rotation: "90.00" }); // ~40px screen gap
    expect(computeEnhanceNormalization([a, b], B)).toHaveLength(0);
  });
});

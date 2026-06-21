import { describe, it, expect } from "vitest";
import {
  isWallMountedType,
  getMountDimensions,
  getBoundaryWalls,
  getCarvedBoundaryWalls,
  alignOpeningToWall,
  getUserWalls,
  getSnapWalls,
  snapToWall,
  placementToObjectFields,
  nearestWall,
  openingsOnWall,
  isAlongFree,
  clampAlongWithinGap,
  constrainWallObjectMove,
  attachedOpenings,
  transformOpeningWithWall,
  resizeOpeningOnWall,
  carryBoundaryOpeningsOnResize,
} from "../utils/wallPlacement";
import { DEFAULT_FLOOR_BOUNDARY, makeFloorBoundary } from "../utils/coordinateHelpers";
import type { LayoutObject } from "../types/layoutObject.types";

const B = DEFAULT_FLOOR_BOUNDARY; // { 48, 48, 904, 544 }

function wall(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 1,
    floor: 1,
    object_type: "wall",
    object_type_display: "Wall",
    label: "",
    x: "200.00",
    y: "400.00",
    width: "100.00",
    height: "10.00",
    rotation: "0.00",
    is_bookable: false,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("isWallMountedType", () => {
  it("is true for door and window, false for others", () => {
    expect(isWallMountedType("door")).toBe(true);
    expect(isWallMountedType("window")).toBe(true);
    expect(isWallMountedType("desk")).toBe(false);
    expect(isWallMountedType("")).toBe(false);
  });
});

describe("getMountDimensions", () => {
  it("uses the long edge as the on-wall length", () => {
    expect(getMountDimensions("door")).toEqual({ length: 40, thickness: 10 });
    expect(getMountDimensions("window")).toEqual({ length: 80, thickness: 8 });
  });
});

describe("getBoundaryWalls", () => {
  it("returns four walls centred on the wall's visual centre (half a thickness outside the boundary)", () => {
    const walls = getBoundaryWalls();
    expect(walls).toHaveLength(4);
    const [top, bottom, left, right] = walls;
    // Wall thickness is 18 → centres sit 9px outside the boundary edge.
    expect(top).toMatchObject({
      centerX: 500,
      centerY: 39,
      angleDeg: 0,
      length: 904,
      thickness: 18,
    });
    expect(bottom).toMatchObject({ centerX: 500, centerY: 601, angleDeg: 0 });
    expect(left).toMatchObject({ centerX: 39, centerY: 320, angleDeg: 90, length: 544 });
    expect(right).toMatchObject({ centerX: 961, centerY: 320, angleDeg: 90 });
  });
});

describe("getCarvedBoundaryWalls / carve-aware getSnapWalls", () => {
  const cutout: LayoutObject = wall({
    id: 9,
    object_type: "cutout",
    x: "48.00",
    y: "48.00",
    width: "200.00",
    height: "150.00",
  });
  const cutoutRect = { x: 48, y: 48, width: 200, height: 150 };

  it("returns the rerouted carved walls (L-shape → 6) at the wall thickness", () => {
    const walls = getCarvedBoundaryWalls(B, [cutoutRect]);
    expect(walls).toHaveLength(6);
    expect(walls.every((w) => w.thickness === 18)).toBe(true);
  });

  it("lets a door snap to a cutout's inner wall when cutouts are supplied", () => {
    // Inner bottom edge of the top-left cutout is a horizontal wall near y≈189.
    const walls = getSnapWalls([cutout], B, [cutoutRect]);
    const p = snapToWall(150, 189, walls, 40);
    expect(p).not.toBeNull();
    expect(p!.angleDeg).toBe(0);
    expect(p!.thickness).toBe(18);
  });

  it("uses the plain rectangle walls when no cutouts are supplied", () => {
    expect(getSnapWalls([cutout], B)).toHaveLength(4);
  });
});

describe("getUserWalls", () => {
  it("maps a landscape wall object to a horizontal snap wall", () => {
    const walls = getUserWalls([wall()]);
    expect(walls).toHaveLength(1);
    expect(walls[0]).toMatchObject({ centerX: 250, centerY: 405, length: 100, angleDeg: 0 });
  });

  it("treats a portrait wall as vertical (+90)", () => {
    const walls = getUserWalls([wall({ width: "10.00", height: "120.00" })]);
    expect(walls[0]).toMatchObject({ length: 120, angleDeg: 90 });
  });

  it("ignores non-wall objects", () => {
    expect(getUserWalls([wall({ object_type: "desk" })])).toHaveLength(0);
  });
});

describe("snapToWall", () => {
  const walls = getBoundaryWalls();

  it("snaps to the top wall centred under the pointer, with the wall's thickness", () => {
    const p = snapToWall(500, 50, walls, 40);
    expect(p).not.toBeNull();
    expect(p!.angleDeg).toBe(0);
    expect(p!.centerX).toBeCloseTo(500);
    expect(p!.centerY).toBeCloseTo(39);
    expect(p!.thickness).toBe(18);
  });

  it("clamps the opening so it stays within the wall ends", () => {
    // Far-left of the top wall — the door must not hang off the corner.
    const p = snapToWall(B.x, 48, walls, 40);
    expect(p!.centerX).toBeCloseTo(B.x + 20); // left edge flush with boundary.x
    expect(p!.angleDeg).toBe(0);
  });

  it("snaps to a vertical wall with 90° rotation", () => {
    const p = snapToWall(48, 320, walls, 40);
    expect(p!.angleDeg).toBe(90);
    expect(p!.centerX).toBeCloseTo(39); // left wall visual centre
    expect(p!.centerY).toBeCloseTo(320);
    expect(p!.thickness).toBe(18);
  });

  it("returns null when the pointer is not near any wall", () => {
    expect(snapToWall(500, 300, walls, 40)).toBeNull();
  });

  it("snaps to a user wall object, matching its thickness", () => {
    const p = snapToWall(250, 405, getSnapWalls([wall()]), 40);
    expect(p).not.toBeNull();
    expect(p!.centerX).toBeCloseTo(250);
    expect(p!.centerY).toBeCloseTo(405);
    expect(p!.angleDeg).toBe(0);
    expect(p!.thickness).toBe(10); // min(width=100, height=10)
  });
});

describe("placementToObjectFields", () => {
  it("uses the wall thickness as the opening's cross dimension", () => {
    const fields = placementToObjectFields(
      { centerX: 500, centerY: 42, angleDeg: 0, thickness: 12 },
      40
    );
    expect(fields).toEqual({ x: 480, y: 36, width: 40, height: 12, rotation: 0 });
  });

  it("keeps rotation for vertical placement", () => {
    const fields = placementToObjectFields(
      { centerX: 42, centerY: 320, angleDeg: 90, thickness: 12 },
      40
    );
    expect(fields.rotation).toBe(90);
  });
});

// ── Sliding along the wall + overlap prevention ──────────────────────────────

// A door placed on the top wall centre: width 40 (along), height 12 (thickness),
// centred at (500, 42) → top-left (480, 36).
function door(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return wall({
    object_type: "door",
    object_type_display: "Door",
    x: "480.00",
    y: "36.00",
    width: "40.00",
    height: "12.00",
    rotation: "0.00",
    ...overrides,
  });
}

describe("nearestWall", () => {
  const walls = getBoundaryWalls();
  it("finds the top wall for a point on it", () => {
    expect(nearestWall(walls, 500, 42)?.angleDeg).toBe(0);
  });
  it("returns null in the middle of the room", () => {
    expect(nearestWall(walls, 500, 300)).toBeNull();
  });
});

describe("openingsOnWall / isAlongFree", () => {
  const top = getBoundaryWalls()[0];
  it("reports an existing door's along interval and blocks that span", () => {
    const intervals = openingsOnWall(top, [door({ id: 9 })], -1);
    expect(intervals).toEqual([{ min: -20, max: 20 }]); // centre along 0 ± 20
    // A new 40-wide door (half 20) centred at 0 overlaps; at 60 it is clear.
    expect(isAlongFree(0, 20, intervals)).toBe(false);
    expect(isAlongFree(60, 20, intervals)).toBe(true);
  });
  it("excludes the dragged object by id", () => {
    expect(openingsOnWall(top, [door({ id: 9 })], 9)).toHaveLength(0);
  });
});

describe("clampAlongWithinGap", () => {
  it("clamps to the wall ends with no neighbours", () => {
    expect(clampAlongWithinGap(10_000, 20, 452, [], 0)).toBe(432);
    expect(clampAlongWithinGap(-10_000, 20, 452, [], 0)).toBe(-432);
  });
  it("stops before a neighbour to the right of the anchor", () => {
    // neighbour occupies [40,80]; opening half 20 → forbidden centre ≥ 20.
    const a = clampAlongWithinGap(100, 20, 452, [{ min: 40, max: 80 }], 0);
    expect(a).toBe(20);
  });
});

describe("alignOpeningToWall", () => {
  const walls = getBoundaryWalls(); // top wall centreline y=39, thickness 18

  it("re-centres an old thin door onto the wall at the wall thickness", () => {
    // A door stored at the old 12px thickness (centre y=42), on the top wall.
    const d = door({ id: 1, x: "480.00", y: "36.00", height: "12.00" });
    const aligned = alignOpeningToWall(d, walls);
    expect(aligned.height).toBe("18.00"); // matches the wall now
    expect(aligned.y).toBe("30.00"); // centred on the wall centreline (39)
    expect(aligned.width).toBe("40.00"); // length unchanged
    expect(aligned.rotation).toBe("0.00");
  });

  it("leaves non-openings unchanged", () => {
    const deskObj = wall({ id: 2, object_type: "desk" });
    expect(alignOpeningToWall(deskObj, walls)).toBe(deskObj);
  });

  it("leaves an opening not on any wall unchanged", () => {
    const free = door({ id: 3, x: "480.00", y: "300.00" }); // mid-room
    expect(alignOpeningToWall(free, walls)).toBe(free);
  });
});

describe("constrainWallObjectMove", () => {
  it("slides a door along its wall and ignores the off-wall (perpendicular) drag", () => {
    const d = door({ id: 1 });
    // Drag 100px right and 200px down → stays on the wall (re-centred to the wall
    // centreline y=33 for an 18px wall), x slides.
    const r = constrainWallObjectMove(d, 580, 236, [d]);
    expect(r).toEqual({ x: 580, y: 33 });
  });

  it("does not let a door slide over another door on the same wall", () => {
    const a = door({ id: 1, x: "480.00" }); // centre along 0
    const b = door({ id: 2, x: "560.00" }); // centre at x=580 → along 80
    // Try to drag B left onto A; it must stop adjacent, not overlap.
    const r = constrainWallObjectMove(b, 480, 36, [a, b]);
    // B half-length 20, A occupies [-20,20] → B centre clamped to along 40 → x=520.
    expect(r!.x).toBe(520);
    expect(r!.y).toBe(33);
  });

  it("returns null for an object not on any wall", () => {
    const free = door({ id: 1, x: "480.00", y: "300.00" }); // mid-room
    expect(constrainWallObjectMove(free, 100, 300, [free])).toBeNull();
  });
});

describe("attachedOpenings", () => {
  it("finds the doors/windows mounted on a wall", () => {
    const w = wall({ id: 1 }); // 200,400,100,10 → centreline at y≈405
    const d = wall({ id: 2, object_type: "door", x: "240.00", y: "400.00", width: "20.00" });
    const far = wall({ id: 3, object_type: "door", x: "240.00", y: "100.00", width: "20.00" });
    const ids = attachedOpenings(w, [w, d, far]).map((o) => o.id);
    expect(ids).toEqual([2]);
  });
});

describe("transformOpeningWithWall", () => {
  it("scales an opening with the wall and keeps it centred on the new wall", () => {
    const w = wall({ id: 1 }); // 200,400,100,10
    const d = wall({ id: 2, object_type: "door", x: "240.00", y: "400.00", width: "20.00" });
    // Double the wall's length (100 → 200), same origin.
    const t = transformOpeningWithWall(w, d, {
      x: 200,
      y: 400,
      width: 200,
      height: 10,
      rotation: 0,
    });
    expect(t).toEqual({ x: 280, y: 400, width: 40, height: 10, rotation: 0 });
  });
});

describe("resizeOpeningOnWall", () => {
  const host = getUserWalls([wall()])[0]; // centre (250,405), length 100, thickness 10
  const d = wall({ id: 2, object_type: "door", x: "240.00", y: "400.00", width: "20.00" });

  it("resizes the length only, keeping thickness/rotation and staying on the wall", () => {
    // Grow the door to 40, left edge fixed at 240 → centre (260,405).
    const r = resizeOpeningOnWall(d, host, { x: 260, y: 405 }, 40, [d]);
    expect(r).toEqual({ x: 240, y: 400, width: 40, height: 10, rotation: 0 });
  });

  it("clamps the length to the wall ends", () => {
    const r = resizeOpeningOnWall(d, host, { x: 250, y: 405 }, 200, [d]);
    expect(r).toEqual({ x: 200, y: 400, width: 100, height: 10, rotation: 0 });
  });

  it("stops growing at a neighbouring opening", () => {
    const n = wall({ id: 3, object_type: "door", x: "270.00", y: "400.00", width: "20.00" });
    // Try to grow right past the neighbour at along [20,40]; right edge stops at 20.
    const r = resizeOpeningOnWall(d, host, { x: 260, y: 405 }, 60, [d, n]);
    expect(r).toEqual({ x: 230, y: 400, width: 40, height: 10, rotation: 0 });
  });
});

describe("carryBoundaryOpeningsOnResize", () => {
  // A door flush on the BOTTOM boundary wall (centre y = 598), centred at x=300.
  const bottomDoor = (): LayoutObject =>
    wall({
      id: 10,
      object_type: "door",
      x: "280.00", // centre 300
      y: "593.00", // centre 598 (bottom wall centreline)
      width: "40.00",
      height: "10.00",
      rotation: "0.00",
    });

  // A door flush on the RIGHT boundary wall (centre x = 958), centred at y=320.
  const rightDoor = (): LayoutObject =>
    wall({
      id: 11,
      object_type: "door",
      x: "938.00", // centre 958 (right wall centreline)
      y: "315.00", // centre 320
      width: "40.00",
      height: "10.00",
      rotation: "90.00",
    });

  it("scales a bottom-wall opening's position when the room widens", () => {
    const next = makeFloorBoundary(1200, 544); // width 904 → 1200
    const updates = carryBoundaryOpeningsOnResize(B, next, [bottomDoor()]);
    expect(updates).toHaveLength(1);
    // along was -200; scale 1200/904; new bottom centre x = 648 + (-200*scale).
    const scale = 1200 / 904;
    const expectedCx = 648 + -200 * scale;
    expect(updates[0].id).toBe(10);
    expect(updates[0].x).toBeCloseTo(expectedCx - 20, 1);
    // Re-centred on the bottom wall centreline (601 for an 18px wall) → y=596.
    expect(updates[0].y).toBeCloseTo(596, 1);
  });

  it("translates a right-wall opening outward when the room widens", () => {
    const next = makeFloorBoundary(1200, 544);
    const updates = carryBoundaryOpeningsOnResize(B, next, [rightDoor()]);
    expect(updates).toHaveLength(1);
    // Right wall centreline moves with the width (48+1200+9 = 1257). Door follows.
    expect(updates[0].id).toBe(11);
    expect(updates[0].x).toBeCloseTo(1257 - 20, 1);
    expect(updates[0].y).toBeCloseTo(315, 1);
  });

  it("ignores non-opening objects and openings not on a boundary wall", () => {
    const innerWall = wall({ id: 12, object_type: "wall" });
    const deskCenter = wall({ id: 13, object_type: "desk", x: "500", y: "300" });
    const next = makeFloorBoundary(1200, 800);
    expect(carryBoundaryOpeningsOnResize(B, next, [innerWall, deskCenter])).toEqual([]);
  });

  it("keeps the opening fully on a shrunken wall", () => {
    // Door near the right end of the bottom wall, then shrink width hard.
    const farDoor = wall({
      id: 14,
      object_type: "door",
      x: "900.00", // centre 920, along ~ +420 on the 904 wall
      y: "593.00",
      width: "40.00",
      height: "10.00",
    });
    const next = makeFloorBoundary(240, 544); // smallest room
    const updates = carryBoundaryOpeningsOnResize(B, next, [farDoor]);
    expect(updates).toHaveLength(1);
    // New bottom wall spans x in [48, 288]; the 40-wide door must stay inside.
    expect(updates[0].x).toBeGreaterThanOrEqual(48);
    expect(updates[0].x + 40).toBeLessThanOrEqual(288 + 0.01);
  });
});

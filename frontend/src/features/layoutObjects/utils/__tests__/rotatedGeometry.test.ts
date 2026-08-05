import { describe, it, expect } from "vitest";
import {
  rotatedAabbHalfExtents,
  rotatedCorners,
  rotatedRectExtent,
  clampRotatedRectToBoundary,
  rectCenter,
  type RGRect,
} from "../rotatedGeometry";

const B: RGRect = { x: 0, y: 0, width: 1000, height: 640 };

describe("rotatedAabbHalfExtents", () => {
  it("is (w/2, h/2) at 0 / 180 / 360", () => {
    for (const deg of [0, 180, 360]) {
      const { hx, hy } = rotatedAabbHalfExtents(80, 50, deg);
      expect(hx).toBeCloseTo(40);
      expect(hy).toBeCloseTo(25);
    }
  });

  it("swaps to (h/2, w/2) at 90 / 270", () => {
    for (const deg of [90, 270]) {
      const { hx, hy } = rotatedAabbHalfExtents(80, 50, deg);
      expect(hx).toBeCloseTo(25);
      expect(hy).toBeCloseTo(40);
    }
  });

  it("is exact for a square at 45 (diagonal envelope)", () => {
    const { hx, hy } = rotatedAabbHalfExtents(100, 100, 45);
    // half-diagonal of a 100 square = 100/√2 ≈ 70.71
    expect(hx).toBeCloseTo(70.7107, 3);
    expect(hy).toBeCloseTo(70.7107, 3);
  });

  it("is exact for a rectangle at 30", () => {
    // hx = 40·cos30 + 25·sin30 = 40·0.8660 + 25·0.5 = 34.64 + 12.5 = 47.14
    // hy = 40·sin30 + 25·cos30 = 20 + 21.65 = 41.65
    const { hx, hy } = rotatedAabbHalfExtents(80, 50, 30);
    expect(hx).toBeCloseTo(47.14, 2);
    expect(hy).toBeCloseTo(41.65, 2);
  });

  it("handles a degenerate zero size", () => {
    const { hx, hy } = rotatedAabbHalfExtents(0, 0, 37);
    expect(hx).toBe(0);
    expect(hy).toBe(0);
  });
});

describe("rotatedCorners", () => {
  it("returns the axis-aligned corners at 0", () => {
    const c = rotatedCorners(10, 20, 80, 50, 0);
    expect(c[0]).toEqual({ x: 10, y: 20 });
    expect(c[1]).toEqual({ x: 90, y: 20 });
    expect(c[2]).toEqual({ x: 90, y: 70 });
    expect(c[3]).toEqual({ x: 10, y: 70 });
  });

  it("keeps the centre fixed under rotation", () => {
    const before = rectCenter(10, 20, 80, 50);
    for (const deg of [30, 45, 90, 137, 270]) {
      const c = rotatedCorners(10, 20, 80, 50, deg);
      const cx = (c[0].x + c[2].x) / 2;
      const cy = (c[0].y + c[2].y) / 2;
      expect(cx).toBeCloseTo(before.x);
      expect(cy).toBeCloseTo(before.y);
    }
  });

  it("rotates a square's top corner up-left at 45", () => {
    const c = rotatedCorners(0, 0, 100, 100, 45);
    // centre (50,50); the pre-rotation TL corner swings to the top of the diamond
    const topMost = Math.min(...c.map((p) => p.y));
    expect(topMost).toBeCloseTo(50 - 70.7107, 3);
  });
});

describe("rotatedRectExtent", () => {
  it("equals the input rect at 0", () => {
    expect(rotatedRectExtent(10, 20, 80, 50, 0)).toEqual({ x: 10, y: 20, width: 80, height: 50 });
  });

  it("swaps width/height at 90, keeping the same centre", () => {
    const r = rotatedRectExtent(10, 20, 80, 50, 90);
    // centre (50, 45); footprint 50 wide × 80 tall
    expect(r.width).toBeCloseTo(50);
    expect(r.height).toBeCloseTo(80);
    expect(r.x + r.width / 2).toBeCloseTo(50);
    expect(r.y + r.height / 2).toBeCloseTo(45);
  });
});

describe("clampRotatedRectToBoundary", () => {
  it("at rotation 0 is identical to the axis-aligned clamp", () => {
    // inside → unchanged
    expect(clampRotatedRectToBoundary(5, 5, 80, 50, 0, B)).toEqual({ x: 5, y: 5 });
    // past top-left → pinned to boundary top-left
    expect(clampRotatedRectToBoundary(-10, -10, 80, 50, 0, B)).toEqual({ x: 0, y: 0 });
    // past bottom-right → pinned so the box's far edge sits on the wall
    expect(clampRotatedRectToBoundary(990, 700, 80, 50, 0, B)).toEqual({ x: 920, y: 590 });
  });

  it("clamps a 90° object by its swapped footprint", () => {
    // 80×50 @ 90° → footprint 50 wide × 80 tall. At (0,0) its tall footprint pokes
    // above the top wall, so y shifts down until the rotated top edge sits on it.
    const r = clampRotatedRectToBoundary(0, 0, 80, 50, 90, B);
    expect(r.x).toBeCloseTo(0); // 50-wide footprint already fits in x
    expect(r.y).toBeCloseTo(15); // centre y forced to 40 → top-left y = 40 - 25
    // verify: the rotated AABB is now fully inside
    const ext = rotatedRectExtent(r.x, r.y, 80, 50, 90);
    expect(ext.x).toBeGreaterThanOrEqual(-1e-6);
    expect(ext.y).toBeGreaterThanOrEqual(-1e-6);
  });

  it("keeps a 45° object's corners inside all four walls", () => {
    // A 100×100 square at 45° dropped hard into the top-left corner.
    const r = clampRotatedRectToBoundary(-500, -500, 100, 100, 45, B);
    const corners = rotatedCorners(r.x, r.y, 100, 100, 45);
    for (const p of corners) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(B.width + 1e-6);
      expect(p.y).toBeLessThanOrEqual(B.height + 1e-6);
    }
  });

  it("keeps an arbitrary-angle object inside when dropped past the bottom-right", () => {
    const r = clampRotatedRectToBoundary(2000, 2000, 120, 60, 37, B);
    const corners = rotatedCorners(r.x, r.y, 120, 60, 37);
    for (const p of corners) {
      expect(p.x).toBeLessThanOrEqual(B.width + 1e-6);
      expect(p.y).toBeLessThanOrEqual(B.height + 1e-6);
    }
  });

  it("anchors an oversize rotated object to the near wall (no inverted range)", () => {
    const small: RGRect = { x: 0, y: 0, width: 100, height: 100 };
    // 200×200 @ 45° has a ~283px footprint — bigger than the 100px room.
    const r = clampRotatedRectToBoundary(-999, -999, 200, 200, 45, small);
    // near (top-left) edge of the footprint anchored to the boundary's top-left
    const ext = rotatedRectExtent(r.x, r.y, 200, 200, 45);
    expect(ext.x).toBeCloseTo(0);
    expect(ext.y).toBeCloseTo(0);
  });
});

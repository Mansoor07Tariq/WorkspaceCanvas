import { describe, it, expect } from "vitest";
import {
  formatCoordinate,
  getTopLeftFromCenterPosition,
  buildMovePatch,
  buildTransformPatch,
  calculateTransformResult,
  MIN_OBJECT_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  clamp,
  clampObjectPosition,
  clampObjectTransform,
  clampObjectToBoundary,
  clampObjectTransformToBoundary,
  DEFAULT_FLOOR_BOUNDARY,
  snapToGrid,
  snapObjectToGrid,
  snapSizeToGrid,
  snapRotation,
} from "../utils/coordinateHelpers";
import type { LayoutObjectType } from "../types/layoutObject.types";

describe("formatCoordinate", () => {
  it("formats an integer to 2 decimal places", () => {
    expect(formatCoordinate(100)).toBe("100.00");
  });

  it("formats a float rounding to 2 decimal places", () => {
    expect(formatCoordinate(100.555)).toBe("100.56");
    expect(formatCoordinate(100.554)).toBe("100.55");
  });

  it("handles zero", () => {
    expect(formatCoordinate(0)).toBe("0.00");
  });

  it("handles negative values", () => {
    expect(formatCoordinate(-50)).toBe("-50.00");
    expect(formatCoordinate(-12.5)).toBe("-12.50");
  });

  it("returns '0.00' for NaN", () => {
    expect(formatCoordinate(NaN)).toBe("0.00");
  });

  it("returns '0.00' for Infinity", () => {
    expect(formatCoordinate(Infinity)).toBe("0.00");
    expect(formatCoordinate(-Infinity)).toBe("0.00");
  });

  it("handles large values", () => {
    expect(formatCoordinate(9999.99)).toBe("9999.99");
  });
});

describe("getTopLeftFromCenterPosition", () => {
  it("converts center (140, 175) with 80×50 to top-left (100, 150)", () => {
    const result = getTopLeftFromCenterPosition(140, 175, 80, 50);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(150);
  });

  it("converts center (50, 25) with 100×50 to top-left (0, 0)", () => {
    const result = getTopLeftFromCenterPosition(50, 25, 100, 50);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it("handles negative center positions", () => {
    const result = getTopLeftFromCenterPosition(-10, -5, 60, 40);
    expect(result.x).toBeCloseTo(-40);
    expect(result.y).toBeCloseTo(-25);
  });

  it("round-trips: top-left → center → top-left", () => {
    const origX = 120;
    const origY = 80;
    const w = 80;
    const h = 50;
    const cx = origX + w / 2;
    const cy = origY + h / 2;
    const { x, y } = getTopLeftFromCenterPosition(cx, cy, w, h);
    expect(x).toBeCloseTo(origX);
    expect(y).toBeCloseTo(origY);
  });

  it("is symmetric for various sizes", () => {
    for (const { w, h } of [
      { w: 35, h: 35 },
      { w: 200, h: 10 },
      { w: 140, h: 120 },
    ]) {
      const topX = 50;
      const topY = 60;
      const cx = topX + w / 2;
      const cy = topY + h / 2;
      const result = getTopLeftFromCenterPosition(cx, cy, w, h);
      expect(result.x).toBeCloseTo(topX);
      expect(result.y).toBeCloseTo(topY);
    }
  });
});

describe("buildMovePatch", () => {
  it("returns x/y strings rounded to 2 decimals", () => {
    const patch = buildMovePatch(100.5, 200.333);
    expect(patch.x).toBe("100.50");
    expect(patch.y).toBe("200.33");
  });

  it("does not include office_id or floor_id", () => {
    const patch = buildMovePatch(0, 0) as Record<string, unknown>;
    expect("office_id" in patch).toBe(false);
    expect("floor_id" in patch).toBe(false);
  });
});

describe("buildTransformPatch", () => {
  it("returns all five fields as formatted strings", () => {
    const patch = buildTransformPatch(10.5, 20.5, 80.0, 50.0, 45.0);
    expect(patch.x).toBe("10.50");
    expect(patch.y).toBe("20.50");
    expect(patch.width).toBe("80.00");
    expect(patch.height).toBe("50.00");
    expect(patch.rotation).toBe("45.00");
  });

  it("does not include scaleX or scaleY", () => {
    const patch = buildTransformPatch(0, 0, 80, 50, 0) as Record<string, unknown>;
    expect("scaleX" in patch).toBe(false);
    expect("scaleY" in patch).toBe(false);
  });
});

describe("calculateTransformResult", () => {
  it("applies scale to produce new width/height", () => {
    const result = calculateTransformResult(140, 175, 80, 50, 1.5, 1.2, 0);
    expect(result.width).toBeCloseTo(120);
    expect(result.height).toBeCloseTo(60);
  });

  it("recalculates top-left from new center after resize", () => {
    // Old: top-left (100, 150), w=80, h=50 → center (140, 175)
    // After scale 1.5×1.2: newW=120, newH=60 → top-left (140-60, 175-30)=(80, 145)
    const result = calculateTransformResult(140, 175, 80, 50, 1.5, 1.2, 0);
    expect(result.x).toBeCloseTo(80);
    expect(result.y).toBeCloseTo(145);
  });

  it("preserves rotation", () => {
    const result = calculateTransformResult(100, 100, 80, 50, 1, 1, 45);
    expect(result.rotation).toBe(45);
  });

  it("enforces minimum dimension", () => {
    const result = calculateTransformResult(100, 100, 80, 50, 0.001, 0.001, 0);
    expect(result.width).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
    expect(result.height).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
  });

  it("allows custom minimum", () => {
    const result = calculateTransformResult(100, 100, 80, 50, 0.001, 0.001, 0, 20);
    expect(result.width).toBeGreaterThanOrEqual(20);
    expect(result.height).toBeGreaterThanOrEqual(20);
  });

  it("returns scale=1 dimensions when scaleX=scaleY=1", () => {
    const result = calculateTransformResult(140, 175, 80, 50, 1, 1, 0);
    expect(result.width).toBeCloseTo(80);
    expect(result.height).toBeCloseTo(50);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(150);
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("clamps below minimum", () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it("clamps above maximum", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("returns min when min === max", () => {
    expect(clamp(50, 30, 30)).toBe(30);
  });

  it("handles negative ranges", () => {
    expect(clamp(-5, -20, -1)).toBe(-5);
    expect(clamp(0, -20, -1)).toBe(-1);
  });

  // ─── NaN / non-finite safety ─────────────────────────────────────────────

  it("returns min for NaN value", () => {
    expect(clamp(NaN, 5, 100)).toBe(5);
  });

  it("clamps Infinity to max", () => {
    // Math.min(Infinity, 100) = 100 — handled correctly without NaN guard
    expect(clamp(Infinity, 0, 100)).toBe(100);
  });

  it("clamps -Infinity to min", () => {
    expect(clamp(-Infinity, 0, 100)).toBe(0);
  });
});

// ─── clampObjectPosition ──────────────────────────────────────────────────────

describe("clampObjectPosition", () => {
  const W = CANVAS_WIDTH; // 1000
  const H = CANVAS_HEIGHT; // 640
  const objW = 80;
  const objH = 50;

  it("allows valid position unchanged", () => {
    const r = clampObjectPosition(200, 300, objW, objH, W, H);
    expect(r.x).toBe(200);
    expect(r.y).toBe(300);
  });

  it("clamps x to 0 when dragged beyond left edge", () => {
    const r = clampObjectPosition(-50, 100, objW, objH, W, H);
    expect(r.x).toBe(0);
  });

  it("clamps y to 0 when dragged beyond top edge", () => {
    const r = clampObjectPosition(100, -30, objW, objH, W, H);
    expect(r.y).toBe(0);
  });

  it("clamps x to canvasWidth - width when dragged past right edge", () => {
    const r = clampObjectPosition(2000, 100, objW, objH, W, H);
    expect(r.x).toBe(W - objW); // 920
  });

  it("clamps y to canvasHeight - height when dragged past bottom edge", () => {
    const r = clampObjectPosition(100, 5000, objW, objH, W, H);
    expect(r.y).toBe(H - objH); // 590
  });

  it("anchors at 0 when object is wider than canvas", () => {
    const r = clampObjectPosition(100, 100, W + 100, objH, W, H);
    expect(r.x).toBe(0);
  });

  it("anchors at 0 when object is taller than canvas", () => {
    const r = clampObjectPosition(100, 100, objW, H + 100, W, H);
    expect(r.y).toBe(0);
  });

  it("returns (0, 0) for negative coords at exact canvas size object", () => {
    const r = clampObjectPosition(-999, -999, W, H, W, H);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

// ─── clampObjectTransform ─────────────────────────────────────────────────────

describe("clampObjectTransform", () => {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  it("clips width to canvas width", () => {
    const r = clampObjectTransform(0, 0, W + 200, 50, W, H);
    expect(r.width).toBe(W);
  });

  it("clips height to canvas height", () => {
    const r = clampObjectTransform(0, 0, 80, H + 200, W, H);
    expect(r.height).toBe(H);
  });

  it("clamps position after size clip", () => {
    // Object bigger than canvas → size clips to canvas size → position anchors at 0
    const r = clampObjectTransform(500, 400, W + 200, H + 200, W, H);
    expect(r.width).toBe(W);
    expect(r.height).toBe(H);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it("preserves normal values unchanged", () => {
    const r = clampObjectTransform(100, 100, 80, 50, W, H);
    expect(r).toEqual({ x: 100, y: 100, width: 80, height: 50 });
  });
});

// ─── snapToGrid ───────────────────────────────────────────────────────────────

describe("snapToGrid", () => {
  it("snaps 13 to 20 with grid size 20", () => {
    expect(snapToGrid(13, 20)).toBe(20);
  });

  it("snaps 9 to 0 with grid size 20 (rounds down)", () => {
    // 9/20 = 0.45 → Math.round(0.45) = 0 → 0
    expect(snapToGrid(9, 20)).toBe(0);
  });

  it("snaps 10 to 10 with grid size 10", () => {
    expect(snapToGrid(10, 10)).toBe(10);
  });

  it("snaps 15 to 20 with grid size 20 (ties round up in JS)", () => {
    // 15/20 = 0.75 → Math.round(0.75) = 1 → 20
    expect(snapToGrid(15, 20)).toBe(20);
  });

  it("snaps 100 to 100 when already on grid", () => {
    expect(snapToGrid(100, 20)).toBe(100);
  });

  it("handles 0 input", () => {
    expect(snapToGrid(0, 20)).toBe(0);
  });

  it("returns value unchanged when gridSize <= 0", () => {
    expect(snapToGrid(13, 0)).toBe(13);
    expect(snapToGrid(13, -5)).toBe(13);
  });

  // ─── NaN / non-finite safety ─────────────────────────────────────────────

  it("returns 0 for NaN value", () => {
    expect(snapToGrid(NaN, 20)).toBe(0);
  });

  it("returns 0 for Infinity value", () => {
    expect(snapToGrid(Infinity, 20)).toBe(0);
  });

  it("returns 0 for -Infinity value", () => {
    expect(snapToGrid(-Infinity, 20)).toBe(0);
  });

  it("returns value unchanged for NaN gridSize", () => {
    expect(snapToGrid(13, NaN)).toBe(13);
  });

  it("returns value unchanged for Infinity gridSize", () => {
    expect(snapToGrid(13, Infinity)).toBe(13);
  });

  it("works with grid size 10", () => {
    expect(snapToGrid(14, 10)).toBe(10);
    expect(snapToGrid(15, 10)).toBe(20);
    expect(snapToGrid(16, 10)).toBe(20);
  });

  it("works with grid size 40", () => {
    expect(snapToGrid(21, 40)).toBe(40);
    expect(snapToGrid(19, 40)).toBe(0);
  });
});

// ─── snapObjectToGrid ─────────────────────────────────────────────────────────

describe("snapObjectToGrid", () => {
  it("snaps both axes independently", () => {
    // snapToGrid(13, 20) = Math.round(0.65)*20 = 20
    // snapToGrid(27, 20) = Math.round(1.35)*20 = 20
    const r = snapObjectToGrid(13, 27, 20);
    expect(r.x).toBe(20);
    expect(r.y).toBe(20);
  });

  it("leaves already-aligned values unchanged", () => {
    const r = snapObjectToGrid(100, 200, 20);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
  });
});

// ─── snapSizeToGrid ───────────────────────────────────────────────────────────

describe("snapSizeToGrid", () => {
  it("snaps width and height to nearest grid", () => {
    const r = snapSizeToGrid(83, 47, 20);
    expect(r.width).toBe(80);
    expect(r.height).toBe(40);
  });

  it("never returns below MIN_OBJECT_SIZE", () => {
    // snapToGrid(3, 20) = 0 → must floor to MIN_OBJECT_SIZE
    const r = snapSizeToGrid(3, 3, 20);
    expect(r.width).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
    expect(r.height).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
  });

  it("respects custom minSize", () => {
    const r = snapSizeToGrid(3, 3, 20, 25);
    expect(r.width).toBeGreaterThanOrEqual(25);
    expect(r.height).toBeGreaterThanOrEqual(25);
  });

  it("does not reduce below minimum even when snap rounds to 0", () => {
    const r = snapSizeToGrid(1, 1, 20);
    expect(r.width).toBe(MIN_OBJECT_SIZE);
    expect(r.height).toBe(MIN_OBJECT_SIZE);
  });
});

// ─── snap + clamp together ────────────────────────────────────────────────────

describe("snap then clamp ordering", () => {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  const objW = 80;
  const objH = 50;

  it("snap first, then clamp: snapped value that would exceed canvas is clamped", () => {
    // Object at x=925 (near right edge): snapToGrid(925, 20)=920, clamp(920,0,920)=920 ✓
    const snapped = snapObjectToGrid(925, 100, 20);
    const { x } = clampObjectPosition(snapped.x, snapped.y, objW, objH, W, H);
    expect(x).toBe(920); // canvasWidth - objW
  });

  it("snap first, then clamp: negative value snaps to 0 then clamps to 0", () => {
    const snapped = snapObjectToGrid(-9, 0, 20);
    const { x } = clampObjectPosition(snapped.x, snapped.y, objW, objH, W, H);
    expect(x).toBe(0);
  });

  it("final position is always inside canvas bounds after snap+clamp", () => {
    const cases = [
      { rawX: -50, rawY: -50 },
      { rawX: 2000, rawY: 2000 },
      { rawX: 500, rawY: 300 },
    ];
    for (const { rawX, rawY } of cases) {
      const snapped = snapObjectToGrid(rawX, rawY, 20);
      const { x, y } = clampObjectPosition(snapped.x, snapped.y, objW, objH, W, H);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(W - objW);
      expect(y).toBeLessThanOrEqual(H - objH);
    }
  });
});

// ─── Boundary clamping (PR 061) ──────────────────────────────────────────────

describe("DEFAULT_FLOOR_BOUNDARY", () => {
  it("is inset symmetrically from the stage (48,48,904,544)", () => {
    expect(DEFAULT_FLOOR_BOUNDARY).toEqual({ x: 48, y: 48, width: 904, height: 544 });
  });
});

describe("clampObjectToBoundary", () => {
  const B = DEFAULT_FLOOR_BOUNDARY;

  it("leaves an in-bounds object unchanged", () => {
    expect(clampObjectToBoundary(100, 100, 80, 50)).toEqual({ x: 100, y: 100 });
  });

  it("clamps negative coords to the boundary top-left", () => {
    expect(clampObjectToBoundary(-50, -50, 80, 50)).toEqual({ x: B.x, y: B.y });
  });

  it("clamps the right/bottom edges to stay inside the boundary", () => {
    // maxX = 48 + (904-80) = 872, maxY = 48 + (544-50) = 542
    expect(clampObjectToBoundary(5000, 5000, 80, 50)).toEqual({ x: 872, y: 542 });
  });

  it("anchors an object larger than the boundary at the top-left (no crash)", () => {
    expect(clampObjectToBoundary(10, 10, 2000, 2000)).toEqual({ x: B.x, y: B.y });
  });

  it("accepts a custom boundary", () => {
    const custom = { x: 0, y: 0, width: 100, height: 100 };
    expect(clampObjectToBoundary(200, 200, 20, 20, custom)).toEqual({ x: 80, y: 80 });
  });
});

describe("clampObjectTransformToBoundary", () => {
  it("shrinks an oversized object to the boundary and pins it to top-left", () => {
    const r = clampObjectTransformToBoundary(10, 10, 2000, 2000);
    expect(r).toEqual({
      x: DEFAULT_FLOOR_BOUNDARY.x,
      y: DEFAULT_FLOOR_BOUNDARY.y,
      width: DEFAULT_FLOOR_BOUNDARY.width,
      height: DEFAULT_FLOOR_BOUNDARY.height,
    });
  });

  it("clamps position after resizing within the boundary", () => {
    const r = clampObjectTransformToBoundary(5000, 5000, 100, 100);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    expect(r.x).toBe(48 + (904 - 100));
    expect(r.y).toBe(48 + (544 - 100));
  });
});

describe("snapRotation", () => {
  it("snaps to the nearest multiple of 10", () => {
    expect(snapRotation(86)).toBe(90);
    expect(snapRotation(82)).toBe(80);
    expect(snapRotation(45)).toBe(50); // round half up
    expect(snapRotation(0)).toBe(0);
  });

  it("normalises negatives and ≥360 into [0,360)", () => {
    expect(snapRotation(-1.03)).toBe(0);
    expect(snapRotation(-95)).toBe(270); // -90 → 270
    expect(snapRotation(356)).toBe(0); // 360 → 0
  });

  it("returns 0 for non-finite input", () => {
    expect(snapRotation(NaN)).toBe(0);
  });
});

// Guard: library types exist to ensure no type drift
describe("LayoutObjectType", () => {
  it("is a union type (runtime type guard via cast)", () => {
    const t: LayoutObjectType = "desk";
    expect(t).toBe("desk");
  });
});

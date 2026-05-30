import { describe, it, expect } from "vitest";
import {
  formatCoordinate,
  getTopLeftFromCenterPosition,
  buildMovePatch,
  buildTransformPatch,
  calculateTransformResult,
  MIN_OBJECT_SIZE,
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

// Guard: library types exist to ensure no type drift
describe("LayoutObjectType", () => {
  it("is a union type (runtime type guard via cast)", () => {
    const t: LayoutObjectType = "desk";
    expect(t).toBe("desk");
  });
});

import { describe, it, expect } from "vitest";
import { formatCoordinate, getTopLeftFromCenterPosition } from "../utils/coordinateHelpers";

describe("formatCoordinate", () => {
  it("formats an integer to 2 decimal places", () => {
    expect(formatCoordinate(100)).toBe("100.00");
  });

  it("formats a float to 2 decimal places", () => {
    expect(formatCoordinate(100.5)).toBe("100.50");
  });

  it("rounds to 2 decimal places", () => {
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

  it("handles large numbers", () => {
    expect(formatCoordinate(9999.99)).toBe("9999.99");
  });
});

describe("getTopLeftFromCenterPosition", () => {
  it("converts center (140, 175) with size 80x50 to top-left (100, 150)", () => {
    const result = getTopLeftFromCenterPosition(140, 175, 80, 50);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(150);
  });

  it("converts center (50, 25) with size 100x50 to top-left (0, 0)", () => {
    const result = getTopLeftFromCenterPosition(50, 25, 100, 50);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it("handles objects positioned at the origin", () => {
    const result = getTopLeftFromCenterPosition(40, 25, 80, 50);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it("handles negative positions", () => {
    const result = getTopLeftFromCenterPosition(-10, -5, 60, 40);
    expect(result.x).toBeCloseTo(-40);
    expect(result.y).toBeCloseTo(-25);
  });

  it("round-trips: top-left → center → top-left", () => {
    const origX = 120;
    const origY = 80;
    const w = 80;
    const h = 50;
    const centerX = origX + w / 2;
    const centerY = origY + h / 2;
    const { x, y } = getTopLeftFromCenterPosition(centerX, centerY, w, h);
    expect(x).toBeCloseTo(origX);
    expect(y).toBeCloseTo(origY);
  });

  it("is symmetric with different sizes", () => {
    const sizes = [
      { w: 35, h: 35 },
      { w: 200, h: 10 },
      { w: 140, h: 120 },
    ];
    for (const { w, h } of sizes) {
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

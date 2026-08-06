import { describe, it, expect } from "vitest";
import { makeMinSizeBoundBox, type TransformBox } from "../transformerBounds";

const box = (width: number, height: number): TransformBox => ({
  x: 0,
  y: 0,
  width,
  height,
  rotation: 0,
});

describe("makeMinSizeBoundBox", () => {
  const MIN = 20;

  it("accepts a box at or above the minimum (scale 1)", () => {
    const fn = makeMinSizeBoundBox(MIN, 1);
    const old = box(100, 100);
    const next = box(20, 20);
    expect(fn(old, next)).toBe(next);
  });

  it("rejects a box narrower than the minimum, returning the old box (scale 1)", () => {
    const fn = makeMinSizeBoundBox(MIN, 1);
    const old = box(100, 100);
    expect(fn(old, box(19, 50))).toBe(old);
  });

  it("rejects a box shorter than the minimum (scale 1)", () => {
    const fn = makeMinSizeBoundBox(MIN, 1);
    const old = box(100, 100);
    expect(fn(old, box(50, 19))).toBe(old);
  });

  it("is zoom-invariant: divides the box by the stage scale before comparing (FE-6)", () => {
    // At 2× zoom a world-space MIN is 2·MIN=40 absolute px. A 40px box is exactly
    // at the world minimum → accepted; 38px (world 19) → rejected.
    const fn = makeMinSizeBoundBox(MIN, 2);
    const old = box(200, 200);
    const atMin = box(40, 40);
    expect(fn(old, atMin)).toBe(atMin);
    expect(fn(old, box(38, 40))).toBe(old);
    expect(fn(old, box(40, 38))).toBe(old);
  });

  it("treats a zero/undefined scale as 1 (no divide-by-zero)", () => {
    const fn = makeMinSizeBoundBox(MIN, 0);
    const old = box(100, 100);
    expect(fn(old, box(25, 25))).toStrictEqual(box(25, 25));
    expect(fn(old, box(19, 25))).toBe(old);
  });
});

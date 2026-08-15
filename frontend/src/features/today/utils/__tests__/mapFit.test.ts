import { describe, it, expect } from "vitest";

import { contentBounds, fitAndCenter } from "../mapFit";
import type { Rect } from "../mapFit";

describe("contentBounds (crop to CONTENT, not the raw floor rect)", () => {
  it("is the union of the object rects, expanded by padding", () => {
    const rects: Rect[] = [
      { x: 100, y: 100, width: 20, height: 20 },
      { x: 200, y: 140, width: 40, height: 20 },
    ];
    const b = contentBounds(null, rects, 10);
    // union = x[100..240], y[100..160] → then padded by 10 on each side
    expect(b).toEqual({ minX: 90, minY: 90, width: 160, height: 80 });
  });

  it("ignores the big empty floor rectangle so a small layout still fills the view", () => {
    const objects: Rect[] = [{ x: 480, y: 300, width: 40, height: 20 }];
    // Passing boundary:null means we crop to the objects, not a 1000×640 floor.
    const b = contentBounds(null, objects, 0);
    expect(b.width).toBe(40);
    expect(b.height).toBe(20);
    expect(b.minX).toBe(480);
  });

  it("returns a unit box for empty content", () => {
    expect(contentBounds(null, [], 0)).toEqual({ minX: 0, minY: 0, width: 1, height: 1 });
  });
});

describe("fitAndCenter (scale-to-fit both dims + centre)", () => {
  it("scales by the smaller ratio and centres in the free dimension", () => {
    // content 100×50 into 200×200 → scale = min(2, 4) = 2; width fills, height centres.
    const t = fitAndCenter(
      { minX: 0, minY: 0, width: 100, height: 50 },
      { width: 200, height: 200 }
    );
    expect(t.scale).toBe(2);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(50); // (200 - 50*2)/2
  });

  it("cancels a non-zero bbox origin", () => {
    const t = fitAndCenter(
      { minX: 10, minY: 10, width: 100, height: 50 },
      { width: 200, height: 200 }
    );
    expect(t.scale).toBe(2);
    expect(t.offsetX).toBe(-20); // 0 - 10*2
    expect(t.offsetY).toBe(30); // 50 - 10*2
  });

  it("never up/down-scales into NaN on degenerate input", () => {
    expect(
      fitAndCenter({ minX: 0, minY: 0, width: 0, height: 0 }, { width: 100, height: 100 })
    ).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(
      fitAndCenter({ minX: 0, minY: 0, width: 10, height: 10 }, { width: 0, height: 0 })
    ).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("fits a tall content into a wide container by height", () => {
    // content 50×100 into 400×100 → scale = min(8, 1) = 1; centred horizontally.
    const t = fitAndCenter(
      { minX: 0, minY: 0, width: 50, height: 100 },
      { width: 400, height: 100 }
    );
    expect(t.scale).toBe(1);
    expect(t.offsetX).toBe(175); // (400 - 50)/2
    expect(t.offsetY).toBe(0);
  });
});

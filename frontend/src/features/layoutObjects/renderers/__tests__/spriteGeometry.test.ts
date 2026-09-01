import { describe, it, expect } from "vitest";
import { occupantTileAspect, occupantTileInset } from "@/theme/tokens";
import {
  computeHitRect,
  containInBox,
  fitFootprint,
  fitFootprintInSubRect,
  SPRITE_MAX_OVERFLOW_RATIO,
  computeTileBox,
  getDesktopRect,
  DEFAULT_DESKTOP_RECT,
} from "../isometric/spriteGeometry";

// The floor rect's bottom edge, in group-centred coords, is +boxH/2.
const bottomEdge = (boxH: number) => boxH / 2;

describe("fitFootprint (PR 081 — width-fill + bottom-anchor + width-bounded overflow)", () => {
  it("fills the box WIDTH and anchors the bottom edge (wide sprite, overflow within bound)", () => {
    // 200x50 (aspect 4) into 80x50: scale 0.4 → 80x20; overflow bound 50+0.25*80=70 not binding.
    const fit = fitFootprint(200, 50, 80, 50);
    expect(fit.width).toBe(80); // fills the box width
    expect(fit.x).toBe(-40); // horizontally centred
    expect(fit.y + fit.height).toBeCloseTo(bottomEdge(50), 5); // bottom-anchored to +boxH/2
  });

  it("bounds OVERFLOW by object WIDTH (not depth) for tall/near-square art", () => {
    // 100x100 into 80x50: width-fill would be 80x80 (overflow 30); bound overflow = 0.25*80 = 20.
    const fit = fitFootprint(100, 100, 80, 50);
    const overflow = fit.height - 50; // amount above the box
    expect(overflow).toBeCloseTo(SPRITE_MAX_OVERFLOW_RATIO * 80, 5); // ≤ ratio × WIDTH
    expect(fit.width).toBeLessThan(80); // trims width to honour the bound (graceful)
    expect(fit.y + fit.height).toBeCloseTo(bottomEdge(50), 5); // still bottom-anchored
  });

  it("a WIDE sofa keeps full width even in a very shallow rect (the depth-cap bug it fixes)", () => {
    // 2457x1083 (sofa) into 220x40: width-fill height ≈ 97; bound = 40+0.25*220=95 → barely trims.
    const fit = fitFootprint(2457, 1083, 220, 40);
    expect(fit.width / 220).toBeGreaterThan(0.95); // ~full width, unlike a depth-relative cap
  });

  it("depth does NOT change the scale when the overflow bound doesn't bind (wide sprite)", () => {
    const a = fitFootprint(200, 50, 80, 50);
    const b = fitFootprint(200, 50, 80, 45);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
  });

  it("tall-thin box: width-fills (no sideways blow-out), small sprite bottom-anchored", () => {
    const fit = fitFootprint(100, 100, 30, 100);
    expect(fit.width).toBe(30);
    expect(fit.height).toBe(30);
    expect(fit.y + fit.height).toBeCloseTo(bottomEdge(100), 5);
  });

  it("fills the box when natural dimensions are unknown (safe fallback)", () => {
    const fit = fitFootprint(0, 0, 80, 50);
    expect(fit).toEqual({ x: -40, y: -25, width: 80, height: 50 });
  });
});

describe("fitFootprintInSubRect (room interior — Fix 1: contained to the shell)", () => {
  it("fills the sub-rect width and bottom-anchors within it (kitchen shelf case)", () => {
    // Wide sprite (400x100, aspect 4) into a wide top-strip sub-rect of a 200x200 room.
    const place = { x: 0.1, y: 0.1, w: 0.8, h: 0.2 }; // subLeft=-80, subW=160, subBottom=-40
    const fit = fitFootprintInSubRect(400, 100, 200, 200, place);
    expect(fit.width).toBeCloseTo(160, 5); // spans the sub-rect width (no dead third)
    expect(fit.x).toBeCloseTo(-80, 5);
    expect(fit.y + fit.height).toBeCloseTo(-40, 5); // bottom-anchored in the sub-rect
  });

  it("CLAMPS a tall interior sprite so it never crosses the room shell's top edge", () => {
    // Tall sprite (100x260) in a SHALLOW room (200x80), top sub-rect → would overflow above the shell.
    const fit = fitFootprintInSubRect(100, 260, 200, 80, { x: 0.1, y: 0.02, w: 0.8, h: 0.25 });
    expect(fit.y).toBeGreaterThanOrEqual(-80 / 2 - 1e-6); // top stays at/below the shell top (-boxH/2)
  });
});

describe("getDesktopRect", () => {
  it("returns the measured rect for a known desk asset", () => {
    const rect = getDesktopRect("desk-chair-1");
    expect(rect).toEqual({ x: 0.03, y: 0.03, w: 0.94, h: 0.55 });
  });

  it("falls back to the default band for an unknown / undefined key", () => {
    expect(getDesktopRect("no-such-key")).toEqual(DEFAULT_DESKTOP_RECT);
    expect(getDesktopRect(undefined)).toEqual(DEFAULT_DESKTOP_RECT);
  });

  it("the default band stays in the upper region, clear of the chair", () => {
    // y + h must stay well above 1 (the chair is in the lower part of the sprite).
    expect(DEFAULT_DESKTOP_RECT.y + DEFAULT_DESKTOP_RECT.h).toBeLessThan(0.65);
  });
});

describe("computeTileBox", () => {
  const fit = { x: -40, y: -25, width: 80, height: 50 };

  it("FILLS the mapped desktop rect (keeps its w:h proportions), minus the token inset", () => {
    // rect maps to: left=-40, top=-25, rectW=80, rectH=25. inset = occupantTileInset*min(80,25).
    const inset = occupantTileInset * 25;
    const box = computeTileBox(fit, { x: 0, y: 0, w: 1, h: 0.5 });
    expect(box.x).toBeCloseTo(-40 + inset, 5); // left + inset
    expect(box.y).toBeCloseTo(-25 + inset, 5); // top + inset
    expect(box.w).toBeCloseTo(80 - 2 * inset, 5); // rectW - 2*inset
    expect(box.h).toBeCloseTo(25 - 2 * inset, 5); // rectH - 2*inset
    // A wide desktop → a wide (non-square) tile.
    expect(box.w).toBeGreaterThan(box.h);
  });

  it("keeps the tile within the desktop rect (never onto the chair below)", () => {
    const rect = getDesktopRect("desk-chair-1");
    const box = computeTileBox(fit, rect);
    const rectTop = fit.y + rect.y * fit.height;
    const rectBottom = fit.y + (rect.y + rect.h) * fit.height;
    expect(box.y).toBeGreaterThanOrEqual(rectTop - 1e-6);
    expect(box.y + box.h).toBeLessThanOrEqual(rectBottom + 1e-6);
  });

  it("PINS the occupant tile to the desk surface under the REAL footprint fit (PR 081 criterion 4)", () => {
    // desk-chair-1 trimmed ~2145x2150 (aspect ~1) fit into a typical 100x60 desk rect.
    const realFit = fitFootprint(2145, 2150, 100, 60);
    const rect = getDesktopRect("desk-chair-1");
    const box = computeTileBox(realFit, rect);
    // The tile must lie fully within the fit-mapped desktopRect — on its own desk's wood, never
    // spilling below (onto the chair) or outside horizontally, even though the fit moved.
    const left = realFit.x + rect.x * realFit.width;
    const right = realFit.x + (rect.x + rect.w) * realFit.width;
    const top = realFit.y + rect.y * realFit.height;
    const bottom = realFit.y + (rect.y + rect.h) * realFit.height;
    expect(box.x).toBeGreaterThanOrEqual(left - 1e-6);
    expect(box.x + box.w).toBeLessThanOrEqual(right + 1e-6);
    expect(box.y).toBeGreaterThanOrEqual(top - 1e-6);
    expect(box.y + box.h).toBeLessThanOrEqual(bottom + 1e-6);
  });
});

describe("computeHitRect (PR 081 fix-up 2 — union of floor rect and sprite bounds)", () => {
  it("(a) an OVERFLOWING desk: the hit rect extends up to the sprite top, killing the dead strip", () => {
    // A realistic desk: 100x60 rect, desk-chair-1-ish square art → sprite 84.8x85 spanning y -55..30.
    const fit = fitFootprint(2145, 2150, 100, 60);
    const hit = computeHitRect(fit, 100, 60);
    // covers the full sprite bounds
    expect(hit.x).toBeLessThanOrEqual(fit.x + 1e-9);
    expect(hit.x + hit.width).toBeGreaterThanOrEqual(fit.x + fit.width - 1e-9);
    expect(hit.y).toBeLessThanOrEqual(fit.y + 1e-9);
    expect(hit.y + hit.height).toBeGreaterThanOrEqual(fit.y + fit.height - 1e-9);
    // AND the full floor rect
    expect(hit.x).toBeLessThanOrEqual(-50);
    expect(hit.x + hit.width).toBeGreaterThanOrEqual(50);
    expect(hit.y).toBeLessThanOrEqual(-30);
    expect(hit.y + hit.height).toBeGreaterThanOrEqual(30);
    // the previously-dead 25px strip is now inside the hit rect
    expect(hit.y).toBeCloseTo(fit.y, 5);
    expect(-30 - hit.y).toBeGreaterThan(20);
  });

  it("(b) a WIDTH-CAPPED sprite keeps the floor rect's full width (union, not swap)", () => {
    // 100x100 art into 80x50 → capped to 70x70, i.e. NARROWER than the 80-wide floor rect.
    const fit = fitFootprint(100, 100, 80, 50);
    expect(fit.width).toBeLessThan(80); // precondition: the sprite really is narrower
    const hit = computeHitRect(fit, 80, 50);
    expect(hit.width).toBe(80); // floor-rect width preserved — not shrunk to the sprite
    expect(hit.x).toBe(-40);
    expect(hit.y).toBeCloseTo(fit.y, 5); // still extended upward
  });

  it("(c) a NON-overflowing object yields exactly the floor rect", () => {
    // Wide, short art sits inside the box: no overflow, nothing to add.
    const fit = fitFootprint(200, 50, 80, 50);
    expect(fit.y).toBeGreaterThanOrEqual(-25);
    expect(computeHitRect(fit, 80, 50)).toEqual({ x: -40, y: -25, width: 80, height: 50 });
  });

  it("is never smaller than the floor rect in either axis", () => {
    for (const [nW, nH, bW, bH] of [
      [2145, 2150, 100, 60],
      [100, 100, 80, 50],
      [200, 50, 80, 50],
      [3805, 1075, 240, 38],
    ] as const) {
      const hit = computeHitRect(fitFootprint(nW, nH, bW, bH), bW, bH);
      expect(hit.width).toBeGreaterThanOrEqual(bW - 1e-9);
      expect(hit.height).toBeGreaterThanOrEqual(bH - 1e-9);
    }
  });
});

describe("containInBox (PR 083 — the occupant photo is contained, not cropped)", () => {
  const BOX = { x: -30, y: -10, w: 60, h: 20 }; // wide and shallow, like a desk's top surface

  it("binds on HEIGHT for a square source in a wide box, and centres it", () => {
    const r = containInBox(100, 100, BOX);
    expect(r.h).toBeCloseTo(20, 9); // the short axis
    expect(r.w).toBeCloseTo(20, 9); // square in → square out
    expect(r.x).toBeCloseTo(-10, 9); // centred: -30 + (60-20)/2
    expect(r.y).toBeCloseTo(-10, 9);
  });

  it("binds on WIDTH for a source wider than the box, leaving equal gaps above and below", () => {
    const r = containInBox(400, 100, BOX); // aspect 4 > box aspect 3
    expect(r.w).toBeCloseTo(60, 9);
    expect(r.h).toBeCloseTo(15, 9);
    expect(r.y).toBeCloseTo(-7.5, 9); // -10 + (20-15)/2
    expect(r.x).toBeCloseTo(-30, 9);
  });

  it("never exceeds the box, and preserves the source aspect, across shapes", () => {
    for (const [nW, nH] of [
      [100, 100],
      [400, 100],
      [100, 400],
      [1200, 1600],
      [3, 2],
    ] as const) {
      const r = containInBox(nW, nH, BOX);
      expect(r.w / r.h).toBeCloseTo(nW / nH, 6);
      expect(r.w).toBeLessThanOrEqual(BOX.w + 1e-9);
      expect(r.h).toBeLessThanOrEqual(BOX.h + 1e-9);
      expect(r.x).toBeGreaterThanOrEqual(BOX.x - 1e-9);
      expect(r.y).toBeGreaterThanOrEqual(BOX.y - 1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(BOX.x + BOX.w + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(BOX.y + BOX.h + 1e-9);
      // Contain touches at least one axis — it is a fit, not an arbitrary shrink.
      expect(r.w === BOX.w || Math.abs(r.h - BOX.h) < 1e-9).toBe(true);
    }
  });

  it("unknown natural dimensions fall back to the token aspect, not to filling the box", () => {
    // The generated fallbacks (initials, "Guest") pass 0 deliberately; an image that never decoded
    // takes the same path, so the degenerate case still matches its neighbours.
    const r = containInBox(0, 0, BOX);
    expect(r.w / r.h).toBeCloseTo(occupantTileAspect, 9);
    expect(r.w).toBeLessThan(BOX.w);
  });

  it("a square source and a zero source land on the SAME rect (initials match photos)", () => {
    expect(containInBox(0, 0, BOX)).toEqual(containInBox(512, 512, BOX));
  });
});

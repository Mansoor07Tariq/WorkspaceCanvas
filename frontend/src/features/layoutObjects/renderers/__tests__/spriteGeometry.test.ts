import { describe, it, expect } from "vitest";
import { occupantTileInset } from "@/theme/tokens";
import {
  fitContain,
  computeTileBox,
  getDesktopRect,
  DEFAULT_DESKTOP_RECT,
} from "../isometric/spriteGeometry";

describe("fitContain", () => {
  it("contain-fits a square image into a wide box and centres it", () => {
    // 100x100 into 80x50 → scale min(0.8, 0.5)=0.5 → 50x50 centred.
    const fit = fitContain(100, 100, 80, 50);
    expect(fit.width).toBe(50);
    expect(fit.height).toBe(50);
    expect(fit.x).toBe(-25);
    expect(fit.y).toBe(-25);
  });

  it("fills the box when natural dimensions are unknown", () => {
    const fit = fitContain(0, 0, 80, 50);
    expect(fit).toEqual({ x: -40, y: -25, width: 80, height: 50 });
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
});

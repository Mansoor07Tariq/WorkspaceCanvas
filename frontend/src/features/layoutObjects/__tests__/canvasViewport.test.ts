import { describe, it, expect } from "vitest";
import {
  DEFAULT_VIEWPORT,
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_STEP,
  clampScale,
  zoomAroundPoint,
  wheelZoomFactor,
  formatZoomPercent,
} from "../utils/canvasViewport";

describe("clampScale", () => {
  it("clamps below MIN_SCALE", () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE);
  });
  it("clamps above MAX_SCALE", () => {
    expect(clampScale(10)).toBe(MAX_SCALE);
  });
  it("passes through an in-range scale", () => {
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe("zoomAroundPoint", () => {
  it("keeps the world point under the focus pinned to that screen point", () => {
    const start = { scale: 1, x: 0, y: 0 };
    const focusX = 200;
    const focusY = 100;
    // world point under focus before zoom
    const worldX = (focusX - start.x) / start.scale;
    const worldY = (focusY - start.y) / start.scale;

    const next = zoomAroundPoint(start, ZOOM_STEP, focusX, focusY);

    // after zoom, that same world point must map back to the same screen point
    expect(next.x + worldX * next.scale).toBeCloseTo(focusX);
    expect(next.y + worldY * next.scale).toBeCloseTo(focusY);
  });

  it("zooms in by the factor", () => {
    const next = zoomAroundPoint({ scale: 1, x: 0, y: 0 }, ZOOM_STEP, 0, 0);
    expect(next.scale).toBeCloseTo(ZOOM_STEP);
  });

  it("clamps scale at MAX_SCALE", () => {
    const next = zoomAroundPoint({ scale: MAX_SCALE, x: 0, y: 0 }, ZOOM_STEP, 100, 100);
    expect(next.scale).toBe(MAX_SCALE);
  });

  it("clamps scale at MIN_SCALE", () => {
    const next = zoomAroundPoint({ scale: MIN_SCALE, x: 0, y: 0 }, 1 / ZOOM_STEP, 100, 100);
    expect(next.scale).toBe(MIN_SCALE);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in when scrolling up (deltaY < 0)", () => {
    expect(wheelZoomFactor(-100)).toBe(ZOOM_STEP);
  });
  it("zooms out when scrolling down (deltaY > 0)", () => {
    expect(wheelZoomFactor(100)).toBe(1 / ZOOM_STEP);
  });
});

describe("formatZoomPercent", () => {
  it("formats default scale as 100%", () => {
    expect(formatZoomPercent(DEFAULT_VIEWPORT.scale)).toBe("100%");
  });
  it("rounds to the nearest integer percent", () => {
    expect(formatZoomPercent(1.156)).toBe("116%");
  });
});

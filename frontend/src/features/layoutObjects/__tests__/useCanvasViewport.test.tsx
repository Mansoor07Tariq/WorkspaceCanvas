import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { DEFAULT_VIEWPORT, MIN_SCALE, MAX_SCALE } from "../utils/canvasViewport";

describe("useCanvasViewport", () => {
  it("starts at the default viewport", () => {
    const { result } = renderHook(() => useCanvasViewport());
    expect(result.current.viewport).toEqual(DEFAULT_VIEWPORT);
  });

  it("zoomIn increases scale", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => result.current.zoomIn());
    expect(result.current.viewport.scale).toBeGreaterThan(1);
  });

  it("zoomOut decreases scale", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => result.current.zoomOut());
    expect(result.current.viewport.scale).toBeLessThan(1);
  });

  it("does not zoom in past MAX_SCALE", () => {
    const { result } = renderHook(() => useCanvasViewport());
    for (let i = 0; i < 40; i++) act(() => result.current.zoomIn());
    expect(result.current.viewport.scale).toBe(MAX_SCALE);
  });

  it("does not zoom out past MIN_SCALE", () => {
    const { result } = renderHook(() => useCanvasViewport());
    for (let i = 0; i < 40; i++) act(() => result.current.zoomOut());
    expect(result.current.viewport.scale).toBe(MIN_SCALE);
  });

  it("reset returns to the default viewport", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => result.current.zoomIn());
    act(() => result.current.setViewport({ scale: 2, x: 100, y: 50 }));
    act(() => result.current.reset());
    expect(result.current.viewport).toEqual(DEFAULT_VIEWPORT);
  });

  it("zoomAt anchors zoom to the given screen point", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => result.current.zoomAt(1.15, 300, 200));
    // world point (300,200) at scale 1 stays under (300,200) after zoom
    const { scale, x, y } = result.current.viewport;
    expect(x + 300 * scale).toBeCloseTo(300);
    expect(y + 200 * scale).toBeCloseTo(200);
  });
});

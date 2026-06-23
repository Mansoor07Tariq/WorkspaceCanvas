import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFloorBoundary } from "../hooks/useFloorBoundary";
import {
  DEFAULT_FLOOR_BOUNDARY,
  FLOOR_BOUNDARY_INSET,
  MIN_FLOOR_BOUNDARY,
} from "../utils/coordinateHelpers";
import type { Floor } from "@/features/floors/types/floor.types";

const updateFloorMock = vi.fn();
vi.mock("@/features/floors/api/floorApi", () => ({
  updateFloor: (...args: unknown[]) => updateFloorMock(...args),
}));

function makeFloor(overrides: Partial<Floor> = {}): Floor {
  return {
    id: 7,
    organization: 1,
    office: 2,
    name: "Ground",
    slug: "ground",
    level_number: 0,
    boundary_width: "1200",
    boundary_height: "800",
    status: "published",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const baseParams = {
  officeId: 2,
  floorId: 7,
  canManage: true,
};

describe("useFloorBoundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateFloorMock.mockReset().mockResolvedValue(makeFloor());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the fixed boundary before the floor loads", () => {
    const { result } = renderHook(() => useFloorBoundary({ ...baseParams, floor: undefined }));
    expect(result.current.boundary).toEqual(DEFAULT_FLOOR_BOUNDARY);
  });

  it("seeds from the loaded floor's saved dimensions", () => {
    const { result } = renderHook(() => useFloorBoundary({ ...baseParams, floor: makeFloor() }));
    expect(result.current.boundary).toEqual({
      x: FLOOR_BOUNDARY_INSET,
      y: FLOOR_BOUNDARY_INSET,
      width: 1200,
      height: 800,
    });
  });

  it("ignores floors with missing/NaN dimensions (keeps default)", () => {
    const { result } = renderHook(() =>
      useFloorBoundary({
        ...baseParams,
        // simulate malformed API data (missing boundary dimensions)
        floor: makeFloor({ boundary_width: undefined, boundary_height: undefined }),
      })
    );
    expect(result.current.boundary).toEqual(DEFAULT_FLOOR_BOUNDARY);
  });

  it("updates locally immediately and persists debounced", () => {
    const { result } = renderHook(() => useFloorBoundary({ ...baseParams, floor: makeFloor() }));
    act(() => result.current.resizeBoundary(1500, 900));
    expect(result.current.boundary.width).toBe(1500);
    expect(result.current.boundary.height).toBe(900);
    // Not persisted yet (debounced).
    expect(updateFloorMock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(600));
    expect(updateFloorMock).toHaveBeenCalledWith(2, 7, {
      boundary_width: 1500,
      boundary_height: 900,
    });
  });

  it("clamps out-of-range sizes before persisting", () => {
    const { result } = renderHook(() => useFloorBoundary({ ...baseParams, floor: makeFloor() }));
    act(() => result.current.resizeBoundary(10, 10));
    expect(result.current.boundary.width).toBe(MIN_FLOOR_BOUNDARY);
    act(() => vi.advanceTimersByTime(600));
    expect(updateFloorMock).toHaveBeenCalledWith(2, 7, {
      boundary_width: MIN_FLOOR_BOUNDARY,
      boundary_height: MIN_FLOOR_BOUNDARY,
    });
  });

  it("does not persist when the user cannot manage", () => {
    const { result } = renderHook(() =>
      useFloorBoundary({ ...baseParams, canManage: false, floor: makeFloor() })
    );
    act(() => result.current.resizeBoundary(1500, 900));
    act(() => vi.advanceTimersByTime(600));
    expect(updateFloorMock).not.toHaveBeenCalled();
    // ...but the local size still updates so members see a consistent room.
    expect(result.current.boundary.width).toBe(1500);
  });

  it("debounces rapid resizes into a single persist", () => {
    const { result } = renderHook(() => useFloorBoundary({ ...baseParams, floor: makeFloor() }));
    act(() => result.current.resizeBoundary(1000, 800));
    act(() => vi.advanceTimersByTime(300));
    act(() => result.current.resizeBoundary(1100, 800));
    act(() => vi.advanceTimersByTime(300));
    expect(updateFloorMock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(600));
    expect(updateFloorMock).toHaveBeenCalledTimes(1);
    expect(updateFloorMock).toHaveBeenCalledWith(2, 7, {
      boundary_width: 1100,
      boundary_height: 800,
    });
  });

  it("notifies onResizeSettled after a persist settles", async () => {
    // Real timers here so the persist promise chain (.finally) actually flushes.
    vi.useRealTimers();
    const onResizeSettled = vi.fn();
    const { result } = renderHook(() =>
      useFloorBoundary({ ...baseParams, floor: makeFloor(), onResizeSettled })
    );
    act(() => result.current.resizeBoundary(1300, 700));
    await waitFor(() => expect(onResizeSettled).toHaveBeenCalled());
    expect(onResizeSettled).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1300, height: 700 })
    );
  });
});

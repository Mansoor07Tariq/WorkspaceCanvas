import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../../enhanceApply", () => ({
  applyEnhancePlan: vi.fn(),
  undoEnhanceRun: vi.fn(),
  retryEnhanceRun: vi.fn(),
  newPlanId: () => "plan-fixed",
}));

import { applyEnhancePlan, undoEnhanceRun, retryEnhanceRun } from "../../enhanceApply";
import { useEnhanceTidy } from "../useEnhanceTidy";
import { DEFAULT_FLOOR_BOUNDARY } from "../../utils/coordinateHelpers";
import type { LayoutObject } from "../../types/layoutObject.types";
import type { EnhanceRunResult } from "../../enhanceApply";

const mockApply = vi.mocked(applyEnhancePlan);
const mockUndo = vi.mocked(undoEnhanceRun);
const mockRetry = vi.mocked(retryEnhanceRun);

function obj(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 1,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "",
    x: "100.00",
    y: "200.00",
    width: "80.00",
    height: "50.00",
    rotation: "0.00",
    is_bookable: false,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

// Two different-sized, touching desks → engine produces resize operations.
const messyObjects = [
  obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" }),
  obj({ id: 2, x: "182.00", y: "200.00", width: "120.00", height: "90.00" }),
];

function setup(objects: LayoutObject[] = messyObjects) {
  const onObjectsUpdated = vi.fn();
  const hook = renderHook(() =>
    useEnhanceTidy({
      officeId: 3,
      floorId: 5,
      buildInput: () => ({ boundary: DEFAULT_FLOOR_BOUNDARY, objects, cutouts: [] }),
      onObjectsUpdated,
    })
  );
  return { ...hook, onObjectsUpdated };
}

const runResult = (over: Partial<EnhanceRunResult> = {}): EnhanceRunResult => ({
  enhance_run_id: 99,
  status: "success",
  applied_count: 2,
  failed_count: 0,
  skipped_count: 0,
  operation_results: [],
  updated_objects: [obj({ id: 1, x: "100.00" })],
  ...over,
});

beforeEach(() => {
  mockApply.mockReset();
  mockUndo.mockReset();
  mockRetry.mockReset();
});

describe("useEnhanceTidy", () => {
  it("starts idle and opens a preview with a computed plan", () => {
    const { result } = setup();
    expect(result.current.phase).toBe("idle");
    act(() => result.current.openPreview());
    expect(result.current.phase).toBe("preview");
    expect(result.current.plan?.operations.length).toBeGreaterThan(0);
    expect(result.current.suggestions.length).toBeGreaterThan(0);
    // All suggestions are selected by default.
    expect(result.current.selectedSuggestionIds.size).toBe(result.current.suggestions.length);
    expect(result.current.canApply).toBe(true);
  });

  it("deselecting all suggestions disables apply and makes apply a no-op", async () => {
    const { result } = setup();
    act(() => result.current.openPreview());
    for (const s of result.current.suggestions) {
      act(() => result.current.toggleSuggestion(s.id));
    }
    expect(result.current.canApply).toBe(false);
    await act(async () => {
      await result.current.apply();
    });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("applies only the selected suggestions' operations (selection-keyed plan id)", async () => {
    mockApply.mockResolvedValue(runResult());
    const wall = obj({
      id: 3,
      object_type: "wall",
      x: "700.00",
      y: "300.00",
      width: "246.00",
      height: "10.00",
    });
    const { result } = setup([...messyObjects, wall]);
    act(() => result.current.openPreview());
    expect(result.current.suggestions.length).toBe(2); // resize (desks) + wallExtend
    act(() => result.current.toggleSuggestion("tidy-wallExtend")); // drop the wall
    expect(result.current.selectedObjectCount).toBe(2);
    await act(async () => {
      await result.current.apply();
    });
    const planArg = mockApply.mock.calls[0][2];
    expect(planArg.operations.map((o) => o.objectId).sort()).toEqual([1, 2]);
    const planIdArg = mockApply.mock.calls[0][3] as string;
    expect(planIdArg.startsWith("plan-fixed:")).toBe(true);
    expect(planIdArg.length).toBeLessThanOrEqual(64); // backend plan_id CharField limit
  });

  it("keeps the apply plan_id within the backend 64-char limit for a large selection", async () => {
    mockApply.mockResolvedValue(runResult());
    // 60 desks that all need aligning → a big selection.
    const many = Array.from({ length: 60 }, (_, i) =>
      obj({ id: i + 1, x: `${100 + i * 80}.00`, y: i % 2 === 0 ? "200.00" : "203.00" })
    );
    const { result } = setup(many);
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.apply();
    });
    const planIdArg = mockApply.mock.calls[0][3] as string;
    expect(planIdArg.length).toBeLessThanOrEqual(64);
  });

  it("applies the plan, resyncs objects, and exposes undo", async () => {
    mockApply.mockResolvedValue(runResult());
    const { result, onObjectsUpdated } = setup();
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.apply();
    });
    expect(mockApply).toHaveBeenCalledWith(
      3,
      5,
      expect.anything(),
      expect.stringContaining("plan-fixed")
    );
    expect(onObjectsUpdated).toHaveBeenCalled();
    expect(result.current.phase).toBe("result");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRetry).toBe(false);
  });

  it("shows retry when operations failed", async () => {
    mockApply.mockResolvedValue(
      runResult({ status: "partial_success", applied_count: 1, failed_count: 1 })
    );
    const { result } = setup();
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.canRetry).toBe(true);
    expect(result.current.canUndo).toBe(true);
  });

  it("undo calls the adapter and hides further undo", async () => {
    mockApply.mockResolvedValue(runResult());
    mockUndo.mockResolvedValue(runResult({ enhance_run_id: 100 }));
    const { result } = setup();
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.apply();
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(mockUndo).toHaveBeenCalledWith(3, 5, 99);
    expect(result.current.lastAction).toBe("undo");
    expect(result.current.canUndo).toBe(false);
  });

  it("retry calls the adapter for the failed run", async () => {
    mockApply.mockResolvedValue(
      runResult({ status: "partial_success", applied_count: 1, failed_count: 1 })
    );
    mockRetry.mockResolvedValue(runResult({ enhance_run_id: 101, failed_count: 0 }));
    const { result } = setup();
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.apply();
    });
    await act(async () => {
      await result.current.retry();
    });
    expect(mockRetry).toHaveBeenCalledWith(3, 5, 99);
    expect(result.current.lastAction).toBe("retry");
  });

  it("does not call the backend for an already-tidy plan", async () => {
    const { result } = setup([obj({ id: 1, x: "400.00", y: "400.00" })]);
    act(() => result.current.openPreview());
    expect(result.current.plan?.operations).toHaveLength(0);
    await act(async () => {
      await result.current.apply();
    });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("sets an error flag when apply throws", async () => {
    mockApply.mockRejectedValue(new Error("network"));
    const { result } = setup();
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.apply();
    });
    await waitFor(() => expect(result.current.error).toBe(true));
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/apiError";
import type { LayoutObject } from "../types/layoutObject.types";

vi.mock("../api/layoutObjectApi", () => ({
  updateLayoutObject: vi.fn(),
}));

import { updateLayoutObject } from "../api/layoutObjectApi";
import { useCanvasInteractions } from "../hooks/useCanvasInteractions";
import type { UseCanvasInteractionsParams } from "../hooks/useCanvasInteractions";

const mockUpdate = vi.mocked(updateLayoutObject);

const OBJ: LayoutObject = {
  id: 42,
  floor: 3,
  object_type: "desk",
  object_type_display: "Desk",
  label: "Desk A1",
  x: "100.00",
  y: "150.00",
  width: "80.00",
  height: "50.00",
  rotation: "0.00",
  is_bookable: false,
  metadata: {},
  is_active: true,
  created_at: "",
  updated_at: "",
};

// A tiny stateful harness mirroring useLayoutObjects' local update/saving behaviour,
// so optimistic update + rollback + saving suppression can be asserted at the hook level.
function makeParams(
  overrides: Partial<UseCanvasInteractionsParams> = {}
): UseCanvasInteractionsParams {
  return {
    officeId: 1,
    floorId: 3,
    objects: [OBJ],
    selectedObjectId: 42,
    canManageLayout: true,
    snapEnabled: false,
    gridSize: 20,
    savingObjectIds: new Set<number>(),
    updateObjectLocally: vi.fn(),
    setSaving: vi.fn(),
    ...overrides,
  };
}

function arrowEvent(key: string, opts: Partial<KeyboardEvent> = {}) {
  return {
    key,
    repeat: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...opts,
  } as unknown as React.KeyboardEvent<HTMLDivElement>;
}

describe("useCanvasInteractions — drag/move", () => {
  beforeEach(() => vi.clearAllMocks());

  it("successful drag calls updateLayoutObject with snapped+clamped coords and flags saving", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook((p: UseCanvasInteractionsParams) => useCanvasInteractions(p), {
      initialProps: params,
    });

    await act(async () => {
      result.current.handleObjectDragEnd(42, 200, 300);
    });

    expect(params.updateObjectLocally).toHaveBeenCalledWith(42, { x: "200.00", y: "300.00" });
    expect(params.setSaving).toHaveBeenCalledWith(42, true);
    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "200.00", y: "300.00" });
    await waitFor(() => expect(params.setSaving).toHaveBeenCalledWith(42, false));
    expect(result.current.savedObjectId).toBe(42);
  });

  it("failed drag rolls back local coords and sets an error", async () => {
    mockUpdate.mockRejectedValue(new ApiError(500, {}));
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(42, 200, 300);
    });

    await waitFor(() => expect(result.current.layoutSaveError).toBeDefined());
    // rollback restores prevObj x/y
    expect(params.updateObjectLocally).toHaveBeenCalledWith(42, { x: "100.00", y: "150.00" });
  });

  it("403 failure surfaces the permission-specific error message", async () => {
    mockUpdate.mockRejectedValue(new ApiError(403, {}));
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(42, 200, 300);
    });

    await waitFor(() => expect(result.current.layoutSaveError).toMatch(/permission/i));
  });

  it("does not start a second save while one is in flight (savingObjectIds guard)", async () => {
    const params = makeParams({ savingObjectIds: new Set([42]) });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(42, 200, 300);
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("is a no-op when the object id is missing from objects", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(999, 10, 10);
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("snap enabled rounds drag coords to the grid", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams({ snapEnabled: true, gridSize: 20 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(42, 205, 307); // → 200, 300
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "200.00", y: "300.00" });
  });

  it("clamps negative drag coords to 0,0", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(42, -50, -50);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "0.00", y: "0.00" });
  });
});

describe("useCanvasInteractions — transform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("successful transform persists x/y/width/height/rotation", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectTransform(42, 50, 60, 120, 70, 45);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, {
      x: "50.00",
      y: "60.00",
      width: "120.00",
      height: "70.00",
      rotation: "45.00",
    });
  });

  it("failed transform rolls back all five fields", async () => {
    mockUpdate.mockRejectedValue(new ApiError(500, {}));
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectTransform(42, 50, 60, 120, 70, 45);
    });

    await waitFor(() => expect(result.current.layoutSaveError).toBeDefined());
    expect(params.updateObjectLocally).toHaveBeenCalledWith(42, {
      x: "100.00",
      y: "150.00",
      width: "80.00",
      height: "50.00",
      rotation: "0.00",
    });
  });

  it("snap enabled snaps size and position, never sends scale", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams({ snapEnabled: true, gridSize: 20 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectTransform(42, 50, 60, 120, 70, 45);
    });

    const payload = mockUpdate.mock.calls[0][3] as Record<string, unknown>;
    expect(payload).toMatchObject({
      x: "60.00",
      y: "60.00",
      width: "120.00",
      height: "80.00",
      rotation: "45.00",
    });
    expect("scaleX" in payload).toBe(false);
    expect("scaleY" in payload).toBe(false);
  });
});

describe("useCanvasInteractions — keyboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ArrowRight moves selected object by 1px", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowRight"));
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "101.00", y: "150.00" });
  });

  it("Shift+ArrowDown moves by 10px", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowDown", { shiftKey: true }));
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "100.00", y: "160.00" });
  });

  it("snap enabled steps by gridSize and does not jump the stationary axis", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams({ snapEnabled: true, gridSize: 20 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowRight"));
    });

    // x: 100 + 20 = 120 (on grid); y stays 150 (not snapped to 160)
    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "120.00", y: "150.00" });
  });

  it("e.repeat is ignored — no PATCH", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowRight", { repeat: true }));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("member (read-only) cannot keyboard-move", async () => {
    const params = makeParams({ canManageLayout: false });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowRight"));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("no selected object → no PATCH", async () => {
    const params = makeParams({ selectedObjectId: null });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowRight"));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("non-arrow key is ignored", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("Enter"));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

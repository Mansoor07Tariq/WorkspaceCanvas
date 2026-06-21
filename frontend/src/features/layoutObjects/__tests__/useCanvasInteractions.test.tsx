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
import { DEFAULT_FLOOR_BOUNDARY, makeFloorBoundary } from "../utils/coordinateHelpers";

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

  it("aligns a dropped object flush to an adjacent neighbour", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    // Neighbour A at (100,100) 80×50; dragged object B (id 43) dropped just past
    // A's right edge / slightly below its top → snaps to (180,100).
    const A = { ...OBJ, id: 1, x: "100.00", y: "100.00", width: "80.00", height: "50.00" };
    const B = { ...OBJ, id: 43, width: "80.00", height: "50.00" };
    const params = makeParams({ objects: [A, B], selectedObjectId: 43 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(43, 183, 104);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 43, { x: "180.00", y: "100.00" });
  });

  it("clamps negative drag coords to the boundary top-left (48,48)", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectDragEnd(42, -50, -50);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "48.00", y: "48.00" });
  });
});

describe("useCanvasInteractions — overlap & walls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pushes a dropped object out of an overlapping neighbour instead of reverting", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const A = { ...OBJ, id: 1, x: "100.00", y: "100.00", width: "80.00", height: "50.00" };
    const B = { ...OBJ, id: 43, width: "80.00", height: "50.00" };
    const params = makeParams({ objects: [A, B], selectedObjectId: 43 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    // Dropped overlapping A from the right → pushed flush to A's right edge (180);
    // the 10px top offset is within the connect threshold so tops also align (100).
    await act(async () => {
      result.current.handleObjectDragEnd(43, 150, 110);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 43, { x: "180.00", y: "100.00" });
  });

  it("reverts to the pickup spot (no PATCH) when a drop overlaps two objects", async () => {
    const A = { ...OBJ, id: 1, x: "100.00", y: "100.00", width: "80.00", height: "50.00" };
    const C = { ...OBJ, id: 2, x: "200.00", y: "100.00", width: "80.00", height: "50.00" };
    // B (id 43) starts at its OBJ default (100,150).
    const B = { ...OBJ, id: 43, width: "80.00", height: "50.00" };
    const params = makeParams({ objects: [A, C, B], selectedObjectId: 43 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    let ret: { x: number; y: number } | undefined;
    await act(async () => {
      ret = result.current.handleObjectDragEnd(43, 150, 100); // overlaps A and C
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(ret).toEqual({ x: 100, y: 150 }); // back to pickup position
  });

  it("moves a wall together with the doors/windows mounted on it", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const wall = {
      ...OBJ,
      id: 1,
      object_type: "wall" as const,
      x: "200.00",
      y: "400.00",
      width: "100.00",
      height: "10.00",
    };
    const door = {
      ...OBJ,
      id: 2,
      object_type: "door" as const,
      x: "240.00",
      y: "400.00",
      width: "20.00",
      height: "10.00",
    };
    const params = makeParams({ objects: [wall, door], selectedObjectId: 1 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    // Drag the wall up by 100 → the mounted door translates by the same delta.
    await act(async () => {
      result.current.handleObjectDragEnd(1, 200, 300);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 1, { x: "200.00", y: "300.00" });
    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 2, { x: "240.00", y: "300.00" });
  });

  it("resizes the mounted doors/windows together with the wall", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const wall = {
      ...OBJ,
      id: 1,
      object_type: "wall" as const,
      x: "200.00",
      y: "400.00",
      width: "100.00",
      height: "10.00",
      rotation: "0.00",
    };
    const door = {
      ...OBJ,
      id: 2,
      object_type: "door" as const,
      x: "240.00",
      y: "400.00",
      width: "20.00",
      height: "10.00",
      rotation: "0.00",
    };
    const params = makeParams({ objects: [wall, door], selectedObjectId: 1 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    // Double the wall length (100 → 200) → the door scales to width 40 with it.
    await act(async () => {
      result.current.handleObjectTransform(1, 200, 400, 200, 10, 0);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 1, {
      x: "200.00",
      y: "400.00",
      width: "200.00",
      height: "10.00",
      rotation: "0.00",
    });
    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 2, {
      x: "280.00",
      y: "400.00",
      width: "40.00",
      height: "10.00",
      rotation: "0.00",
    });
  });
});

describe("useCanvasInteractions — wall-mounted (door/window)", () => {
  beforeEach(() => vi.clearAllMocks());

  // Door on the top boundary wall: centre (500, 42), 40×12 → top-left (480, 36).
  const DOOR: LayoutObject = {
    ...OBJ,
    id: 7,
    object_type: "door",
    object_type_display: "Door",
    x: "480.00",
    y: "36.00",
    width: "40.00",
    height: "12.00",
  };

  it("drag slides the door along the wall and is NOT boundary-clamped", async () => {
    mockUpdate.mockResolvedValue(DOOR);
    const params = makeParams({ objects: [DOOR], selectedObjectId: 7 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    // Drag 100px right + 200px down → stays on the wall (re-centred to the wall
    // centreline y=33 for an 18px wall).
    await act(async () => {
      result.current.handleObjectDragEnd(7, 580, 236);
    });

    // y stays on the wall line (outside the 48px room) → proves no boundary clamp.
    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 7, { x: "580.00", y: "33.00" });
  });

  it("resizes a door's length along the wall (thickness and rotation stay locked)", async () => {
    mockUpdate.mockResolvedValue(DOOR);
    const wall = {
      ...OBJ,
      id: 1,
      object_type: "wall" as const,
      x: "200.00",
      y: "400.00",
      width: "100.00",
      height: "10.00",
      rotation: "0.00",
    };
    const door = {
      ...OBJ,
      id: 2,
      object_type: "door" as const,
      x: "240.00",
      y: "400.00",
      width: "20.00",
      height: "10.00",
      rotation: "0.00",
    };
    const params = makeParams({ objects: [wall, door], selectedObjectId: 2 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    // Transformer grows the door from 20 → 40 (left edge fixed at 240).
    await act(async () => {
      result.current.handleObjectTransform(2, 240, 400, 40, 10, 0);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 2, {
      x: "240.00",
      y: "400.00",
      width: "40.00",
      height: "10.00",
      rotation: "0.00",
    });
  });

  it("keyboard ArrowDown does not push the door off its wall", async () => {
    mockUpdate.mockResolvedValue(DOOR);
    const params = makeParams({ objects: [DOOR], selectedObjectId: 7 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowDown"));
    });

    // Perpendicular move is ignored — the door stays on the wall line (y=33).
    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 7, { x: "480.00", y: "33.00" });
  });
});

describe("useCanvasInteractions — transform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("successful transform persists x/y/width/height/rotation", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectTransform(42, 50, 60, 120, 70, 40);
    });

    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, {
      x: "50.00",
      y: "60.00",
      width: "120.00",
      height: "70.00",
      rotation: "40.00",
    });
  });

  it("snaps the rotation to the nearest multiple of 10 (86 → 90)", async () => {
    mockUpdate.mockResolvedValue(OBJ);
    const params = makeParams();
    const { result } = renderHook(() => useCanvasInteractions(params));

    await act(async () => {
      result.current.handleObjectTransform(42, 50, 60, 120, 70, 86);
    });

    const payload = mockUpdate.mock.calls[0][3] as Record<string, unknown>;
    expect(payload.rotation).toBe("90.00");
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
      result.current.handleObjectTransform(42, 50, 60, 120, 70, 40);
    });

    const payload = mockUpdate.mock.calls[0][3] as Record<string, unknown>;
    expect(payload).toMatchObject({
      x: "60.00",
      y: "60.00",
      width: "120.00",
      height: "80.00",
      rotation: "40.00",
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

  it("blocks a keyboard move that would overlap another object", async () => {
    // Neighbour A occupies [180,260]; selected OBJ is at [100,180] (touching).
    const A = { ...OBJ, id: 2, x: "180.00", y: "150.00", width: "80.00", height: "50.00" };
    const params = makeParams({ objects: [A, OBJ], selectedObjectId: 42 });
    const { result } = renderHook(() => useCanvasInteractions(params));

    // ArrowRight → x 101 → right edge 181 overlaps A → blocked.
    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowRight"));
    });
    expect(mockUpdate).not.toHaveBeenCalled();

    // ArrowLeft → x 99 → moves away, no overlap → allowed.
    await act(async () => {
      result.current.handleCanvasKeyDown(arrowEvent("ArrowLeft"));
    });
    expect(mockUpdate).toHaveBeenCalledWith(1, 3, 42, { x: "99.00", y: "150.00" });
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

  // ─── applyBoundaryResize (directional resize) ─────────────────────────────

  describe("applyBoundaryResize", () => {
    it("shifts furniture by the origin delta when a top/left handle moved", async () => {
      mockUpdate.mockResolvedValue(OBJ);
      const params = makeParams(); // single desk at (100,150)
      const { result } = renderHook(() => useCanvasInteractions(params));

      await act(async () => {
        result.current.applyBoundaryResize(
          DEFAULT_FLOOR_BOUNDARY,
          makeFloorBoundary(904, 644), // taller room
          0,
          100 // origin moved → furniture shifts down by 100
        );
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "100.00", y: "250.00" })
      );
    });

    it("does not shift furniture when the shift is zero (bottom/right grow)", async () => {
      mockUpdate.mockResolvedValue(OBJ);
      const params = makeParams();
      const { result } = renderHook(() => useCanvasInteractions(params));

      await act(async () => {
        result.current.applyBoundaryResize(
          DEFAULT_FLOOR_BOUNDARY,
          makeFloorBoundary(1200, 544),
          0,
          0
        );
      });

      // No boundary-wall openings and zero shift → nothing moves.
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("carries a boundary-wall opening onto the resized wall", async () => {
      mockUpdate.mockResolvedValue(OBJ);
      // A door flush on the bottom boundary wall (centre y≈598), centred at x=300.
      const bottomDoor: LayoutObject = {
        ...OBJ,
        id: 7,
        object_type: "door",
        x: "280.00",
        y: "593.00",
        width: "40.00",
        height: "10.00",
      };
      const params = makeParams({ objects: [bottomDoor], selectedObjectId: 7 });
      const { result } = renderHook(() => useCanvasInteractions(params));

      await act(async () => {
        result.current.applyBoundaryResize(
          DEFAULT_FLOOR_BOUNDARY,
          makeFloorBoundary(1200, 544), // widen → bottom wall lengthens
          0,
          0
        );
      });

      // The door is re-placed on the new (longer) bottom wall, not left behind.
      // Re-centred on the bottom wall centreline (601 for an 18px wall) → y=596.
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(1, 3, 7, expect.objectContaining({ y: "596.00" }));
    });
  });
});

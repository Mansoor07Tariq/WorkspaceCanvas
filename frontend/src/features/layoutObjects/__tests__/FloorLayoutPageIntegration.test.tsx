/**
 * Integration tests for FloorLayoutPage drag/transform/keyboard optimistic update and rollback.
 *
 * Strategy: mock react-konva (canvas), useAuth, and the layout object API.
 * Trigger drag/transform/keyboard via the FloorMapCanvas mock's callbacks.
 * Assert local state updates, PATCH calls, rollback on failure, and saved feedback.
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/lib/api/apiError";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="floor-map-stage">{children}</div>
  ),
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Rect: () => null,
  Circle: () => null,
  Line: () => null,
  Text: ({ text }: { text?: string }) => (text ? <span>{text}</span> : null),
  Group: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="canvas-group">{children}</div>
  ),
  Transformer: () => null,
}));

// Mock the entire FloorMapCanvas so we can control drag/transform/keyboard callbacks
vi.mock("@/features/layoutObjects/components/FloorMapCanvas", () => ({
  FloorMapCanvas: ({
    objects,
    onSelectObject,
    onObjectDragEnd,
    onObjectTransformEnd,
    savingObjectIds,
    onKeyDown,
  }: {
    objects: { id: number; x: string; y: string; width: string; height: string }[];
    onSelectObject: (id: number | null) => void;
    onObjectDragEnd?: (id: number, x: number, y: number) => void;
    onObjectTransformEnd?: (
      id: number,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => void;
    savingObjectIds?: ReadonlySet<number>;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  }) => (
    <div data-testid="floor-map-canvas" onKeyDown={onKeyDown} tabIndex={0}>
      {objects.map((obj) => (
        <div key={obj.id} data-testid={`canvas-obj-${obj.id}`}>
          <span data-testid={`obj-x-${obj.id}`}>{obj.x}</span>
          <span data-testid={`obj-y-${obj.id}`}>{obj.y}</span>
          {savingObjectIds?.has(obj.id) && <span data-testid={`obj-saving-${obj.id}`}>saving</span>}
          <button onClick={() => onSelectObject(obj.id)} data-testid={`select-${obj.id}`}>
            select
          </button>
          {/* Normal drag at (200, 300) — within canvas bounds, already on 20px grid */}
          <button
            onClick={() => onObjectDragEnd?.(obj.id, 200, 300)}
            data-testid={`drag-${obj.id}`}
          >
            drag
          </button>
          {/* Unaligned drag: (205, 307) — not on 20px grid, used to test snap rounding */}
          <button
            onClick={() => onObjectDragEnd?.(obj.id, 205, 307)}
            data-testid={`drag-unaligned-${obj.id}`}
          >
            drag-unaligned
          </button>
          {/* Out-of-bounds drag: negative coords → expect clamp to (0, 0) */}
          <button
            onClick={() => onObjectDragEnd?.(obj.id, -50, -50)}
            data-testid={`drag-neg-${obj.id}`}
          >
            drag-neg
          </button>
          {/* Out-of-bounds drag: far outside → expect clamp to max valid (920, 590) for w=80, h=50 */}
          <button
            onClick={() => onObjectDragEnd?.(obj.id, 2000, 2000)}
            data-testid={`drag-far-${obj.id}`}
          >
            drag-far
          </button>
          <button
            onClick={() => onObjectTransformEnd?.(obj.id, 50, 60, 120, 70, 45)}
            data-testid={`transform-${obj.id}`}
          >
            transform
          </button>
        </div>
      ))}
    </div>
  ),
  CANVAS_WIDTH: 1000,
  CANVAS_HEIGHT: 640,
}));

// Controllable auth mock — default to owner; override per-test via mockUseAuth.mockReturnValueOnce
const { mockUseAuth } = vi.hoisted(() => {
  const mockUseAuth = vi.fn().mockReturnValue({
    user: { id: 1, memberships: [{ role: "owner", has_active_access: true }] },
  });
  return { mockUseAuth };
});

vi.mock("@/features/auth", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/features/layoutObjects/api/layoutObjectApi");
vi.mock("@/features/layoutObjects/api/floorApi", () => ({ listFloors: vi.fn() }));

import {
  listLayoutObjects,
  updateLayoutObject,
} from "@/features/layoutObjects/api/layoutObjectApi";
import { FloorLayoutPage } from "@/app/pages/FloorLayoutPage";

const mockListLayoutObjects = vi.mocked(listLayoutObjects);
const mockUpdateLayoutObject = vi.mocked(updateLayoutObject);

const MOCK_OBJ = {
  id: 42,
  floor: 3,
  object_type: "desk" as const,
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/offices/1/floors/3/layout"]}>
      <Routes>
        <Route path="/app/offices/:officeId/floors/:floorId/layout" element={<FloorLayoutPage />} />
        <Route path="/app/offices" element={<div>offices</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Drag / transform integration tests ──────────────────────────────────────

describe("FloorLayoutPage drag/transform integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 1, memberships: [{ role: "owner", has_active_access: true }] },
    });
    mockListLayoutObjects.mockResolvedValue([MOCK_OBJ]);
    mockUpdateLayoutObject.mockResolvedValue({ ...MOCK_OBJ, x: "200.00", y: "300.00" });
  });

  it("shows objects after load", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("canvas-obj-42")).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it("successful drag: calls updateLayoutObject with new x/y", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();
    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "200.00", y: "300.00" })
      )
    );
  });

  it("optimistic update: coordinates change before PATCH resolves", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvePatch!: (v: any) => void;
    mockUpdateLayoutObject.mockReturnValue(new Promise((r) => (resolvePatch = r)));

    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();

    await waitFor(() => expect(screen.getByTestId("obj-x-42").textContent).toBe("200.00"));
    resolvePatch({ ...MOCK_OBJ, x: "200.00", y: "300.00" });
  });

  it("failed drag: reverts coordinates and shows error", async () => {
    mockUpdateLayoutObject.mockRejectedValue(new ApiError(500, {}));

    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();

    await waitFor(() => expect(screen.getByTestId("obj-x-42").textContent).toBe("100.00"));
    await waitFor(() =>
      expect(screen.getByText(/could not save layout changes/i)).toBeInTheDocument()
    );
  });

  it("failed drag (403): shows permission error message", async () => {
    mockUpdateLayoutObject.mockRejectedValue(new ApiError(403, {}));

    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();

    await waitFor(() =>
      expect(screen.getByText(/you do not have permission/i)).toBeInTheDocument()
    );
  });

  it("successful transform: calls updateLayoutObject with x/y/width/height/rotation", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("transform-42"));
    screen.getByTestId("transform-42").click();
    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({
          x: "50.00",
          y: "60.00",
          width: "120.00",
          height: "70.00",
          rotation: "45.00",
        })
      )
    );
  });

  it("failed transform: reverts all fields and shows error", async () => {
    mockUpdateLayoutObject.mockRejectedValue(new ApiError(500, {}));

    renderPage();
    await waitFor(() => screen.getByTestId("transform-42"));
    screen.getByTestId("transform-42").click();

    await waitFor(() =>
      expect(screen.getByText(/could not save layout changes/i)).toBeInTheDocument()
    );
  });

  it("shows saving state while PATCH is in-flight", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvePatch!: (v: any) => void;
    mockUpdateLayoutObject.mockReturnValue(new Promise((r) => (resolvePatch = r)));

    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();

    await waitFor(() => expect(screen.getByTestId("obj-saving-42")).toBeInTheDocument());
    resolvePatch({ ...MOCK_OBJ });
  });

  it("shows Saved chip after successful PATCH", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("select-42").click();
    screen.getByTestId("drag-42").click();
    await waitFor(() => expect(screen.queryByText(/saving…/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/^saved$/i)).toBeInTheDocument());
  });

  it("does not allow a second drag while the first PATCH is in-flight", async () => {
    let callCount = 0;
    mockUpdateLayoutObject.mockImplementation(
      () =>
        new Promise((r) => {
          callCount++;
          setTimeout(() => r(MOCK_OBJ), 500);
        })
    );

    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();

    await waitFor(() => screen.getByTestId("obj-saving-42"));
    screen.getByTestId("drag-42").click();

    expect(callCount).toBe(1);
  });
});

// ─── Keyboard movement integration tests ─────────────────────────────────────

describe("FloorLayoutPage keyboard movement integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 1, memberships: [{ role: "owner", has_active_access: true }] },
    });
    mockListLayoutObjects.mockResolvedValue([MOCK_OBJ]);
    mockUpdateLayoutObject.mockResolvedValue(MOCK_OBJ);
  });

  it("ArrowRight moves selected object right by 1 px and calls PATCH", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));
    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => expect(screen.getByText(/tap arrow keys/i)).toBeInTheDocument());

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowRight" });

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "101.00", y: "150.00" })
      )
    );
  });

  it("Shift+ArrowDown moves selected object down by 10 px", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));
    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => expect(screen.getByText(/tap arrow keys/i)).toBeInTheDocument());

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), {
      key: "ArrowDown",
      shiftKey: true,
    });

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "100.00", y: "160.00" })
      )
    );
  });

  it("ArrowLeft with no object selected does not call PATCH", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("floor-map-canvas"));

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowLeft" });

    expect(mockUpdateLayoutObject).not.toHaveBeenCalled();
  });

  it("member user cannot keyboard-move an object", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, memberships: [{ role: "member", has_active_access: true }] },
    });

    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));
    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => screen.getByTestId("floor-map-canvas"));

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowRight" });

    expect(mockUpdateLayoutObject).not.toHaveBeenCalled();
  });

  it("keyboard move optimistically updates coordinates before PATCH resolves", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvePatch!: (v: any) => void;
    mockUpdateLayoutObject.mockReturnValue(new Promise((r) => (resolvePatch = r)));

    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));
    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => expect(screen.getByText(/tap arrow keys/i)).toBeInTheDocument());

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowRight" });

    await waitFor(() => expect(screen.getByTestId("obj-x-42").textContent).toBe("101.00"));
    resolvePatch(MOCK_OBJ);
  });

  it("e.repeat keydown is dropped — no PATCH, no optimistic update", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));
    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => expect(screen.getByText(/tap arrow keys/i)).toBeInTheDocument());

    // repeat=true simulates a held key — the guard must return early
    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), {
      key: "ArrowRight",
      repeat: true,
    });

    expect(mockUpdateLayoutObject).not.toHaveBeenCalled();
    expect(screen.getByTestId("obj-x-42").textContent).toBe("100.00");
  });
});

// ─── Boundary clamping integration tests ─────────────────────────────────────

describe("FloorLayoutPage boundary clamping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 1, memberships: [{ role: "owner", has_active_access: true }] },
    });
    mockListLayoutObjects.mockResolvedValue([MOCK_OBJ]);
    mockUpdateLayoutObject.mockResolvedValue(MOCK_OBJ);
  });

  it("drag with negative coords clamps to x=0, y=0", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("drag-neg-42"));
    screen.getByTestId("drag-neg-42").click();

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "0.00", y: "0.00" })
      )
    );
  });

  it("drag far beyond canvas clamps to max valid position", async () => {
    // MOCK_OBJ: width=80, height=50 → maxX = 1000-80 = 920, maxY = 640-50 = 590
    renderPage();
    await waitFor(() => screen.getByTestId("drag-far-42"));
    screen.getByTestId("drag-far-42").click();

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "920.00", y: "590.00" })
      )
    );
  });

  it("ArrowLeft at x=0 stays at x=0", async () => {
    mockListLayoutObjects.mockResolvedValue([{ ...MOCK_OBJ, x: "0.00", y: "0.00" }]);
    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));
    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => screen.getByText(/tap arrow keys/i));

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowLeft" });

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "0.00", y: "0.00" })
      )
    );
  });

  it("ArrowUp at y=0 stays at y=0", async () => {
    mockListLayoutObjects.mockResolvedValue([{ ...MOCK_OBJ, x: "100.00", y: "0.00" }]);
    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));
    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => screen.getByText(/tap arrow keys/i));

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowUp" });

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "100.00", y: "0.00" })
      )
    );
  });

  it("rollback still works after clamped drag", async () => {
    mockUpdateLayoutObject.mockRejectedValue(new ApiError(500, {}));

    renderPage();
    await waitFor(() => screen.getByTestId("drag-neg-42"));
    screen.getByTestId("drag-neg-42").click();

    // Optimistic: x becomes "0.00" (clamped)
    await waitFor(() => expect(screen.getByTestId("obj-x-42").textContent).toBe("0.00"));
    // Rollback: reverts to original "100.00"
    await waitFor(() => expect(screen.getByTestId("obj-x-42").textContent).toBe("100.00"));
    await waitFor(() =>
      expect(screen.getByText(/could not save layout changes/i)).toBeInTheDocument()
    );
  });
});

// ─── Snap-to-grid integration tests ──────────────────────────────────────────

describe("FloorLayoutPage snap-to-grid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 1, memberships: [{ role: "owner", has_active_access: true }] },
    });
    mockListLayoutObjects.mockResolvedValue([MOCK_OBJ]);
    mockUpdateLayoutObject.mockResolvedValue(MOCK_OBJ);
  });

  it("snap disabled (default): drag saves exact coordinates", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();

    // (200, 300) → snap disabled → clamp (within bounds) → (200.00, 300.00)
    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "200.00", y: "300.00" })
      )
    );
  });

  it("snap enabled: drag with unaligned coords snaps to nearest grid point", async () => {
    // drag-unaligned fires onObjectDragEnd(42, 205, 307)
    // snapToGrid(205, 20) = Math.round(205/20)*20 = Math.round(10.25)*20 = 200
    // snapToGrid(307, 20) = Math.round(307/20)*20 = Math.round(15.35)*20 = 300
    // clamp(200, 300) within bounds → PATCH x:"200.00", y:"300.00"
    renderPage();
    await waitFor(() => screen.getByTestId("drag-unaligned-42"));

    const snapToggle = screen.getByRole("switch", { name: /snap to grid/i });
    fireEvent.click(snapToggle);

    screen.getByTestId("drag-unaligned-42").click();

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "200.00", y: "300.00" })
      )
    );
  });

  it("snap disabled (default): drag with unaligned coords saves exact coordinates", async () => {
    // snap off — (205, 307) must reach the API unchanged
    renderPage();
    await waitFor(() => screen.getByTestId("drag-unaligned-42"));
    screen.getByTestId("drag-unaligned-42").click();

    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "205.00", y: "307.00" })
      )
    );
  });

  it("snap enabled: transform saves snapped width/height and position, no scaleX/scaleY", async () => {
    // transform button fires onObjectTransformEnd(42, 50, 60, 120, 70, 45)
    // With gridSize=20:
    //   snapSizeToGrid(120, 70, 20): snapToGrid(120,20)=120, snapToGrid(70,20)=Math.round(3.5)*20=80
    //   snapToGrid(50, 20) = Math.round(2.5)*20 = 60
    //   snapToGrid(60, 20) = 60
    //   clampObjectTransform(60, 60, 120, 80, 1000, 640) → {x:60, y:60, w:120, h:80}
    // PATCH: x:"60.00", y:"60.00", width:"120.00", height:"80.00", rotation:"45.00"
    renderPage();
    await waitFor(() => screen.getByTestId("transform-42"));

    const snapToggle = screen.getByRole("switch", { name: /snap to grid/i });
    fireEvent.click(snapToggle);

    screen.getByTestId("transform-42").click();

    await waitFor(() => {
      const call = mockUpdateLayoutObject.mock.calls[0];
      expect(call).toBeDefined();
      const payload = call[3] as Record<string, unknown>;
      expect(payload).toMatchObject({
        x: "60.00",
        y: "60.00",
        width: "120.00",
        height: "80.00",
        rotation: "45.00",
      });
      // scaleX / scaleY must never be in the payload
      expect("scaleX" in payload).toBe(false);
      expect("scaleY" in payload).toBe(false);
    });
  });

  it("snap enabled: keyboard ArrowRight steps by gridSize (20)", async () => {
    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));

    // Enable snap
    const snapToggle = screen.getByRole("switch", { name: /snap to grid/i });
    fireEvent.click(snapToggle);

    fireEvent.click(screen.getByTestId("select-42"));
    // With snap enabled, hint changes to snap variant
    await waitFor(() =>
      expect(screen.getByText(/tap arrow keys to move by one grid step/i)).toBeInTheDocument()
    );

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowRight" });

    // x = 100 + 20 = 120 (step = gridSize = 20), snapToGrid(120, 20) = 120
    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "120.00", y: "150.00" })
      )
    );
  });

  it("snap enabled: keyboard move does not jump the stationary axis", async () => {
    // MOCK_OBJ.y = "150.00" — not on 20px grid (150/20 = 7.5 → snaps to 160 if both axes snap)
    // With axis-specific snap, ArrowRight only snaps x, leaving y=150 unchanged
    renderPage();
    await waitFor(() => screen.getByTestId("select-42"));

    const snapToggle = screen.getByRole("switch", { name: /snap to grid/i });
    fireEvent.click(snapToggle);

    fireEvent.click(screen.getByTestId("select-42"));
    await waitFor(() => screen.getByText(/tap arrow keys to move by one grid step/i));

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowRight" });

    // y should remain "150.00" — not snapped to 160
    await waitFor(() =>
      expect(mockUpdateLayoutObject).toHaveBeenCalledWith(
        1,
        3,
        42,
        expect.objectContaining({ x: "120.00", y: "150.00" })
      )
    );
  });
});

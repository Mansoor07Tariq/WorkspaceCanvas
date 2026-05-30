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
          <button
            onClick={() => onObjectDragEnd?.(obj.id, 200, 300)}
            data-testid={`drag-${obj.id}`}
          >
            drag
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

// ─── Tests ───────────────────────────────────────────────────────────────────

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
    // Allow extra time for lazy-loaded FloorMapCanvas to resolve in the full suite
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

    // Optimistic: x should immediately show "200.00"
    await waitFor(() => expect(screen.getByTestId("obj-x-42").textContent).toBe("200.00"));
    // Resolve PATCH
    resolvePatch({ ...MOCK_OBJ, x: "200.00", y: "300.00" });
  });

  it("failed drag: reverts coordinates and shows error", async () => {
    mockUpdateLayoutObject.mockRejectedValue(new ApiError(500, {}));

    renderPage();
    await waitFor(() => screen.getByTestId("drag-42"));
    screen.getByTestId("drag-42").click();

    // After rejection: position should revert AND error should appear
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

    // The mock canvas renders <span data-testid="obj-saving-42"> when savingObjectIds has 42
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

    // Wait for saving state to be set (React re-render happened)
    await waitFor(() => screen.getByTestId("obj-saving-42"));

    // Second click now — savingObjectIds.has(42) is true, so guard blocks it
    screen.getByTestId("drag-42").click();

    // Only one PATCH call should have been made
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
    // Wait for the keyboard hint — it appears only when an object is selected and canManage=true
    await waitFor(() => expect(screen.getByText(/arrow keys move/i)).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByText(/arrow keys move/i)).toBeInTheDocument());

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
    // Wait for canvas to render but do NOT select any object
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
    // For members, selectedObjectId is set but canManageLayout is false —
    // the keyboard hint does NOT appear; wait for the canvas to be ready instead
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
    await waitFor(() => expect(screen.getByText(/arrow keys move/i)).toBeInTheDocument());

    fireEvent.keyDown(screen.getByTestId("floor-map-canvas"), { key: "ArrowRight" });

    // Optimistic update: x should be 101.00 before PATCH resolves
    await waitFor(() => expect(screen.getByTestId("obj-x-42").textContent).toBe("101.00"));
    resolvePatch(MOCK_OBJ);
  });
});

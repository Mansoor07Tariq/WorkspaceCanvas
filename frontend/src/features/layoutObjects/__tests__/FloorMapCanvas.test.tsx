import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LayoutObject } from "../types/layoutObject.types";

vi.mock("react-konva", () => ({
  Stage: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: (e: { target: { getStage: () => unknown } }) => void;
  }) => {
    function handleClick() {
      const target = { getStage: () => target };
      onClick?.({ target });
    }
    return (
      <div data-testid="floor-map-stage" onClick={handleClick}>
        {children}
      </div>
    );
  },
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Rect: () => null,
  Circle: () => null,
  Line: ({ points }: { points?: number[] }) => (
    <div data-testid="grid-line" data-points={JSON.stringify(points)} />
  ),
  Text: ({ text }: { text?: string }) => (text ? <span>{text}</span> : null),
  Group: ({
    children,
    onClick,
    onDragEnd,
    onTransformEnd,
    draggable,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    onDragEnd?: (e: { target: { x: () => number; y: () => number } }) => void;
    onTransformEnd?: (e: {
      target: {
        x: () => number;
        y: () => number;
        scaleX: () => number;
        scaleY: () => number;
        rotation: () => number;
      };
    }) => void;
    draggable?: boolean;
  }) => (
    <div
      data-testid={draggable ? "canvas-object-group-draggable" : "canvas-object-group"}
      onClick={onClick}
      onMouseUp={() => onDragEnd?.({ target: { x: () => 140, y: () => 175 } })}
      onDoubleClick={() =>
        onTransformEnd?.({
          target: {
            x: () => 140,
            y: () => 175,
            scaleX: () => 1.5,
            scaleY: () => 1.2,
            rotation: () => 30,
          },
        })
      }
    >
      {children}
    </div>
  ),
  Transformer: () => null,
}));

import { FloorMapCanvas } from "../components/FloorMapCanvas";

const makeObj = (overrides: Partial<LayoutObject> = {}): LayoutObject => ({
  id: 1,
  floor: 2,
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
  ...overrides,
});

describe("FloorMapCanvas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the stage", () => {
    render(<FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} />);
    expect(screen.getByTestId("floor-map-stage")).toBeInTheDocument();
  });

  it("shows empty state overlay when no objects", () => {
    render(<FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} />);
    expect(screen.getByText(/nothing on this floor yet/i)).toBeInTheDocument();
  });

  it("does not show empty state when objects exist", () => {
    render(
      <FloorMapCanvas objects={[makeObj()]} selectedObjectId={null} onSelectObject={vi.fn()} />
    );
    expect(screen.queryByText(/nothing on this floor yet/i)).not.toBeInTheDocument();
  });

  it("renders one group per object", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 1 }), makeObj({ id: 2, label: "B" })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/canvas-object-group/).length).toBe(2);
  });

  it("calls onSelectObject with id when canvas object is clicked", () => {
    const onSelectObject = vi.fn();
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 7 })]}
        selectedObjectId={null}
        onSelectObject={onSelectObject}
      />
    );
    fireEvent.click(screen.getByTestId(/canvas-object-group/));
    expect(onSelectObject).toHaveBeenCalledWith(7);
  });

  it("calls onSelectObject with null when stage background is clicked", () => {
    const onSelectObject = vi.fn();
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={onSelectObject}
      />
    );
    fireEvent.click(screen.getByTestId("floor-map-stage"));
    expect(onSelectObject).toHaveBeenCalledWith(null);
  });

  it("renders object label text", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj({ label: "My Desk" })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
      />
    );
    expect(screen.getByText("My Desk")).toBeInTheDocument();
  });

  it("renders shortCode when label is empty", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj({ label: "" })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
      />
    );
    expect(screen.getByText("DSK")).toBeInTheDocument();
  });

  // ─── Drag tests ───────────────────────────────────────────────────────────

  it("renders non-draggable group when canManageLayout is false", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={false}
      />
    );
    expect(screen.getByTestId("canvas-object-group")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-object-group-draggable")).not.toBeInTheDocument();
  });

  it("renders draggable group when canManageLayout is true", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
      />
    );
    expect(screen.getByTestId("canvas-object-group-draggable")).toBeInTheDocument();
  });

  it("calls onObjectDragEnd with top-left coordinates (not center) after drag", () => {
    const onObjectDragEnd = vi.fn();
    // Object x=100, y=150, w=80, h=50 → center=(140,175)
    // Mock drag ends at center (140,175) → top-left must be (100,150)
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 5, x: "100.00", y: "150.00", width: "80.00", height: "50.00" })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        onObjectDragEnd={onObjectDragEnd}
      />
    );
    fireEvent.mouseUp(screen.getByTestId("canvas-object-group-draggable"));
    expect(onObjectDragEnd).toHaveBeenCalledWith(5, 100, 150);
  });

  // ─── Transform tests ──────────────────────────────────────────────────────

  it("calls onObjectTransformEnd with correct dimensions after transform", () => {
    const onObjectTransformEnd = vi.fn();
    // Object: w=80, h=50; scaleX=1.5, scaleY=1.2 → newW=120, newH=60
    // new center (140,175) → top-left=(140-60, 175-30)=(80,145)
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 9, x: "100.00", y: "150.00", width: "80.00", height: "50.00" })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        onObjectTransformEnd={onObjectTransformEnd}
      />
    );
    fireEvent.doubleClick(screen.getByTestId("canvas-object-group-draggable"));
    const [id, x, y, w, h, rot] = onObjectTransformEnd.mock.calls[0];
    expect(id).toBe(9);
    expect(x).toBeCloseTo(80);
    expect(y).toBeCloseTo(145);
    expect(w).toBeCloseTo(120);
    expect(h).toBeCloseTo(60);
    expect(rot).toBe(30);
  });

  // ─── Grid visibility tests ────────────────────────────────────────────────

  it("renders grid lines when showGrid is true (default)", () => {
    render(<FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} />);
    // With the mocked Line, grid lines render as divs with data-testid="grid-line"
    expect(screen.getAllByTestId("grid-line").length).toBeGreaterThan(0);
  });

  it("renders no grid lines when showGrid is false", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        showGrid={false}
      />
    );
    expect(screen.queryAllByTestId("grid-line").length).toBe(0);
  });

  it("renders different number of grid lines for gridSize=40 vs gridSize=10", () => {
    const { unmount } = render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        showGrid={true}
        gridSize={40}
      />
    );
    const linesAt40 = screen.getAllByTestId("grid-line").length;
    unmount();

    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        showGrid={true}
        gridSize={10}
      />
    );
    const linesAt10 = screen.getAllByTestId("grid-line").length;

    // Smaller grid size → more lines
    expect(linesAt10).toBeGreaterThan(linesAt40);
  });

  // ─── Accessibility tests ──────────────────────────────────────────────────

  it("canvas wrapper has role=region and aria-label", () => {
    render(<FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} />);
    expect(screen.getByRole("region", { name: /floor map canvas/i })).toBeInTheDocument();
  });

  it("calls onKeyDown when a key is pressed on the canvas wrapper", () => {
    const onKeyDown = vi.fn();
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        onKeyDown={onKeyDown}
      />
    );
    fireEvent.keyDown(screen.getByRole("region", { name: /floor map canvas/i }), {
      key: "ArrowRight",
    });
    expect(onKeyDown).toHaveBeenCalled();
  });

  // ─── Booking mode tests ───────────────────────────────────────────────────

  it("booking mode sets aria-label to 'Floor booking map'", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        mode="booking"
      />
    );
    expect(screen.getByRole("region", { name: /floor booking map/i })).toBeInTheDocument();
  });

  it("editor mode keeps aria-label as 'Floor map canvas'", () => {
    render(
      <FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} mode="editor" />
    );
    expect(screen.getByRole("region", { name: /floor map canvas/i })).toBeInTheDocument();
  });

  it("booking mode does not propagate onKeyDown to the canvas wrapper", () => {
    const onKeyDown = vi.fn();
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        mode="booking"
        onKeyDown={onKeyDown}
      />
    );
    fireEvent.keyDown(screen.getByRole("region", { name: /floor booking map/i }), {
      key: "ArrowRight",
    });
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("booking mode renders non-draggable nodes even when canManageLayout is true", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        mode="booking"
      />
    );
    expect(screen.getByTestId("canvas-object-group")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-object-group-draggable")).not.toBeInTheDocument();
  });

  it("booking mode: clicking a desk object with an availability status calls onAvailabilityObjectSelect", () => {
    const onAvailabilityObjectSelect = vi.fn();
    const availabilityMap = new Map([[1, "available" as const]]);
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 1 })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        mode="booking"
        availabilityByLayoutObjectId={availabilityMap}
        onAvailabilityObjectSelect={onAvailabilityObjectSelect}
      />
    );
    fireEvent.click(screen.getByTestId("canvas-object-group"));
    expect(onAvailabilityObjectSelect).toHaveBeenCalledWith(1);
  });

  it("booking mode: clicking an object without availability status does not call onAvailabilityObjectSelect", () => {
    const onAvailabilityObjectSelect = vi.fn();
    // Empty availability map — object 1 has no entry
    const availabilityMap = new Map<number, "available">([]);
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 1 })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        mode="booking"
        availabilityByLayoutObjectId={availabilityMap}
        onAvailabilityObjectSelect={onAvailabilityObjectSelect}
      />
    );
    fireEvent.click(screen.getByTestId("canvas-object-group"));
    expect(onAvailabilityObjectSelect).not.toHaveBeenCalled();
  });

  it("editor mode: drag still works with canManageLayout=true (regression)", () => {
    const onObjectDragEnd = vi.fn();
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 5, x: "100.00", y: "150.00", width: "80.00", height: "50.00" })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        onObjectDragEnd={onObjectDragEnd}
        mode="editor"
      />
    );
    expect(screen.getByTestId("canvas-object-group-draggable")).toBeInTheDocument();
    fireEvent.mouseUp(screen.getByTestId("canvas-object-group-draggable"));
    expect(onObjectDragEnd).toHaveBeenCalledWith(5, 100, 150);
  });
});

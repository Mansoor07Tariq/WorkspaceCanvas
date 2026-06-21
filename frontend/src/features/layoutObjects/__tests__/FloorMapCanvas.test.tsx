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
  Layer: ({ children, listening }: { children?: React.ReactNode; listening?: boolean }) => (
    <div data-testid="konva-layer" data-listening={String(listening ?? true)}>
      {children}
    </div>
  ),
  Rect: ({
    fill,
    stroke,
    onClick,
    "data-testid": testId,
  }: {
    fill?: string;
    stroke?: string;
    onClick?: (e: {
      target: { getStage: () => { getRelativePointerPosition: () => { x: number; y: number } } };
    }) => void;
    "data-testid"?: string;
  }) => (
    <div
      data-testid={testId ?? "konva-rect"}
      data-fill={fill}
      data-stroke={stroke}
      onClick={
        onClick
          ? (domEvent: React.MouseEvent) => {
              // In real Konva a shape click does not also run the Stage's
              // background-click handler (e.target is the shape, not the stage).
              // Stop DOM bubbling so the nested mock matches that behaviour.
              domEvent.stopPropagation();
              onClick({
                target: {
                  getStage: () => ({ getRelativePointerPosition: () => ({ x: 500, y: 50 }) }),
                },
              });
            }
          : undefined
      }
    />
  ),
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

  it("shows admin empty state overlay when no objects and canManageLayout is true", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
      />
    );
    expect(screen.getByText(/nothing on this floor yet/i)).toBeInTheDocument();
  });

  it("shows member empty state overlay when no objects and canManageLayout is false", () => {
    render(<FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} />);
    expect(screen.getByText(/floor map not set up yet/i)).toBeInTheDocument();
  });

  it("does not show empty state when objects exist", () => {
    render(
      <FloorMapCanvas objects={[makeObj()]} selectedObjectId={null} onSelectObject={vi.fn()} />
    );
    expect(screen.queryByText(/nothing on this floor yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/floor map not set up yet/i)).not.toBeInTheDocument();
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

  // ─── Editable boundary resize handles ─────────────────────────────────────

  it("renders clickable boundary walls for managers", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        onBoundaryResize={vi.fn()}
      />
    );
    expect(screen.getAllByTestId("boundary-wall").length).toBe(4);
  });

  it("does not show resize handles until a wall is clicked (selects the room)", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        onBoundaryResize={vi.fn()}
      />
    );
    // Hidden initially…
    expect(screen.queryByTestId("boundary-resize-target")).not.toBeInTheDocument();
    // …shown after selecting the room by clicking a wall.
    fireEvent.click(screen.getAllByTestId("boundary-wall")[0]);
    expect(screen.getByTestId("boundary-resize-target")).toBeInTheDocument();
  });

  it("clicking a wall clears any object selection", () => {
    const onSelectObject = vi.fn();
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={onSelectObject}
        canManageLayout={true}
        onBoundaryResize={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByTestId("boundary-wall")[0]);
    expect(onSelectObject).toHaveBeenCalledWith(null);
  });

  it("hides resize handles again once an object is selected", () => {
    const { rerender } = render(
      <FloorMapCanvas
        objects={[makeObj({ id: 5 })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        onBoundaryResize={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByTestId("boundary-wall")[0]);
    expect(screen.getByTestId("boundary-resize-target")).toBeInTheDocument();
    rerender(
      <FloorMapCanvas
        objects={[makeObj({ id: 5 })]}
        selectedObjectId={5}
        onSelectObject={vi.fn()}
        canManageLayout={true}
        onBoundaryResize={vi.fn()}
      />
    );
    expect(screen.queryByTestId("boundary-resize-target")).not.toBeInTheDocument();
  });

  it("does not make walls selectable for members", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={false}
        onBoundaryResize={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByTestId("boundary-wall")[0]);
    expect(screen.queryByTestId("boundary-resize-target")).not.toBeInTheDocument();
  });

  // ─── Cutouts (non-rectangular floors) ─────────────────────────────────────

  const cutoutObj = (overrides: Partial<LayoutObject> = {}): LayoutObject =>
    makeObj({
      id: 90,
      object_type: "cutout",
      x: "48.00",
      y: "48.00",
      width: "200.00",
      height: "150.00",
      ...overrides,
    });

  it("keeps the boundary rectangular (4 walls) with a cutout in the editor", () => {
    render(
      <FloorMapCanvas objects={[cutoutObj()]} selectedObjectId={null} onSelectObject={vi.fn()} />
    );
    expect(screen.getAllByTestId("boundary-wall").length).toBe(4);
    // The cutout shows as an editable object box in the editor.
    expect(screen.getAllByTestId(/canvas-object-group/).length).toBe(1);
  });

  it("reroutes the walls (L-shape, 6 segments) for a corner cutout when enhanced", () => {
    render(
      <FloorMapCanvas
        objects={[cutoutObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        enhanced
      />
    );
    expect(screen.getAllByTestId("boundary-wall").length).toBe(6);
  });

  it("hides the cutout's editor box in the enhanced view", () => {
    render(
      <FloorMapCanvas
        objects={[cutoutObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        enhanced
      />
    );
    expect(screen.queryByTestId(/canvas-object-group/)).not.toBeInTheDocument();
  });

  // ─── Enhanced view polish ─────────────────────────────────────────────────

  it("hides the grid in the enhanced view", () => {
    const { rerender } = render(
      <FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} showGrid />
    );
    expect(screen.getAllByTestId("grid-line").length).toBeGreaterThan(0);
    rerender(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        showGrid
        enhanced
      />
    );
    expect(screen.queryAllByTestId("grid-line").length).toBe(0);
  });

  it("draws thin walls around rooms only in the enhanced view", () => {
    // A mid-room room has all four edges → four wall segments.
    const room = makeObj({ id: 30, object_type: "meeting_room", x: "300.00", y: "300.00" });
    const { rerender } = render(
      <FloorMapCanvas objects={[room]} selectedObjectId={null} onSelectObject={vi.fn()} />
    );
    expect(screen.queryAllByTestId("room-wall").length).toBe(0);
    rerender(
      <FloorMapCanvas objects={[room]} selectedObjectId={null} onSelectObject={vi.fn()} enhanced />
    );
    expect(screen.getAllByTestId("room-wall").length).toBe(4);
  });

  it("skips room-wall edges that sit on the boundary wall", () => {
    // A room flush in the top-left corner: top + left edges are on the boundary,
    // so only the bottom + right edges get walls.
    const room = makeObj({
      id: 31,
      object_type: "meeting_room",
      x: "48.00",
      y: "48.00",
      width: "200.00",
      height: "150.00",
    });
    render(
      <FloorMapCanvas objects={[room]} selectedObjectId={null} onSelectObject={vi.fn()} enhanced />
    );
    expect(screen.getAllByTestId("room-wall").length).toBe(2);
  });

  it("draws a single shared wall between two adjacent rooms (no doubling)", () => {
    // Two mid-room rooms touching at x=400. Without merging this is 8 walls; the
    // shared border + the colinear tops/bottoms merge → 5.
    const a = makeObj({
      id: 40,
      object_type: "meeting_room",
      x: "200.00",
      y: "200.00",
      width: "200.00",
      height: "150.00",
    });
    const b = makeObj({
      id: 41,
      object_type: "meeting_room",
      x: "400.00",
      y: "200.00",
      width: "200.00",
      height: "150.00",
    });
    render(
      <FloorMapCanvas objects={[a, b]} selectedObjectId={null} onSelectObject={vi.fn()} enhanced />
    );
    expect(screen.getAllByTestId("room-wall").length).toBe(5);
  });

  it("does not select the room when no onBoundaryResize handler is given", () => {
    render(
      <FloorMapCanvas
        objects={[makeObj()]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={true}
      />
    );
    fireEvent.click(screen.getAllByTestId("boundary-wall")[0]);
    expect(screen.queryByTestId("boundary-resize-target")).not.toBeInTheDocument();
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

  // ─── Boundary tests (PR 061) ──────────────────────────────────────────────

  it("renders a white interior rect and four solid wall segments for the boundary", () => {
    render(<FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} />);
    const rects = screen.getAllByTestId("konva-rect");
    // White interior
    expect(rects.some((r) => r.getAttribute("data-fill") === "#FFFFFF")).toBe(true);
    // Walls match the "wall" object: grey fill + darker stroke, four segments
    const walls = screen
      .getAllByTestId("boundary-wall")
      .filter(
        (r) =>
          r.getAttribute("data-fill") === "#D1D5DB" && r.getAttribute("data-stroke") === "#4B5563"
      );
    expect(walls.length).toBe(4);
  });

  it("draws the boundary in a non-listening layer (does not capture clicks)", () => {
    render(<FloorMapCanvas objects={[]} selectedObjectId={null} onSelectObject={vi.fn()} />);
    const layers = screen.getAllByTestId("konva-layer");
    // The first layer (background/boundary) must be non-listening.
    expect(layers[0].getAttribute("data-listening")).toBe("false");
  });

  it("renders the boundary in booking mode too", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        mode="booking"
      />
    );
    const rects = screen.getAllByTestId("konva-rect");
    expect(rects.some((r) => r.getAttribute("data-fill") === "#FFFFFF")).toBe(true);
  });

  it("renders the boundary without hiding object clicks (boundary + object both present)", () => {
    const onSelectObject = vi.fn();
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 3 })]}
        selectedObjectId={null}
        onSelectObject={onSelectObject}
      />
    );
    // boundary present
    expect(screen.getAllByTestId("konva-rect").length).toBeGreaterThan(0);
    // object still clickable
    fireEvent.click(screen.getByTestId(/canvas-object-group/));
    expect(onSelectObject).toHaveBeenCalledWith(3);
  });

  // ─── Zoom controls (PR 061) ───────────────────────────────────────────────

  it("renders zoom controls in editor mode", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout
      />
    );
    expect(screen.getByTestId("canvas-zoom-controls")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders zoom controls in read-only (member) mode", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={false}
      />
    );
    expect(screen.getByTestId("canvas-zoom-controls")).toBeInTheDocument();
  });

  it("renders zoom controls in booking mode", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        mode="booking"
      />
    );
    expect(screen.getByTestId("canvas-zoom-controls")).toBeInTheDocument();
  });

  it("zoom-in control raises the displayed percentage", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout
      />
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(screen.getByText("115%")).toBeInTheDocument();
  });

  it("reset control restores 100% after zooming", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /fit to office/i }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  // ─── Door/window wall placement (PR 061) ──────────────────────────────────

  it("enters wall-placement mode (capture overlay) when a door is the pending type", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout
        pendingPlacementType="door"
        onPlaceObject={vi.fn()}
      />
    );
    expect(screen.getByTestId("wall-placement-capture")).toBeInTheDocument();
  });

  it("does not enter placement mode for a non-wall type", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout
        pendingPlacementType="desk"
        onPlaceObject={vi.fn()}
      />
    );
    expect(screen.queryByTestId("wall-placement-capture")).not.toBeInTheDocument();
  });

  it("does not enter placement mode without manage permission", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout={false}
        pendingPlacementType="door"
        onPlaceObject={vi.fn()}
      />
    );
    expect(screen.queryByTestId("wall-placement-capture")).not.toBeInTheDocument();
  });

  it("does not enter placement mode in booking mode", () => {
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        mode="booking"
        pendingPlacementType="door"
        onPlaceObject={vi.fn()}
      />
    );
    expect(screen.queryByTestId("wall-placement-capture")).not.toBeInTheDocument();
  });

  it("clicking a wall places a door at the snapped position", () => {
    const onPlaceObject = vi.fn();
    render(
      <FloorMapCanvas
        objects={[]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout
        pendingPlacementType="door"
        onPlaceObject={onPlaceObject}
      />
    );
    // Mock pointer is (500, 50) → snaps to the top wall centre (500, 39) and
    // matches the wall thickness (18): door 40×18 → top-left (480, 30), rot 0.
    fireEvent.click(screen.getByTestId("wall-placement-capture"));
    expect(onPlaceObject).toHaveBeenCalledWith("door", 480, 30, 40, 18, 0);
  });

  it("does not place a door on top of an existing one (no overlap)", () => {
    const onPlaceObject = vi.fn();
    // Existing door occupying the top-wall centre (where the mock pointer snaps).
    const existing = makeObj({
      id: 99,
      object_type: "door",
      x: "480.00",
      y: "36.00",
      width: "40.00",
      height: "12.00",
    });
    render(
      <FloorMapCanvas
        objects={[existing]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
        canManageLayout
        pendingPlacementType="door"
        onPlaceObject={onPlaceObject}
      />
    );
    fireEvent.click(screen.getByTestId("wall-placement-capture"));
    expect(onPlaceObject).not.toHaveBeenCalled();
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

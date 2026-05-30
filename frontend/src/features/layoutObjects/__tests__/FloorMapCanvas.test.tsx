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
    // Simulate clicking the stage background: target.getStage() === target
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
  Line: () => null,
  Text: ({ text }: { text?: string }) => (text ? <span>{text}</span> : null),
  Group: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="canvas-object-group" onClick={onClick}>
      {children}
    </div>
  ),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        objects={[makeObj({ id: 1 }), makeObj({ id: 2, label: "Desk B" })]}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
      />
    );
    expect(screen.getAllByTestId("canvas-object-group")).toHaveLength(2);
  });

  it("calls onSelectObject with object id when canvas object is clicked", () => {
    const onSelectObject = vi.fn();
    render(
      <FloorMapCanvas
        objects={[makeObj({ id: 7 })]}
        selectedObjectId={null}
        onSelectObject={onSelectObject}
      />
    );
    fireEvent.click(screen.getByTestId("canvas-object-group"));
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

  it("renders label text from object label", () => {
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
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { LayoutObject } from "../../types/layoutObject.types";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";

// Capture the props passed to the Konva shapes as data attributes so we can
// assert pass-through without rendering a real Konva stage.
vi.mock("react-konva", () => ({
  Rect: (props: Record<string, unknown>) => (
    <div data-testid="konva-rect" data-props={JSON.stringify(props)} />
  ),
  Circle: (props: Record<string, unknown>) => (
    <div data-testid="konva-circle" data-props={JSON.stringify(props)} />
  ),
}));

import { DefaultLayoutObjectRenderer } from "../DefaultLayoutObjectRenderer";

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

const baseStyle: LayoutObjectNodeStyle = {
  fill: "#BFDBFE",
  stroke: "#2563EB",
  strokeWidth: 1.5,
  opacity: 1,
  dash: undefined,
};

function renderDefault(
  objectType: LayoutObject["object_type"],
  style: LayoutObjectNodeStyle = baseStyle
) {
  const obj = makeObj({ object_type: objectType });
  const config = getLayoutObjectRenderConfig(objectType);
  render(
    <DefaultLayoutObjectRenderer
      object={obj}
      config={config}
      style={style}
      width={80}
      height={50}
      isSelected={false}
      isSaving={false}
      isBookingMode={false}
    />
  );
}

function shapeProps(testId: string): Record<string, unknown> {
  return JSON.parse(screen.getByTestId(testId).getAttribute("data-props") ?? "{}");
}

describe("DefaultLayoutObjectRenderer", () => {
  it("renders a Rect for a rect-shaped config (e.g. desk)", () => {
    renderDefault("desk");
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument();
    expect(screen.queryByTestId("konva-circle")).not.toBeInTheDocument();
  });

  it("renders a Circle for a circle-shaped config (e.g. chair)", () => {
    renderDefault("chair");
    expect(screen.getByTestId("konva-circle")).toBeInTheDocument();
    expect(screen.queryByTestId("konva-rect")).not.toBeInTheDocument();
  });

  it("centres the rect on the group origin and passes width/height + cornerRadius", () => {
    renderDefault("desk");
    const props = shapeProps("konva-rect");
    expect(props.x).toBe(-40); // -width/2
    expect(props.y).toBe(-25); // -height/2
    expect(props.width).toBe(80);
    expect(props.height).toBe(50);
    expect(props.cornerRadius).toBe(getLayoutObjectRenderConfig("desk").cornerRadius);
  });

  it("passes fill/stroke/strokeWidth/opacity through from style", () => {
    renderDefault("desk", {
      fill: "#DCFCE7",
      stroke: "#16A34A",
      strokeWidth: 2,
      opacity: 0.8,
      dash: undefined,
    });
    const props = shapeProps("konva-rect");
    expect(props.fill).toBe("#DCFCE7");
    expect(props.stroke).toBe("#16A34A");
    expect(props.strokeWidth).toBe(2);
    expect(props.opacity).toBe(0.8);
  });

  it("passes the dash pattern through from style when present", () => {
    renderDefault("desk", { ...baseStyle, dash: [8, 4] });
    const props = shapeProps("konva-rect");
    expect(props.dash).toEqual([8, 4]);
  });

  it("sizes a circle from the smaller of width/height", () => {
    renderDefault("chair");
    const props = shapeProps("konva-circle");
    expect(props.radius).toBe(25); // min(80, 50) / 2
  });
});

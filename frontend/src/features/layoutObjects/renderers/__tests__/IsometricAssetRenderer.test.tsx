import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LayoutObject, LayoutObjectType } from "../../types/layoutObject.types";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";
import type { KonvaImageState } from "../isometric/useKonvaImage";

// Capture Konva shape props as data attributes (no real Konva stage).
vi.mock("react-konva", () => ({
  Image: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-image"
      data-props={JSON.stringify({
        x: props.x,
        y: props.y,
        width: props.width,
        height: props.height,
        opacity: props.opacity,
        listening: props.listening,
      })}
    />
  ),
  Rect: (props: Record<string, unknown>) => (
    <div data-testid="konva-rect" data-props={JSON.stringify(props)} />
  ),
  Circle: (props: Record<string, unknown>) => (
    <div data-testid="konva-circle" data-props={JSON.stringify(props)} />
  ),
}));

// Control image-load status per test.
const mockUseKonvaImage = vi.hoisted(() => vi.fn<(src: string | undefined) => KonvaImageState>());
vi.mock("../isometric/useKonvaImage", () => ({
  useKonvaImage: (src: string | undefined) => mockUseKonvaImage(src),
}));

import { IsometricAssetRenderer } from "../isometric/IsometricAssetRenderer";

const makeObj = (type: LayoutObjectType): LayoutObject => ({
  id: 1,
  floor: 2,
  object_type: type,
  object_type_display: type,
  label: "Obj",
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
});

const baseStyle: LayoutObjectNodeStyle = {
  fill: "#BFDBFE",
  stroke: "#2563EB",
  strokeWidth: 1.5,
  opacity: 1,
  dash: undefined,
};

function renderAsset(
  type: LayoutObjectType,
  opts: {
    style?: LayoutObjectNodeStyle;
    isSelected?: boolean;
    isSaving?: boolean;
    isBookingMode?: boolean;
  } = {}
) {
  const obj = makeObj(type);
  render(
    <IsometricAssetRenderer
      object={obj}
      config={getLayoutObjectRenderConfig(type)}
      style={opts.style ?? baseStyle}
      width={80}
      height={50}
      isSelected={opts.isSelected ?? false}
      isSaving={opts.isSaving ?? false}
      isBookingMode={opts.isBookingMode ?? false}
    />
  );
}

function loaded(): KonvaImageState {
  return { image: {} as HTMLImageElement, status: "loaded" };
}

function loadedWithNatural(naturalWidth: number, naturalHeight: number): KonvaImageState {
  return { image: { naturalWidth, naturalHeight } as HTMLImageElement, status: "loaded" };
}

function rectProps(index = 0): Record<string, unknown> {
  const el = screen.getAllByTestId("konva-rect")[index];
  return JSON.parse(el.getAttribute("data-props") ?? "{}");
}

beforeEach(() => vi.clearAllMocks());

describe("IsometricAssetRenderer", () => {
  it("renders the asset image for desk when loaded, sized to the object box", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("desk");
    const img = JSON.parse(screen.getByTestId("konva-image").getAttribute("data-props") ?? "{}");
    expect(img.width).toBe(80);
    expect(img.height).toBe(50);
    expect(img.x).toBe(-40); // -width/2
    expect(img.y).toBe(-25); // -height/2
  });

  it("renders the asset image for meeting_room when loaded", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("meeting_room");
    expect(screen.getByTestId("konva-image")).toBeInTheDocument();
  });

  it("contain-fits the artwork without distortion and centres it in the box", () => {
    // Square 100x100 art in an 80x50 box → scale = min(80/100, 50/100) = 0.5
    // → drawn 50x50, centred: x=-25, y=-25.
    mockUseKonvaImage.mockReturnValue(loadedWithNatural(100, 100));
    renderAsset("desk");
    const img = JSON.parse(screen.getByTestId("konva-image").getAttribute("data-props") ?? "{}");
    expect(img.width).toBe(50);
    expect(img.height).toBe(50);
    expect(img.x).toBe(-25);
    expect(img.y).toBe(-25);
    // The border still covers the full object box (selection/availability target).
    const border = rectProps(1);
    expect(border.width).toBe(80);
    expect(border.height).toBe(50);
  });

  it("fills the box when natural dimensions are unavailable (safe fallback)", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("desk");
    const img = JSON.parse(screen.getByTestId("konva-image").getAttribute("data-props") ?? "{}");
    expect(img.width).toBe(80);
    expect(img.height).toBe(50);
  });

  it("falls back to the default shape (no image) while loading", () => {
    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
    renderAsset("desk");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument(); // default renderer rect
  });

  it("falls back to the default shape (no image) on load error", () => {
    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "error" });
    renderAsset("desk");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument();
  });

  it("applies the selection/availability border from style (overlay rect)", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("desk", {
      style: { fill: "#FECACA", stroke: "#DC2626", strokeWidth: 3, opacity: 1, dash: undefined },
    });
    // The border rect (last) carries the resolved stroke; it is non-interactive.
    const border = rectProps(1);
    expect(border.stroke).toBe("#DC2626");
    expect(border.strokeWidth).toBe(3);
    expect(border.listening).toBe(false);
    // The tint rect (first) uses the resolved fill and is the full-box hit target
    // (not disabled), so the clickable area matches the default rect.
    const tint = rectProps(0);
    expect(tint.fill).toBe("#FECACA");
    expect(tint.listening).not.toBe(false);
    expect(tint.width).toBe(80);
    expect(tint.height).toBe(50);
  });

  it("keeps the asset image non-interactive so the hitbox stays on the full box", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("desk");
    const img = JSON.parse(screen.getByTestId("konva-image").getAttribute("data-props") ?? "{}");
    expect(img.listening).toBe(false);
  });

  it("uses a stronger availability tint in booking mode", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("desk", { isBookingMode: true });
    expect(rectProps(0).opacity).toBe(0.45);
  });

  it("dims the asset while saving", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("desk", { isSaving: true });
    const img = JSON.parse(screen.getByTestId("konva-image").getAttribute("data-props") ?? "{}");
    expect(img.opacity).toBe(0.6);
  });

  it("does not render labels or the bookable dot (owned by the node)", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderAsset("desk");
    // No Text/label and no extra Circle (the bookable dot) are produced here.
    expect(screen.queryByTestId("konva-circle")).not.toBeInTheDocument();
  });
});

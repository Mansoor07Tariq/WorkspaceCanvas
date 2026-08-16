import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LayoutObject, LayoutObjectType } from "../../types/layoutObject.types";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";
import type { KonvaImageState } from "../isometric/useKonvaImage";

vi.mock("react-konva", () => ({
  Image: () => <div data-testid="konva-image" />,
  Rect: () => <div data-testid="konva-rect" />,
  Circle: () => <div data-testid="konva-circle" />,
}));

const mockUseKonvaImage = vi.hoisted(() => vi.fn<(src: string | undefined) => KonvaImageState>());
vi.mock("../isometric/useKonvaImage", () => ({
  useKonvaImage: (src: string | undefined) => mockUseKonvaImage(src),
}));

import { SpriteRenderer } from "../isometric/SpriteRenderer";

const baseStyle: LayoutObjectNodeStyle = {
  fill: "#BFDBFE",
  stroke: "#2563EB",
  strokeWidth: 1.5,
  opacity: 1,
  dash: undefined,
};

const makeObj = (id: number, type: LayoutObjectType, w = "80", h = "50"): LayoutObject => ({
  id,
  floor: 1,
  object_type: type,
  object_type_display: type,
  label: "",
  x: "0",
  y: "0",
  width: w,
  height: h,
  rotation: "0",
  metadata: {},
  is_active: true,
  created_at: "",
  updated_at: "",
});

function renderSprite(type: LayoutObjectType) {
  render(
    <SpriteRenderer
      object={makeObj(1, type)}
      config={getLayoutObjectRenderConfig(type)}
      style={baseStyle}
      width={80}
      height={50}
      isSelected={false}
      isSaving={false}
      isBookingMode={false}
    />
  );
}

const loaded = (): KonvaImageState => ({
  image: { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement,
  status: "loaded",
});

beforeEach(() => vi.clearAllMocks());

describe("SpriteRenderer", () => {
  it("draws a sprite for a mapped type (plant) when the image is loaded", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderSprite("plant");
    expect(screen.getByTestId("konva-image")).toBeInTheDocument();
    // It resolved a real manifest sprite URL (not undefined) for the Plant family.
    expect(mockUseKonvaImage).toHaveBeenCalledWith(expect.stringMatching(/plant/i));
  });

  it("falls back to the styled box for an UNMAPPED type (wall)", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderSprite("wall");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument();
  });

  it("falls back to the styled shape while the sprite is loading", () => {
    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
    renderSprite("stool"); // seating → circle fallback
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-circle")).toBeInTheDocument();
  });

  it("size-splits sofas: a small box picks Small Sofa, a large box picks Big Sofa", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    render(
      <SpriteRenderer
        object={makeObj(1, "sofa")}
        config={getLayoutObjectRenderConfig("sofa")}
        style={baseStyle}
        width={60}
        height={40}
        isSelected={false}
        isSaving={false}
        isBookingMode={false}
      />
    ); // area 2400 < 12000 → Small Sofa
    expect(mockUseKonvaImage).toHaveBeenCalledWith(expect.stringMatching(/small-sofa/i));

    vi.clearAllMocks();
    mockUseKonvaImage.mockReturnValue(loaded());
    render(
      <SpriteRenderer
        object={makeObj(1, "sofa")}
        config={getLayoutObjectRenderConfig("sofa")}
        style={baseStyle}
        width={200}
        height={120}
        isSelected={false}
        isSaving={false}
        isBookingMode={false}
      />
    ); // area 24000 ≥ 12000 → Big Sofa
    expect(mockUseKonvaImage).toHaveBeenCalledWith(expect.stringMatching(/big-sofa/i));
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import type { LayoutObject } from "../../types/layoutObject.types";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";
import type { KonvaImageState } from "../isometric/useKonvaImage";

// Capture Konva shapes as data attributes (no real Konva stage).
vi.mock("react-konva", () => ({
  Image: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-image"
      data-props={JSON.stringify({ width: props.width, height: props.height })}
    />
  ),
  Rect: (props: Record<string, unknown>) => (
    <div data-testid="konva-rect" data-props={JSON.stringify(props)} />
  ),
  Circle: () => <div data-testid="konva-circle" />,
}));

// Control image-load status per test.
const mockUseKonvaImage = vi.hoisted(() => vi.fn<(src: string | undefined) => KonvaImageState>());
vi.mock("../isometric/useKonvaImage", () => ({
  useKonvaImage: (src: string | undefined) => mockUseKonvaImage(src),
}));

// Capture which sprite key the renderer asked for, holding the real impl so the
// default mock delegates to it (re-importing the mocked module would recurse).
const deskSpriteMock = vi.hoisted(() => ({
  pick: vi.fn(),
  real: null as null | ((id: number, s: DeskAvailabilityStatus | undefined) => string | undefined),
}));
vi.mock("../isometric/deskSprite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../isometric/deskSprite")>();
  deskSpriteMock.real = actual.pickDeskSpriteKey;
  return {
    ...actual,
    pickDeskSpriteKey: (id: number, s: DeskAvailabilityStatus | undefined) =>
      deskSpriteMock.pick(id, s),
  };
});
const mockPick = deskSpriteMock.pick;

import { DeskRenderer } from "../isometric/DeskRenderer";

const makeObj = (id: number): LayoutObject => ({
  id,
  floor: 2,
  object_type: "desk",
  object_type_display: "desk",
  label: "Desk",
  x: "100.00",
  y: "150.00",
  width: "80.00",
  height: "50.00",
  rotation: "0.00",
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

function renderDesk(id: number, status?: DeskAvailabilityStatus) {
  render(
    <DeskRenderer
      object={makeObj(id)}
      config={getLayoutObjectRenderConfig("desk")}
      style={baseStyle}
      width={80}
      height={50}
      isSelected={false}
      isSaving={false}
      isBookingMode={false}
      availabilityStatus={status}
    />
  );
}

function loaded(): KonvaImageState {
  return { image: { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement, status: "loaded" };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: resolve to a real manifest key so spriteUrl() is truthy.
  mockPick.mockImplementation((id: number, s: DeskAvailabilityStatus | undefined) =>
    deskSpriteMock.real!(id, s)
  );
});

describe("DeskRenderer", () => {
  it("draws the isometric desk sprite when the image is loaded", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderDesk(1, "available");
    expect(screen.getByTestId("konva-image")).toBeInTheDocument();
  });

  it("picks the sprite from the desk id and booking state", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderDesk(42, "reserved");
    expect(mockPick).toHaveBeenCalledWith(42, "reserved");
  });

  it("falls back to the styled box while the sprite is loading", () => {
    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
    renderDesk(1, "available");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument();
  });

  it("falls back to the styled box on load error", () => {
    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "error" });
    renderDesk(1, "reserved");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument();
  });

  it("falls back to the styled box when no sprite key resolves (empty pool)", () => {
    mockPick.mockReturnValue(undefined);
    mockUseKonvaImage.mockReturnValue(loaded());
    renderDesk(1, "available");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument();
  });
});

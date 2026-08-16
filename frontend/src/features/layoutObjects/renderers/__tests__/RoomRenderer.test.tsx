import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LayoutObject, LayoutObjectType } from "../../types/layoutObject.types";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";
import type { KonvaImageState } from "../isometric/useKonvaImage";
import { ROOM_AREA_MEDIUM_MAX, ROOM_MIN_FURNISH_AREA } from "../isometric/roomFurnishing";

vi.mock("react-konva", () => ({
  Image: () => <div data-testid="konva-image" />,
  Rect: () => <div data-testid="konva-rect" />,
  Circle: () => <div data-testid="konva-circle" />,
}));

const mockUseKonvaImage = vi.hoisted(() => vi.fn<(src: string | undefined) => KonvaImageState>());
vi.mock("../isometric/useKonvaImage", () => ({
  useKonvaImage: (src: string | undefined) => mockUseKonvaImage(src),
}));

import { RoomRenderer } from "../isometric/RoomRenderer";

const baseStyle: LayoutObjectNodeStyle = {
  fill: "#DDD6FE",
  stroke: "#7C3AED",
  strokeWidth: 1.5,
  opacity: 0.35,
  dash: [8, 4],
};

const side = (area: number) => Math.round(Math.sqrt(area));

function renderRoom(type: LayoutObjectType, area: number) {
  const s = side(area);
  render(
    <RoomRenderer
      object={
        {
          id: 1,
          floor: 1,
          object_type: type,
          object_type_display: type,
          label: "",
          x: "0",
          y: "0",
          width: String(s),
          height: String(s),
          rotation: "0",
          metadata: {},
          is_active: true,
          created_at: "",
          updated_at: "",
        } as LayoutObject
      }
      config={getLayoutObjectRenderConfig(type)}
      style={baseStyle}
      width={s}
      height={s}
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

describe("RoomRenderer", () => {
  it("always draws the geometric shell (the room rect) — any size, furnished or not", () => {
    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
    renderRoom("meeting_room", ROOM_MIN_FURNISH_AREA - 2000); // too small to furnish
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument(); // the shell
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument(); // no furniture
  });

  it("places interior furniture when the room is big enough and the sprite is loaded", () => {
    mockUseKonvaImage.mockReturnValue(loaded());
    renderRoom("kitchen", ROOM_AREA_MEDIUM_MAX); // kitchen → shelf + table (2 pieces)
    expect(screen.getAllByTestId("konva-image")).toHaveLength(2);
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument(); // shell still present
  });

  it("shows only the shell (no furniture) while interior sprites are loading", () => {
    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
    renderRoom("meeting_room", ROOM_AREA_MEDIUM_MAX);
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("konva-rect")).toBeInTheDocument();
  });
});

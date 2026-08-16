import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";

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
}));

import { AssetSpriteBody } from "../isometric/AssetSpriteBody";

const baseStyle: LayoutObjectNodeStyle = {
  fill: "#BFDBFE",
  stroke: "#2563EB",
  strokeWidth: 1.5,
  opacity: 1,
  dash: undefined,
};

function renderBody(
  opts: {
    natural?: [number, number];
    style?: LayoutObjectNodeStyle;
    isSaving?: boolean;
    isBookingMode?: boolean;
  } = {}
) {
  const [nw, nh] = opts.natural ?? [0, 0];
  const image = { naturalWidth: nw, naturalHeight: nh } as HTMLImageElement;
  render(
    <AssetSpriteBody
      image={image}
      style={opts.style ?? baseStyle}
      config={getLayoutObjectRenderConfig("desk")}
      width={80}
      height={50}
      isSaving={opts.isSaving ?? false}
      isBookingMode={opts.isBookingMode ?? false}
    />
  );
}

function img() {
  return JSON.parse(screen.getByTestId("konva-image").getAttribute("data-props") ?? "{}");
}
function rect(i: number) {
  return JSON.parse(screen.getAllByTestId("konva-rect")[i].getAttribute("data-props") ?? "{}");
}

describe("AssetSpriteBody", () => {
  it("fills the box when natural dimensions are unknown", () => {
    renderBody();
    expect(img().width).toBe(80);
    expect(img().height).toBe(50);
    expect(img().x).toBe(-40);
    expect(img().y).toBe(-25);
  });

  it("contain-fits the artwork without distortion and centres it", () => {
    // 100x100 into 80x50 → scale 0.5 → 50x50 centred.
    renderBody({ natural: [100, 100] });
    expect(img().width).toBe(50);
    expect(img().height).toBe(50);
    expect(img().x).toBe(-25);
    expect(img().y).toBe(-25);
    // The border still covers the full object box.
    expect(rect(1).width).toBe(80);
    expect(rect(1).height).toBe(50);
  });

  it("keeps the image non-interactive; the full-box tint is the hit target", () => {
    renderBody({
      style: { fill: "#FECACA", stroke: "#DC2626", strokeWidth: 3, opacity: 1, dash: undefined },
    });
    expect(img().listening).toBe(false);
    const tint = rect(0);
    expect(tint.fill).toBe("#FECACA");
    expect(tint.width).toBe(80);
    expect(tint.height).toBe(50);
    expect(tint.listening).not.toBe(false); // clickable
    const border = rect(1);
    expect(border.stroke).toBe("#DC2626");
    expect(border.strokeWidth).toBe(3);
    expect(border.listening).toBe(false);
  });

  it("uses a stronger availability tint in booking mode", () => {
    renderBody({ isBookingMode: true });
    expect(rect(0).opacity).toBe(0.45);
  });

  it("dims the sprite while saving", () => {
    renderBody({ isSaving: true });
    expect(img().opacity).toBe(0.6);
  });
});

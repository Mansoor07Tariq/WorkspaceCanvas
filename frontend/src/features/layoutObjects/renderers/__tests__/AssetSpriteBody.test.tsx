import { cleanup, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";

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
    availabilityStatus?: DeskAvailabilityStatus;
    showBorder?: boolean;
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
      availabilityStatus={opts.availabilityStatus}
      showBorder={opts.showBorder ?? false}
    />
  );
}

function img() {
  return JSON.parse(screen.getByTestId("konva-image").getAttribute("data-props") ?? "{}");
}
function rects() {
  return screen
    .queryAllByTestId("konva-rect")
    .map((el) => JSON.parse(el.getAttribute("data-props") ?? "{}"));
}
// The invisible hit target: opacity 0, a fill, no stroke. Its size is now the UNION of the floor
// rect and the drawn sprite bounds, so it is NOT keyed to the box size.
const hitRect = () => rects().find((r) => r.opacity === 0 && !r.stroke);
// The border: stroked, fill disabled.
const border = () => rects().find((r) => r.fillEnabled === false && r.stroke);
// The availability fill: has a fill + a visible opacity, no stroke.
const availFill = () =>
  rects().find((r) => r.fill && !r.stroke && r.opacity !== undefined && r.opacity > 0);

describe("AssetSpriteBody", () => {
  it("fills the box when natural dimensions are unknown", () => {
    renderBody();
    expect(img().width).toBe(80);
    expect(img().height).toBe(50);
    expect(img().x).toBe(-40);
    expect(img().y).toBe(-25);
  });

  it("footprint-fits the artwork: fills width (up to the overflow bound), bottom-anchored (PR 081)", () => {
    // 100x100 into 80x50: width-fill 80x80 (overflow 30) trimmed to overflow ≤ 0.25*80=20 → 70x70.
    renderBody({ natural: [100, 100] });
    expect(img().width).toBe(70);
    expect(img().height).toBe(70);
    expect(img().x).toBe(-35); // centred
    expect(img().y).toBe(-45); // bottom edge at 25 (= boxH/2), overflowing up
  });

  it("hit target is the UNION of floor rect and sprite bounds — no dead strip (fix-up 2)", () => {
    // 100x100 into 80x50 → sprite 70x70 spanning y -45..25, x -35..35. Floor rect: 80x50, y -25..25.
    // Union = x -40..40 (floor rect is WIDER than the capped sprite) and y -45..25 (sprite is TALLER).
    renderBody({ natural: [100, 100], availabilityStatus: "bookedByMe", showBorder: true });
    const hit = hitRect()!;
    expect(hit.listening).not.toBe(false); // still hit-testable
    expect(hit.x).toBe(-40);
    expect(hit.y).toBe(-45); // extends UP to the sprite top — the old dead strip is now clickable
    expect(hit.width).toBe(80); // keeps the floor rect's width (the sprite is only 70 wide)
    expect(hit.height).toBe(70); // floor-rect bottom (25) up to sprite top (-45)
    // It covers the full drawn sprite bounds...
    expect(hit.x).toBeLessThanOrEqual(-35);
    expect(hit.x + hit.width).toBeGreaterThanOrEqual(35);
    expect(hit.y).toBeLessThanOrEqual(-45);
    expect(hit.y + hit.height).toBeGreaterThanOrEqual(25);
    // ...AND the full floor rect.
    expect(hit.x).toBeLessThanOrEqual(-40);
    expect(hit.x + hit.width).toBeGreaterThanOrEqual(40);
    expect(hit.y).toBeLessThanOrEqual(-25);
    // Availability fill + border are at the SPRITE bounds (70x70), not the 80x50 box.
    // (the coloured region and the hit region are different shapes BY DESIGN)
    // PR 083 Part A: the border only exists while hovered/selected, so this case opts in.
    const fill = availFill();
    expect(fill!.width).toBe(70);
    expect(fill!.height).toBe(70);
    expect(fill!.listening).toBe(false);
    expect(border()!.width).toBe(70);
    expect(border()!.listening).toBe(false);
  });

  it("a NON-overflowing sprite leaves the hit target exactly equal to the floor rect", () => {
    // 200x50 (wide) into 80x50 → scale .4 → 80x20, sitting inside the box (y 5..25). No overflow.
    renderBody({ natural: [200, 50] });
    const hit = hitRect()!;
    expect(hit.x).toBe(-40);
    expect(hit.y).toBe(-25);
    expect(hit.width).toBe(80);
    expect(hit.height).toBe(50);
  });

  it("ONLY the hit target listens — sprite, fill and border stay non-listening", () => {
    renderBody({ natural: [100, 100], availabilityStatus: "reserved", showBorder: true });
    expect(img().listening).toBe(false);
    expect(availFill()!.listening).toBe(false);
    expect(border()!.listening).toBe(false);
    // exactly one hit-testable rect (the others all opt out)
    const listening = rects().filter((r) => r.listening !== false);
    expect(listening).toHaveLength(1);
    expect(listening[0].opacity).toBe(0);
  });

  it("a bookable desk gets a strong availability wash over the sprite", () => {
    renderBody({ natural: [100, 100], isBookingMode: true, availabilityStatus: "reserved" });
    expect(availFill()!.opacity).toBe(0.4);
  });

  it("non-bookable furniture on the booking map is NOT washed (stool no longer a flat blob)", () => {
    renderBody({ natural: [100, 100], isBookingMode: true }); // no availabilityStatus
    expect(availFill()).toBeUndefined(); // no visible fill rect at all
    // the sprite + hit target + border still render
    expect(screen.getByTestId("konva-image")).toBeInTheDocument();
    expect(hitRect()).toBeTruthy();
  });

  it("dims the sprite while saving", () => {
    renderBody({ isSaving: true });
    expect(img().opacity).toBe(0.6);
  });

  // ─── PR 083 Part A: a border means "you are interacting with this" ────────────

  it("draws NO border at rest — an object at rest has no outline", () => {
    // The resting state is the whole point of Part A: previously every enhanced object carried a
    // permanent coloured outline, which read as "this object exists" rather than as interaction.
    renderBody({ natural: [100, 100], availabilityStatus: "available" });
    expect(border()).toBeUndefined();
  });

  it("draws no border at rest in the editor either (no availability status)", () => {
    renderBody({ natural: [100, 100] });
    expect(border()).toBeUndefined();
  });

  it("draws the border when hovered/selected, tracking the DRAWN sprite not the floor rect", () => {
    // 100x100 into an 80x50 box → width-fill 80, capped to 70x70 by SPRITE_MAX_OVERFLOW_RATIO.
    renderBody({ natural: [100, 100], availabilityStatus: "available", showBorder: true });
    const b = border()!;
    expect(b).toBeDefined();
    expect(b.width).toBe(70); // the sprite bounds…
    expect(b.height).toBe(70);
    expect(b.width).not.toBe(80); // …not the 80x50 floor rect
    expect(b.listening).toBe(false); // and it never steals the hit target
  });

  it("the availability FILL is unchanged by the border rule — it still carries state at rest", () => {
    // With the border gone, the tint is the only thing separating available/reserved/unavailable,
    // so it must be present and unchanged in the resting state.
    renderBody({ natural: [100, 100], availabilityStatus: "available" });
    const fill = availFill()!;
    expect(fill).toBeDefined();
    expect(fill.opacity).toBe(0.4);
    expect(fill.width).toBe(70);
  });

  it("hiding the border does not change the hit target", () => {
    renderBody({ natural: [100, 100], availabilityStatus: "available" });
    const atRest = hitRect()!;
    cleanup();
    renderBody({ natural: [100, 100], availabilityStatus: "available", showBorder: true });
    const hovered = hitRect()!;
    expect(atRest).toEqual(hovered);
  });
});

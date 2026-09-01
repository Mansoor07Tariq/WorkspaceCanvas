import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { colorTokens, initialsFromName, occupantTileInset } from "@/theme/tokens";
import type { KonvaImageState } from "../isometric/useKonvaImage";
import type { SpriteFit } from "../isometric/spriteGeometry";

// Capture Konva shapes as data nodes (no real stage).
vi.mock("react-konva", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Group: ({ children, ...p }: any) => (
    <div data-testid="konva-group" data-props={JSON.stringify({ listening: p.listening })}>
      {children}
    </div>
  ),
  Image: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-image"
      data-props={JSON.stringify({
        x: props.x,
        y: props.y,
        width: props.width,
        height: props.height,
        listening: props.listening,
      })}
    />
  ),
  Rect: (props: Record<string, unknown>) => (
    <div data-testid="konva-rect" data-props={JSON.stringify(props)} />
  ),
  Text: (props: Record<string, unknown>) => (
    <div data-testid="konva-text" data-props={JSON.stringify(props)} />
  ),
}));

const mockUseKonvaImage = vi.hoisted(() => vi.fn<(src: string | undefined) => KonvaImageState>());
vi.mock("../isometric/useKonvaImage", () => ({
  useKonvaImage: (src: string | undefined) => mockUseKonvaImage(src),
}));

import { OccupantTile } from "../isometric/OccupantTile";

const FIT: SpriteFit = { x: -40, y: -25, width: 80, height: 50 };
const RECT = { x: 0.03, y: 0.03, w: 0.94, h: 0.55 };

function texts(): string[] {
  return screen.queryAllByTestId("konva-text").map((el) => {
    const p = JSON.parse(el.getAttribute("data-props") ?? "{}");
    return p.text as string;
  });
}
function rects(): Record<string, unknown>[] {
  return screen
    .queryAllByTestId("konva-rect")
    .map((el) => JSON.parse(el.getAttribute("data-props") ?? "{}"));
}
function frame(): Record<string, unknown> | undefined {
  // The frame is the stroked, fill-disabled rect.
  return rects().find((r) => r.fillEnabled === false && r.stroke);
}
/** The initials/guest colour block: the filled, unstroked rect. */
function block(): Record<string, unknown> | undefined {
  return rects().find((r) => r.fill && !r.stroke);
}
function photo(): Record<string, unknown> | undefined {
  const el = screen.queryByTestId("konva-image");
  return el ? JSON.parse(el.getAttribute("data-props") ?? "{}") : undefined;
}
function bounds(p: Record<string, unknown>) {
  return { x: p.x as number, y: p.y as number, w: p.width as number, h: p.height as number };
}
/** The desk's top surface (the box the identity is contained in) — mirrors `computeTileBox`. */
const SURFACE = (() => {
  const rectW = RECT.w * FIT.width;
  const rectH = RECT.h * FIT.height;
  const inset = occupantTileInset * Math.min(rectW, rectH);
  return {
    x: FIT.x + RECT.x * FIT.width + inset,
    y: FIT.y + RECT.y * FIT.height + inset,
    w: rectW - 2 * inset,
    h: rectH - 2 * inset,
  };
})();
function loadedPhoto(naturalWidth: number, naturalHeight: number) {
  mockUseKonvaImage.mockReturnValue({
    image: { naturalWidth, naturalHeight } as HTMLImageElement,
    status: "loaded",
  });
}
function renderColleague(showFrame = true) {
  return render(
    <OccupantTile
      showFrame={showFrame}
      fit={FIT}
      desktopRect={RECT}
      kind="colleague"
      name="Jane Smith"
      avatarUrl="https://cdn/x.jpg"
      colorKey={5}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
});

describe("OccupantTile", () => {
  it("colleague with no photo → coloured initials, thin frame, NO pine", () => {
    render(
      <OccupantTile
        showFrame
        fit={FIT}
        desktopRect={RECT}
        kind="colleague"
        name="Jane Smith"
        colorKey={5}
      />
    );
    expect(texts()).toContain(initialsFromName("Jane Smith")); // "JS"
    const f = frame();
    expect(f?.stroke).toBe(colorTokens.onPine); // hairline, not pine
    expect(texts()).not.toContain("You");
  });

  it("you (me) → pine frame + 'You' tag", () => {
    render(
      <OccupantTile
        showFrame
        fit={FIT}
        desktopRect={RECT}
        kind="me"
        name="Me Myself"
        colorKey={7}
      />
    );
    expect(frame()?.stroke).toBe(colorTokens.pineDark);
    expect(texts()).toContain("You");
  });

  it("guest → neutral tile labelled 'Guest', no initials/photo", () => {
    render(<OccupantTile showFrame fit={FIT} desktopRect={RECT} kind="guest" />);
    expect(texts()).toContain("Guest");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
  });

  it("photo loaded → renders the avatar image instead of initials", () => {
    loadedPhoto(100, 100);
    renderColleague();
    expect(screen.getByTestId("konva-image")).toBeInTheDocument();
    expect(texts()).not.toContain(initialsFromName("Jane Smith"));
  });

  it("EVERY tile shape is non-listening, so the desk's own hit target is unaffected (fix-up 2)", () => {
    render(
      <OccupantTile
        showFrame
        fit={FIT}
        desktopRect={RECT}
        kind="me"
        name="Me Myself"
        colorKey={7}
      />
    );
    const nodes = [
      ...screen.queryAllByTestId("konva-group"),
      ...screen.queryAllByTestId("konva-rect"),
      ...screen.queryAllByTestId("konva-text"),
      ...screen.queryAllByTestId("konva-image"),
    ];
    expect(nodes.length).toBeGreaterThan(0);
    for (const el of nodes) {
      const p = JSON.parse(el.getAttribute("data-props") ?? "{}");
      expect(p.listening).toBe(false);
    }
  });

  it("the tile stays within the desktop rect (never onto the chair)", () => {
    render(
      <OccupantTile showFrame fit={FIT} desktopRect={RECT} kind="colleague" name="J" colorKey={1} />
    );
    const f = frame()!;
    const rectBottom = FIT.y + (RECT.y + RECT.h) * FIT.height;
    const tileBottom = (f.y as number) + (f.height as number);
    expect(tileBottom).toBeLessThanOrEqual(rectBottom + 1e-6);
  });

  // ─── PR 083: the photo is contained, not cropped ──────────────────────────────

  it("a square photo on a wide desktop is drawn WHOLE — aspect preserved, inside the surface", () => {
    // Pins the reversal of PR 080's cover-fit. Cover scaled by max(w/nW, h/nH), so a square photo
    // was drawn SURFACE.w wide and equally tall and the clip cut the overhang away; this asserts the
    // drawn box is bound by the SHORT axis instead, which is what makes the whole face visible.
    loadedPhoto(100, 100);
    renderColleague();
    const p = bounds(photo()!);

    expect(p.w).toBeCloseTo(p.h, 6); // square source → square drawn: aspect preserved
    expect(p.h).toBeCloseTo(SURFACE.h, 6); // height-bound on a wide, shallow desktop
    expect(p.w).toBeLessThan(SURFACE.w); // and therefore NARROWER than the surface it sits on
    // Wholly inside the surface on both axes — nothing to crop.
    expect(p.x).toBeGreaterThanOrEqual(SURFACE.x - 1e-6);
    expect(p.y).toBeGreaterThanOrEqual(SURFACE.y - 1e-6);
    expect(p.x + p.w).toBeLessThanOrEqual(SURFACE.x + SURFACE.w + 1e-6);
    expect(p.y + p.h).toBeLessThanOrEqual(SURFACE.y + SURFACE.h + 1e-6);
    // Centred in the surface.
    expect(p.x + p.w / 2).toBeCloseTo(SURFACE.x + SURFACE.w / 2, 6);
    expect(p.y + p.h / 2).toBeCloseTo(SURFACE.y + SURFACE.h / 2, 6);
  });

  it("a very wide photo is bound by WIDTH and leaves gaps above and below", () => {
    // Hosted avatars are an unprocessed ImageField, so non-square uploads are real. Aspect 4 is
    // wider than the surface's own aspect, so the binding axis flips from height to width.
    loadedPhoto(400, 100);
    renderColleague();
    const p = bounds(photo()!);

    expect(p.w / p.h).toBeCloseTo(4, 6); // source aspect preserved
    expect(p.w).toBeCloseTo(SURFACE.w, 6); // width-bound
    expect(p.h).toBeLessThan(SURFACE.h); // → letterboxed
    const gap = (SURFACE.h - p.h) / 2;
    expect(p.y - SURFACE.y).toBeCloseTo(gap, 6); // equal gap above
    expect(SURFACE.y + SURFACE.h - (p.y + p.h)).toBeCloseTo(gap, 6); // and below
  });

  it("the frame tracks the DRAWN photo, not the desk surface", () => {
    // The PR 081 fix-up rule: an affordance must never sit where the art is not. With a contained
    // photo the surface is wider than the photo, so a frame left on the surface would be visibly
    // wrong on both sides.
    loadedPhoto(100, 100);
    renderColleague();
    const p = bounds(photo()!);
    const f = frame()!;

    expect(f.x).toBeCloseTo(p.x, 6);
    expect(f.y).toBeCloseTo(p.y, 6);
    expect(f.width).toBeCloseTo(p.w, 6);
    expect(f.height).toBeCloseTo(p.h, 6);
    expect(f.width as number).toBeLessThan(SURFACE.w); // and so is NOT the surface
  });

  it("the 'You' tag follows the photo's bounds too", () => {
    loadedPhoto(100, 100);
    render(
      <OccupantTile
        showFrame={true}
        fit={FIT}
        desktopRect={RECT}
        kind="me"
        name="Me Myself"
        avatarUrl="https://cdn/x.jpg"
        colorKey={7}
      />
    );
    const p = bounds(photo()!);
    const tag = screen
      .queryAllByTestId("konva-text")
      .map((el) => JSON.parse(el.getAttribute("data-props") ?? "{}"))
      .find((t) => t.text === "You")!;

    expect(tag.x).toBeCloseTo(p.x, 6); // centred over the photo, not the surface
    expect(tag.width).toBeCloseTo(p.w, 6);
    expect(tag.y as number).toBeGreaterThanOrEqual(p.y + p.h); // sits below it
  });

  it("initials occupy exactly the rect a square photo would — one design, not two", () => {
    // A desk showing initials and a desk showing a photo stand side by side on the same floor; if
    // the generated fallback kept filling the whole surface they would read as different systems.
    loadedPhoto(100, 100);
    const mounted = renderColleague();
    const withPhoto = bounds(photo()!);
    mounted.unmount();

    mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
    render(
      <OccupantTile
        showFrame
        fit={FIT}
        desktopRect={RECT}
        kind="colleague"
        name="Jane Smith"
        colorKey={5}
      />
    );
    const b = block()!;

    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument(); // really the fallback
    expect(b.x).toBeCloseTo(withPhoto.x, 6);
    expect(b.y).toBeCloseTo(withPhoto.y, 6);
    expect(b.width).toBeCloseTo(withPhoto.w, 6);
    expect(b.height).toBeCloseTo(withPhoto.h, 6);
  });

  it("the guest tile matches that same footprint", () => {
    loadedPhoto(100, 100);
    const mounted = renderColleague();
    const withPhoto = bounds(photo()!);
    mounted.unmount();

    render(<OccupantTile showFrame fit={FIT} desktopRect={RECT} kind="guest" />);
    const b = block()!;
    expect(b.width).toBeCloseTo(withPhoto.w, 6);
    expect(b.height).toBeCloseTo(withPhoto.h, 6);
  });

  // ─── PR 083 Part A: the frame appears on interaction, not at rest ─────────────

  it("draws NO frame around the occupant photo at rest", () => {
    loadedPhoto(100, 100);
    renderColleague(false);
    expect(frame()).toBeUndefined();
    expect(screen.getByTestId("konva-image")).toBeInTheDocument(); // the photo itself still shows
  });

  it("draws no frame around the initials tile at rest either", () => {
    render(
      <OccupantTile
        showFrame={false}
        fit={FIT}
        desktopRect={RECT}
        kind="colleague"
        name="Jane Smith"
        colorKey={5}
      />
    );
    expect(frame()).toBeUndefined();
    expect(block()).toBeDefined(); // the coloured initials block is unaffected
  });

  it("the pine 'You' frame is hidden at rest and still tracks the photo when shown", () => {
    // Part A supersedes only WHEN the frame appears; the PR 083 rule that it tracks the drawn
    // photo rather than the desktop rect still stands, so both halves are pinned together here.
    loadedPhoto(100, 100);
    const atRest = render(
      <OccupantTile
        showFrame={false}
        fit={FIT}
        desktopRect={RECT}
        kind="me"
        name="Me Myself"
        avatarUrl="https://cdn/x.jpg"
        colorKey={7}
      />
    );
    expect(frame()).toBeUndefined();
    atRest.unmount();

    render(
      <OccupantTile
        showFrame
        fit={FIT}
        desktopRect={RECT}
        kind="me"
        name="Me Myself"
        avatarUrl="https://cdn/x.jpg"
        colorKey={7}
      />
    );
    const p = bounds(photo()!);
    const f = frame()!;
    expect(f.stroke).toBe(colorTokens.pineDark); // still the pine "you" frame
    expect(f.x).toBeCloseTo(p.x, 6); // still tracking the DRAWN photo
    expect(f.width).toBeCloseTo(p.w, 6);
    expect(f.width as number).toBeLessThan(SURFACE.w); // not the desktop rect
  });

  it("the 'You' TAG is not a border — it stays visible at rest", () => {
    // Part A removes outlines, not identity. The tag is how you find your own desk on the map.
    loadedPhoto(100, 100);
    render(
      <OccupantTile
        showFrame={false}
        fit={FIT}
        desktopRect={RECT}
        kind="me"
        name="Me Myself"
        avatarUrl="https://cdn/x.jpg"
        colorKey={7}
      />
    );
    expect(texts()).toContain("You");
  });
});

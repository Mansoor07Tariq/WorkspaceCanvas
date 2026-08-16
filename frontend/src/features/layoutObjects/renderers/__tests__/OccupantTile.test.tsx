import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { colorTokens, initialsFromName } from "@/theme/tokens";
import type { KonvaImageState } from "../isometric/useKonvaImage";
import type { SpriteFit } from "../isometric/spriteGeometry";

// Capture Konva shapes as data nodes (no real stage).
vi.mock("react-konva", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Group: ({ children }: any) => <div data-testid="konva-group">{children}</div>,
  Image: (props: Record<string, unknown>) => (
    <div data-testid="konva-image" data-props={JSON.stringify({ width: props.width })} />
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseKonvaImage.mockReturnValue({ image: undefined, status: "loading" });
});

describe("OccupantTile", () => {
  it("colleague with no photo → coloured initials, thin frame, NO pine", () => {
    render(
      <OccupantTile fit={FIT} desktopRect={RECT} kind="colleague" name="Jane Smith" colorKey={5} />
    );
    expect(texts()).toContain(initialsFromName("Jane Smith")); // "JS"
    const f = frame();
    expect(f?.stroke).toBe(colorTokens.onPine); // hairline, not pine
    expect(texts()).not.toContain("You");
  });

  it("you (me) → pine frame + 'You' tag", () => {
    render(<OccupantTile fit={FIT} desktopRect={RECT} kind="me" name="Me Myself" colorKey={7} />);
    expect(frame()?.stroke).toBe(colorTokens.pineDark);
    expect(texts()).toContain("You");
  });

  it("guest → neutral tile labelled 'Guest', no initials/photo", () => {
    render(<OccupantTile fit={FIT} desktopRect={RECT} kind="guest" />);
    expect(texts()).toContain("Guest");
    expect(screen.queryByTestId("konva-image")).not.toBeInTheDocument();
  });

  it("photo loaded → renders the avatar image instead of initials", () => {
    mockUseKonvaImage.mockReturnValue({
      image: { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement,
      status: "loaded",
    });
    render(
      <OccupantTile
        fit={FIT}
        desktopRect={RECT}
        kind="colleague"
        name="Jane Smith"
        avatarUrl="https://cdn/x.jpg"
        colorKey={5}
      />
    );
    expect(screen.getByTestId("konva-image")).toBeInTheDocument();
    expect(texts()).not.toContain(initialsFromName("Jane Smith"));
  });

  it("the tile stays within the desktop rect (never onto the chair)", () => {
    render(<OccupantTile fit={FIT} desktopRect={RECT} kind="colleague" name="J" colorKey={1} />);
    const f = frame()!;
    const rectBottom = FIT.y + (RECT.y + RECT.h) * FIT.height;
    const tileBottom = (f.y as number) + (f.height as number);
    expect(tileBottom).toBeLessThanOrEqual(rectBottom + 1e-6);
  });
});

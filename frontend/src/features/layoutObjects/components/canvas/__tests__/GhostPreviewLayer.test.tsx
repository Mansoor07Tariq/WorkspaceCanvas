import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GhostPreviewLayer } from "../GhostPreviewLayer";
import type { GhostPreview } from "../../../enhancePreview/buildGhostPreview";

// Render react-konva primitives as plain divs so we can inspect props in jsdom.
vi.mock("react-konva", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Layer: ({ children, listening }: any) => (
    <div data-testid="ghost-layer" data-listening={String(listening)}>
      {children}
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Rect: (props: any) => (
    <div
      data-testid={props["data-testid"] ?? "rect"}
      data-rotation={props.rotation}
      data-width={props.width}
      data-height={props.height}
      data-listening={String(props.listening)}
    />
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Line: (props: any) => (
    <div data-testid="ghost-connector" data-points={JSON.stringify(props.points)} />
  ),
}));

function ghost(objectId: number, over: Partial<GhostPreview> = {}): GhostPreview {
  return {
    objectId,
    before: { x: 100, y: 100, width: 80, height: 50, rotation: 0 },
    after: { x: 160, y: 100, width: 80, height: 50, rotation: 0 },
    moved: true,
    resized: false,
    ...over,
  };
}

describe("GhostPreviewLayer", () => {
  it("renders one ghost outline per entry with listening disabled", () => {
    render(<GhostPreviewLayer ghosts={[ghost(1), ghost(2), ghost(3)]} />);
    expect(screen.getByTestId("ghost-layer").dataset.listening).toBe("false");
    const outlines = screen.getAllByTestId("tidy-ghost");
    expect(outlines).toHaveLength(3);
    // Every ghost outline is itself non-interactive.
    expect(outlines.every((o) => o.dataset.listening === "false")).toBe(true);
  });

  it("draws a connector only for ghosts whose centre moves", () => {
    render(
      <GhostPreviewLayer
        ghosts={[
          ghost(1, { moved: true }),
          ghost(2, {
            moved: false,
            after: { x: 100, y: 100, width: 80, height: 50, rotation: 90 },
          }),
        ]}
      />
    );
    expect(screen.getAllByTestId("tidy-ghost")).toHaveLength(2);
    expect(screen.getAllByTestId("ghost-connector")).toHaveLength(1); // only the moved one
  });

  it("renders the ghost outline at the proposed rotation", () => {
    render(
      <GhostPreviewLayer
        ghosts={[ghost(1, { after: { x: 100, y: 100, width: 80, height: 50, rotation: 45 } })]}
      />
    );
    expect(screen.getByTestId("tidy-ghost").dataset.rotation).toBe("45");
  });

  it("renders nothing interactive for an empty ghost list", () => {
    render(<GhostPreviewLayer ghosts={[]} />);
    expect(screen.queryByTestId("tidy-ghost")).toBeNull();
    expect(screen.queryByTestId("ghost-connector")).toBeNull();
  });
});

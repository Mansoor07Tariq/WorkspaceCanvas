import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CanvasZoomControls } from "../components/CanvasZoomControls";
import { MIN_SCALE, MAX_SCALE } from "../utils/canvasViewport";

function setup(scale = 1) {
  const onZoomIn = vi.fn();
  const onZoomOut = vi.fn();
  const onReset = vi.fn();
  render(
    <CanvasZoomControls scale={scale} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onReset} />
  );
  return { onZoomIn, onZoomOut, onReset };
}

describe("CanvasZoomControls", () => {
  it("shows the current zoom percentage", () => {
    setup(1);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("rounds the percentage", () => {
    setup(1.5);
    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("fires zoom in / out / reset callbacks", () => {
    const { onZoomIn, onZoomOut, onReset } = setup(1);
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /zoom out/i }));
    fireEvent.click(screen.getByRole("button", { name: /fit to office/i }));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("disables zoom in at MAX_SCALE", () => {
    setup(MAX_SCALE);
    expect(screen.getByRole("button", { name: /zoom in/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /zoom out/i })).toBeEnabled();
  });

  it("disables zoom out at MIN_SCALE", () => {
    setup(MIN_SCALE);
    expect(screen.getByRole("button", { name: /zoom out/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /zoom in/i })).toBeEnabled();
  });
});

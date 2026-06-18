import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LayoutCanvasToolbar } from "../components/LayoutCanvasToolbar";

// MUI Switch renders <input type="checkbox" role="switch"> in jsdom.
// We query by role="switch" and find by the label text provided by FormControlLabel.

const defaultProps = {
  showGrid: true,
  onShowGridChange: vi.fn(),
  snapEnabled: false,
  onSnapChange: vi.fn(),
  gridSize: 20,
  onGridSizeChange: vi.fn(),
  canManageLayout: true,
  enhanced: false,
  onEnhancedChange: vi.fn(),
};

function getShowGridSwitch() {
  return screen.getByRole("switch", { name: /show grid/i });
}

function getSnapSwitch() {
  return screen.getByRole("switch", { name: /snap to grid/i });
}

describe("LayoutCanvasToolbar", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── Rendering ───────────────────────────────────────────────────────────

  it("renders the toolbar container", () => {
    render(<LayoutCanvasToolbar {...defaultProps} />);
    expect(screen.getByTestId("canvas-toolbar")).toBeInTheDocument();
  });

  it("renders the Show Grid toggle", () => {
    render(<LayoutCanvasToolbar {...defaultProps} />);
    expect(getShowGridSwitch()).toBeInTheDocument();
  });

  it("renders Snap to Grid toggle for editors", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={true} />);
    expect(getSnapSwitch()).toBeInTheDocument();
  });

  it("hides Snap to Grid toggle for members (canManageLayout=false)", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={false} />);
    expect(screen.queryByRole("switch", { name: /snap to grid/i })).not.toBeInTheDocument();
  });

  it("renders grid size buttons for editors", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={true} />);
    expect(screen.getByRole("button", { name: "10 px" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20 px" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "40 px" })).toBeInTheDocument();
  });

  it("hides grid size buttons for members", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={false} />);
    expect(screen.queryByRole("button", { name: "10 px" })).not.toBeInTheDocument();
  });

  // ─── Show Grid toggle ─────────────────────────────────────────────────────

  it("Show Grid is checked when showGrid=true", () => {
    render(<LayoutCanvasToolbar {...defaultProps} showGrid={true} />);
    expect(getShowGridSwitch()).toBeChecked();
  });

  it("Show Grid is unchecked when showGrid=false", () => {
    render(<LayoutCanvasToolbar {...defaultProps} showGrid={false} />);
    expect(getShowGridSwitch()).not.toBeChecked();
  });

  it("calls onShowGridChange(false) when Show Grid is toggled off", () => {
    const onShowGridChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} showGrid={true} onShowGridChange={onShowGridChange} />
    );
    fireEvent.click(getShowGridSwitch());
    expect(onShowGridChange).toHaveBeenCalledWith(false);
  });

  it("calls onShowGridChange(true) when Show Grid is toggled on", () => {
    const onShowGridChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} showGrid={false} onShowGridChange={onShowGridChange} />
    );
    fireEvent.click(getShowGridSwitch());
    expect(onShowGridChange).toHaveBeenCalledWith(true);
  });

  // ─── Snap toggle ──────────────────────────────────────────────────────────

  it("Snap to Grid is checked when snapEnabled=true", () => {
    render(<LayoutCanvasToolbar {...defaultProps} snapEnabled={true} />);
    expect(getSnapSwitch()).toBeChecked();
  });

  it("Snap to Grid is unchecked when snapEnabled=false", () => {
    render(<LayoutCanvasToolbar {...defaultProps} snapEnabled={false} />);
    expect(getSnapSwitch()).not.toBeChecked();
  });

  it("calls onSnapChange(true) when Snap is toggled on", () => {
    const onSnapChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} snapEnabled={false} onSnapChange={onSnapChange} />
    );
    fireEvent.click(getSnapSwitch());
    expect(onSnapChange).toHaveBeenCalledWith(true);
  });

  it("calls onSnapChange(false) when Snap is toggled off", () => {
    const onSnapChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} snapEnabled={true} onSnapChange={onSnapChange} />
    );
    fireEvent.click(getSnapSwitch());
    expect(onSnapChange).toHaveBeenCalledWith(false);
  });

  // ─── Grid size buttons ────────────────────────────────────────────────────

  it("calls onGridSizeChange(10) when 10 px button is clicked", () => {
    const onGridSizeChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} gridSize={20} onGridSizeChange={onGridSizeChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "10 px" }));
    expect(onGridSizeChange).toHaveBeenCalledWith(10);
  });

  it("calls onGridSizeChange(40) when 40 px button is clicked", () => {
    const onGridSizeChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} gridSize={20} onGridSizeChange={onGridSizeChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "40 px" }));
    expect(onGridSizeChange).toHaveBeenCalledWith(40);
  });

  // ─── Accessibility ────────────────────────────────────────────────────────

  it("Show Grid toggle has accessible label", () => {
    render(<LayoutCanvasToolbar {...defaultProps} />);
    expect(getShowGridSwitch()).toBeInTheDocument();
  });

  it("Snap to Grid toggle has accessible label", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={true} />);
    expect(getSnapSwitch()).toBeInTheDocument();
  });

  it("grid size buttons have accessible labels", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={true} />);
    expect(screen.getByRole("button", { name: "10 px" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20 px" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "40 px" })).toBeInTheDocument();
  });

  it("member view still shows the Show Grid toggle", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={false} />);
    expect(getShowGridSwitch()).toBeInTheDocument();
  });

  // ─── Enhance toggle ───────────────────────────────────────────────────────

  it("shows the Enhance button when not enhanced", () => {
    render(<LayoutCanvasToolbar {...defaultProps} enhanced={false} />);
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
  });

  it("shows the Revert button when enhanced", () => {
    render(<LayoutCanvasToolbar {...defaultProps} enhanced={true} />);
    expect(screen.getByRole("button", { name: /revert/i })).toBeInTheDocument();
  });

  it("calls onEnhancedChange(true) when Enhance is clicked", () => {
    const onEnhancedChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} enhanced={false} onEnhancedChange={onEnhancedChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /enhance/i }));
    expect(onEnhancedChange).toHaveBeenCalledWith(true);
  });

  it("calls onEnhancedChange(false) when Revert is clicked", () => {
    const onEnhancedChange = vi.fn();
    render(
      <LayoutCanvasToolbar {...defaultProps} enhanced={true} onEnhancedChange={onEnhancedChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /revert/i }));
    expect(onEnhancedChange).toHaveBeenCalledWith(false);
  });

  it("Enhance toggle is available to members too", () => {
    render(<LayoutCanvasToolbar {...defaultProps} canManageLayout={false} enhanced={false} />);
    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
  });
});

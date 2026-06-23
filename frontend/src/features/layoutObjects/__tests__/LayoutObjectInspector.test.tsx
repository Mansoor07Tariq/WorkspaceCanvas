import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LayoutObjectInspector } from "../components/LayoutObjectInspector";
import type { LayoutObject } from "../types/layoutObject.types";

const mockObject: LayoutObject = {
  id: 1,
  floor: 2,
  object_type: "desk",
  object_type_display: "Desk",
  label: "Desk A1",
  x: "100.00",
  y: "150.00",
  width: "80.00",
  height: "50.00",
  rotation: "0.00",
  is_bookable: false,
  metadata: {},
  is_active: true,
  created_at: "2026-05-30T00:00:00Z",
  updated_at: "2026-05-30T00:00:00Z",
};

describe("LayoutObjectInspector", () => {
  it("shows empty state when no object is selected", () => {
    render(<LayoutObjectInspector object={null} />);
    expect(screen.getByText(/select an object to inspect its details/i)).toBeInTheDocument();
  });

  it("shows Inspector title", () => {
    render(<LayoutObjectInspector object={null} />);
    expect(screen.getByText(/inspector/i)).toBeInTheDocument();
  });

  it("shows object type when object is selected", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.getByText("Desk")).toBeInTheDocument();
  });

  it("shows object label when set", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.getByText("Desk A1")).toBeInTheDocument();
  });

  it("shows (no label) when label is empty", () => {
    render(<LayoutObjectInspector object={{ ...mockObject, label: "" }} />);
    expect(screen.getByText(/no label/i)).toBeInTheDocument();
  });

  it("shows position", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.getByText("(100.00, 150.00)")).toBeInTheDocument();
  });

  it("shows size", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.getByText("80.00 × 50.00")).toBeInTheDocument();
  });

  it("shows rotation", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.getByText("0.00°")).toBeInTheDocument();
  });

  it("shows Saving… chip when isSaving=true", () => {
    render(<LayoutObjectInspector object={mockObject} isSaving={true} />);
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it("does not show Saving chip when isSaving=false", () => {
    render(<LayoutObjectInspector object={mockObject} isSaving={false} />);
    expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
  });

  it("shows Saved chip when isSaved=true and not saving", () => {
    render(<LayoutObjectInspector object={mockObject} isSaving={false} isSaved={true} />);
    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
  });

  it("does not show Saved chip when isSaving=true even if isSaved=true", () => {
    render(<LayoutObjectInspector object={mockObject} isSaving={true} isSaved={true} />);
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  // ─── Editable mode (PR 065) ────────────────────────────────────────────────

  it("read-only mode shows no Save button", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
  });

  it("editable mode saves edited details", () => {
    const onSave = vi.fn();
    render(<LayoutObjectInspector object={{ ...mockObject, label: "" }} canEdit onSave={onSave} />);
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Reception desk" } });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledWith({
      label: "Reception desk",
      width: "80.00",
      height: "50.00",
      rotation: "0.00",
    });
  });

  it("disables Save and warns on an invalid size", () => {
    render(<LayoutObjectInspector object={mockObject} canEdit onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "0" } });
    expect(screen.getByText(/greater than 0/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("delete calls onDelete", () => {
    const onDelete = vi.fn();
    render(
      <LayoutObjectInspector object={mockObject} canEdit onSave={vi.fn()} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

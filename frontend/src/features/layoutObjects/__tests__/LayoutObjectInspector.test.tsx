import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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

const bookableObject: LayoutObject = {
  ...mockObject,
  id: 2,
  is_bookable: true,
  label: "",
  metadata: { color: "#2563EB" },
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

  it("shows No for non-bookable object", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("shows Yes for bookable object", () => {
    render(<LayoutObjectInspector object={bookableObject} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("shows metadata preview when metadata is non-empty", () => {
    render(<LayoutObjectInspector object={bookableObject} />);
    expect(screen.getByText(/2563eb/i)).toBeInTheDocument();
  });

  it("does not show metadata section for empty metadata", () => {
    render(<LayoutObjectInspector object={mockObject} />);
    expect(screen.queryByText(/metadata/i)).not.toBeInTheDocument();
  });

  it("shows saving chip when isSaving=true", () => {
    render(<LayoutObjectInspector object={mockObject} isSaving={true} />);
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it("does not show saving chip when isSaving=false", () => {
    render(<LayoutObjectInspector object={mockObject} isSaving={false} />);
    expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
  });
});

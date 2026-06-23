import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FloorReviewPanel } from "../FloorReviewPanel";

describe("FloorReviewPanel", () => {
  it("draft floor shows Publish and calls onPublish", () => {
    const onPublish = vi.fn();
    render(<FloorReviewPanel status="draft" busy={false} onPublish={onPublish} onEdit={vi.fn()} />);
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /publish floor/i }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("published floor shows Edit and calls onEdit", () => {
    const onEdit = vi.fn();
    render(
      <FloorReviewPanel status="published" busy={false} onPublish={vi.fn()} onEdit={onEdit} />
    );
    expect(screen.getByText(/published/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit floor/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("disables the action while busy", () => {
    render(<FloorReviewPanel status="draft" busy onPublish={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
  });
});

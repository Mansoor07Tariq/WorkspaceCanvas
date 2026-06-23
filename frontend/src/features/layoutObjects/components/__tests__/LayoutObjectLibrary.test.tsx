import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutObjectLibrary } from "../LayoutObjectLibrary";

describe("LayoutObjectLibrary (tiled palette)", () => {
  it("renders curated tiles with icon + label", () => {
    render(<LayoutObjectLibrary selectedType="" onSelect={vi.fn()} />);
    expect(screen.getByTestId("object-library")).toBeInTheDocument();
    // Curated items present...
    expect(screen.getByTestId("library-tile-desk")).toBeInTheDocument();
    expect(screen.getByTestId("library-tile-lobby")).toBeInTheDocument();
    expect(screen.getByTestId("library-tile-bathroom")).toBeInTheDocument();
    expect(screen.getByText("Empty Room")).toBeInTheDocument();
    // ...and de-curated ones are not offered.
    expect(screen.queryByTestId("library-tile-hot_desk")).toBeNull();
    expect(screen.queryByTestId("library-tile-toilet")).toBeNull();
  });

  it("selecting a tile calls onSelect with its type", () => {
    const onSelect = vi.fn();
    render(<LayoutObjectLibrary selectedType="" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("library-tile-standing_desk"));
    expect(onSelect).toHaveBeenCalledWith("standing_desk");
  });

  it("marks the selected tile as pressed", () => {
    render(<LayoutObjectLibrary selectedType="desk" onSelect={vi.fn()} />);
    expect(screen.getByTestId("library-tile-desk")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("library-tile-table")).toHaveAttribute("aria-pressed", "false");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvailabilityMapLegend } from "../components/AvailabilityMapLegend";

describe("AvailabilityMapLegend", () => {
  it("renders all four status labels", () => {
    render(<AvailabilityMapLegend />);
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.getByText("Your booking")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("has an accessible label on the legend list", () => {
    render(<AvailabilityMapLegend />);
    expect(screen.getByRole("list", { name: /map legend/i })).toBeInTheDocument();
  });

  it("renders four list items", () => {
    render(<AvailabilityMapLegend />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders a legend item for each availability status", () => {
    render(<AvailabilityMapLegend />);
    expect(screen.getByTestId("legend-item-available")).toBeInTheDocument();
    expect(screen.getByTestId("legend-item-reserved")).toBeInTheDocument();
    expect(screen.getByTestId("legend-item-bookedByMe")).toBeInTheDocument();
    expect(screen.getByTestId("legend-item-unavailable")).toBeInTheDocument();
  });

  it("renders the legend items in availability order", () => {
    render(<AvailabilityMapLegend />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((el) => el.getAttribute("data-testid"))).toEqual([
      "legend-item-available",
      "legend-item-reserved",
      "legend-item-bookedByMe",
      "legend-item-unavailable",
    ]);
  });

  it("wraps the legend container so labels do not overflow (TD-034)", () => {
    render(<AvailabilityMapLegend />);
    // The legend wrapper opts into flex-wrap so every status label stays
    // visible on narrow viewports instead of clipping.
    const list = screen.getByRole("list", { name: /map legend/i });
    expect(list).toHaveStyle({ flexWrap: "wrap" });
  });
});

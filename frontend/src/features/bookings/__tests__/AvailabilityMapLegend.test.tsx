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
});

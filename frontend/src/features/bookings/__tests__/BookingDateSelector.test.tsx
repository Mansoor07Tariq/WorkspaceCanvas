import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingDateSelector } from "../components/BookingDateSelector";

describe("BookingDateSelector", () => {
  it("renders the booking date input", () => {
    render(<BookingDateSelector value="2026-06-01" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Booking Date")).toBeInTheDocument();
  });

  it("calls onChange when the date changes", () => {
    const handleChange = vi.fn();
    render(<BookingDateSelector value="2026-06-01" onChange={handleChange} />);
    const input = screen.getByLabelText("Booking Date");
    fireEvent.change(input, { target: { value: "2026-06-10" } });
    expect(handleChange).toHaveBeenCalledWith("2026-06-10");
  });

  it("shows error helper text when error prop is provided", () => {
    render(<BookingDateSelector value="2026-06-01" onChange={vi.fn()} error="Invalid date" />);
    expect(screen.getByText("Invalid date")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<BookingDateSelector value="2026-06-01" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Booking Date")).toBeDisabled();
  });
});

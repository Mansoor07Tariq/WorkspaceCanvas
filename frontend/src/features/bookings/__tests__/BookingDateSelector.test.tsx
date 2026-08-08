import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingDateSelector } from "../components/BookingDateSelector";
import { todayLocalDate, tomorrowLocalDate } from "../utils/bookingValidation";

describe("BookingDateSelector", () => {
  it("renders the booking date input", () => {
    render(<BookingDateSelector value="2026-06-01" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Booking date")).toBeInTheDocument();
  });

  it("calls onChange when the date changes", () => {
    const handleChange = vi.fn();
    render(<BookingDateSelector value="2026-06-01" onChange={handleChange} />);
    const input = screen.getByLabelText("Booking date");
    fireEvent.change(input, { target: { value: "2026-06-10" } });
    expect(handleChange).toHaveBeenCalledWith("2026-06-10");
  });

  it("shows error helper text when error prop is provided", () => {
    render(<BookingDateSelector value="2026-06-01" onChange={vi.fn()} error="Invalid date" />);
    expect(screen.getByText("Invalid date")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<BookingDateSelector value="2026-06-01" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Booking date")).toBeDisabled();
  });

  it("Today chip sets the date to today (PR 071)", () => {
    const onChange = vi.fn();
    render(<BookingDateSelector value="2026-06-01" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("date-chip-today"));
    expect(onChange).toHaveBeenCalledWith(todayLocalDate());
  });

  it("Tomorrow chip sets the date to tomorrow (PR 071)", () => {
    const onChange = vi.fn();
    render(<BookingDateSelector value="2026-06-01" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("date-chip-tomorrow"));
    expect(onChange).toHaveBeenCalledWith(tomorrowLocalDate());
  });

  it("applies min/max to the native input", () => {
    render(
      <BookingDateSelector
        value={todayLocalDate()}
        onChange={vi.fn()}
        minDate="2026-01-01"
        maxDate="2027-01-01"
      />
    );
    const input = screen.getByLabelText("Booking date");
    expect(input).toHaveAttribute("min", "2026-01-01");
    expect(input).toHaveAttribute("max", "2027-01-01");
  });
});

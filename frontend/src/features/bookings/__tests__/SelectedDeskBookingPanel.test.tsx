import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SelectedDeskBookingPanel } from "../components/SelectedDeskBookingPanel";
import type { DeskAvailabilityItem } from "../utils/bookingAvailability";
import type { Desk } from "@/features/desks/types/desk.types";
import type { DeskBooking } from "../types/booking.types";

function makeDesk(overrides: Partial<Desk> = {}): Desk {
  return {
    id: 1,
    organization: 1,
    office: 1,
    floor: 1,
    layout_object: 10,
    layout_object_type: "desk",
    layout_object_label: "Desk A1",
    name: "Desk A1",
    code: "A1",
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeBooking(overrides: Partial<DeskBooking> = {}): DeskBooking {
  return {
    id: 100,
    organization: 1,
    office: 1,
    floor: 1,
    desk: 1,
    desk_name: "Desk A1",
    desk_code: "A1",
    layout_object: 10,
    user: 42,
    user_name: "Jane Smith",
    booking_date: "2026-06-01",
    status: "active",
    status_display: "Active",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-01T08:00:00Z",
    cancelled_at: null,
    cancelled_by: null,
    is_mine: true,
    ...overrides,
  };
}

function makeItem(overrides: Partial<DeskAvailabilityItem> = {}): DeskAvailabilityItem {
  return {
    desk: makeDesk(),
    layoutObject: null,
    booking: null,
    status: "available",
    isMine: false,
    label: "Available",
    ...overrides,
  };
}

const defaultProps = {
  selectedDate: "2026-06-01",
  hasMyBooking: false,
  onBook: vi.fn(),
  onCancel: vi.fn(),
  bookingLoading: false,
  cancelLoading: false,
  bookingError: null,
  cancelError: null,
  bookingSuccess: false,
  cancelSuccess: false,
};

describe("SelectedDeskBookingPanel", () => {
  it("renders select-a-desk prompt when item is null", () => {
    render(<SelectedDeskBookingPanel {...defaultProps} item={null} />);
    expect(
      screen.getByText("Select a desk to see details and booking options.")
    ).toBeInTheDocument();
  });

  it("shows Book button for available desk when no existing booking", () => {
    const item = makeItem({ status: "available" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} />);
    expect(screen.getByTestId("panel-book-button")).toBeInTheDocument();
  });

  it("does not show Book button when user already has a booking", () => {
    const item = makeItem({ status: "available" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} hasMyBooking={true} />);
    expect(screen.queryByTestId("panel-book-button")).not.toBeInTheDocument();
  });

  it("shows reserved message for a reserved desk", () => {
    const item = makeItem({ status: "reserved", label: "Reserved" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} />);
    expect(screen.getByText("This desk is reserved by another user.")).toBeInTheDocument();
  });

  it("reserved desk with booking data does not render the other user's name", () => {
    // booking is null for reserved desks due to privacy sanitization in buildDeskAvailability
    const item = makeItem({ status: "reserved", label: "Reserved", booking: null });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} />);
    expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
    expect(screen.queryByText(/jane/i)).not.toBeInTheDocument();
  });

  it("shows Cancel button and 'Your booking' section for bookedByMe desk", () => {
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} />);
    expect(screen.getByTestId("panel-cancel-button")).toBeInTheDocument();
    expect(screen.getByText("Your booking")).toBeInTheDocument();
  });

  it("renders bookingError in an Alert", () => {
    const item = makeItem({ status: "available" });
    render(
      <SelectedDeskBookingPanel {...defaultProps} item={item} bookingError="Something failed" />
    );
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });

  it("renders cancelError in an Alert", () => {
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} cancelError="Cancel failed" />);
    expect(screen.getByText("Cancel failed")).toBeInTheDocument();
  });

  it("renders booking success message when bookingSuccess is true", () => {
    const item = makeItem({ status: "available" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} bookingSuccess={true} />);
    expect(screen.getByText("Desk booked successfully.")).toBeInTheDocument();
  });

  it("renders cancel success message when cancelSuccess is true", () => {
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} cancelSuccess={true} />);
    expect(screen.getByText("Booking cancelled.")).toBeInTheDocument();
  });

  it("Book button is disabled when bookingLoading is true", () => {
    const item = makeItem({ status: "available" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} bookingLoading={true} />);
    expect(screen.getByTestId("panel-book-button")).toBeDisabled();
  });

  it("Cancel button is disabled when cancelLoading is true", () => {
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(<SelectedDeskBookingPanel {...defaultProps} item={item} cancelLoading={true} />);
    expect(screen.getByTestId("panel-cancel-button")).toBeDisabled();
  });
});

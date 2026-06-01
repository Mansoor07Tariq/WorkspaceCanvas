import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeskAvailabilityCard } from "../components/DeskAvailabilityCard";
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
    user_name: "Jane",
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

describe("DeskAvailabilityCard", () => {
  it("renders the desk name", () => {
    const item = makeItem();
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={true}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByText("Desk A1")).toBeInTheDocument();
  });

  it("shows Book button for available desk when canBook is true", () => {
    const item = makeItem({ status: "available" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={true}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByText("Book")).toBeInTheDocument();
  });

  it("does not show Book button when canBook is false", () => {
    const item = makeItem({ status: "available" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.queryByText("Book")).not.toBeInTheDocument();
  });

  it("shows Cancel booking button for bookedByMe desk", () => {
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByText("Cancel booking")).toBeInTheDocument();
  });

  it("does not show any action button for reserved desk", () => {
    const booking = makeBooking({ is_mine: false });
    const item = makeItem({ status: "reserved", isMine: false, booking, label: "Reserved" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.queryByText("Book")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel booking")).not.toBeInTheDocument();
  });

  it("calls onBook with desk id when Book button is clicked", () => {
    const handleBook = vi.fn();
    const item = makeItem({ status: "available" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={handleBook}
        onCancel={vi.fn()}
        canBook={true}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    fireEvent.click(screen.getByText("Book"));
    expect(handleBook).toHaveBeenCalledWith(1);
  });

  it("calls onCancel with booking id when Cancel button is clicked", () => {
    const handleCancel = vi.fn();
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={handleCancel}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    fireEvent.click(screen.getByText("Cancel booking"));
    expect(handleCancel).toHaveBeenCalledWith(100);
  });

  it("clicking the card calls onSelect with the desk id", () => {
    const handleSelect = vi.fn();
    const item = makeItem();
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={handleSelect}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    fireEvent.click(screen.getByText("Desk A1"));
    expect(handleSelect).toHaveBeenCalledWith(1);
  });

  it("selected card has aria-pressed true", () => {
    const item = makeItem();
    render(
      <DeskAvailabilityCard
        item={item}
        selected={true}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByRole("button", { name: /Select desk Desk A1/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("unselected card has aria-pressed false", () => {
    const item = makeItem();
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByRole("button", { name: /Select desk Desk A1/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("Book button has accessible name containing desk name", () => {
    const item = makeItem({ status: "available" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={true}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByRole("button", { name: /Book desk Desk A1/i })).toBeInTheDocument();
  });

  it("Cancel button has accessible name containing desk name", () => {
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /Cancel booking for desk Desk A1/i })
    ).toBeInTheDocument();
  });

  it("Book button is disabled when bookingLoading prop is true", () => {
    const item = makeItem({ status: "available" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={true}
        bookingLoading={true}
        cancelLoading={false}
      />
    );
    expect(screen.getByRole("button", { name: /Book desk Desk A1/i })).toBeDisabled();
  });

  it("Cancel button is disabled when cancelLoading prop is true", () => {
    const booking = makeBooking({ id: 100, is_mine: true });
    const item = makeItem({ status: "bookedByMe", isMine: true, booking, label: "Your booking" });
    render(
      <DeskAvailabilityCard
        item={item}
        selected={false}
        onSelect={vi.fn()}
        onBook={vi.fn()}
        onCancel={vi.fn()}
        canBook={false}
        bookingLoading={false}
        cancelLoading={true}
      />
    );
    expect(screen.getByRole("button", { name: /Cancel booking for desk Desk A1/i })).toBeDisabled();
  });
});

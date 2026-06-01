import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingSummaryCards } from "../components/BookingSummaryCards";
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
    id: 1,
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
    booking: makeBooking(),
    status: "bookedByMe",
    isMine: true,
    label: "Your booking",
    ...overrides,
  };
}

describe("BookingSummaryCards", () => {
  it("shows the available count", () => {
    render(
      <BookingSummaryCards
        availableCount={5}
        reservedCount={2}
        unavailableCount={1}
        myBooking={null}
      />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("shows the reserved count", () => {
    render(
      <BookingSummaryCards
        availableCount={0}
        reservedCount={3}
        unavailableCount={0}
        myBooking={null}
      />
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Reserved")).toBeInTheDocument();
  });

  it("shows the unavailable count", () => {
    render(
      <BookingSummaryCards
        availableCount={0}
        reservedCount={0}
        unavailableCount={4}
        myBooking={null}
      />
    );
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("renders my booking card when myBooking is provided", () => {
    const item = makeItem();
    render(
      <BookingSummaryCards
        availableCount={1}
        reservedCount={0}
        unavailableCount={0}
        myBooking={item}
      />
    );
    expect(screen.getByText("Your booking")).toBeInTheDocument();
    expect(screen.getByText("Desk A1")).toBeInTheDocument();
  });

  it("does not render my booking card when myBooking is null", () => {
    render(
      <BookingSummaryCards
        availableCount={1}
        reservedCount={0}
        unavailableCount={0}
        myBooking={null}
      />
    );
    expect(screen.queryByText("Your booking")).not.toBeInTheDocument();
  });
});

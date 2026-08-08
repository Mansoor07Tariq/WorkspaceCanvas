import { describe, it, expect } from "vitest";
import { groupMyBookings } from "../utils/groupMyBookings";
import type { DeskBooking } from "../types/booking.types";

function booking(over: Partial<DeskBooking> = {}): DeskBooking {
  return {
    id: 1,
    organization: 1,
    office: 2,
    floor: 3,
    desk: 4,
    desk_name: "Desk A1",
    desk_code: "A1",
    layout_object: 10,
    user: 5,
    user_name: "Alice",
    booking_date: "2026-08-10",
    status: "active",
    status_display: "Active",
    created_at: "",
    updated_at: "",
    cancelled_at: null,
    is_mine: true,
    ...over,
  };
}

const TODAY = "2026-08-07";

describe("groupMyBookings", () => {
  it("splits into upcoming (>= today), past (< today), and cancelled", () => {
    const bookings = [
      booking({ id: 1, booking_date: "2026-08-10" }), // upcoming
      booking({ id: 2, booking_date: "2026-08-07" }), // today → upcoming
      booking({ id: 3, booking_date: "2026-08-01" }), // past
      booking({ id: 4, booking_date: "2026-08-20", status: "cancelled" }), // cancelled (future date, still cancelled)
      booking({ id: 5, booking_date: "2026-07-01", status: "cancelled" }), // cancelled
    ];
    const { upcoming, past, cancelled } = groupMyBookings(bookings, TODAY);
    // Membership (order-agnostic here; sorting is asserted separately).
    expect([...upcoming.map((b) => b.id)].sort()).toEqual([1, 2]);
    expect(past.map((b) => b.id)).toEqual([3]);
    expect([...cancelled.map((b) => b.id)].sort()).toEqual([4, 5]);
  });

  it("sorts upcoming soonest-first and past/cancelled most-recent-first", () => {
    const bookings = [
      booking({ id: 1, booking_date: "2026-08-15" }),
      booking({ id: 2, booking_date: "2026-08-09" }),
      booking({ id: 3, booking_date: "2026-08-05" }), // past
      booking({ id: 4, booking_date: "2026-08-01" }), // past
      booking({ id: 5, booking_date: "2026-06-01", status: "cancelled" }),
      booking({ id: 6, booking_date: "2026-07-01", status: "cancelled" }),
    ];
    const { upcoming, past, cancelled } = groupMyBookings(bookings, TODAY);
    expect(upcoming.map((b) => b.booking_date)).toEqual(["2026-08-09", "2026-08-15"]); // asc
    expect(past.map((b) => b.booking_date)).toEqual(["2026-08-05", "2026-08-01"]); // desc
    expect(cancelled.map((b) => b.booking_date)).toEqual(["2026-07-01", "2026-06-01"]); // desc
  });

  it("returns empty groups for no bookings", () => {
    expect(groupMyBookings([], TODAY)).toEqual({ upcoming: [], past: [], cancelled: [] });
  });

  it("classifies a cancelled booking as cancelled regardless of its date", () => {
    const { upcoming, cancelled } = groupMyBookings(
      [booking({ id: 1, booking_date: "2099-01-01", status: "cancelled" })],
      TODAY
    );
    expect(upcoming).toHaveLength(0);
    expect(cancelled.map((b) => b.id)).toEqual([1]);
  });
});

import type { DeskBooking } from "../types/booking.types";

/** The three my-bookings views. */
export type MyBookingsTab = "upcoming" | "past" | "cancelled";

export interface GroupedMyBookings {
  /** Active bookings from today onward, soonest first. */
  upcoming: DeskBooking[];
  /** Active bookings before today (completed stays), most recent first. */
  past: DeskBooking[];
  /** Cancelled bookings (any date), most recent first. */
  cancelled: DeskBooking[];
}

/**
 * Split the caller's bookings into Upcoming / Past / Cancelled and sort each
 * (PR 070). Pure + deterministic — no framework, no clock: `today` is passed in as
 * a `YYYY-MM-DD` string so comparisons are plain lexicographic string compares
 * (the wire format sorts correctly as text). A booking is "past" only when it is
 * still active but its date has passed (there is no completed/expired status on the
 * backend, so past active bookings simply remain `active`).
 */
export function groupMyBookings(bookings: DeskBooking[], today: string): GroupedMyBookings {
  const upcoming: DeskBooking[] = [];
  const past: DeskBooking[] = [];
  const cancelled: DeskBooking[] = [];

  for (const b of bookings) {
    if (b.status === "cancelled") cancelled.push(b);
    else if (b.booking_date >= today) upcoming.push(b);
    else past.push(b);
  }

  upcoming.sort((a, b) => a.booking_date.localeCompare(b.booking_date)); // soonest first
  past.sort((a, b) => b.booking_date.localeCompare(a.booking_date)); // most recent first
  cancelled.sort((a, b) => b.booking_date.localeCompare(a.booking_date));

  return { upcoming, past, cancelled };
}

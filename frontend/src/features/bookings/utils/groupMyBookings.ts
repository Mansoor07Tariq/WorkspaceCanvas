import type { DeskBooking } from "../types/booking.types";

/** The three my-bookings views. */
export type MyBookingsTab = "upcoming" | "past" | "cancelled";

/** Minimum shape `groupMyBookings` needs; both DeskBooking and RoomBooking satisfy it. */
export interface GroupableBooking {
  booking_date: string;
  status: string;
  /** Present on merged My-Bookings entries (PR 075); absent on plain desk bookings. */
  resource_type?: "desk" | "room";
  /** UTC start instant for room bookings; used only as a same-day tie-break. */
  start_at?: string;
}

export interface GroupedMyBookings {
  /** Active bookings from today onward, soonest first. */
  upcoming: DeskBooking[];
  /** Active bookings before today (completed stays), most recent first. */
  past: DeskBooking[];
  /** Cancelled bookings (any date), most recent first. */
  cancelled: DeskBooking[];
}

export interface Grouped<T> {
  upcoming: T[];
  past: T[];
  cancelled: T[];
}

// Desks are all-day → sort before rooms on the same date; rooms then order by start.
function withinDayRank(b: GroupableBooking): number {
  return b.resource_type === "room" ? 1 : 0;
}

/**
 * Ordering rule (PR 075):
 *   1. Primary: booking_date — ascending for Upcoming, descending for Past/Cancelled.
 *   2. Same-date tie-break (NOT flipped by the date direction): all-day desks sort
 *      before rooms; multiple rooms sort by their UTC start instant ascending; desks
 *      keep insertion order among themselves (stable sort).
 * For a desk-only list (no `resource_type`/`start_at`) this reduces to the original
 * date-only ordering, so existing behaviour is unchanged.
 */
function compareWithinGroup(a: GroupableBooking, b: GroupableBooking, dateDir: 1 | -1): number {
  const d = a.booking_date.localeCompare(b.booking_date) * dateDir;
  if (d !== 0) return d;
  const rank = withinDayRank(a) - withinDayRank(b);
  if (rank !== 0) return rank;
  return (a.start_at ?? "").localeCompare(b.start_at ?? "");
}

/**
 * Split the caller's bookings into Upcoming / Past / Cancelled and sort each
 * (PR 070; extended for rooms in PR 075). Pure + deterministic — no framework, no
 * clock: `today` is passed in as a `YYYY-MM-DD` string so date comparisons are plain
 * lexicographic string compares. A booking is "past" only when it is still active but
 * its date has passed (there is no completed/expired status on the backend).
 */
export function groupMyBookings<T extends GroupableBooking>(
  bookings: T[],
  today: string
): Grouped<T> {
  const upcoming: T[] = [];
  const past: T[] = [];
  const cancelled: T[] = [];

  for (const b of bookings) {
    if (b.status === "cancelled") cancelled.push(b);
    else if (b.booking_date >= today) upcoming.push(b);
    else past.push(b);
  }

  upcoming.sort((a, b) => compareWithinGroup(a, b, 1));
  past.sort((a, b) => compareWithinGroup(a, b, -1));
  cancelled.sort((a, b) => compareWithinGroup(a, b, -1));

  return { upcoming, past, cancelled };
}

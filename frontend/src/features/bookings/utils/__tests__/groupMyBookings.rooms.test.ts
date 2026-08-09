import { describe, it, expect } from "vitest";
import { groupMyBookings, type GroupableBooking } from "../groupMyBookings";

// PR 075 ordering rule: within a day, all-day desks sort before rooms, and rooms
// order by their UTC start instant ascending (date direction does not flip the
// within-day tie-break).

interface Entry extends GroupableBooking {
  id: number;
}

function entry(o: Partial<Entry> & Pick<Entry, "id" | "booking_date">): Entry {
  return { status: "active", ...o };
}

const TODAY = "2026-06-15";

describe("groupMyBookings — desks + rooms ordering", () => {
  it("within a day: desks first, then rooms by start time (Upcoming)", () => {
    const { upcoming } = groupMyBookings(
      [
        entry({
          id: 1,
          booking_date: TODAY,
          resource_type: "room",
          start_at: "2026-06-15T14:00:00Z",
        }),
        entry({ id: 2, booking_date: TODAY, resource_type: "desk" }),
        entry({
          id: 3,
          booking_date: TODAY,
          resource_type: "room",
          start_at: "2026-06-15T09:00:00Z",
        }),
      ],
      TODAY
    );
    expect(upcoming.map((e) => e.id)).toEqual([2, 3, 1]);
  });

  it("orders by date first (ascending in Upcoming), tie-break within a day", () => {
    const { upcoming } = groupMyBookings(
      [
        entry({
          id: 1,
          booking_date: "2026-06-17",
          resource_type: "room",
          start_at: "2026-06-17T09:00:00Z",
        }),
        entry({ id: 2, booking_date: "2026-06-16", resource_type: "desk" }),
        entry({
          id: 3,
          booking_date: "2026-06-16",
          resource_type: "room",
          start_at: "2026-06-16T08:00:00Z",
        }),
      ],
      TODAY
    );
    // 06-16 (desk, then room) before 06-17 (room).
    expect(upcoming.map((e) => e.id)).toEqual([2, 3, 1]);
  });

  it("Past is date-descending but keeps the same within-day tie-break", () => {
    const { past } = groupMyBookings(
      [
        entry({
          id: 1,
          booking_date: "2020-01-01",
          resource_type: "room",
          start_at: "2020-01-01T14:00:00Z",
        }),
        entry({ id: 2, booking_date: "2020-01-02", resource_type: "desk" }),
        entry({ id: 3, booking_date: "2020-01-01", resource_type: "desk" }),
      ],
      TODAY
    );
    // 01-02 first (most recent), then 01-01 (desk before room).
    expect(past.map((e) => e.id)).toEqual([2, 3, 1]);
  });

  it("splits a mix of desks and rooms into the right groups", () => {
    const groups = groupMyBookings(
      [
        entry({
          id: 1,
          booking_date: "2099-01-01",
          resource_type: "room",
          start_at: "2099-01-01T09:00:00Z",
        }),
        entry({ id: 2, booking_date: "2000-01-01", resource_type: "desk" }),
        entry({
          id: 3,
          booking_date: "2099-02-02",
          resource_type: "room",
          status: "cancelled",
          start_at: "2099-02-02T09:00:00Z",
        }),
      ],
      TODAY
    );
    expect(groups.upcoming.map((e) => e.id)).toEqual([1]);
    expect(groups.past.map((e) => e.id)).toEqual([2]);
    expect(groups.cancelled.map((e) => e.id)).toEqual([3]);
  });
});

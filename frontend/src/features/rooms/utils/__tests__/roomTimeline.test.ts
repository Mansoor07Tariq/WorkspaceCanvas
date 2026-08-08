import { describe, it, expect } from "vitest";
import type { RoomBooking } from "../../types/room.types";
import {
  buildTimelineSegments,
  durationOptionsFor,
  endTimeLabel,
  formatDuration,
  hourTicks,
  officeMinutesOfInstant,
  officeTimeLabel,
  slotConflicts,
  startTimeOptions,
  timeLabelToMinutes,
} from "../roomTimeline";

function booking(overrides: Partial<RoomBooking>): RoomBooking {
  return {
    id: 1,
    organization: 1,
    office: 1,
    floor: 1,
    room: 1,
    room_name: "Room A",
    room_capacity: 6,
    layout_object: 1,
    user_name: "Reserved",
    is_mine: false,
    booking_date: "2026-06-15",
    start_at: "2026-06-15T09:00:00Z",
    end_at: "2026-06-15T10:00:00Z",
    status: "active",
    status_display: "Active",
    cancelled_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const UNITS = { hour: "h", minute: "min" };

describe("timezone conversion", () => {
  it("converts a UTC instant to office-local minutes (UTC)", () => {
    expect(officeMinutesOfInstant("2026-06-15T09:30:00Z", "UTC")).toBe(570);
    expect(officeTimeLabel("2026-06-15T09:30:00Z", "UTC")).toBe("09:30");
  });

  it("converts a UTC instant to office-local minutes (America/Los_Angeles, PDT)", () => {
    // 17:00Z is 10:00 PDT (UTC-7).
    expect(officeMinutesOfInstant("2026-06-15T17:00:00Z", "America/Los_Angeles")).toBe(600);
    expect(officeTimeLabel("2026-06-15T17:00:00Z", "America/Los_Angeles")).toBe("10:00");
  });

  it("falls back to UTC on an invalid timezone rather than throwing", () => {
    expect(officeMinutesOfInstant("2026-06-15T09:00:00Z", "Not/AZone")).toBe(540);
  });
});

describe("buildTimelineSegments", () => {
  it("positions, labels, and sorts active bookings in office-local time", () => {
    const segments = buildTimelineSegments(
      [
        booking({
          id: 2,
          start_at: "2026-06-15T14:00:00Z",
          end_at: "2026-06-15T15:00:00Z",
          is_mine: true,
        }),
        booking({ id: 1, start_at: "2026-06-15T09:00:00Z", end_at: "2026-06-15T10:00:00Z" }),
      ],
      "UTC"
    );
    expect(segments.map((s) => s.bookingId)).toEqual([1, 2]); // sorted by start
    expect(segments[0]).toMatchObject({
      status: "reserved",
      startLabel: "09:00",
      endLabel: "10:00",
    });
    // window 06:00–22:00 (960 min span); 09:00 → left (540-360)/960 = 18.75%
    expect(segments[0].leftPct).toBeCloseTo(18.75, 5);
    expect(segments[0].widthPct).toBeCloseTo(6.25, 5); // 60/960
    expect(segments[1].status).toBe("mine");
  });

  it("clips a booking that starts before the window and drops fully-outside ones", () => {
    const [seg, ...rest] = buildTimelineSegments(
      [booking({ start_at: "2026-06-15T05:00:00Z", end_at: "2026-06-15T07:00:00Z" })],
      "UTC"
    );
    expect(seg.startMin).toBe(360); // clipped to 06:00
    expect(seg.leftPct).toBe(0);
    expect(rest).toHaveLength(0);

    const none = buildTimelineSegments(
      [booking({ start_at: "2026-06-15T02:00:00Z", end_at: "2026-06-15T03:00:00Z" })],
      "UTC"
    );
    expect(none).toHaveLength(0); // before 06:00 entirely
  });

  it("ignores cancelled bookings", () => {
    expect(buildTimelineSegments([booking({ status: "cancelled" })], "UTC")).toHaveLength(0);
  });
});

describe("slotConflicts", () => {
  const bookings = [booking({ start_at: "2026-06-15T09:00:00Z", end_at: "2026-06-15T10:00:00Z" })];

  it("flags an overlapping slot", () => {
    expect(slotConflicts(bookings, "UTC", 570, 585)).toBe(true); // 09:30–09:45
  });

  it("allows a back-to-back slot (half-open)", () => {
    expect(slotConflicts(bookings, "UTC", 600, 630)).toBe(false); // 10:00–10:30
    expect(slotConflicts(bookings, "UTC", 480, 540)).toBe(false); // 08:00–09:00
  });

  it("ignores cancelled bookings", () => {
    expect(slotConflicts([booking({ status: "cancelled" })], "UTC", 540, 600)).toBe(false);
  });
});

describe("slot option helpers", () => {
  it("startTimeOptions spans the window leaving room for a min-duration slot", () => {
    const opts = startTimeOptions();
    expect(opts[0]).toBe("06:00");
    expect(opts[opts.length - 1]).toBe("21:45"); // 22:00 - 15min
  });

  it("durationOptionsFor caps at the window end", () => {
    expect(durationOptionsFor(timeLabelToMinutes("06:00"))).toContain(480);
    const late = durationOptionsFor(timeLabelToMinutes("21:45"));
    expect(late).toEqual([15]); // only 15 min fits before 22:00
  });

  it("formatDuration renders hours and minutes with injected units", () => {
    expect(formatDuration(15, UNITS)).toBe("15 min");
    expect(formatDuration(60, UNITS)).toBe("1 h");
    expect(formatDuration(90, UNITS)).toBe("1 h 30 min");
    expect(formatDuration(480, UNITS)).toBe("8 h");
  });

  it("endTimeLabel adds a duration to a start", () => {
    expect(endTimeLabel("10:00", 90)).toBe("11:30");
  });

  it("hourTicks covers the window inclusive", () => {
    const ticks = hourTicks();
    expect(ticks[0]).toBe("06:00");
    expect(ticks[ticks.length - 1]).toBe("22:00");
    expect(ticks).toHaveLength(17);
  });
});

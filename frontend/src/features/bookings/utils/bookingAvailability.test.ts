import { describe, it, expect } from "vitest";
import {
  buildDeskAvailability,
  getMyBookingForDate,
  countAvailability,
  canBookDesk,
} from "./bookingAvailability";
import type { Desk } from "@/features/desks/types/desk.types";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
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

function makeLayoutObject(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 10,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "Desk A1",
    x: "100",
    y: "100",
    width: "80",
    height: "60",
    rotation: "0",
    is_bookable: true,
    metadata: {},
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
    is_mine: false,
    ...overrides,
  };
}

describe("buildDeskAvailability", () => {
  it("returns available status for an active desk with no booking", () => {
    const desk = makeDesk();
    const lo = makeLayoutObject();
    const items = buildDeskAvailability({ desks: [desk], bookings: [], layoutObjects: [lo] });
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("available");
    expect(items[0].label).toBe("Available");
    expect(items[0].booking).toBeNull();
    expect(items[0].isMine).toBe(false);
  });

  it("returns reserved status for a desk booked by someone else", () => {
    const desk = makeDesk();
    const lo = makeLayoutObject();
    const booking = makeBooking({ is_mine: false });
    const items = buildDeskAvailability({
      desks: [desk],
      bookings: [booking],
      layoutObjects: [lo],
    });
    expect(items[0].status).toBe("reserved");
    expect(items[0].label).toBe("Reserved");
    expect(items[0].isMine).toBe(false);
  });

  it("returns bookedByMe status for the current user's booking", () => {
    const desk = makeDesk();
    const lo = makeLayoutObject();
    const booking = makeBooking({ is_mine: true });
    const items = buildDeskAvailability({
      desks: [desk],
      bookings: [booking],
      layoutObjects: [lo],
    });
    expect(items[0].status).toBe("bookedByMe");
    expect(items[0].label).toBe("Your booking");
    expect(items[0].isMine).toBe(true);
  });

  it("returns unavailable for an inactive desk", () => {
    const desk = makeDesk({ is_active: false });
    const items = buildDeskAvailability({ desks: [desk], bookings: [], layoutObjects: [] });
    expect(items[0].status).toBe("unavailable");
  });

  it("returns unavailable for a desk in maintenance", () => {
    const desk = makeDesk({ status: "maintenance" });
    const items = buildDeskAvailability({ desks: [desk], bookings: [], layoutObjects: [] });
    expect(items[0].status).toBe("unavailable");
  });

  it("returns null layoutObject when no matching layout object found", () => {
    const desk = makeDesk({ layout_object: 999 });
    const items = buildDeskAvailability({ desks: [desk], bookings: [], layoutObjects: [] });
    expect(items[0].layoutObject).toBeNull();
  });

  it("ignores cancelled bookings when computing status", () => {
    const desk = makeDesk();
    const booking = makeBooking({ status: "cancelled", is_mine: false });
    const items = buildDeskAvailability({ desks: [desk], bookings: [booking], layoutObjects: [] });
    expect(items[0].status).toBe("available");
  });
});

describe("getMyBookingForDate", () => {
  it("returns the first active booking where is_mine is true", () => {
    const b1 = makeBooking({ id: 1, is_mine: false });
    const b2 = makeBooking({ id: 2, is_mine: true });
    expect(getMyBookingForDate([b1, b2])).toBe(b2);
  });

  it("returns null when no active booking is mine", () => {
    const b = makeBooking({ is_mine: false });
    expect(getMyBookingForDate([b])).toBeNull();
  });

  it("returns null for empty bookings array", () => {
    expect(getMyBookingForDate([])).toBeNull();
  });
});

describe("countAvailability", () => {
  it("correctly counts each status type", () => {
    const desk1 = makeDesk({ id: 1 });
    const desk2 = makeDesk({ id: 2 });
    const desk3 = makeDesk({ id: 3 });
    const desk4 = makeDesk({ id: 4, is_active: false });
    const booking2 = makeBooking({ desk: 2, is_mine: false });
    const booking3 = makeBooking({ desk: 3, is_mine: true });
    const items = buildDeskAvailability({
      desks: [desk1, desk2, desk3, desk4],
      bookings: [booking2, booking3],
      layoutObjects: [],
    });
    const counts = countAvailability(items);
    expect(counts.available).toBe(1);
    expect(counts.reserved).toBe(1);
    expect(counts.bookedByMe).toBe(1);
    expect(counts.unavailable).toBe(1);
    expect(counts.myBooking).not.toBeNull();
    expect(counts.myBooking?.desk.id).toBe(3);
  });
});

describe("canBookDesk", () => {
  it("returns true for an available desk when no existing booking", () => {
    const desk = makeDesk();
    const items = buildDeskAvailability({ desks: [desk], bookings: [], layoutObjects: [] });
    expect(canBookDesk(items[0], false)).toBe(true);
  });

  it("returns false when the user already has a booking", () => {
    const desk = makeDesk();
    const items = buildDeskAvailability({ desks: [desk], bookings: [], layoutObjects: [] });
    expect(canBookDesk(items[0], true)).toBe(false);
  });

  it("returns false for a reserved desk", () => {
    const desk = makeDesk();
    const booking = makeBooking({ is_mine: false });
    const items = buildDeskAvailability({ desks: [desk], bookings: [booking], layoutObjects: [] });
    expect(canBookDesk(items[0], false)).toBe(false);
  });

  it("returns false for an unavailable desk", () => {
    const desk = makeDesk({ is_active: false });
    const items = buildDeskAvailability({ desks: [desk], bookings: [], layoutObjects: [] });
    expect(canBookDesk(items[0], false)).toBe(false);
  });
});

describe("privacy — reserved booking sanitization", () => {
  it("reserved desk: item.booking is null even when input booking has user identity data", () => {
    const desk = makeDesk();
    const booking = makeBooking({ user: 42, user_name: "Jane Smith", is_mine: false });
    const items = buildDeskAvailability({ desks: [desk], bookings: [booking], layoutObjects: [] });
    expect(items[0].status).toBe("reserved");
    expect(items[0].booking).toBeNull();
  });

  it("reserved desk: item object does not expose the other user's name", () => {
    const desk = makeDesk();
    const booking = makeBooking({ user: 42, user_name: "Jane Smith", is_mine: false });
    const items = buildDeskAvailability({ desks: [desk], bookings: [booking], layoutObjects: [] });
    expect(JSON.stringify(items[0])).not.toContain("Jane Smith");
  });

  it("bookedByMe desk: item.booking is defined and contains the correct booking id", () => {
    const desk = makeDesk();
    const booking = makeBooking({ id: 77, is_mine: true });
    const items = buildDeskAvailability({ desks: [desk], bookings: [booking], layoutObjects: [] });
    expect(items[0].status).toBe("bookedByMe");
    expect(items[0].booking).not.toBeNull();
    expect(items[0].booking?.id).toBe(77);
  });
});

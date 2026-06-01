import { describe, it, expect } from "vitest";
import {
  getSetupChecklist,
  getTodayBooking,
  getNextBooking,
  getSetupProgress,
} from "../utils/dashboardState";
import type { CurrentUser } from "@/features/auth/types/auth.types";
import type { DeskBooking } from "@/features/bookings/types/booking.types";
import type { Office } from "@/features/offices/types/office.types";
import type { Floor } from "@/features/floors/types/floor.types";
import type { Desk } from "@/features/desks/types/desk.types";

const mockUser: CurrentUser = {
  id: 1,
  username: "user@example.com",
  email: "user@example.com",
  full_name: "Jane Smith",
  first_name: "Jane",
  last_name: "Smith",
  avatar: null,
  phone_number: "",
  job_title: "",
  timezone: "UTC",
  locale: "en",
  is_profile_completed: true,
  email_verified: true,
  preferred_auth_provider: "email",
  mfa_enabled: false,
  memberships: [],
};

const mockOffice: Office = {
  id: 10,
  name: "Dublin HQ",
  slug: "dublin-hq",
  address_line_1: "1 Main St",
  address_line_2: "",
  city: "Dublin",
  county_or_state: "Co. Dublin",
  country: "Ireland",
  timezone: "Europe/Dublin",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockFloor: Floor = {
  id: 20,
  office: 10,
  name: "Ground Floor",
  slug: "ground-floor",
  level_number: 0,
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockDesk: Desk = {
  id: 30,
  organization: 1,
  office: 10,
  floor: 20,
  layout_object: 5,
  layout_object_type: "desk",
  layout_object_label: "Desk A1",
  name: "Desk A1",
  code: "A1",
  status: "available",
  status_display: "Available",
  amenities: {},
  notes: "",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

function makeBooking(overrides: Partial<DeskBooking> = {}): DeskBooking {
  return {
    id: 1,
    organization: 1,
    office: 10,
    floor: 20,
    desk: 30,
    desk_name: "Desk A1",
    desk_code: "A1",
    layout_object: 5,
    user: 1,
    user_name: "Jane Smith",
    booking_date: "2026-06-01",
    status: "active",
    status_display: "Active",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-01T08:00:00Z",
    cancelled_at: null,
    is_mine: true,
    office_name: "Dublin HQ",
    floor_name: "Ground Floor",
    ...overrides,
  };
}

// ─── getSetupChecklist ────────────────────────────────────────────────────────

describe("getSetupChecklist", () => {
  it("returns 6 items", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result).toHaveLength(6);
  });

  it("profile item is completed when is_profile_completed is true", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: false,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "profile")?.completed).toBe(true);
  });

  it("profile item is not completed when is_profile_completed is false", () => {
    const result = getSetupChecklist({
      user: { ...mockUser, is_profile_completed: false },
      hasOrg: false,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "profile")?.completed).toBe(false);
  });

  it("org item is completed when hasOrg is true", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "org")?.completed).toBe(true);
  });

  it("org item is not completed when hasOrg is false", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: false,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "org")?.completed).toBe(false);
  });

  it("office item is completed when offices exist", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [mockOffice],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "office")?.completed).toBe(true);
  });

  it("office item is not completed when offices is empty", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "office")?.completed).toBe(false);
  });

  it("floor item is completed when floors exist", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [mockOffice],
      floors: [mockFloor],
      desks: [],
    });
    expect(result.find((i) => i.id === "floor")?.completed).toBe(true);
  });

  it("floor item has a to route when office exists", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [mockOffice],
      floors: [],
      desks: [],
    });
    const floorItem = result.find((i) => i.id === "floor");
    expect(floorItem?.to).toContain(String(mockOffice.id));
  });

  it("desks item is completed when desks exist", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [mockOffice],
      floors: [mockFloor],
      desks: [mockDesk],
    });
    expect(result.find((i) => i.id === "desks")?.completed).toBe(true);
  });

  it("invite item is always deferred", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "invite")?.deferred).toBe(true);
  });

  it("invite item is never completed", () => {
    const result = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "invite")?.completed).toBe(false);
  });

  it("handles null user safely", () => {
    const result = getSetupChecklist({
      user: null,
      hasOrg: false,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(result.find((i) => i.id === "profile")?.completed).toBe(false);
  });
});

// ─── getTodayBooking ──────────────────────────────────────────────────────────

describe("getTodayBooking", () => {
  const TODAY = "2026-06-01";

  it("returns booking matching today", () => {
    const booking = makeBooking({ booking_date: TODAY });
    expect(getTodayBooking([booking], TODAY)).toBe(booking);
  });

  it("returns null when no booking today", () => {
    const booking = makeBooking({ booking_date: "2026-06-02" });
    expect(getTodayBooking([booking], TODAY)).toBeNull();
  });

  it("returns null for cancelled booking today", () => {
    const booking = makeBooking({ booking_date: TODAY, status: "cancelled" });
    expect(getTodayBooking([booking], TODAY)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(getTodayBooking([], TODAY)).toBeNull();
  });

  it("returns the first active booking for today when multiple bookings", () => {
    const b1 = makeBooking({ id: 1, booking_date: TODAY });
    const b2 = makeBooking({ id: 2, booking_date: TODAY });
    const result = getTodayBooking([b1, b2], TODAY);
    expect(result?.id).toBe(1);
  });
});

// ─── getNextBooking ───────────────────────────────────────────────────────────

describe("getNextBooking", () => {
  const TODAY = "2026-06-01";

  it("returns the earliest future active booking", () => {
    const b1 = makeBooking({ id: 1, booking_date: "2026-06-05" });
    const b2 = makeBooking({ id: 2, booking_date: "2026-06-03" });
    const result = getNextBooking([b1, b2], TODAY);
    expect(result?.id).toBe(2);
  });

  it("returns null when no future bookings", () => {
    const booking = makeBooking({ booking_date: TODAY });
    expect(getNextBooking([booking], TODAY)).toBeNull();
  });

  it("excludes today's booking from next booking", () => {
    const today = makeBooking({ booking_date: TODAY });
    const future = makeBooking({ id: 2, booking_date: "2026-06-10" });
    expect(getNextBooking([today, future], TODAY)?.id).toBe(2);
  });

  it("excludes cancelled future bookings", () => {
    const cancelled = makeBooking({ booking_date: "2026-06-05", status: "cancelled" });
    expect(getNextBooking([cancelled], TODAY)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(getNextBooking([], TODAY)).toBeNull();
  });
});

// ─── getSetupProgress ────────────────────────────────────────────────────────

describe("getSetupProgress", () => {
  it("returns 0 when nothing is complete", () => {
    const checklist = getSetupChecklist({
      user: { ...mockUser, is_profile_completed: false },
      hasOrg: false,
      offices: [],
      floors: [],
      desks: [],
    });
    expect(getSetupProgress(checklist)).toBe(0);
  });

  it("returns 100 when all non-deferred items are complete", () => {
    const checklist = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [mockOffice],
      floors: [mockFloor],
      desks: [mockDesk],
    });
    expect(getSetupProgress(checklist)).toBe(100);
  });

  it("excludes deferred items from progress calculation", () => {
    const checklist = getSetupChecklist({
      user: mockUser,
      hasOrg: true,
      offices: [],
      floors: [],
      desks: [],
    });
    const nonDeferred = checklist.filter((i) => !i.deferred);
    const completed = nonDeferred.filter((i) => i.completed).length;
    const expected = Math.round((completed / nonDeferred.length) * 100);
    expect(getSetupProgress(checklist)).toBe(expected);
  });

  it("returns 0 for empty checklist", () => {
    expect(getSetupProgress([])).toBe(0);
  });
});

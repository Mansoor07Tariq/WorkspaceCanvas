import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, data: unknown) {
      super("ApiError");
      this.status = status;
      void data;
    }
  },
}));

import { api } from "@/lib/api/apiClient";
import {
  listFloorBookings,
  createDeskBooking,
  cancelDeskBooking,
  getDeskBooking,
  listMyBookings,
  cancelMyBooking,
} from "../api/bookingApi";
import { setCachedValue, getCachedValue, clearRequestCache } from "@/lib/api/requestCache";

const mockApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe("bookingApi", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── listFloorBookings ──────────────────────────────────────────────────────

  it("listFloorBookings calls GET with URL that includes ?date= and the date argument", () => {
    mockApi.get.mockResolvedValue([]);
    const date = "2026-06-01";
    listFloorBookings(1, 3, date);
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain("?date=");
    expect(calledUrl).toContain(date);
  });

  it("listFloorBookings URL contains the correct base path", () => {
    mockApi.get.mockResolvedValue([]);
    listFloorBookings(2, 5, "2026-07-15");
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain("/api/offices/2/floors/5/bookings/");
  });

  // ─── createDeskBooking ──────────────────────────────────────────────────────

  it("createDeskBooking calls POST to the base URL", () => {
    mockApi.post.mockResolvedValue({});
    const payload = { desk: 7, booking_date: "2026-06-01" };
    createDeskBooking(1, 3, payload);
    const calledUrl: string = mockApi.post.mock.calls[0][0];
    expect(calledUrl).toBe("/api/offices/1/floors/3/bookings/");
  });

  it("createDeskBooking payload has exactly {desk, booking_date}", () => {
    mockApi.post.mockResolvedValue({});
    const payload = { desk: 7, booking_date: "2026-06-01" };
    createDeskBooking(1, 3, payload);
    const sentPayload = mockApi.post.mock.calls[0][1] as Record<string, unknown>;
    expect(sentPayload).toEqual({ desk: 7, booking_date: "2026-06-01" });
  });

  // ─── cancelDeskBooking ──────────────────────────────────────────────────────

  it("cancelDeskBooking calls POST to URL ending in /{bookingId}/cancel/", () => {
    mockApi.post.mockResolvedValue({});
    cancelDeskBooking(1, 3, 42);
    const calledUrl: string = mockApi.post.mock.calls[0][0];
    expect(calledUrl).toMatch(/\/42\/cancel\/$/);
  });

  it("cancelDeskBooking URL contains the correct base path", () => {
    mockApi.post.mockResolvedValue({});
    cancelDeskBooking(1, 3, 42);
    const calledUrl: string = mockApi.post.mock.calls[0][0];
    expect(calledUrl).toContain("/api/offices/1/floors/3/bookings/42/cancel/");
  });

  // ─── getDeskBooking ─────────────────────────────────────────────────────────

  it("getDeskBooking calls GET with correct detail URL", () => {
    mockApi.get.mockResolvedValue({});
    getDeskBooking(1, 3, 42);
    expect(mockApi.get).toHaveBeenCalledWith("/api/offices/1/floors/3/bookings/42/");
  });

  // ─── error propagation ──────────────────────────────────────────────────────

  it("listFloorBookings propagates rejection from api client", async () => {
    const error = new Error("network error");
    mockApi.get.mockRejectedValue(error);
    await expect(listFloorBookings(1, 3, "2026-06-01")).rejects.toThrow("network error");
  });

  it("createDeskBooking propagates rejection from api client", async () => {
    const error = new Error("server error");
    mockApi.post.mockRejectedValue(error);
    await expect(createDeskBooking(1, 3, { desk: 7, booking_date: "2026-06-01" })).rejects.toThrow(
      "server error"
    );
  });

  it("cancelDeskBooking propagates rejection from api client", async () => {
    const error = new Error("forbidden");
    mockApi.post.mockRejectedValue(error);
    await expect(cancelDeskBooking(1, 3, 42)).rejects.toThrow("forbidden");
  });

  it("getDeskBooking propagates rejection from api client", async () => {
    const error = new Error("not found");
    mockApi.get.mockRejectedValue(error);
    await expect(getDeskBooking(1, 3, 42)).rejects.toThrow("not found");
  });

  // ─── listMyBookings ─────────────────────────────────────────────────────────

  it("listMyBookings calls GET /api/bookings/my/ with no params", () => {
    mockApi.get.mockResolvedValue([]);
    listMyBookings();
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toBe("/api/bookings/my/");
  });

  it("listMyBookings appends status param to the URL", () => {
    mockApi.get.mockResolvedValue([]);
    listMyBookings({ status: "cancelled" });
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain("status=cancelled");
  });

  it("listMyBookings appends from and to params to the URL", () => {
    mockApi.get.mockResolvedValue([]);
    listMyBookings({ from: "2026-06-01", to: "2026-06-30" });
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain("from=2026-06-01");
    expect(calledUrl).toContain("to=2026-06-30");
  });

  it("listMyBookings does not append a query string when params are all undefined", () => {
    mockApi.get.mockResolvedValue([]);
    listMyBookings({});
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toBe("/api/bookings/my/");
  });

  // ─── cancelMyBooking ────────────────────────────────────────────────────────

  it("cancelMyBooking calls POST to /api/bookings/my/{id}/cancel/", () => {
    mockApi.post.mockResolvedValue({});
    cancelMyBooking(99);
    const calledUrl: string = mockApi.post.mock.calls[0][0];
    expect(calledUrl).toBe("/api/bookings/my/99/cancel/");
  });

  it("cancelMyBooking sends an empty object as the request body", () => {
    mockApi.post.mockResolvedValue({});
    cancelMyBooking(99);
    const sentPayload = mockApi.post.mock.calls[0][1];
    expect(sentPayload).toEqual({});
  });

  // ─── TD-044: booking mutations invalidate the booking caches ─────────────────

  describe("cache invalidation", () => {
    beforeEach(() => clearRequestCache());

    function seedBookingCaches() {
      setCachedValue("deskBookings:1:3:2026-06-01", [{ id: 1 }]);
      setCachedValue("myBookings:::", [{ id: 1 }]);
      setCachedValue("desks:1:3", [{ id: 9 }]); // unrelated — must survive
    }

    it("createDeskBooking clears deskBookings and myBookings caches", async () => {
      mockApi.post.mockResolvedValue({});
      seedBookingCaches();
      await createDeskBooking(1, 3, { desk: 7, booking_date: "2026-06-01" });
      expect(getCachedValue("deskBookings:1:3:2026-06-01")).toBeUndefined();
      expect(getCachedValue("myBookings:::")).toBeUndefined();
      expect(getCachedValue("desks:1:3")).toBeDefined();
    });

    it("cancelDeskBooking clears deskBookings and myBookings caches", async () => {
      mockApi.post.mockResolvedValue({});
      seedBookingCaches();
      await cancelDeskBooking(1, 3, 42);
      expect(getCachedValue("deskBookings:1:3:2026-06-01")).toBeUndefined();
      expect(getCachedValue("myBookings:::")).toBeUndefined();
      expect(getCachedValue("desks:1:3")).toBeDefined();
    });

    it("cancelMyBooking clears deskBookings and myBookings caches", async () => {
      mockApi.post.mockResolvedValue({});
      seedBookingCaches();
      await cancelMyBooking(99);
      expect(getCachedValue("deskBookings:1:3:2026-06-01")).toBeUndefined();
      expect(getCachedValue("myBookings:::")).toBeUndefined();
      expect(getCachedValue("desks:1:3")).toBeDefined();
    });

    it("a rejected createDeskBooking does not clear the caches", async () => {
      mockApi.post.mockRejectedValue(new Error("boom"));
      seedBookingCaches();
      await expect(
        createDeskBooking(1, 3, { desk: 7, booking_date: "2026-06-01" })
      ).rejects.toThrow("boom");
      expect(getCachedValue("deskBookings:1:3:2026-06-01")).toBeDefined();
      expect(getCachedValue("myBookings:::")).toBeDefined();
    });
  });
});

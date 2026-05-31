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
} from "../api/bookingApi";

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
});

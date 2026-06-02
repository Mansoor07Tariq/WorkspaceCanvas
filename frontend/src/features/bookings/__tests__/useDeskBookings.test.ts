import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock the booking API before importing the hook
vi.mock("../api/bookingApi");
import { listFloorBookings } from "../api/bookingApi";
const mockListFloorBookings = vi.mocked(listFloorBookings);

// Provide a minimal ApiError so getApiErrorMessage works as expected
vi.mock("@/lib/api/getApiErrorMessage", () => ({
  getApiErrorMessage: (err: unknown) => {
    if (err instanceof Error) return err.message;
    return "Something went wrong. Please try again.";
  },
}));

import { useDeskBookings } from "../hooks/useDeskBookings";
import type { DeskBooking } from "../types/booking.types";

function makeBooking(overrides: Partial<DeskBooking> = {}): DeskBooking {
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
    booking_date: "2026-06-01",
    status: "active",
    status_display: "Active",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
    cancelled_at: null,
    is_mine: true,
    ...overrides,
  };
}

describe("useDeskBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state with an empty bookings array", () => {
    // Never resolves — keeps hook in loading state
    mockListFloorBookings.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));

    expect(result.current.loading).toBe(true);
    expect(result.current.bookings).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it("calls listFloorBookings with the correct officeId, floorId and date", async () => {
    mockListFloorBookings.mockResolvedValue([]);

    renderHook(() => useDeskBookings(2, 5, "2026-07-15"));

    await waitFor(() => {
      expect(mockListFloorBookings).toHaveBeenCalledWith(2, 5, "2026-07-15");
    });
  });

  it("sets bookings and clears loading on successful fetch", async () => {
    const booking = makeBooking();
    mockListFloorBookings.mockResolvedValue([booking]);

    const { result } = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.bookings).toEqual([booking]);
    expect(result.current.error).toBeUndefined();
  });

  it("does not call listFloorBookings when officeId is 0 (falsy)", () => {
    const { result } = renderHook(() => useDeskBookings(0, 2, "2026-06-01"));

    expect(mockListFloorBookings).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.bookings).toEqual([]);
  });

  it("does not call listFloorBookings when floorId is 0 (falsy)", () => {
    renderHook(() => useDeskBookings(1, 0, "2026-06-01"));

    expect(mockListFloorBookings).not.toHaveBeenCalled();
  });

  it("does not call listFloorBookings when date is an empty string", () => {
    renderHook(() => useDeskBookings(1, 2, ""));

    expect(mockListFloorBookings).not.toHaveBeenCalled();
  });

  it("sets error state and clears loading when the API rejects", async () => {
    mockListFloorBookings.mockRejectedValue(new Error("network failure"));

    const { result } = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("network failure");
    expect(result.current.bookings).toEqual([]);
  });

  it("refresh() triggers a re-fetch and returns updated data", async () => {
    const first = makeBooking({ id: 1 });
    const second = makeBooking({ id: 2 });
    mockListFloorBookings.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);

    const { result } = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bookings).toEqual([first]);

    result.current.refresh();

    await waitFor(() => expect(result.current.bookings).toEqual([second]));
    expect(mockListFloorBookings).toHaveBeenCalledTimes(2);
  });

  // ─── TD-044: caching ─────────────────────────────────────────────────────────

  it("caches the first fetch; a second mount with the same office/floor/date serves the cache without refetching", async () => {
    const booking = makeBooking();
    mockListFloorBookings.mockResolvedValue([booking]);

    const first = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(mockListFloorBookings).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));
    // Cache hit is synchronous: no loading flicker, data already present.
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.bookings).toEqual([booking]);
    expect(mockListFloorBookings).toHaveBeenCalledTimes(1);
  });

  it("does not reuse the cache for a different date", async () => {
    mockListFloorBookings.mockResolvedValue([]);

    const first = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    const second = renderHook(() => useDeskBookings(1, 2, "2026-06-02"));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(mockListFloorBookings).toHaveBeenCalledTimes(2);
    expect(mockListFloorBookings).toHaveBeenLastCalledWith(1, 2, "2026-06-02");
  });

  it("does not reuse the cache for a different floor", async () => {
    mockListFloorBookings.mockResolvedValue([]);

    const first = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    const second = renderHook(() => useDeskBookings(1, 9, "2026-06-01"));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(mockListFloorBookings).toHaveBeenCalledTimes(2);
    expect(mockListFloorBookings).toHaveBeenLastCalledWith(1, 9, "2026-06-01");
  });

  it("refresh() bypasses the cache even when a fresh entry exists", async () => {
    const first = makeBooking({ id: 1 });
    const second = makeBooking({ id: 2 });
    mockListFloorBookings.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);

    const a = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(mockListFloorBookings).toHaveBeenCalledTimes(1);

    // Second mount is a cache hit (still 1 call).
    const b = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));
    expect(mockListFloorBookings).toHaveBeenCalledTimes(1);

    // refresh forces a network fetch.
    b.result.current.refresh();
    await waitFor(() => expect(b.result.current.bookings).toEqual([second]));
    expect(mockListFloorBookings).toHaveBeenCalledTimes(2);
  });

  it("does not cache the empty result produced by a missing scope", async () => {
    mockListFloorBookings.mockResolvedValue([makeBooking()]);

    // Missing date → empty list, nothing cached.
    const empty = renderHook(() => useDeskBookings(1, 2, ""));
    expect(empty.result.current.bookings).toEqual([]);
    expect(mockListFloorBookings).not.toHaveBeenCalled();

    // A real fetch for the same office/floor still happens (no poisoned cache).
    const real = renderHook(() => useDeskBookings(1, 2, "2026-06-01"));
    await waitFor(() => expect(real.result.current.loading).toBe(false));
    expect(mockListFloorBookings).toHaveBeenCalledTimes(1);
  });
});

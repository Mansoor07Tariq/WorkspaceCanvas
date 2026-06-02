import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../api/bookingApi");
import { listMyBookings, cancelMyBooking } from "../api/bookingApi";
const mockListMyBookings = vi.mocked(listMyBookings);
const mockCancelMyBooking = vi.mocked(cancelMyBooking);

vi.mock("@/lib/api/getApiErrorMessage", () => ({
  getApiErrorMessage: (err: unknown) => {
    if (err instanceof Error) return err.message;
    return "Something went wrong. Please try again.";
  },
}));

import { useMyBookings } from "../hooks/useMyBookings";
import type { DeskBooking, MyBookingStatusFilter } from "../types/booking.types";

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

describe("useMyBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading initially then shows bookings after fetch resolves", async () => {
    const booking = makeBooking();
    mockListMyBookings.mockResolvedValue([booking]);

    const { result } = renderHook(() => useMyBookings());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.bookings).toEqual([booking]);
    expect(result.current.error).toBeUndefined();
  });

  it("shows error on fetch failure", async () => {
    mockListMyBookings.mockRejectedValue(new Error("network failure"));

    const { result } = renderHook(() => useMyBookings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("network failure");
    expect(result.current.bookings).toEqual([]);
  });

  it("returns empty bookings array when API resolves with empty list", async () => {
    mockListMyBookings.mockResolvedValue([]);

    const { result } = renderHook(() => useMyBookings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.bookings).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it("refresh() triggers a re-fetch and returns updated data", async () => {
    const first = makeBooking({ id: 1 });
    const second = makeBooking({ id: 2 });
    mockListMyBookings.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);

    const { result } = renderHook(() => useMyBookings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bookings).toEqual([first]);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.bookings).toEqual([second]));
    expect(mockListMyBookings).toHaveBeenCalledTimes(2);
  });

  it("cancelBooking calls cancelMyBooking with the correct id and refreshes", async () => {
    const booking = makeBooking({ id: 7 });
    const cancelled = makeBooking({ id: 7, status: "cancelled", status_display: "Cancelled" });
    mockListMyBookings.mockResolvedValueOnce([booking]).mockResolvedValueOnce([cancelled]);
    mockCancelMyBooking.mockResolvedValue(cancelled);

    const { result } = renderHook(() => useMyBookings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.cancelBooking(7);
    });

    expect(mockCancelMyBooking).toHaveBeenCalledWith(7);
    expect(result.current.cancelSuccess).toBe("Booking cancelled successfully.");
    await waitFor(() => expect(result.current.bookings).toEqual([cancelled]));
  });

  it("cancelBooking sets cancelError when cancel API call fails", async () => {
    const booking = makeBooking({ id: 3 });
    mockListMyBookings.mockResolvedValue([booking]);
    mockCancelMyBooking.mockRejectedValue(new Error("cancel failed"));

    const { result } = renderHook(() => useMyBookings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.cancelBooking(3);
    });

    expect(result.current.cancelError).toBe("cancel failed");
    expect(result.current.cancelSuccess).toBeUndefined();
  });

  // ─── TD-044: caching ─────────────────────────────────────────────────────────

  it("caches per param context; a second mount with the same params serves the cache", async () => {
    const booking = makeBooking();
    mockListMyBookings.mockResolvedValue([booking]);

    const first = renderHook(() => useMyBookings({ status: "active" }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(mockListMyBookings).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useMyBookings({ status: "active" }));
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.bookings).toEqual([booking]);
    expect(mockListMyBookings).toHaveBeenCalledTimes(1);
  });

  it("does not reuse the cache for a different status filter", async () => {
    mockListMyBookings.mockResolvedValue([]);

    const first = renderHook(() => useMyBookings({ status: "active" }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    const second = renderHook(() => useMyBookings({ status: "cancelled" }));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(mockListMyBookings).toHaveBeenCalledTimes(2);
  });

  it("refresh() bypasses the cache", async () => {
    const first = makeBooking({ id: 1 });
    const second = makeBooking({ id: 2 });
    mockListMyBookings.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);

    const a = renderHook(() => useMyBookings({ status: "active" }));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(mockListMyBookings).toHaveBeenCalledTimes(1);

    // Cache hit (still 1 call).
    const b = renderHook(() => useMyBookings({ status: "active" }));
    expect(mockListMyBookings).toHaveBeenCalledTimes(1);

    act(() => b.result.current.refresh());
    await waitFor(() => expect(b.result.current.bookings).toEqual([second]));
    expect(mockListMyBookings).toHaveBeenCalledTimes(2);
  });

  it("does not update state from stale request when params change (TD-020)", async () => {
    // First fetch resolves slowly; second fetch resolves immediately.
    // The stale first response should not overwrite the second's data.
    let resolveFirst!: (value: DeskBooking[]) => void;
    const slowFirst = new Promise<DeskBooking[]>((res) => {
      resolveFirst = res;
    });
    const fastSecond = [makeBooking({ id: 99 })];

    mockListMyBookings.mockReturnValueOnce(slowFirst).mockResolvedValueOnce(fastSecond);

    const { result, rerender } = renderHook(({ params }) => useMyBookings(params), {
      initialProps: { params: { status: "active" as MyBookingStatusFilter } },
    });

    // Change params — triggers second effect, which aborts/cancels the first
    rerender({ params: { status: "cancelled" as MyBookingStatusFilter } });

    // Let second fetch settle
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Now resolve the stale first request
    act(() => {
      resolveFirst([makeBooking({ id: 1 })]);
    });

    // State should reflect the second fetch, not the stale first
    expect(result.current.bookings).toEqual(fastSecond);
  });
});

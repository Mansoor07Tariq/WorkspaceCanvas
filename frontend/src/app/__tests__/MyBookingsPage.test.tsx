import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MyBookingsPage } from "../pages/MyBookingsPage";
import type { DeskBooking } from "@/features/bookings/types/booking.types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockRefresh = vi.fn();
const mockUseMyBookings = vi.fn();
vi.mock("@/features/bookings/hooks/useMyBookings", () => ({
  useMyBookings: (...args: unknown[]) => mockUseMyBookings(...args),
}));

const mockCancelMyBooking = vi.fn();
vi.mock("@/features/bookings/api/bookingApi", () => ({
  cancelMyBooking: (...args: unknown[]) => mockCancelMyBooking(...args),
}));

vi.mock("@/lib/api/getApiErrorMessage", () => ({
  getApiErrorMessage: (err: unknown) => {
    if (err instanceof Error) return err.message;
    return "Something went wrong.";
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    booking_date: "2026-06-02",
    status: "active",
    status_display: "Active",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
    cancelled_at: null,
    is_mine: true,
    office_name: "Dublin HQ",
    floor_name: "Ground Floor",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyBookingsPage />
    </MemoryRouter>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MyBookingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
  });

  it("renders the page title 'My Bookings'", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "My Bookings", level: 1 })).toBeInTheDocument();
  });

  it("shows a loading spinner while bookings are loading", () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: true,
      error: undefined,
      refresh: mockRefresh,
    });
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows empty state when there are no bookings", () => {
    renderPage();
    expect(screen.getByText("No upcoming bookings")).toBeInTheDocument();
    expect(screen.getByText("You don't have any active desk bookings.")).toBeInTheDocument();
  });

  it("shows booking cards when bookings exist", () => {
    const booking = makeBooking({ desk_name: "Desk B3" });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    renderPage();
    expect(screen.getByText("Desk B3")).toBeInTheDocument();
  });

  it("cancel button triggers cancel flow and calls cancelMyBooking", async () => {
    const booking = makeBooking({ id: 42 });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    mockCancelMyBooking.mockResolvedValue({ ...booking, status: "cancelled" });

    renderPage();

    const cancelBtn = screen.getByRole("button", {
      name: /cancel booking for desk a1/i,
    });
    fireEvent.click(cancelBtn);

    await waitFor(() => expect(mockCancelMyBooking).toHaveBeenCalledWith(42));
  });

  it("shows success message after cancel", async () => {
    const booking = makeBooking({ id: 10 });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    mockCancelMyBooking.mockResolvedValue({ ...booking, status: "cancelled" });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /cancel booking for desk a1/i }));

    await waitFor(() =>
      expect(screen.getByText("Booking cancelled successfully.")).toBeInTheDocument()
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("'Book a desk' button navigates to /app/bookings", () => {
    renderPage();
    // When bookings is empty, both the header button and EmptyState button
    // are present — click the first one (the header button).
    const buttons = screen.getAllByRole("button", { name: "Book a desk" });
    fireEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/app/bookings");
  });

  it("shows an error alert when the hook returns an error", () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: "Failed to load",
      refresh: mockRefresh,
    });
    renderPage();
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });
});

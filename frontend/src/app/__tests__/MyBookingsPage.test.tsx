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

// PR 075: My Bookings merges desk + room endpoints — the room-bookings hook and the
// room cancel api are mocked here (declared). (PR 076 dropped the offices/org
// dependency; room bookings now carry office_timezone directly.)
const mockRefreshRooms = vi.fn();
const mockUseMyRoomBookings = vi.fn();
vi.mock("@/features/rooms/hooks/useMyRoomBookings", () => ({
  useMyRoomBookings: (...args: unknown[]) => mockUseMyRoomBookings(...args),
}));

const mockCancelMyBooking = vi.fn();
vi.mock("@/features/bookings/api/bookingApi", () => ({
  cancelMyBooking: (...args: unknown[]) => mockCancelMyBooking(...args),
}));

const mockCancelRoomBooking = vi.fn();
vi.mock("@/features/rooms/api/roomApi", () => ({
  cancelRoomBooking: (...args: unknown[]) => mockCancelRoomBooking(...args),
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
    mockUseMyRoomBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      refresh: mockRefreshRooms,
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
    // PR 075: empty-state copy now covers both desks and rooms.
    expect(
      screen.getByText("You don't have any upcoming desk or room bookings.")
    ).toBeInTheDocument();
  });

  it("shows booking cards when bookings exist", () => {
    // Future-dated so it lands in the default "Upcoming" tab (PR 070).
    const booking = makeBooking({ desk_name: "Desk B3", booking_date: "2099-01-01" });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    renderPage();
    expect(screen.getByText("Desk B3")).toBeInTheDocument();
  });

  it("cancel button opens confirmation, then calls cancelMyBooking on confirm", async () => {
    const booking = makeBooking({ id: 42, booking_date: "2099-01-01" });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    mockCancelMyBooking.mockResolvedValue({ ...booking, status: "cancelled" });

    renderPage();

    // The card's cancel button opens the confirmation dialog (PR 070).
    fireEvent.click(screen.getByRole("button", { name: /cancel booking — Desk A1/i }));
    expect(mockCancelMyBooking).not.toHaveBeenCalled();
    // The dialog's confirm button (exact "Cancel booking") runs the cancel.
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));

    await waitFor(() => expect(mockCancelMyBooking).toHaveBeenCalledWith(42));
  });

  it("shows success message after confirming a cancel", async () => {
    const booking = makeBooking({ id: 10, booking_date: "2099-01-01" });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    mockCancelMyBooking.mockResolvedValue({ ...booking, status: "cancelled" });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /cancel booking — Desk A1/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));

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

  it("shows a partial-failure alert when the desk endpoint errors (PR 075)", () => {
    // The page no longer surfaces the raw hook error; it shows a resource-specific
    // partial-failure message so the loaded half still renders.
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: "Failed to load",
      refresh: mockRefresh,
    });
    renderPage();
    expect(
      screen.getByText("Couldn't load your desk bookings. Showing room bookings only.")
    ).toBeInTheDocument();
  });

  it("splits bookings across Upcoming / Past / Cancelled tabs (PR 070)", () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [
        makeBooking({ id: 1, desk_name: "Future Desk", booking_date: "2099-01-01" }),
        makeBooking({ id: 2, desk_name: "Old Desk", booking_date: "2000-01-01" }),
        makeBooking({
          id: 3,
          desk_name: "Gone Desk",
          booking_date: "2099-02-02",
          status: "cancelled",
        }),
      ],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    renderPage();

    // Default = Upcoming
    expect(screen.getByText("Future Desk")).toBeInTheDocument();
    expect(screen.queryByText("Old Desk")).not.toBeInTheDocument();
    expect(screen.queryByText("Gone Desk")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Past/ }));
    expect(screen.getByText("Old Desk")).toBeInTheDocument();
    expect(screen.queryByText("Future Desk")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Cancelled/ }));
    expect(screen.getByText("Gone Desk")).toBeInTheDocument();
    expect(screen.queryByText("Old Desk")).not.toBeInTheDocument();
  });

  it("'Book again' deep-links the picker with office/floor/desk", () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [makeBooking({ id: 7, office: 2, floor: 3, desk: 4, booking_date: "2099-01-01" })],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Book again/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/app/bookings?office=2&floor=3&desk=4");
  });

  it("shows the Past empty state on the Past tab when there are none", () => {
    mockUseMyBookings.mockReturnValue({
      bookings: [makeBooking({ booking_date: "2099-01-01" })],
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /Past/ }));
    expect(screen.getByText("No past bookings")).toBeInTheDocument();
  });
});

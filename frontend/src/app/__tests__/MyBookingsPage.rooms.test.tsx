import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MyBookingsPage } from "../pages/MyBookingsPage";
import type { DeskBooking } from "@/features/bookings/types/booking.types";
import type { RoomBooking } from "@/features/rooms/types/room.types";

// PR 075: My Bookings merges desk + room bookings. This file exercises the room side.

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

let deskBookings: DeskBooking[] = [];
let deskError: string | undefined;
let roomBookings: RoomBooking[] = [];
let roomError: string | undefined;

vi.mock("@/features/bookings/hooks/useMyBookings", () => ({
  useMyBookings: () => ({
    bookings: deskBookings,
    loading: false,
    error: deskError,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/features/rooms/hooks/useMyRoomBookings", () => ({
  useMyRoomBookings: () => ({
    bookings: roomBookings,
    loading: false,
    error: roomError,
    refresh: vi.fn(),
  }),
}));
const mockCancelMyBooking = vi.fn();
vi.mock("@/features/bookings/api/bookingApi", () => ({
  cancelMyBooking: (...a: unknown[]) => mockCancelMyBooking(...a),
}));
const mockCancelRoomBooking = vi.fn();
vi.mock("@/features/rooms/api/roomApi", () => ({
  cancelRoomBooking: (...a: unknown[]) => mockCancelRoomBooking(...a),
}));
vi.mock("@/lib/api/getApiErrorMessage", () => ({
  getApiErrorMessage: () => "Something went wrong.",
}));

function makeDesk(o: Partial<DeskBooking> = {}): DeskBooking {
  return {
    id: 1,
    organization: 1,
    office: 2,
    floor: 3,
    desk: 4,
    desk_name: "Desk A1",
    desk_code: "A1",
    layout_object: 10,
    user_name: "Me",
    booking_date: "2099-01-01",
    status: "active",
    status_display: "Active",
    created_at: "",
    updated_at: "",
    cancelled_at: null,
    is_mine: true,
    office_name: "HQ",
    floor_name: "Ground",
    ...o,
  };
}

function makeRoom(o: Partial<RoomBooking> = {}): RoomBooking {
  return {
    id: 50,
    organization: 1,
    office: 2,
    floor: 3,
    room: 9,
    room_name: "Meeting Room X",
    room_capacity: 8,
    office_timezone: "UTC",
    layout_object: 20,
    user_name: "Me",
    is_mine: true,
    booking_date: "2099-01-01",
    start_at: "2099-01-01T09:00:00Z",
    end_at: "2099-01-01T10:00:00Z",
    status: "active",
    status_display: "Active",
    cancelled_at: null,
    office_name: "HQ",
    floor_name: "Ground",
    created_at: "",
    updated_at: "",
    ...o,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyBookingsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deskBookings = [];
  deskError = undefined;
  roomBookings = [];
  roomError = undefined;
  mockCancelRoomBooking.mockResolvedValue(makeRoom({ status: "cancelled" }));
});

describe("MyBookingsPage — rooms merged", () => {
  it("renders both a desk card and a room card (with time range) in Upcoming", () => {
    deskBookings = [makeDesk({ desk_name: "Desk Z9" })];
    roomBookings = [makeRoom()];
    renderPage();
    expect(screen.getByText("Desk Z9")).toBeInTheDocument();
    expect(screen.getByText("Meeting Room X")).toBeInTheDocument();
    // Office-local time range (UTC office) 09:00–10:00.
    expect(screen.getByText(/09:00–10:00/)).toBeInTheDocument();
  });

  it("cancels a room booking via the confirm dialog (room endpoint)", async () => {
    roomBookings = [makeRoom()];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /cancel booking — Meeting Room X/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    await waitFor(() => expect(mockCancelRoomBooking).toHaveBeenCalledWith(2, 3, 50));
    expect(mockCancelMyBooking).not.toHaveBeenCalled();
  });

  it("'Book again' on a room deep-links the room page with office/floor (no date)", () => {
    roomBookings = [makeRoom()];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Book again — Meeting Room X/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/app/bookings/rooms?office=2&floor=3");
  });

  it("shows the room-endpoint partial-failure alert but still renders desk bookings", () => {
    deskBookings = [makeDesk({ desk_name: "Desk Still Here" })];
    roomError = "boom";
    renderPage();
    expect(
      screen.getByText("Couldn't load your room bookings. Showing desk bookings only.")
    ).toBeInTheDocument();
    expect(screen.getByText("Desk Still Here")).toBeInTheDocument();
  });
});

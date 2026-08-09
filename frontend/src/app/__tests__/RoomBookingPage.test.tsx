import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RoomBookingPage } from "../pages/RoomBookingPage";
import { ApiError } from "@/lib/api/apiError";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { MeetingRoom, RoomBooking } from "@/features/rooms/types/room.types";

// ─── Auth (member) ───────────────────────────────────────────────────────────

const mockUseAuth = vi.fn<() => AuthContextValue>();
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const membership: MembershipInline = {
  id: 1,
  organization_id: 10,
  organization_name: "Acme Corp",
  organization_slug: "acme",
  organization_status: "active",
  role: "member",
  status: "active",
  has_active_access: true,
};
const user: CurrentUser = {
  id: 1,
  username: "u@example.com",
  email: "u@example.com",
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
  memberships: [membership],
};
const baseAuth: AuthContextValue = {
  status: "authenticated",
  user,
  error: undefined,
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn(),
};

// ─── Selection hooks ─────────────────────────────────────────────────────────

vi.mock("@/features/offices/hooks/useOffices", () => ({
  useOffices: () => ({
    offices: [{ id: 1, name: "HQ", timezone: "" }],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/features/floors/hooks/useFloors", () => ({
  useFloors: (officeId: number) => ({
    floors: officeId === 1 ? [{ id: 10, name: "Ground" }] : [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// ─── Room hooks + api ────────────────────────────────────────────────────────

let roomsData: MeetingRoom[] = [];
let bookingsData: RoomBooking[] = [];
const refreshBookings = vi.fn();

vi.mock("@/features/rooms/hooks/useMeetingRooms", () => ({
  useMeetingRooms: () => ({ rooms: roomsData, loading: false, error: undefined, refresh: vi.fn() }),
}));
vi.mock("@/features/rooms/hooks/useRoomBookings", () => ({
  useRoomBookings: () => ({
    bookings: bookingsData,
    loading: false,
    error: undefined,
    refresh: refreshBookings,
  }),
}));

const createRoomBooking = vi.fn();
const cancelRoomBooking = vi.fn();
vi.mock("@/features/rooms/api/roomApi", () => ({
  createRoomBooking: (...args: unknown[]) => createRoomBooking(...args),
  cancelRoomBooking: (...args: unknown[]) => cancelRoomBooking(...args),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRoom(overrides: Partial<MeetingRoom> = {}): MeetingRoom {
  return {
    id: 100,
    organization: 10,
    office: 1,
    floor: 10,
    layout_object: 5,
    layout_object_type: "meeting_room",
    layout_object_label: "MR",
    name: "Boardroom",
    capacity: 8,
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeBooking(overrides: Partial<RoomBooking> = {}): RoomBooking {
  return {
    id: 500,
    organization: 10,
    office: 1,
    floor: 10,
    room: 100,
    room_name: "Boardroom",
    room_capacity: 8,
    layout_object: 5,
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

function renderPage() {
  mockUseAuth.mockReturnValue(baseAuth);
  return render(
    <MemoryRouter initialEntries={["/app/bookings/rooms?office=1&floor=10"]}>
      <RoomBookingPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  roomsData = [];
  bookingsData = [];
  refreshBookings.mockReset();
  createRoomBooking.mockReset().mockResolvedValue(makeBooking());
  cancelRoomBooking.mockReset().mockResolvedValue(makeBooking({ status: "cancelled" }));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RoomBookingPage", () => {
  it("lists rooms with a booked timeline segment for the day", async () => {
    roomsData = [makeRoom()];
    bookingsData = [makeBooking()]; // 09:00–10:00 reserved
    renderPage();
    await waitFor(() => expect(screen.getByTestId("room-card-100")).toBeInTheDocument());
    expect(screen.getByTestId("room-segment-500")).toBeInTheDocument();
    // a11y text alternative lists the booked time + masked status.
    const list = screen.getByTestId("room-booked-list-100");
    expect(list).toHaveTextContent("09:00");
    expect(list).toHaveTextContent("Reserved");
  });

  it("books a free slot (default 06:00 slot) and refreshes", async () => {
    const userE = userEvent.setup();
    roomsData = [makeRoom()];
    bookingsData = [];
    renderPage();
    await userE.click(await screen.findByTestId("room-book-100"));
    await waitFor(() => expect(createRoomBooking).toHaveBeenCalledTimes(1));
    expect(createRoomBooking).toHaveBeenCalledWith(
      1,
      10,
      expect.objectContaining({ room: 100, start: "06:00", end: "06:15" })
    );
    expect(refreshBookings).toHaveBeenCalled();
  });

  it("disables Book with a reason when the default slot conflicts", async () => {
    roomsData = [makeRoom()];
    // Booking covers 06:00–07:00, so the default 06:00–06:15 slot conflicts.
    bookingsData = [
      makeBooking({ start_at: "2026-06-15T06:00:00Z", end_at: "2026-06-15T07:00:00Z" }),
    ];
    renderPage();
    await waitFor(() => expect(screen.getByTestId("room-book-100")).toBeDisabled());
    expect(screen.getByTestId("room-conflict-100")).toBeInTheDocument();
    expect(createRoomBooking).not.toHaveBeenCalled();
  });

  it("renders the server 409 detail inline on the room card", async () => {
    const userE = userEvent.setup();
    roomsData = [makeRoom()];
    bookingsData = [];
    createRoomBooking.mockRejectedValue(
      new ApiError(409, { detail: "This room is already booked for an overlapping time." })
    );
    renderPage();
    await userE.click(await screen.findByTestId("room-book-100"));
    await waitFor(() =>
      expect(screen.getByTestId("room-error-100")).toHaveTextContent("overlapping time")
    );
  });

  it("cancels a own booking through the confirm dialog", async () => {
    const userE = userEvent.setup();
    roomsData = [makeRoom()];
    bookingsData = [makeBooking({ id: 777, is_mine: true, user_name: "Jane Smith" })];
    renderPage();
    await userE.click(await screen.findByTestId("room-segment-777"));
    // Confirm dialog appears.
    const confirmBtn = await screen.findByRole("button", { name: /cancel booking/i });
    await userE.click(confirmBtn);
    await waitFor(() => expect(cancelRoomBooking).toHaveBeenCalledWith(1, 10, 777));
  });

  it("shows the no-rooms note when the floor has no meeting rooms", async () => {
    roomsData = [];
    renderPage();
    expect(await screen.findByText("No meeting rooms")).toBeInTheDocument();
  });
});

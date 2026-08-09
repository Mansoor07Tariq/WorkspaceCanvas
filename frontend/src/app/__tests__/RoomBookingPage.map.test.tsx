import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RoomBookingPage } from "../pages/RoomBookingPage";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { MeetingRoom, RoomBooking } from "@/features/rooms/types/room.types";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";

// PR 075: the floor map colors rooms by availability for the chosen page slot, and
// the availability map is a memoized (stable) prop — recomputed only when the slot
// or bookings change, never on an unrelated re-render (the PR 068 perf rule).

const mockUseAuth = vi.fn<() => AuthContextValue>();
vi.mock("@/features/auth/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

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
    floors:
      officeId === 1
        ? [
            {
              id: 10,
              name: "G",
              boundary_width: "904",
              boundary_height: "544",
              status: "published",
            },
          ]
        : [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

let roomsData: MeetingRoom[] = [];
let bookingsData: RoomBooking[] = [];
let layoutData: LayoutObject[] = [];
vi.mock("@/features/rooms/hooks/useMeetingRooms", () => ({
  useMeetingRooms: () => ({ rooms: roomsData, loading: false, error: undefined, refresh: vi.fn() }),
}));
vi.mock("@/features/rooms/hooks/useRoomBookings", () => ({
  useRoomBookings: () => ({
    bookings: bookingsData,
    loading: false,
    error: undefined,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/features/layoutObjects/hooks/useLayoutObjects", () => ({
  useLayoutObjects: () => ({
    objects: layoutData,
    loading: false,
    error: undefined,
    refresh: vi.fn(),
    updateObjectLocally: vi.fn(),
    setSaving: vi.fn(),
    savingObjectIds: new Set(),
  }),
}));

// Capture what the canvas receives across renders (identity + contents).
interface FmcProps {
  availabilityByLayoutObjectId: Map<number, DeskAvailabilityStatus>;
  onAvailabilityObjectSelect: (id: number) => void;
}
let lastAvailability: Map<number, DeskAvailabilityStatus> | null = null;
let fmcRenderCount = 0;
vi.mock("@/features/layoutObjects/components/FloorMapCanvas", () => ({
  FloorMapCanvas: ({ availabilityByLayoutObjectId, onAvailabilityObjectSelect }: FmcProps) => {
    lastAvailability = availabilityByLayoutObjectId;
    fmcRenderCount++;
    return (
      <div
        data-testid="mock-fmc"
        data-avail={JSON.stringify(Array.from(availabilityByLayoutObjectId.entries()))}
      >
        <button data-testid="map-pick-20" onClick={() => onAvailabilityObjectSelect(20)}>
          pick
        </button>
      </div>
    );
  },
}));

const membership: MembershipInline = {
  id: 1,
  organization_id: 10,
  organization_name: "Acme",
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
  full_name: "Jane",
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

function room(id: number, layoutObject: number): MeetingRoom {
  return {
    id,
    organization: 10,
    office: 1,
    floor: 10,
    layout_object: layoutObject,
    layout_object_type: "meeting_room",
    layout_object_label: "MR",
    name: `Room ${id}`,
    capacity: 6,
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}
function layout(id: number): LayoutObject {
  return {
    id,
    floor: 10,
    object_type: "meeting_room",
    object_type_display: "Meeting Room",
    label: "MR",
    x: "100",
    y: "100",
    width: "120",
    height: "80",
    rotation: "0",
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}
function booking(id: number, roomId: number, start: string, end: string): RoomBooking {
  return {
    id,
    organization: 10,
    office: 1,
    floor: 10,
    room: roomId,
    room_name: `Room ${roomId}`,
    room_capacity: 6,
    layout_object: 0,
    user_name: "Reserved",
    is_mine: false,
    booking_date: "2099-06-15",
    start_at: start,
    end_at: end,
    status: "active",
    status_display: "Active",
    cancelled_at: null,
    created_at: "",
    updated_at: "",
  };
}

function renderPage() {
  mockUseAuth.mockReturnValue(baseAuth);
  return render(
    <MemoryRouter initialEntries={["/app/bookings/rooms?office=1&floor=10&date=2099-06-15"]}>
      <RoomBookingPage />
    </MemoryRouter>
  );
}

function avail(): Array<[number, string]> {
  const el = screen.getByTestId("mock-fmc");
  return JSON.parse(el.getAttribute("data-avail") ?? "[]");
}

beforeEach(() => {
  lastAvailability = null;
  fmcRenderCount = 0;
  roomsData = [room(1, 20), room(2, 30)];
  layoutData = [layout(20), layout(30)];
  // Room 1 booked 06:00–07:00 (overlaps the default 06:00–07:00 map slot).
  bookingsData = [booking(100, 1, "2099-06-15T06:00:00Z", "2099-06-15T07:00:00Z")];
});

describe("RoomBookingPage — floor map coloring", () => {
  it("colors rooms by availability for the default slot", async () => {
    renderPage();
    await screen.findByTestId("mock-fmc");
    const map = new Map(avail());
    expect(map.get(20)).toBe("reserved"); // room 1 booked at 06:00–07:00
    expect(map.get(30)).toBe("available"); // room 2 free
  });

  it("recolors when the map slot changes", async () => {
    const u = userEvent.setup();
    renderPage();
    await screen.findByTestId("mock-fmc");
    expect(new Map(avail()).get(20)).toBe("reserved");

    // Move the slot to 08:00 (no overlap with the 06:00–07:00 booking).
    const startSelect = within(screen.getByTestId("map-start-select")).getByRole("combobox");
    await u.click(startSelect);
    await u.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: "08:00" })
    );

    await waitFor(() => expect(new Map(avail()).get(20)).toBe("available"));
  });

  it("keeps the availability map reference stable on an unrelated re-render (perf)", async () => {
    const u = userEvent.setup();
    renderPage();
    await screen.findByTestId("mock-fmc");
    const before = lastAvailability;
    const rendersBefore = fmcRenderCount;

    // Clicking a room on the map only changes the selected-room highlight — the
    // canvas re-renders but the availability map must NOT be recomputed.
    await u.click(screen.getByTestId("map-pick-20"));
    await waitFor(() => expect(fmcRenderCount).toBeGreaterThan(rendersBefore)); // did re-render
    expect(lastAvailability).toBe(before); // …yet the availability map is the same reference
  });
});

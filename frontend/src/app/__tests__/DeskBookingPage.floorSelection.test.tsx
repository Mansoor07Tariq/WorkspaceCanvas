import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DeskBookingPage } from "../pages/DeskBookingPage";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { Desk } from "@/features/desks/types/desk.types";
import type { Floor } from "@/features/floors/types/floor.types";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";

// TD-033: integration test exercising the floor-selection path — proves the
// booking map and desk list re-render for the newly selected floor, the
// availability hook reloads for that floor, and no stale floor-A desk stays
// selected.

// ─── Auth ──────────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn<() => AuthContextValue>();
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const memberMembership: MembershipInline = {
  id: 1,
  organization_id: 10,
  organization_name: "Acme Corp",
  organization_slug: "acme",
  organization_status: "active",
  role: "member",
  status: "active",
  has_active_access: true,
};

const memberUser: CurrentUser = {
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
  memberships: [memberMembership],
};

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: memberUser,
  error: undefined,
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn(),
};

// ─── Fixtures: two floors with distinct desks/layout objects ────────────────────

const FLOOR_A: Floor = {
  id: 10,
  organization: 1,
  office: 1,
  name: "Floor A",
  slug: "floor-a",
  level_number: 0,
  is_active: true,
  created_at: "",
  updated_at: "",
};
const FLOOR_B: Floor = { ...FLOOR_A, id: 20, name: "Floor B", slug: "floor-b", level_number: 1 };

function makeDesk(id: number, name: string, layoutObjectId: number): Desk {
  return {
    id,
    organization: 10,
    office: 1,
    floor: 0,
    layout_object: layoutObjectId,
    layout_object_type: "desk",
    layout_object_label: name,
    name,
    code: name.replace(/\s/g, ""),
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

function makeLayoutObject(id: number, label: string): LayoutObject {
  return {
    id,
    floor: 0,
    object_type: "desk",
    object_type_display: "Desk",
    label,
    x: "100",
    y: "100",
    width: "80",
    height: "60",
    rotation: "0",
    is_bookable: true,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

const DESKS_BY_FLOOR: Record<number, Desk[]> = {
  10: [makeDesk(101, "Desk A1", 11)],
  20: [makeDesk(201, "Desk B1", 21)],
};
const OBJECTS_BY_FLOOR: Record<number, LayoutObject[]> = {
  10: [makeLayoutObject(11, "Desk A1")],
  20: [makeLayoutObject(21, "Desk B1")],
};

// ─── Hook mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/features/offices/hooks/useOffices", () => ({
  useOffices: () => ({
    offices: [
      {
        id: 1,
        name: "HQ",
        slug: "hq",
        address_line_1: "",
        address_line_2: "",
        city: "",
        county_or_state: "",
        country: "",
        timezone: "",
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/floors/hooks/useFloors", () => ({
  useFloors: (officeId: number) => ({
    floors: officeId === 1 ? [FLOOR_A, FLOOR_B] : [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/desks/hooks/useDesks", () => ({
  useDesks: (_officeId: number, floorId: number) => ({
    desks: DESKS_BY_FLOOR[floorId] ?? [],
    loading: false,
    error: undefined,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/layoutObjects/hooks/useLayoutObjects", () => ({
  useLayoutObjects: (_officeId: number, floorId: number) => ({
    objects: OBJECTS_BY_FLOOR[floorId] ?? [],
    loading: false,
    error: undefined,
    refresh: vi.fn(),
    updateObjectLocally: vi.fn(),
    setSaving: vi.fn(),
    savingObjectIds: new Set(),
  }),
}));

const deskBookingsCalls: Array<{ officeId: number; floorId: number; date: string }> = [];
vi.mock("@/features/bookings/hooks/useDeskBookings", () => ({
  useDeskBookings: (officeId: number, floorId: number, date: string) => {
    deskBookingsCalls.push({ officeId, floorId, date });
    return { bookings: [], loading: false, error: undefined, refresh: vi.fn() };
  },
}));

// Mock the lazy/Konva map; expose which layout objects and selected desk it received.
vi.mock("@/features/bookings/components/BookingFloorMap", () => ({
  BookingFloorMap: ({
    layoutObjects,
    selectedDeskId,
  }: {
    layoutObjects: { id: number }[];
    selectedDeskId: number | null;
  }) => (
    <div
      data-testid="mock-booking-floor-map"
      data-object-ids={layoutObjects.map((o) => o.id).join(",")}
      data-selected-desk={selectedDeskId ?? "none"}
    />
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────────

async function selectOption(testId: string, optionName: RegExp) {
  const user = userEvent.setup();
  const combo = within(screen.getByTestId(testId)).getByRole("combobox");
  await user.click(combo);
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: optionName }));
}

function renderPage() {
  mockUseAuth.mockReturnValue(baseAuth);
  return render(
    <MemoryRouter>
      <DeskBookingPage />
    </MemoryRouter>
  );
}

describe("DeskBookingPage — floor selection (TD-033)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deskBookingsCalls.length = 0;
  });

  it("renders the selected floor's desks and map, and updates when the floor changes", async () => {
    renderPage();

    await selectOption("office-select", /^HQ$/);
    await selectOption("floor-select", /^Floor A$/);

    // Floor A data renders.
    await waitFor(() => {
      expect(screen.getByText("Desk A1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mock-booking-floor-map")).toHaveAttribute("data-object-ids", "11");

    // Switch to Floor B.
    await selectOption("floor-select", /^Floor B$/);

    await waitFor(() => {
      expect(screen.getByText("Desk B1")).toBeInTheDocument();
    });
    // Floor A desk is gone; the map now shows Floor B's layout object.
    expect(screen.queryByText("Desk A1")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-booking-floor-map")).toHaveAttribute("data-object-ids", "21");
  });

  it("reloads the availability hook for the newly selected floor", async () => {
    renderPage();
    await selectOption("office-select", /^HQ$/);
    await selectOption("floor-select", /^Floor A$/);
    await selectOption("floor-select", /^Floor B$/);

    const floorIds = deskBookingsCalls.map((c) => c.floorId);
    // useDeskBookings was driven by both floor 10 and floor 20 (not floor-A only).
    expect(floorIds).toContain(10);
    expect(floorIds).toContain(20);
  });

  it("clears the previously selected desk when the floor changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectOption("office-select", /^HQ$/);
    await selectOption("floor-select", /^Floor A$/);

    // Select Desk A1 on Floor A.
    await user.click(screen.getByRole("button", { name: /select desk desk a1/i }));
    await waitFor(() => {
      expect(screen.getByTestId("mock-booking-floor-map")).toHaveAttribute(
        "data-selected-desk",
        "101"
      );
    });

    // Changing floor must reset the selection — no stale Floor A desk selected.
    await selectOption("floor-select", /^Floor B$/);
    await waitFor(() => {
      expect(screen.getByTestId("mock-booking-floor-map")).toHaveAttribute(
        "data-selected-desk",
        "none"
      );
    });
  });

  it("shows the role-aware no-desks empty state for a floor without desks", async () => {
    // Floor B has desks in fixtures; point its desks to empty to prove the
    // empty state still works after a floor switch.
    DESKS_BY_FLOOR[20] = [];
    OBJECTS_BY_FLOOR[20] = [];
    try {
      renderPage();
      await selectOption("office-select", /^HQ$/);
      await selectOption("floor-select", /^Floor B$/);
      await waitFor(() => {
        expect(screen.getByText(/no bookable desks/i)).toBeInTheDocument();
      });
    } finally {
      // Restore shared fixtures for other tests.
      DESKS_BY_FLOOR[20] = [makeDesk(201, "Desk B1", 21)];
      OBJECTS_BY_FLOOR[20] = [makeLayoutObject(21, "Desk B1")];
    }
  });
});

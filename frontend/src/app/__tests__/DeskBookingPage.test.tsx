import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DeskBookingPage } from "../pages/DeskBookingPage";
import { en } from "@/i18n/en";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";

// ─── Auth mock ────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockAdminMembership: MembershipInline = {
  id: 1,
  organization_id: 10,
  organization_name: "Acme Corp",
  organization_slug: "acme",
  organization_status: "active",
  role: "owner",
  status: "active",
  has_active_access: true,
};

const mockMemberMembership: MembershipInline = { ...mockAdminMembership, role: "member" };

const mockUserBase: CurrentUser = {
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
  memberships: [],
};

const adminUser: CurrentUser = { ...mockUserBase, memberships: [mockAdminMembership] };
const memberUser: CurrentUser = { ...mockUserBase, memberships: [mockMemberMembership] };

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: adminUser,
  error: undefined,
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn(),
};

vi.mock("@/features/offices/hooks/useOffices", () => ({
  useOffices: vi.fn(),
}));

import { useOffices } from "@/features/offices/hooks/useOffices";
const mockUseOffices = vi.mocked(useOffices);

vi.mock("@/features/floors/hooks/useFloors", () => ({
  useFloors: () => ({ floors: [], loading: false, error: null, refresh: vi.fn() }),
}));

vi.mock("@/features/desks/hooks/useDesks", () => ({
  useDesks: () => ({ desks: [], loading: false, error: undefined, refresh: vi.fn() }),
}));

vi.mock("@/features/layoutObjects/hooks/useLayoutObjects", () => ({
  useLayoutObjects: () => ({
    objects: [],
    loading: false,
    error: undefined,
    refresh: vi.fn(),
    updateObjectLocally: vi.fn(),
    setSaving: vi.fn(),
    savingObjectIds: new Set(),
  }),
}));

vi.mock("@/features/bookings/hooks/useDeskBookings", () => ({
  useDeskBookings: () => ({ bookings: [], loading: false, error: undefined, refresh: vi.fn() }),
}));

// Mock BookingFloorMap to avoid pulling in Konva and lazy-loading in unit tests.
// Interaction and availability prop tests are covered in BookingFloorMap.test.tsx.
vi.mock("@/features/bookings/components/BookingFloorMap", () => ({
  BookingFloorMap: ({ selectedDeskId }: { selectedDeskId: number | null }) => (
    <div data-testid="mock-booking-floor-map" data-selected-desk={selectedDeskId ?? "none"} />
  ),
}));

function setupDefaultMocks(user: CurrentUser = adminUser) {
  mockUseAuth.mockReturnValue({ ...baseAuth, user });
  mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
}

function renderPage(user: CurrentUser = adminUser) {
  mockUseAuth.mockReturnValue({ ...baseAuth, user });
  return render(
    <MemoryRouter>
      <DeskBookingPage />
    </MemoryRouter>
  );
}

describe("DeskBookingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders the Desk Booking heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: en.bookings.pageTitle })).toBeInTheDocument();
  });

  it("renders office and floor selects", () => {
    renderPage();
    expect(screen.getByTestId("office-select")).toBeInTheDocument();
    expect(screen.getByTestId("floor-select")).toBeInTheDocument();
  });

  it("renders the booking date input", () => {
    renderPage();
    expect(screen.getByLabelText("Booking Date")).toBeInTheDocument();
  });

  it("shows prompt to select office and floor when none selected", () => {
    mockUseOffices.mockReturnValue({
      offices: [
        {
          id: 1,
          organization: 1,
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
    });
    renderPage();
    expect(screen.getByText(en.bookings.selectPrompt)).toBeInTheDocument();
  });

  it("page heading is an h1 element", () => {
    renderPage();
    const heading = screen.getByRole("heading", { name: en.bookings.pageTitle, level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });

  it("floor map is not rendered before a floor is selected", () => {
    renderPage();
    expect(screen.queryByTestId("mock-booking-floor-map")).not.toBeInTheDocument();
    expect(screen.queryByText("Floor map")).not.toBeInTheDocument();
  });

  it("does not expose any other user's name in the initial render", () => {
    const { container } = renderPage();
    // Privacy guard: no user identity data should appear at page level
    expect(container.textContent).not.toContain("Jane Smith");
    expect(container.textContent).not.toContain("user_name");
  });
});

describe("DeskBookingPage — no offices (admin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks(adminUser);
  });

  it("shows admin no-offices empty state title", () => {
    renderPage(adminUser);
    expect(screen.getByText(en.bookings.noOfficesAdminTitle)).toBeInTheDocument();
  });

  it("shows admin no-offices action button", () => {
    renderPage(adminUser);
    expect(
      screen.getByRole("button", { name: en.bookings.noOfficesAdminAction })
    ).toBeInTheDocument();
  });

  it("does not show select prompt when no offices", () => {
    renderPage(adminUser);
    expect(screen.queryByText(en.bookings.selectPrompt)).not.toBeInTheDocument();
  });
});

describe("DeskBookingPage — no offices (member)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks(memberUser);
  });

  it("shows member no-offices empty state title", () => {
    renderPage(memberUser);
    expect(screen.getByText(en.bookings.noOfficesMemberTitle)).toBeInTheDocument();
  });

  it("does not show admin action button for member", () => {
    renderPage(memberUser);
    expect(
      screen.queryByRole("button", { name: en.bookings.noOfficesAdminAction })
    ).not.toBeInTheDocument();
  });
});

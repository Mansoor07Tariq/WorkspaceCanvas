import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../pages/DashboardPage";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { DeskBooking } from "@/features/bookings/types/booking.types";

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogoutUser = vi.fn<() => Promise<void>>();
const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/features/offices/hooks/useOffices", () => ({
  useOffices: vi.fn(),
}));

vi.mock("@/features/bookings/hooks/useMyBookings", () => ({
  useMyBookings: vi.fn(),
}));

vi.mock("@/features/floors/api/floorApi", () => ({
  listFloors: vi.fn(),
}));

vi.mock("@/features/desks/api/deskApi", () => ({
  listDesks: vi.fn(),
}));

vi.mock("@/features/profile/api/profileApi", () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

vi.mock("@/features/teams/hooks/useTeamMembers", () => ({
  useTeamMembers: vi.fn(),
}));

// ─── Lazy import mocked hooks after vi.mock ───────────────────────────────────

import { useOffices } from "@/features/offices/hooks/useOffices";
import { useMyBookings } from "@/features/bookings/hooks/useMyBookings";
import { listFloors } from "@/features/floors/api/floorApi";
import { listDesks } from "@/features/desks/api/deskApi";
import { useTeamMembers } from "@/features/teams/hooks/useTeamMembers";

const mockUseOffices = vi.mocked(useOffices);
const mockUseMyBookings = vi.mocked(useMyBookings);
const mockListFloors = vi.mocked(listFloors);
const mockListDesks = vi.mocked(listDesks);
const mockUseTeamMembers = vi.mocked(useTeamMembers);

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const mockUser: CurrentUser = {
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

const adminMembership: MembershipInline = {
  id: 1,
  organization_id: 10,
  organization_name: "Acme Corp",
  organization_slug: "acme",
  organization_status: "active",
  role: "owner",
  status: "active",
  has_active_access: true,
};

const memberMembership: MembershipInline = {
  ...adminMembership,
  role: "member",
};

const adminUser: CurrentUser = { ...mockUser, memberships: [adminMembership] };
const memberUser: CurrentUser = { ...mockUser, memberships: [memberMembership] };

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: mockUser,
  error: undefined,
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: mockLogoutUser,
};

function makeBooking(overrides: Partial<DeskBooking> = {}): DeskBooking {
  return {
    id: 1,
    organization: 10,
    office: 1,
    floor: 1,
    desk: 1,
    desk_name: "Desk A1",
    desk_code: "A1",
    layout_object: 1,
    user: 1,
    user_name: "Jane Smith",
    booking_date: "2026-06-01",
    status: "active",
    status_display: "Active",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-01T08:00:00Z",
    cancelled_at: null,
    is_mine: true,
    office_name: "Dublin HQ",
    floor_name: "Ground Floor",
    ...overrides,
  };
}

function setupDefaultHooks() {
  mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
  mockUseMyBookings.mockReturnValue({
    bookings: [],
    loading: false,
    error: undefined,
    cancelSuccess: undefined,
    cancelError: undefined,
    refresh: vi.fn(),
    cancelBooking: vi.fn(),
  });
  mockListFloors.mockResolvedValue([]);
  mockListDesks.mockResolvedValue([]);
  mockUseTeamMembers.mockReturnValue({
    members: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
}

function renderPage(overrides: Partial<AuthContextValue> = {}) {
  mockUseAuth.mockReturnValue({ ...baseAuth, ...overrides });
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DashboardPage — app shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHooks();
  });

  it("renders the WorkspaceCanvas brand in the header", () => {
    renderPage({ user: adminUser });
    expect(screen.getByText(en.app.shell.brand)).toBeInTheDocument();
  });

  it("renders the logout button", () => {
    renderPage({ user: adminUser });
    expect(screen.getByRole("button", { name: en.app.shell.logout })).toBeInTheDocument();
  });

  it("calls logoutUser and navigates to login on logout click", async () => {
    const user = userEvent.setup();
    mockLogoutUser.mockResolvedValueOnce(undefined);
    renderPage({ user: adminUser });
    await user.click(screen.getByRole("button", { name: en.app.shell.logout }));
    await waitFor(() => {
      expect(mockLogoutUser).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.login);
    });
  });
});

describe("DashboardPage — profile onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHooks();
  });

  it("shows profile onboarding carousel when profile is not completed", () => {
    renderPage({ user: { ...adminUser, is_profile_completed: false } });
    expect(screen.getByText(en.app.profile.carousel.stepWelcomeTitle)).toBeInTheDocument();
  });

  it("does not show dashboard h1 when profile is not completed", () => {
    renderPage({ user: { ...adminUser, is_profile_completed: false } });
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});

describe("DashboardPage — no organization state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHooks();
  });

  it("renders no-org heading when user has no memberships", () => {
    renderPage({ user: mockUser });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.app.dashboard.noOrgTitle
    );
  });

  it("renders create workspace CTA for no-org user", () => {
    renderPage({ user: mockUser });
    expect(
      screen.getByRole("link", { name: en.app.dashboard.createOrgAction })
    ).toBeInTheDocument();
  });

  it("create workspace link points to offices route", () => {
    renderPage({ user: mockUser });
    expect(screen.getByRole("link", { name: en.app.dashboard.createOrgAction })).toHaveAttribute(
      "href",
      ROUTES.offices
    );
  });

  it("does not show admin setup checklist for no-org user", () => {
    renderPage({ user: mockUser });
    expect(screen.queryByText(en.app.dashboard.setupTitle)).not.toBeInTheDocument();
  });
});

describe("DashboardPage — admin role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHooks();
  });

  it("renders dashboard h1 greeting for admin", () => {
    renderPage({ user: adminUser });
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("shows admin setup checklist for owner", async () => {
    renderPage({ user: adminUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.setupTitle)).toBeInTheDocument();
    });
  });

  it("shows manage offices quick action for admin", () => {
    renderPage({ user: adminUser });
    expect(
      screen.getByRole("link", { name: en.app.dashboard.actionManageOffices })
    ).toBeInTheDocument();
  });

  it("shows build floor map quick action for admin", () => {
    renderPage({ user: adminUser });
    expect(
      screen.getByRole("link", { name: en.app.dashboard.actionBuildFloorMap })
    ).toBeInTheDocument();
  });

  it("shows book a desk quick action for admin", () => {
    renderPage({ user: adminUser });
    expect(screen.getByRole("link", { name: en.app.dashboard.actionBookDesk })).toBeInTheDocument();
  });

  it("shows my bookings quick action for admin", () => {
    renderPage({ user: adminUser });
    expect(
      screen.getByRole("link", { name: en.app.dashboard.actionMyBookings })
    ).toBeInTheDocument();
  });

  it("shows workspace health cards for admin", async () => {
    renderPage({ user: adminUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.healthTitle)).toBeInTheDocument();
    });
  });
});

describe("DashboardPage — member role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHooks();
  });

  it("does not show admin setup checklist for member", async () => {
    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.queryByText(en.app.dashboard.setupTitle)).not.toBeInTheDocument();
    });
  });

  it("does not show manage offices action for member", () => {
    renderPage({ user: memberUser });
    expect(
      screen.queryByRole("link", { name: en.app.dashboard.actionManageOffices })
    ).not.toBeInTheDocument();
  });

  it("does not show build floor map action for member", () => {
    renderPage({ user: memberUser });
    expect(
      screen.queryByRole("link", { name: en.app.dashboard.actionBuildFloorMap })
    ).not.toBeInTheDocument();
  });

  it("shows book a desk quick action for member", () => {
    renderPage({ user: memberUser });
    expect(screen.getByRole("link", { name: en.app.dashboard.actionBookDesk })).toBeInTheDocument();
  });

  it("shows my bookings quick action for member", () => {
    renderPage({ user: memberUser });
    expect(
      screen.getByRole("link", { name: en.app.dashboard.actionMyBookings })
    ).toBeInTheDocument();
  });

  it("does not show workspace health cards for member", async () => {
    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.queryByText(en.app.dashboard.healthTitle)).not.toBeInTheDocument();
    });
  });
});

describe("DashboardPage — booking cards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows today booking card section heading", async () => {
    setupDefaultHooks();
    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.todayTitle)).toBeInTheDocument();
    });
  });

  it("shows no-booking CTA when no booking today", async () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);

    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.noBookingTodayTitle)).toBeInTheDocument();
    });
  });

  it("shows today booking desk name when booking exists for today", async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const booking = makeBooking({ booking_date: todayStr, desk_name: "Hot Desk 7" });

    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);

    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.getByText("Hot Desk 7")).toBeInTheDocument();
    });
  });

  it("shows next booking card when a future booking exists", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const booking = makeBooking({ id: 2, booking_date: tomorrowStr, desk_name: "Future Desk" });

    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [booking],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);

    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.upcomingTitle)).toBeInTheDocument();
      expect(screen.getByText("Future Desk")).toBeInTheDocument();
    });
  });

  it("shows booking error alert when bookings fail to load", async () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: "Failed to load bookings.",
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);

    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Failed to load bookings.")).toBeInTheDocument();
    });
  });
});

describe("DashboardPage — loading state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading indicator while bookings are loading", () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: true,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);

    renderPage({ user: memberUser });
    expect(screen.getByLabelText(en.app.dashboard.loadingBookings)).toBeInTheDocument();
  });
});

describe("DashboardPage — admin checklist items", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows office checklist item incomplete when no offices", async () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);

    renderPage({ user: adminUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.checklistItemOfficeLabel)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: `${en.app.dashboard.checklistItemOfficeAction} →` })
      ).toBeInTheDocument();
    });
  });

  it("links to offices page from office checklist item action", async () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);

    renderPage({ user: adminUser });
    await waitFor(() => {
      const link = screen.getByRole("link", {
        name: `${en.app.dashboard.checklistItemOfficeAction} →`,
      });
      expect(link).toHaveAttribute("href", ROUTES.offices);
    });
  });
});

describe("DashboardPage — admin invite people action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHooks();
  });

  it("shows invite people quick action for admin", () => {
    renderPage({ user: adminUser });
    expect(
      screen.getByRole("link", { name: en.app.dashboard.actionInvitePeople })
    ).toBeInTheDocument();
  });

  it("invite people link points to people page", () => {
    renderPage({ user: adminUser });
    expect(screen.getByRole("link", { name: en.app.dashboard.actionInvitePeople })).toHaveAttribute(
      "href",
      ROUTES.people
    );
  });

  it("does not show invite people action for member", () => {
    renderPage({ user: memberUser });
    expect(
      screen.queryByRole("link", { name: en.app.dashboard.actionInvitePeople })
    ).not.toBeInTheDocument();
  });
});

describe("DashboardPage — member workspace not ready", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows workspace-being-set-up status when member has org but no desks", async () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);
    mockUseTeamMembers.mockReturnValue({
      members: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.memberSetupTitle)).toBeInTheDocument();
    });
  });

  it("does not show workspace-being-set-up status for admin when no desks", async () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);
    mockUseTeamMembers.mockReturnValue({
      members: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderPage({ user: adminUser });
    await waitFor(() => {
      expect(screen.queryByText(en.app.dashboard.memberSetupTitle)).not.toBeInTheDocument();
    });
  });

  it("hero subtitle changes to setup message for member when workspace not ready", async () => {
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
    mockUseMyBookings.mockReturnValue({
      bookings: [],
      loading: false,
      error: undefined,
      cancelSuccess: undefined,
      cancelError: undefined,
      refresh: vi.fn(),
      cancelBooking: vi.fn(),
    });
    mockListFloors.mockResolvedValue([]);
    mockListDesks.mockResolvedValue([]);
    mockUseTeamMembers.mockReturnValue({
      members: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderPage({ user: memberUser });
    await waitFor(() => {
      expect(screen.getByText(en.app.dashboard.heroMemberSetup)).toBeInTheDocument();
    });
  });
});

describe("DashboardPage — accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultHooks();
  });

  it("AppShell provides a single main landmark", () => {
    renderPage({ user: adminUser });
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("has an h1 for admin user", () => {
    renderPage({ user: adminUser });
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("has an h1 for no-org user", () => {
    renderPage({ user: mockUser });
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("quick action links have accessible names for admin", () => {
    renderPage({ user: adminUser });
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveAccessibleName();
    });
  });
});

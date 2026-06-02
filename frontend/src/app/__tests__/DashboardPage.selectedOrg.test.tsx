import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../pages/DashboardPage";
import { SelectedOrganizationProvider } from "@/features/organizations/context/SelectedOrganizationProvider";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { WorkspaceSummary } from "@/features/dashboard/types/dashboard.types";

const mockUseAuth = vi.fn<() => AuthContextValue>();
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/features/offices/hooks/useOffices", () => ({ useOffices: vi.fn() }));
vi.mock("@/features/bookings/hooks/useMyBookings", () => ({ useMyBookings: vi.fn() }));
vi.mock("@/features/floors/api/floorApi", () => ({ listFloors: vi.fn() }));
vi.mock("@/features/teams/hooks/useTeamMembers", () => ({ useTeamMembers: vi.fn() }));
vi.mock("@/features/dashboard/hooks/useWorkspaceSummary", () => ({
  useWorkspaceSummary: vi.fn(),
}));
vi.mock("@/features/profile/api/profileApi", () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

import { useOffices } from "@/features/offices/hooks/useOffices";
import { useMyBookings } from "@/features/bookings/hooks/useMyBookings";
import { listFloors } from "@/features/floors/api/floorApi";
import { useTeamMembers } from "@/features/teams/hooks/useTeamMembers";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";

const mockUseOffices = vi.mocked(useOffices);
const mockUseMyBookings = vi.mocked(useMyBookings);
const mockListFloors = vi.mocked(listFloors);
const mockUseTeamMembers = vi.mocked(useTeamMembers);
const mockUseWorkspaceSummary = vi.mocked(useWorkspaceSummary);

function membership(orgId: number, name: string): MembershipInline {
  return {
    id: orgId,
    organization_id: orgId,
    organization_name: name,
    organization_slug: name.toLowerCase(),
    organization_status: "active",
    role: "owner",
    status: "active",
    has_active_access: true,
  };
}

const twoOrgUser: CurrentUser = {
  id: 1,
  username: "u@e.com",
  email: "u@e.com",
  full_name: "U E",
  first_name: "U",
  last_name: "E",
  avatar: null,
  phone_number: "",
  job_title: "",
  timezone: "UTC",
  locale: "en",
  is_profile_completed: true,
  email_verified: true,
  preferred_auth_provider: "email",
  mfa_enabled: false,
  memberships: [membership(10, "Acme"), membership(20, "Zephyr")],
};

function summary(): WorkspaceSummary {
  return {
    organization: 10,
    offices_count: 0,
    floors_count: 0,
    layout_objects_count: 0,
    bookable_desks_count: 0,
    active_members_count: 1,
    pending_invitations_count: 0,
    has_offices: false,
    has_floors: false,
    has_layout_objects: false,
    has_bookable_desks: false,
    setup_complete: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockUseAuth.mockReturnValue({
    status: "authenticated",
    user: twoOrgUser,
    error: undefined,
    refreshUser: vi.fn(),
    setAuthenticatedUser: vi.fn(),
    markUnauthenticated: vi.fn(),
    logoutUser: vi.fn(),
  });
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
  mockUseTeamMembers.mockReturnValue({
    members: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockUseWorkspaceSummary.mockReturnValue({
    summary: summary(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <SelectedOrganizationProvider>
        <DashboardPage />
      </SelectedOrganizationProvider>
    </MemoryRouter>
  );
}

describe("DashboardPage — selected organization (PR 055)", () => {
  it("scopes the summary and offices hooks to the first active org by default", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockUseWorkspaceSummary).toHaveBeenCalledWith(10);
    });
    expect(mockUseOffices).toHaveBeenCalledWith(10);
  });

  it("scopes the summary and offices hooks to a persisted selected org", async () => {
    window.localStorage.setItem("wc.selectedOrganizationId", "20");
    renderDashboard();
    await waitFor(() => {
      expect(mockUseWorkspaceSummary).toHaveBeenCalledWith(20);
    });
    expect(mockUseOffices).toHaveBeenCalledWith(20);
  });

  it("still renders the dashboard h1 for the selected org", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

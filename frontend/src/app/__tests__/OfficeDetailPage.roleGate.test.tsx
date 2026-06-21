/**
 * TD-045: OfficeDetailPage must gate the "Add floor" affordance on the role the
 * user holds in THIS office's organization, not on their first active membership.
 *
 * Strategy: mock useAuth (which backs useSelectedOrganization's no-provider
 * fallback), useFloors (carries the office's organization id), and the
 * floors list/empty-state components so we can read their `canManage` prop.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OfficeDetailPage } from "@/app/pages/OfficeDetailPage";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { Floor } from "@/features/floors/types/floor.types";

vi.mock("@/features/auth/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/floors/hooks/useFloors", () => ({ useFloors: vi.fn() }));

vi.mock("@/features/floors/components/FloorsList", () => ({
  FloorsList: ({ canManage }: { canManage?: boolean }) => (
    <div data-testid="floors-list" data-can-manage={canManage ? "true" : "false"}>
      {canManage && <button>Add floor</button>}
    </div>
  ),
}));
vi.mock("@/features/floors/components/FloorsEmptyState", () => ({
  FloorsEmptyState: ({ canManage }: { canManage?: boolean }) => (
    <div data-testid="floors-empty" data-can-manage={canManage ? "true" : "false"} />
  ),
}));
vi.mock("@/features/floors/components/FloorCreationFlow", () => ({
  FloorCreationFlow: () => <div data-testid="floor-create-flow" />,
}));

import { useAuth } from "@/features/auth/context/AuthContext";
import { useFloors } from "@/features/floors/hooks/useFloors";

const mockUseAuth = vi.mocked(useAuth);
const mockUseFloors = vi.mocked(useFloors);

const ORG_A = 10;
const ORG_B = 20;

function membership(overrides: Partial<MembershipInline>): MembershipInline {
  return {
    id: 1,
    organization_id: ORG_A,
    organization_name: "Org",
    organization_slug: "org",
    organization_status: "active",
    role: "member",
    status: "active",
    has_active_access: true,
    ...overrides,
  };
}

// Admin in Org A (first active membership), member in Org B.
function makeUser(): CurrentUser {
  return {
    id: 1,
    username: "u@example.com",
    email: "u@example.com",
    full_name: "U",
    first_name: "U",
    last_name: "",
    avatar: null,
    phone_number: "",
    job_title: "",
    timezone: "UTC",
    locale: "en",
    is_profile_completed: true,
    email_verified: true,
    preferred_auth_provider: "email",
    mfa_enabled: false,
    memberships: [
      membership({ id: 1, organization_id: ORG_A, role: "admin" }),
      membership({ id: 2, organization_id: ORG_B, role: "member" }),
    ],
  };
}

function makeAuthValue(user: CurrentUser): AuthContextValue {
  return {
    user,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as unknown as AuthContextValue;
}

function floor(orgId: number): Floor {
  return {
    id: 100,
    organization: orgId,
    office: 5,
    name: "Ground",
    slug: "ground",
    level_number: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
    boundary_width: "904",
    boundary_height: "544",
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/offices/5"]}>
      <Routes>
        <Route path="/app/offices/:officeId" element={<OfficeDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OfficeDetailPage role gate (TD-045)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser()));
  });

  it("shows Add floor when the office belongs to the org the user administers (Org A)", () => {
    mockUseFloors.mockReturnValue({
      floors: [floor(ORG_A)],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId("floors-list").dataset.canManage).toBe("true");
  });

  it("hides Add floor when the office belongs to an org where the user is only a member (Org B)", () => {
    // First active membership is Org A (admin); the office is in Org B (member).
    // Pre-TD-045 this incorrectly showed admin controls.
    mockUseFloors.mockReturnValue({
      floors: [floor(ORG_B)],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    renderPage();
    expect(screen.getByTestId("floors-list").dataset.canManage).toBe("false");
    expect(screen.queryByText("Add floor")).toBeNull();
  });
});

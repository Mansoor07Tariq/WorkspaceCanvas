/**
 * PR 057 (Error 4): WorkspaceRequiredRoute redirects users with no active
 * organization membership away from workspace-dependent pages (to /app), and
 * renders the nested route when a membership exists.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceRequiredRoute } from "../WorkspaceRequiredRoute";
import { ROUTES } from "@/routes/paths";
import type { MembershipInline } from "@/features/auth/types/auth.types";
import type { SelectedOrganizationValue } from "@/features/organizations/context/SelectedOrganizationProvider";

const mockUseSelectedOrganization = vi.fn<() => SelectedOrganizationValue>();

vi.mock("@/features/organizations/context/SelectedOrganizationProvider", () => ({
  useSelectedOrganization: () => mockUseSelectedOrganization(),
}));

function membership(): MembershipInline {
  return {
    id: 1,
    organization_id: 10,
    organization_name: "Acme",
    organization_slug: "acme",
    organization_status: "active",
    role: "member",
    status: "active",
    has_active_access: true,
  };
}

function baseValue(selectedMembership: MembershipInline | null): SelectedOrganizationValue {
  return {
    activeMemberships: selectedMembership ? [selectedMembership] : [],
    selectedOrganizationId: selectedMembership?.organization_id ?? null,
    selectedMembership,
    selectedOrganizationName: selectedMembership?.organization_name ?? null,
    setSelectedOrganizationId: vi.fn(),
    hasMultipleOrganizations: false,
  };
}

function renderAtBookings() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.bookings]}>
      <Routes>
        <Route path={ROUTES.app} element={<div>Dashboard (no workspace)</div>} />
        <Route element={<WorkspaceRequiredRoute />}>
          <Route path={ROUTES.bookings} element={<div>Bookings Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkspaceRequiredRoute (PR 057 Error 4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the workspace page when an active membership exists", () => {
    mockUseSelectedOrganization.mockReturnValue(baseValue(membership()));
    renderAtBookings();
    expect(screen.getByText("Bookings Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard (no workspace)")).not.toBeInTheDocument();
  });

  it("redirects to /app when there is no active membership", () => {
    mockUseSelectedOrganization.mockReturnValue(baseValue(null));
    renderAtBookings();
    expect(screen.getByText("Dashboard (no workspace)")).toBeInTheDocument();
    expect(screen.queryByText("Bookings Page")).not.toBeInTheDocument();
  });
});

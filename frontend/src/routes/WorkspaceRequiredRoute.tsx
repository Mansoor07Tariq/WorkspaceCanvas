import { Navigate, Outlet } from "react-router-dom";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { ROUTES } from "./paths";

/**
 * PR 057 (Error 4): guard for workspace-dependent routes (Office Detail, Floor
 * Layout, Bookings, My Bookings, People). A user who has completed their profile
 * but has no active organization membership must not land on these pages as if a
 * workspace exists — they are redirected to `/app`, where DashboardPage renders
 * the "No workspace yet" state (with a Create Workspace CTA + invite guidance).
 *
 * `/app` (dashboard) and `/app/offices` are intentionally NOT guarded: the
 * dashboard hosts the no-workspace state and the Offices route hosts the
 * organization-creation flow, which is how a user gets a workspace in the first
 * place. Backend permissions are enforced independently regardless of this gate.
 */
export function WorkspaceRequiredRoute() {
  const { selectedMembership } = useSelectedOrganization();

  if (!selectedMembership) {
    return <Navigate to={ROUTES.app} replace />;
  }

  return <Outlet />;
}

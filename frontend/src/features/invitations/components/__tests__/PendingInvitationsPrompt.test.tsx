import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PendingInvitationsPrompt } from "../PendingInvitationsPrompt";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { PendingInvitation } from "@/features/teams/types/teams.types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSetSelectedOrg = vi.hoisted(() => vi.fn());
const mockInvalidateCache = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/features/organizations/context/SelectedOrganizationProvider", () => ({
  useSelectedOrganization: () => ({ setSelectedOrganizationId: mockSetSelectedOrg }),
}));

vi.mock("@/lib/api/requestCache", () => ({
  invalidateCache: (...args: unknown[]) => mockInvalidateCache(...args),
}));

vi.mock("@/features/teams/api/teamsApi", () => ({
  listMyPendingInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
}));

import { listMyPendingInvitations, acceptInvitation } from "@/features/teams/api/teamsApi";
import { ApiError } from "@/lib/api/apiError";

const mockList = vi.mocked(listMyPendingInvitations);
const mockAccept = vi.mocked(acceptInvitation);
const mockUseAuth = vi.fn<() => AuthContextValue>();
const mockRefreshUser = vi.fn<() => Promise<void>>();

// ─── Fixtures ────────────────────────────────────────────────────────────────

const userNoOrg: CurrentUser = {
  id: 1,
  username: "invited@example.com",
  email: "invited@example.com",
  full_name: "Dave",
  first_name: "Dave",
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
  memberships: [],
};

const acmeMembership: MembershipInline = {
  id: 10,
  organization_id: 42,
  organization_name: "Acme Corp",
  organization_slug: "acme",
  organization_status: "active",
  role: "member",
  status: "active",
  has_active_access: true,
};

// The user AFTER refreshUser resolves: the joined membership is now present.
const userWithAcme: CurrentUser = { ...userNoOrg, memberships: [acmeMembership] };

const inviteAcme: PendingInvitation = {
  token: "tok-acme",
  role: "member",
  organization_name: "Acme Corp",
  organization_slug: "acme",
  invited_by_email: "owner@example.com",
  expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const inviteBeta: PendingInvitation = {
  ...inviteAcme,
  token: "tok-beta",
  organization_name: "Beta LLC",
  organization_slug: "beta",
};

function setAuth(user: CurrentUser | null) {
  mockUseAuth.mockReturnValue({
    status: user ? "authenticated" : "unauthenticated",
    user,
    error: undefined,
    refreshUser: mockRefreshUser,
    setAuthenticatedUser: vi.fn(),
    markUnauthenticated: vi.fn(),
    logoutUser: vi.fn<() => Promise<void>>(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mockRefreshUser.mockResolvedValue(undefined);
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("PendingInvitationsPrompt", () => {
  it("renders nothing when unauthenticated", async () => {
    setAuth(null);
    mockList.mockResolvedValue([]);
    const { container } = render(<PendingInvitationsPrompt />);
    await waitFor(() => expect(mockList).not.toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no pending invitations", async () => {
    setAuth(userNoOrg);
    mockList.mockResolvedValue([]);
    render(<PendingInvitationsPrompt />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("auto-shows the accept modal with org name and role", async () => {
    setAuth(userNoOrg);
    mockList.mockResolvedValue([inviteAcme]);
    render(<PendingInvitationsPrompt />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
  });

  it("accepts: refreshes user, invalidates caches, selects org, and closes", async () => {
    const user = userEvent.setup();
    // First render returns the invite; after accept the auth user has the membership.
    setAuth(userNoOrg);
    mockList.mockResolvedValue([inviteAcme]);
    mockAccept.mockResolvedValue({} as never);

    const { rerender } = render(<PendingInvitationsPrompt />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Simulate refreshUser making the membership visible on the next render.
    mockRefreshUser.mockImplementation(async () => {
      setAuth(userWithAcme);
    });

    await user.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith("tok-acme"));
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
    expect(mockInvalidateCache).toHaveBeenCalledWith("offices:");
    expect(mockInvalidateCache).toHaveBeenCalledWith("summary:");

    // Re-render with the refreshed auth so the selection effect can run.
    rerender(<PendingInvitationsPrompt />);
    await waitFor(() =>
      expect(mockSetSelectedOrg).toHaveBeenCalledWith(acmeMembership.organization_id)
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a clear message and stays open when accept returns 403", async () => {
    const user = userEvent.setup();
    setAuth(userNoOrg);
    mockList.mockResolvedValue([inviteAcme]);
    mockAccept.mockRejectedValue(
      new ApiError(403, { detail: "This invitation was sent to a different email address." })
    );

    render(<PendingInvitationsPrompt />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() =>
      expect(screen.getByText(/sent to another email address/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });

  it("lists multiple invitations and accepts each independently", async () => {
    setAuth(userNoOrg);
    mockList.mockResolvedValue([inviteAcme, inviteBeta]);
    render(<PendingInvitationsPrompt />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /accept/i })).toHaveLength(2);
  });

  it("dismissing closes the modal and remembers it for the session", async () => {
    const user = userEvent.setup();
    setAuth(userNoOrg);
    mockList.mockResolvedValue([inviteAcme]);

    const { rerender } = render(<PendingInvitationsPrompt />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /maybe later/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // A subsequent mount in the same session stays closed.
    rerender(<PendingInvitationsPrompt />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

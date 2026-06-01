import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PeoplePage } from "../pages/PeoplePage";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { TeamMember, Invitation } from "../types/teams.types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../hooks/useTeamMembers", () => ({
  useTeamMembers: vi.fn(),
}));

vi.mock("../hooks/useInvitations", () => ({
  useInvitations: vi.fn(),
}));

vi.mock("@/features/profile/api/profileApi", () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

import { useTeamMembers } from "../hooks/useTeamMembers";
import { useInvitations } from "../hooks/useInvitations";

const mockUseTeamMembers = vi.mocked(useTeamMembers);
const mockUseInvitations = vi.mocked(useInvitations);
const mockUseAuth = vi.fn<() => AuthContextValue>();

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ownerMembership: MembershipInline = {
  id: 1,
  organization_id: 10,
  organization_name: "Acme Corp",
  organization_slug: "acme",
  organization_status: "active",
  role: "owner",
  status: "active",
  has_active_access: true,
};

const memberMembership: MembershipInline = { ...ownerMembership, role: "member" };

const mockUserBase: CurrentUser = {
  id: 1,
  username: "u@example.com",
  email: "u@example.com",
  full_name: "Alice",
  first_name: "Alice",
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

const ownerUser: CurrentUser = { ...mockUserBase, memberships: [ownerMembership] };
const memberUser: CurrentUser = { ...mockUserBase, memberships: [memberMembership] };
const noOrgUser: CurrentUser = { ...mockUserBase, memberships: [] };

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: ownerUser,
  error: undefined,
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn<() => Promise<void>>(),
};

const mockMember: TeamMember = {
  id: 1,
  user_id: 1,
  email: "alice@example.com",
  full_name: "Alice Admin",
  job_title: "Developer",
  avatar_url: null,
  role: "owner",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
};

const mockInvitation: Invitation = {
  id: 10,
  email: "invited@example.com",
  role: "member",
  status: "pending",
  token: "abc-token-123",
  invited_by_email: "alice@example.com",
  accepted_by_email: null,
  expires_at: "2026-06-08T00:00:00Z",
  accepted_at: null,
  created_at: "2026-06-01T00:00:00Z",
};

function defaultInvHooks() {
  mockUseTeamMembers.mockReturnValue({
    members: [mockMember],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockUseInvitations.mockReturnValue({
    invitations: [],
    loading: false,
    error: null,
    creating: false,
    createError: null,
    createInvite: vi.fn(),
    cancelInvite: vi.fn(),
    refresh: vi.fn(),
  });
}

function renderPage(user: CurrentUser = ownerUser) {
  mockUseAuth.mockReturnValue({ ...baseAuth, user });
  return render(
    <MemoryRouter>
      <PeoplePage />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PeoplePage — page structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultInvHooks();
  });

  it("renders page h1", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("People");
  });

  it("shows invite form for owner", () => {
    renderPage(ownerUser);
    expect(screen.getByText("Invite a team member")).toBeInTheDocument();
  });

  it("shows pending invitations section for owner", () => {
    renderPage(ownerUser);
    expect(screen.getByText("Pending invitations")).toBeInTheDocument();
  });

  it("shows team members section", () => {
    renderPage(ownerUser);
    expect(screen.getByText("Team members")).toBeInTheDocument();
  });
});

describe("PeoplePage — member role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultInvHooks();
  });

  it("does not show invite form for member", () => {
    renderPage(memberUser);
    expect(screen.queryByText("Invite a team member")).not.toBeInTheDocument();
  });

  it("does not show pending invitations section for member", () => {
    renderPage(memberUser);
    expect(screen.queryByText("Pending invitations")).not.toBeInTheDocument();
  });

  it("shows team members section for member", () => {
    renderPage(memberUser);
    expect(screen.getByText("Team members")).toBeInTheDocument();
  });
});

describe("PeoplePage — no org", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultInvHooks();
  });

  it("shows empty state for user with no org", () => {
    renderPage(noOrgUser);
    expect(screen.getByText("No workspace yet")).toBeInTheDocument();
  });
});

describe("PeoplePage — members list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders member email in list", () => {
    mockUseTeamMembers.mockReturnValue({
      members: [mockMember],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    mockUseInvitations.mockReturnValue({
      invitations: [],
      loading: false,
      error: null,
      creating: false,
      createError: null,
      createInvite: vi.fn(),
      cancelInvite: vi.fn(),
      refresh: vi.fn(),
    });
    renderPage();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });
});

describe("PeoplePage — pending invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pending invitation email", () => {
    mockUseTeamMembers.mockReturnValue({
      members: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    mockUseInvitations.mockReturnValue({
      invitations: [mockInvitation],
      loading: false,
      error: null,
      creating: false,
      createError: null,
      createInvite: vi.fn(),
      cancelInvite: vi.fn(),
      refresh: vi.fn(),
    });
    renderPage();
    expect(screen.getByText("invited@example.com")).toBeInTheDocument();
  });

  it("shows cancel button for pending invitation", () => {
    mockUseTeamMembers.mockReturnValue({
      members: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    mockUseInvitations.mockReturnValue({
      invitations: [mockInvitation],
      loading: false,
      error: null,
      creating: false,
      createError: null,
      createInvite: vi.fn(),
      cancelInvite: vi.fn(),
      refresh: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole("button", { name: /cancel invitation for invited@example.com/i })
    ).toBeInTheDocument();
  });
});

describe("PeoplePage — invite form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultInvHooks();
  });

  it("shows validation error for empty email on submit", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  it("shows validation error for invalid email", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByRole("textbox", { name: /email address/i }), "notanemail");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("calls createInvite with correct payload on valid submit", async () => {
    const user = userEvent.setup();
    const mockCreateInvite = vi.fn().mockResolvedValue({ id: 1 });
    mockUseInvitations.mockReturnValue({
      invitations: [],
      loading: false,
      error: null,
      creating: false,
      createError: null,
      createInvite: mockCreateInvite,
      cancelInvite: vi.fn(),
      refresh: vi.fn(),
    });
    renderPage();
    await user.type(screen.getByRole("textbox", { name: /email address/i }), "new@example.com");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => {
      expect(mockCreateInvite).toHaveBeenCalledWith({
        email: "new@example.com",
        role: "member",
      });
    });
  });
});

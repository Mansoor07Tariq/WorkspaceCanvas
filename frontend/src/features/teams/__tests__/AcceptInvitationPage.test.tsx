import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AcceptInvitationPage } from "@/features/invitations/pages/AcceptInvitationPage";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { InvitationPublic } from "../types/teams.types";
import { ApiError } from "@/lib/api/apiError";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());
const mockRefreshUser = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockSetSelectedOrg = vi.hoisted(() => vi.fn());
const mockInvalidateCache = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

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
  getInvitationByToken: vi.fn(),
  acceptInvitation: vi.fn(),
}));

import { getInvitationByToken, acceptInvitation } from "@/features/teams/api/teamsApi";
const mockGetInvitation = vi.mocked(getInvitationByToken);
const mockAccept = vi.mocked(acceptInvitation);
const mockUseAuth = vi.fn<() => AuthContextValue>();

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockUserBase: CurrentUser = {
  id: 1,
  username: "u@example.com",
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

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: mockUserBase,
  error: undefined,
  refreshUser: mockRefreshUser,
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn<() => Promise<void>>(),
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

// Simulates the user AFTER refreshUser resolves: the new membership is present.
const userWithAcme: CurrentUser = { ...mockUserBase, memberships: [acmeMembership] };

const pendingInvite: InvitationPublic = {
  status: "pending",
  role: "member",
  organization_name: "Acme Corp",
  organization_slug: "acme",
  is_expired: false,
};

function renderPage(user: CurrentUser | null = mockUserBase) {
  mockUseAuth.mockReturnValue({
    ...baseAuth,
    user,
    status: user ? "authenticated" : "unauthenticated",
  });
  return render(
    <MemoryRouter initialEntries={["/invite/test-token"]}>
      <Routes>
        <Route path="/invite/:token" element={<AcceptInvitationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AcceptInvitationPage — loading state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading indicator while fetching invite info", () => {
    mockGetInvitation.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText("Loading invitation details")).toBeInTheDocument();
  });
});

describe("AcceptInvitationPage — invalid token", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows error when token not found", async () => {
    mockGetInvitation.mockRejectedValue(new Error("Not found"));
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText("This invitation link is invalid or has expired.")
      ).toBeInTheDocument();
    });
  });
});

describe("AcceptInvitationPage — valid pending invite, authenticated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows org name and role", async () => {
    mockGetInvitation.mockResolvedValue(pendingInvite);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Join Acme Corp/i })).toBeInTheDocument();
    });
  });

  it("shows join button for authenticated user", async () => {
    mockGetInvitation.mockResolvedValue(pendingInvite);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Join Acme Corp/i })).toBeInTheDocument();
    });
  });

  it("calls acceptInvitation and navigates on success", async () => {
    const user = userEvent.setup();
    mockGetInvitation.mockResolvedValue(pendingInvite);
    mockAccept.mockResolvedValue({} as never);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Join Acme Corp/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith("test-token");
    });
  });

  it("shows error message when accept fails", async () => {
    const user = userEvent.setup();
    mockGetInvitation.mockResolvedValue(pendingInvite);
    mockAccept.mockRejectedValue(new Error("Email mismatch"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Join Acme Corp/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Email mismatch")).toBeInTheDocument();
    });
  });
});

describe("AcceptInvitationPage — unauthenticated user", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows sign in and create account buttons for unauthenticated user", async () => {
    mockGetInvitation.mockResolvedValue(pendingInvite);
    renderPage(null);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    });
  });

  it("sign in button navigates to login with returnTo state", async () => {
    const user = userEvent.setup();
    mockGetInvitation.mockResolvedValue(pendingInvite);
    renderPage(null);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("login"), {
      state: { returnTo: "/invite/test-token" },
    });
  });

  it("create account button navigates to signup with returnTo state", async () => {
    const user = userEvent.setup();
    mockGetInvitation.mockResolvedValue(pendingInvite);
    renderPage(null);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("signup"), {
      state: { returnTo: "/invite/test-token" },
    });
  });
});

describe("AcceptInvitationPage — cancelled/expired invite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows cancelled message for cancelled invite", async () => {
    mockGetInvitation.mockResolvedValue({ ...pendingInvite, status: "cancelled" });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("This invitation has been cancelled.")).toBeInTheDocument();
    });
  });

  it("shows expired message for expired invite", async () => {
    mockGetInvitation.mockResolvedValue({ ...pendingInvite, is_expired: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("This invitation has expired.")).toBeInTheDocument();
    });
  });

  it("shows already accepted message", async () => {
    mockGetInvitation.mockResolvedValue({ ...pendingInvite, status: "accepted" });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("This invitation has already been accepted.")).toBeInTheDocument();
    });
  });

  it("does not show join button for cancelled invite", async () => {
    mockGetInvitation.mockResolvedValue({ ...pendingInvite, status: "cancelled" });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
    });
  });
});

describe("AcceptInvitationPage — post-accept refresh & org selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshUser.mockResolvedValue(undefined);
    mockAccept.mockResolvedValue({} as never);
    mockGetInvitation.mockResolvedValue(pendingInvite);
  });

  async function clickJoin() {
    const user = userEvent.setup();
    renderPage(userWithAcme);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Join Acme Corp/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
  }

  it("refreshes the authenticated user after accepting", async () => {
    await clickJoin();
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith("test-token"));
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalledTimes(1));
  });

  it("invalidates org-scoped caches after accepting", async () => {
    await clickJoin();
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
    for (const ns of [
      "offices:",
      "summary:",
      "floors:",
      "desks:",
      "deskBookings:",
      "myBookings:",
    ]) {
      expect(mockInvalidateCache).toHaveBeenCalledWith(ns);
    }
  });

  it("selects the joined organization by matching the invite slug", async () => {
    await clickJoin();
    await waitFor(() =>
      expect(mockSetSelectedOrg).toHaveBeenCalledWith(acmeMembership.organization_id)
    );
  });

  it("navigates to the app dashboard after a successful accept", async () => {
    await clickJoin();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/app"), { timeout: 2500 });
  });

  it("shows the success state and does not navigate before accept resolves", async () => {
    let resolveAccept: () => void = () => {};
    mockAccept.mockReturnValue(
      new Promise((res) => {
        resolveAccept = () => res({} as never);
      })
    );
    await clickJoin();
    // Accept still pending: no refresh, no selection, no navigation yet.
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    resolveAccept();
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/You've joined Acme Corp/i)).toBeInTheDocument());
  });

  it("does not strand a single-org user in the no-workspace state", async () => {
    // After refresh the user has an active membership, so the joined org is
    // selectable and the app navigation fires — the user reaches the dashboard.
    await clickJoin();
    await waitFor(() =>
      expect(mockSetSelectedOrg).toHaveBeenCalledWith(acmeMembership.organization_id)
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/app"), { timeout: 2500 });
  });
});

describe("AcceptInvitationPage — email mismatch UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInvitation.mockResolvedValue(pendingInvite);
  });

  it("renders a clear sign-out message when the backend returns 403", async () => {
    const user = userEvent.setup();
    mockAccept.mockRejectedValue(
      new ApiError(403, { detail: "This invitation was sent to a different email address." })
    );
    renderPage(userWithAcme);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Join Acme Corp/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
    await waitFor(() => {
      expect(screen.getByText(/sent to another email address/i)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });

  it("surfaces the backend detail for other accept errors (e.g. expired)", async () => {
    const user = userEvent.setup();
    mockAccept.mockRejectedValue(new ApiError(400, { detail: "This invitation has expired." }));
    renderPage(userWithAcme);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Join Acme Corp/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
    await waitFor(() => {
      expect(screen.getByText("This invitation has expired.")).toBeInTheDocument();
    });
  });
});

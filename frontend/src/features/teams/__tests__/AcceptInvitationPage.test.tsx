import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AcceptInvitationPage } from "@/features/invitations/pages/AcceptInvitationPage";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser } from "@/features/auth/types/auth.types";
import type { InvitationPublic } from "../types/teams.types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
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
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn<() => Promise<void>>(),
};

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

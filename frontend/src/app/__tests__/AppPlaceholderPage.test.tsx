import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppPlaceholderPage } from "../pages/AppPlaceholderPage";
import { updateProfile } from "@/features/profile/api/profileApi";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser } from "@/features/auth/types/auth.types";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogoutUser = vi.fn<() => Promise<void>>();
const mockSetAuthenticatedUser = vi.fn();
const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/features/profile/api/profileApi", () => ({
  updateProfile: vi.fn(),
}));

const mockUpdateProfile = vi.mocked(updateProfile);

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

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: mockUser,
  error: undefined,
  refreshUser: vi.fn(),
  setAuthenticatedUser: mockSetAuthenticatedUser,
  markUnauthenticated: vi.fn(),
  logoutUser: mockLogoutUser,
};

function renderPage(overrides: Partial<AuthContextValue> = {}) {
  mockUseAuth.mockReturnValue({ ...baseAuth, ...overrides });
  return render(
    <MemoryRouter>
      <AppPlaceholderPage />
    </MemoryRouter>
  );
}

describe("AppPlaceholderPage — app shell", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the WorkspaceCanvas brand in the header", () => {
    renderPage();
    expect(screen.getByText(en.app.shell.brand)).toBeInTheDocument();
  });

  it("renders the current user email in the header", () => {
    renderPage();
    expect(screen.getAllByText(mockUser.email).length).toBeGreaterThan(0);
  });

  it("renders the logout button in the header", () => {
    renderPage();
    expect(screen.getByRole("button", { name: en.app.shell.logout })).toBeInTheDocument();
  });

  it("calls logoutUser and navigates to /login when logout is clicked", async () => {
    const user = userEvent.setup();
    mockLogoutUser.mockResolvedValueOnce(undefined);
    renderPage();
    await user.click(screen.getByRole("button", { name: en.app.shell.logout }));
    await waitFor(() => {
      expect(mockLogoutUser).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.login);
    });
  });
});

describe("AppPlaceholderPage — profile setup card", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the profile setup card when profile is not completed", () => {
    renderPage({ user: { ...mockUser, is_profile_completed: false } });
    expect(screen.getByText(en.app.profile.setupTitle)).toBeInTheDocument();
  });

  it("does not show the dashboard when profile is not completed", () => {
    renderPage({ user: { ...mockUser, is_profile_completed: false } });
    expect(screen.queryByText(en.app.placeholder.title)).not.toBeInTheDocument();
  });

  it("shows the full name field in the setup card", () => {
    renderPage({ user: { ...mockUser, is_profile_completed: false } });
    expect(screen.getByLabelText(en.app.profile.fullName)).toBeInTheDocument();
  });

  it("shows the save button in the setup card", () => {
    renderPage({ user: { ...mockUser, is_profile_completed: false } });
    expect(screen.getByRole("button", { name: en.app.profile.saveButton })).toBeInTheDocument();
  });

  it("sidebar product items are disabled when profile is incomplete", () => {
    renderPage({ user: { ...mockUser, is_profile_completed: false } });
    expect(screen.getByRole("button", { name: en.app.sidebar.offices })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: en.app.sidebar.people })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("unlocks sidebar and shows dashboard after profile is saved", async () => {
    const user = userEvent.setup();
    const completedUser = { ...mockUser, is_profile_completed: true };
    mockUpdateProfile.mockResolvedValueOnce(completedUser);

    const { rerender } = renderPage({ user: { ...mockUser, is_profile_completed: false } });

    expect(screen.getByRole("button", { name: en.app.sidebar.offices })).toHaveAttribute(
      "aria-disabled",
      "true"
    );

    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));

    await waitFor(() => {
      expect(mockSetAuthenticatedUser).toHaveBeenCalledWith(completedUser);
    });

    // Simulate AuthContext updating with the completed user
    mockUseAuth.mockReturnValue({ ...baseAuth, user: completedUser });
    rerender(
      <MemoryRouter>
        <AppPlaceholderPage />
      </MemoryRouter>
    );

    expect(screen.queryByText(en.app.profile.setupTitle)).not.toBeInTheDocument();
    expect(screen.getByText(en.app.placeholder.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.app.sidebar.offices })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: en.app.sidebar.people })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});

describe("AppPlaceholderPage — dashboard content", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the welcome title when profile is completed", () => {
    renderPage();
    expect(screen.getByText(en.app.placeholder.title)).toBeInTheDocument();
  });

  it("renders the subtitle when profile is completed", () => {
    renderPage();
    expect(screen.getByText(en.app.placeholder.subtitle)).toBeInTheDocument();
  });

  it("renders user email in the info card", () => {
    renderPage();
    expect(screen.getByText(en.app.placeholder.email)).toBeInTheDocument();
  });

  it("renders full name when user has one", () => {
    renderPage();
    expect(screen.getByText(mockUser.full_name)).toBeInTheDocument();
  });

  it("renders organizations count", () => {
    renderPage();
    expect(screen.getByText(en.app.placeholder.organizations)).toBeInTheDocument();
  });

  it("shows no-organization empty state when memberships is empty", () => {
    renderPage();
    expect(screen.getByText(en.app.placeholder.noOrganizationsTitle)).toBeInTheDocument();
    expect(screen.getByText(en.app.placeholder.noOrganizationsMessage)).toBeInTheDocument();
  });

  it("does not show empty state when user has memberships", () => {
    renderPage({
      user: {
        ...mockUser,
        memberships: [
          {
            id: 1,
            organization_id: 10,
            organization_name: "Acme Corp",
            organization_slug: "acme",
            organization_status: "active",
            role: "admin",
            status: "active",
            has_active_access: true,
          },
        ],
      },
    });
    expect(screen.queryByText(en.app.placeholder.noOrganizationsTitle)).not.toBeInTheDocument();
  });

  it("does not render user info block when user is null", () => {
    renderPage({ user: null });
    expect(screen.queryByText(en.app.placeholder.email)).not.toBeInTheDocument();
  });

  it("does not show profile setup card when profile is completed", () => {
    renderPage();
    expect(screen.queryByText(en.app.profile.setupTitle)).not.toBeInTheDocument();
  });

  it("sidebar product items are enabled when profile is completed", () => {
    renderPage();
    expect(screen.getByRole("button", { name: en.app.sidebar.offices })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: en.app.sidebar.people })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});

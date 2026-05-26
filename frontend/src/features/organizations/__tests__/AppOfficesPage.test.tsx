import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppOfficesPage } from "@/app/pages/AppOfficesPage";
import type { CurrentUser } from "@/features/auth/types/auth.types";
import type { AuthContextValue } from "@/features/auth/types/authState.types";

let capturedOnCreated: (() => void) | null = null;

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/organizations/components/OrganizationSetupFlow", () => ({
  OrganizationSetupFlow: ({ onCreated }: { onCreated: () => void }) => {
    capturedOnCreated = onCreated;
    return <div data-testid="org-setup-flow">Setup Flow</div>;
  },
}));

vi.mock("@/features/organizations/components/OfficesEmptyState", () => ({
  OfficesEmptyState: () => <div data-testid="offices-empty-state">Empty State</div>,
}));

import { useAuth } from "@/features/auth/context/AuthContext";

const mockUseAuth = vi.mocked(useAuth);

function makeAuthValue(user: CurrentUser | null): AuthContextValue {
  return {
    status: user ? "authenticated" : "unauthenticated",
    user,
    refreshUser: vi.fn().mockResolvedValue(undefined),
    setAuthenticatedUser: vi.fn(),
    markUnauthenticated: vi.fn(),
    logoutUser: vi.fn().mockResolvedValue(undefined),
  };
}

function makeUser(hasActive: boolean): CurrentUser {
  return {
    id: 1,
    username: "user@example.com",
    email: "user@example.com",
    full_name: "Test User",
    first_name: "Test",
    last_name: "User",
    avatar: null,
    phone_number: "",
    job_title: "",
    timezone: "UTC",
    locale: "en",
    is_profile_completed: true,
    email_verified: true,
    preferred_auth_provider: "email",
    mfa_enabled: false,
    memberships: hasActive
      ? [
          {
            id: 1,
            organization_id: 1,
            organization_name: "Acme",
            organization_slug: "acme",
            organization_status: "active",
            role: "owner",
            status: "active",
            has_active_access: true,
          },
        ]
      : [],
  };
}

describe("AppOfficesPage", () => {
  beforeEach(() => {
    capturedOnCreated = null;
    vi.clearAllMocks();
  });

  it("shows setup flow when user has no active membership", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(false)));

    render(<AppOfficesPage />);

    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("offices-empty-state")).not.toBeInTheDocument();
  });

  it("shows empty state when user has an active membership", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(true)));

    render(<AppOfficesPage />);

    expect(screen.getByTestId("offices-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("org-setup-flow")).not.toBeInTheDocument();
  });

  it("shows setup flow when user is null", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(null));

    render(<AppOfficesPage />);

    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
  });

  it("shows empty state immediately after onCreated fires without waiting for refreshUser", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(false)));

    render(<AppOfficesPage />);
    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();

    act(() => {
      capturedOnCreated!();
    });

    expect(screen.getByTestId("offices-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("org-setup-flow")).not.toBeInTheDocument();
  });
});

import { render, screen, act, fireEvent } from "@testing-library/react";
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

vi.mock("@/features/offices/components/OfficesEmptyState", () => ({
  OfficesEmptyState: ({ onAddOffice }: { onAddOffice: () => void }) => (
    <div data-testid="offices-empty-state">
      <button onClick={onAddOffice}>Add office</button>
    </div>
  ),
}));

vi.mock("@/features/offices/components/OfficeCreationFlow", () => ({
  OfficeCreationFlow: ({ onCreated }: { onCreated: (office: unknown) => void }) => (
    <div data-testid="office-creation-flow">
      <button onClick={() => onCreated({ id: 1, name: "Dublin" })}>Submit</button>
    </div>
  ),
}));

vi.mock("@/features/offices/components/OfficesList", () => ({
  OfficesList: () => <div data-testid="offices-list">List</div>,
}));

vi.mock("@/features/offices/hooks/useOffices", () => ({
  useOffices: vi.fn(),
}));

import { useAuth } from "@/features/auth/context/AuthContext";
import { useOffices } from "@/features/offices/hooks/useOffices";

const mockUseAuth = vi.mocked(useAuth);
const mockUseOffices = vi.mocked(useOffices);

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
    mockUseOffices.mockReturnValue({
      offices: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("shows setup flow when user has no active membership", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(false)));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("offices-empty-state")).not.toBeInTheDocument();
  });

  it("shows empty state when user has active membership and no offices", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(true)));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("offices-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("org-setup-flow")).not.toBeInTheDocument();
  });

  it("shows offices list when offices exist", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(true)));
    mockUseOffices.mockReturnValue({
      offices: [
        {
          id: 1,
          name: "Dublin",
          slug: "dublin",
          address_line_1: "",
          address_line_2: "",
          city: "",
          county_or_state: "",
          country: "",
          timezone: "",
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    render(<AppOfficesPage />);
    expect(screen.getByTestId("offices-list")).toBeInTheDocument();
    expect(screen.queryByTestId("offices-empty-state")).not.toBeInTheDocument();
  });

  it("shows setup flow when user is null", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(null));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
  });

  it("shows empty state immediately after onCreated fires (orgJustCreated guard)", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(false)));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
    act(() => {
      capturedOnCreated!();
    });
    expect(screen.getByTestId("offices-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("org-setup-flow")).not.toBeInTheDocument();
  });

  it("shows creation flow when add office is clicked", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(true)));
    render(<AppOfficesPage />);
    fireEvent.click(screen.getByRole("button", { name: /add office/i }));
    expect(screen.getByTestId("office-creation-flow")).toBeInTheDocument();
  });
});

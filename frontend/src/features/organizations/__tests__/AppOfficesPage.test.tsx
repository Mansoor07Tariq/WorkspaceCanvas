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
  OfficesEmptyState: ({
    canManage,
    onAddOffice,
  }: {
    canManage?: boolean;
    onAddOffice: () => void;
  }) => (
    <div data-testid="offices-empty-state" data-can-manage={canManage ? "true" : "false"}>
      {canManage && <button onClick={onAddOffice}>Add office</button>}
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
  OfficesList: ({ canManage }: { canManage?: boolean }) => (
    <div data-testid="offices-list" data-can-manage={canManage ? "true" : "false"}>
      List
    </div>
  ),
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

function makeUser(role: "owner" | "admin" | "member" | null): CurrentUser {
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
    memberships:
      role !== null
        ? [
            {
              id: 1,
              organization_id: 1,
              organization_name: "Acme",
              organization_slug: "acme",
              organization_status: "active",
              role,
              status: "active",
              has_active_access: true,
            },
          ]
        : [],
  };
}

const officeFixture = {
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
};

describe("AppOfficesPage — no org", () => {
  beforeEach(() => {
    capturedOnCreated = null;
    vi.clearAllMocks();
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
  });

  it("shows setup flow when user has no active membership", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(null)));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("offices-empty-state")).not.toBeInTheDocument();
  });

  it("shows setup flow when user is null", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(null));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
  });

  it("shows empty state immediately after onCreated fires (orgJustCreated guard)", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser(null)));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("org-setup-flow")).toBeInTheDocument();
    act(() => {
      capturedOnCreated!();
    });
    expect(screen.getByTestId("offices-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("org-setup-flow")).not.toBeInTheDocument();
  });
});

describe("AppOfficesPage — admin role", () => {
  beforeEach(() => {
    capturedOnCreated = null;
    vi.clearAllMocks();
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
  });

  it("shows empty state with canManage=true when admin has no offices", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("admin")));
    render(<AppOfficesPage />);
    const state = screen.getByTestId("offices-empty-state");
    expect(state).toBeInTheDocument();
    expect(state).toHaveAttribute("data-can-manage", "true");
  });

  it("shows Add Office button for admin when no offices", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("admin")));
    render(<AppOfficesPage />);
    expect(screen.getByRole("button", { name: /add office/i })).toBeInTheDocument();
  });

  it("shows offices list with canManage=true for admin when offices exist", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("admin")));
    mockUseOffices.mockReturnValue({
      offices: [officeFixture],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    render(<AppOfficesPage />);
    const list = screen.getByTestId("offices-list");
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute("data-can-manage", "true");
  });

  it("shows creation flow when admin clicks Add office", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("admin")));
    render(<AppOfficesPage />);
    fireEvent.click(screen.getByRole("button", { name: /add office/i }));
    expect(screen.getByTestId("office-creation-flow")).toBeInTheDocument();
  });
});

describe("AppOfficesPage — owner role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
  });

  it("shows empty state with canManage=true for owner", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("owner")));
    render(<AppOfficesPage />);
    expect(screen.getByTestId("offices-empty-state")).toHaveAttribute("data-can-manage", "true");
  });
});

describe("AppOfficesPage — member role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffices.mockReturnValue({ offices: [], loading: false, error: null, refresh: vi.fn() });
  });

  it("shows empty state with canManage=false for member when no offices", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("member")));
    render(<AppOfficesPage />);
    const state = screen.getByTestId("offices-empty-state");
    expect(state).toBeInTheDocument();
    expect(state).toHaveAttribute("data-can-manage", "false");
  });

  it("does not show Add Office button for member when no offices", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("member")));
    render(<AppOfficesPage />);
    expect(screen.queryByRole("button", { name: /add office/i })).not.toBeInTheDocument();
  });

  it("shows offices list with canManage=false for member when offices exist", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("member")));
    mockUseOffices.mockReturnValue({
      offices: [officeFixture],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    render(<AppOfficesPage />);
    const list = screen.getByTestId("offices-list");
    expect(list).toHaveAttribute("data-can-manage", "false");
  });

  it("does not show creation flow for member", () => {
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser("member")));
    render(<AppOfficesPage />);
    // No add button visible, no creation flow
    expect(screen.queryByTestId("office-creation-flow")).not.toBeInTheDocument();
  });
});

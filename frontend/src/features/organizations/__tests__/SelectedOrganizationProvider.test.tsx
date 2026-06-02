import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  SelectedOrganizationProvider,
  useSelectedOrganization,
} from "../context/SelectedOrganizationProvider";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";

const mockUseAuth = vi.fn<() => AuthContextValue>();
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function membership(
  orgId: number,
  name: string,
  over: Partial<MembershipInline> = {}
): MembershipInline {
  return {
    id: orgId,
    organization_id: orgId,
    organization_name: name,
    organization_slug: name.toLowerCase(),
    organization_status: "active",
    role: "owner",
    status: "active",
    has_active_access: true,
    ...over,
  };
}

function makeUser(memberships: MembershipInline[]): CurrentUser {
  return {
    id: 1,
    username: "u@e.com",
    email: "u@e.com",
    full_name: "U E",
    first_name: "U",
    last_name: "E",
    avatar: null,
    phone_number: "",
    job_title: "",
    timezone: "UTC",
    locale: "en",
    is_profile_completed: true,
    email_verified: true,
    preferred_auth_provider: "email",
    mfa_enabled: false,
    memberships,
  };
}

function setUser(user: CurrentUser | null) {
  mockUseAuth.mockReturnValue({
    status: "authenticated",
    user,
    error: undefined,
    refreshUser: vi.fn(),
    setAuthenticatedUser: vi.fn(),
    markUnauthenticated: vi.fn(),
    logoutUser: vi.fn(),
  });
}

// Probe component that surfaces context values + a switch button.
function Probe() {
  const ctx = useSelectedOrganization();
  return (
    <div>
      <span data-testid="selected-id">{ctx.selectedOrganizationId ?? "none"}</span>
      <span data-testid="selected-name">{ctx.selectedOrganizationName ?? "none"}</span>
      <span data-testid="multi">{String(ctx.hasMultipleOrganizations)}</span>
      <span data-testid="role">{ctx.selectedMembership?.role ?? "none"}</span>
      <button onClick={() => ctx.setSelectedOrganizationId(20)}>switch-to-20</button>
      <button onClick={() => ctx.setSelectedOrganizationId(999)}>switch-to-invalid</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <SelectedOrganizationProvider>
      <Probe />
    </SelectedOrganizationProvider>
  );
}

describe("SelectedOrganizationProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("defaults to the first active membership for a single-org user", () => {
    setUser(makeUser([membership(10, "Acme")]));
    renderWithProvider();
    expect(screen.getByTestId("selected-id")).toHaveTextContent("10");
    expect(screen.getByTestId("selected-name")).toHaveTextContent("Acme");
    expect(screen.getByTestId("multi")).toHaveTextContent("false");
  });

  it("reports multiple organizations when there is more than one active membership", () => {
    setUser(makeUser([membership(10, "Acme"), membership(20, "Zephyr")]));
    renderWithProvider();
    expect(screen.getByTestId("multi")).toHaveTextContent("true");
  });

  it("switches the selected organization and persists it", () => {
    setUser(makeUser([membership(10, "Acme"), membership(20, "Zephyr", { role: "member" })]));
    renderWithProvider();
    expect(screen.getByTestId("selected-id")).toHaveTextContent("10");

    act(() => {
      screen.getByText("switch-to-20").click();
    });
    expect(screen.getByTestId("selected-id")).toHaveTextContent("20");
    expect(screen.getByTestId("selected-name")).toHaveTextContent("Zephyr");
    // selectedMembership reflects the per-org role
    expect(screen.getByTestId("role")).toHaveTextContent("member");
    expect(window.localStorage.getItem("wc.selectedOrganizationId")).toBe("20");
  });

  it("ignores a switch to an org the user is not an active member of", () => {
    setUser(makeUser([membership(10, "Acme")]));
    renderWithProvider();
    act(() => {
      screen.getByText("switch-to-invalid").click();
    });
    expect(screen.getByTestId("selected-id")).toHaveTextContent("10");
  });

  it("restores a valid persisted selection on mount", () => {
    window.localStorage.setItem("wc.selectedOrganizationId", "20");
    setUser(makeUser([membership(10, "Acme"), membership(20, "Zephyr")]));
    renderWithProvider();
    expect(screen.getByTestId("selected-id")).toHaveTextContent("20");
  });

  it("falls back to first active when the persisted org is no longer a membership", () => {
    window.localStorage.setItem("wc.selectedOrganizationId", "999");
    setUser(makeUser([membership(10, "Acme")]));
    renderWithProvider();
    expect(screen.getByTestId("selected-id")).toHaveTextContent("10");
  });

  it("ignores disabled memberships", () => {
    setUser(
      makeUser([
        membership(10, "Acme"),
        membership(20, "Zephyr", { has_active_access: false, status: "disabled" }),
      ])
    );
    renderWithProvider();
    expect(screen.getByTestId("multi")).toHaveTextContent("false");
  });

  it("no active membership → null selection", () => {
    setUser(makeUser([]));
    renderWithProvider();
    expect(screen.getByTestId("selected-id")).toHaveTextContent("none");
  });

  it("fallback (no provider) derives from the first active membership", () => {
    setUser(makeUser([membership(10, "Acme")]));
    render(<Probe />);
    expect(screen.getByTestId("selected-id")).toHaveTextContent("10");
    expect(screen.getByTestId("multi")).toHaveTextContent("false");
  });
});

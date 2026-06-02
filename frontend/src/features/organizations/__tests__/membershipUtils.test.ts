import { describe, it, expect } from "vitest";
import {
  canManageWorkspaceContent,
  hasActiveMembership,
  canManageOfficeSetup,
  canManageFloorLayout,
  canInviteMembers,
  canBookDesk,
  isActiveMembership,
  getMembershipForOrganization,
} from "../utils/membershipUtils";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
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
    memberships: [],
    ...overrides,
  };
}

function makeMembership(overrides: Partial<MembershipInline> = {}): MembershipInline {
  return {
    id: 1,
    organization_id: 1,
    organization_name: "Acme",
    organization_slug: "acme",
    organization_status: "active",
    role: "owner",
    status: "active",
    has_active_access: true,
    ...overrides,
  };
}

describe("canManageWorkspaceContent", () => {
  it("returns true for owner role", () => {
    expect(canManageWorkspaceContent("owner")).toBe(true);
  });

  it("returns true for admin role", () => {
    expect(canManageWorkspaceContent("admin")).toBe(true);
  });

  it("returns false for member role", () => {
    expect(canManageWorkspaceContent("member")).toBe(false);
  });

  it("returns false for undefined role", () => {
    expect(canManageWorkspaceContent(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(canManageWorkspaceContent("")).toBe(false);
  });

  it("returns false for unknown role string", () => {
    expect(canManageWorkspaceContent("superadmin")).toBe(false);
  });
});

describe("hasActiveMembership", () => {
  it("returns false for null user", () => {
    expect(hasActiveMembership(null)).toBe(false);
  });

  it("returns false when memberships array is empty", () => {
    expect(hasActiveMembership(makeUser({ memberships: [] }))).toBe(false);
  });

  it("returns false when all memberships have has_active_access=false", () => {
    const user = makeUser({
      memberships: [makeMembership({ has_active_access: false })],
    });
    expect(hasActiveMembership(user)).toBe(false);
  });

  it("returns true when at least one membership has has_active_access=true", () => {
    const user = makeUser({
      memberships: [makeMembership({ has_active_access: true })],
    });
    expect(hasActiveMembership(user)).toBe(true);
  });

  it("returns true when mixed memberships and one is active", () => {
    const user = makeUser({
      memberships: [
        makeMembership({ id: 1, organization_id: 1, has_active_access: false }),
        makeMembership({ id: 2, organization_id: 2, has_active_access: true }),
      ],
    });
    expect(hasActiveMembership(user)).toBe(true);
  });
});

describe("canManageOfficeSetup", () => {
  it("returns true for owner", () => expect(canManageOfficeSetup("owner")).toBe(true));
  it("returns true for admin", () => expect(canManageOfficeSetup("admin")).toBe(true));
  it("returns false for member", () => expect(canManageOfficeSetup("member")).toBe(false));
  it("returns false for undefined", () => expect(canManageOfficeSetup(undefined)).toBe(false));
});

describe("canManageFloorLayout", () => {
  it("returns true for owner", () => expect(canManageFloorLayout("owner")).toBe(true));
  it("returns true for admin", () => expect(canManageFloorLayout("admin")).toBe(true));
  it("returns false for member", () => expect(canManageFloorLayout("member")).toBe(false));
  it("returns false for undefined", () => expect(canManageFloorLayout(undefined)).toBe(false));
});

describe("canInviteMembers", () => {
  it("returns true for owner", () => expect(canInviteMembers("owner")).toBe(true));
  it("returns true for admin", () => expect(canInviteMembers("admin")).toBe(true));
  it("returns false for member", () => expect(canInviteMembers("member")).toBe(false));
  it("returns false for undefined", () => expect(canInviteMembers(undefined)).toBe(false));
});

describe("canBookDesk", () => {
  it("returns true when membership has_active_access is true", () => {
    expect(canBookDesk(makeMembership({ has_active_access: true }))).toBe(true);
  });

  it("returns false when membership has_active_access is false", () => {
    expect(canBookDesk(makeMembership({ has_active_access: false }))).toBe(false);
  });

  it("returns false for null membership", () => {
    expect(canBookDesk(null)).toBe(false);
  });

  it("returns false for undefined membership", () => {
    expect(canBookDesk(undefined)).toBe(false);
  });
});

describe("isActiveMembership", () => {
  it("returns true when membership has_active_access is true", () => {
    expect(isActiveMembership(makeMembership({ has_active_access: true }))).toBe(true);
  });

  it("returns false when membership has_active_access is false", () => {
    expect(isActiveMembership(makeMembership({ has_active_access: false }))).toBe(false);
  });

  it("returns false for null", () => {
    expect(isActiveMembership(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isActiveMembership(undefined)).toBe(false);
  });
});

describe("getMembershipForOrganization (TD-045)", () => {
  const orgA = makeMembership({ id: 1, organization_id: 10, role: "admin" });
  const orgB = makeMembership({ id: 2, organization_id: 20, role: "member" });
  const memberships = [orgA, orgB];

  it("returns the membership matching the organization id", () => {
    expect(getMembershipForOrganization(memberships, 20)).toBe(orgB);
    expect(getMembershipForOrganization(memberships, 10)).toBe(orgA);
  });

  it("does not just return the first membership (per-org resolution)", () => {
    // Regression for TD-045: previously the first active membership (org A admin)
    // was used regardless of which org's office was viewed.
    expect(getMembershipForOrganization(memberships, 20)?.role).toBe("member");
  });

  it("returns null when no active membership exists for the org", () => {
    expect(getMembershipForOrganization(memberships, 999)).toBeNull();
  });

  it("ignores disabled memberships for the org", () => {
    const disabled = makeMembership({ organization_id: 30, has_active_access: false });
    expect(getMembershipForOrganization([disabled], 30)).toBeNull();
  });

  it("returns null when organization id is null or undefined", () => {
    expect(getMembershipForOrganization(memberships, null)).toBeNull();
    expect(getMembershipForOrganization(memberships, undefined)).toBeNull();
  });
});

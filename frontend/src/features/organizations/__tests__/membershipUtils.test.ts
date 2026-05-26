import { describe, it, expect } from "vitest";
import { hasActiveMembership } from "../utils/membershipUtils";
import type { CurrentUser } from "@/features/auth/types/auth.types";

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

describe("hasActiveMembership", () => {
  it("returns false for null user", () => {
    expect(hasActiveMembership(null)).toBe(false);
  });

  it("returns false when memberships array is empty", () => {
    expect(hasActiveMembership(makeUser({ memberships: [] }))).toBe(false);
  });

  it("returns false when all memberships have has_active_access=false", () => {
    const user = makeUser({
      memberships: [
        {
          id: 1,
          organization_id: 1,
          organization_name: "Acme",
          organization_slug: "acme",
          organization_status: "active",
          role: "owner",
          status: "active",
          has_active_access: false,
        },
      ],
    });
    expect(hasActiveMembership(user)).toBe(false);
  });

  it("returns true when at least one membership has has_active_access=true", () => {
    const user = makeUser({
      memberships: [
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
      ],
    });
    expect(hasActiveMembership(user)).toBe(true);
  });

  it("returns true when mixed memberships and one is active", () => {
    const user = makeUser({
      memberships: [
        {
          id: 1,
          organization_id: 1,
          organization_name: "Org1",
          organization_slug: "org1",
          organization_status: "inactive",
          role: "member",
          status: "inactive",
          has_active_access: false,
        },
        {
          id: 2,
          organization_id: 2,
          organization_name: "Org2",
          organization_slug: "org2",
          organization_status: "active",
          role: "owner",
          status: "active",
          has_active_access: true,
        },
      ],
    });
    expect(hasActiveMembership(user)).toBe(true);
  });
});

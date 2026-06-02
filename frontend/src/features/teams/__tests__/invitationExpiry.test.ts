import { describe, it, expect } from "vitest";
import { formatInvitationExpiry } from "../utils/invitationExpiry";

const NOW = new Date("2026-06-02T12:00:00Z");

describe("formatInvitationExpiry", () => {
  it("returns Expired for a past date", () => {
    const result = formatInvitationExpiry("2026-06-01T12:00:00Z", NOW);
    expect(result.expired).toBe(true);
    expect(result.label).toBe("Expired");
  });

  it("returns 'Expires in N days' for a future date", () => {
    const result = formatInvitationExpiry("2026-06-08T12:00:00Z", NOW);
    expect(result.expired).toBe(false);
    expect(result.label).toBe("Expires in 6 days");
  });

  it("returns 'Expires tomorrow' for next day", () => {
    const result = formatInvitationExpiry("2026-06-03T12:00:00Z", NOW);
    expect(result.label).toBe("Expires tomorrow");
  });

  it("handles null expiry", () => {
    const result = formatInvitationExpiry(null, NOW);
    expect(result.expired).toBe(false);
    expect(result.label).toBe("No expiry");
  });

  it("handles an invalid date string without crashing", () => {
    const result = formatInvitationExpiry("not-a-date", NOW);
    expect(result.label).toBe("No expiry");
  });
});

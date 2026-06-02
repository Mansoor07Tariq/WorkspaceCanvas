import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../api/teamsApi", () => ({
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  resendInvitation: vi.fn(),
}));

import { listInvitations, resendInvitation } from "../api/teamsApi";
import { useInvitations } from "../hooks/useInvitations";
import type { Invitation } from "../types/teams.types";

const mockList = vi.mocked(listInvitations);
const mockResend = vi.mocked(resendInvitation);

const invitation: Invitation = {
  id: 1,
  email: "guest@example.com",
  role: "member",
  status: "pending",
  token: "old-token",
  invited_by_email: "owner@example.com",
  accepted_by_email: null,
  expires_at: "2026-06-08T00:00:00Z",
  accepted_at: null,
  created_at: "2026-06-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useInvitations resend", () => {
  it("exposes a resendInvite action", async () => {
    mockList.mockResolvedValueOnce([invitation]);
    const { result } = renderHook(() => useInvitations(10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.resendInvite).toBe("function");
  });

  it("updates the invitation row with the refreshed token/expiry on success", async () => {
    mockList.mockResolvedValueOnce([invitation]);
    const refreshed: Invitation = {
      ...invitation,
      token: "new-token",
      expires_at: "2026-06-15T00:00:00Z",
    };
    mockResend.mockResolvedValueOnce(refreshed);

    const { result } = renderHook(() => useInvitations(10));
    await waitFor(() => expect(result.current.invitations).toHaveLength(1));

    await act(async () => {
      await result.current.resendInvite(1);
    });

    expect(mockResend).toHaveBeenCalledWith(10, 1);
    expect(result.current.invitations[0].token).toBe("new-token");
    expect(result.current.invitations[0].expires_at).toBe("2026-06-15T00:00:00Z");
    expect(result.current.resendingId).toBeNull();
  });

  it("rethrows and clears resendingId on error", async () => {
    mockList.mockResolvedValueOnce([invitation]);
    mockResend.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useInvitations(10));
    await waitFor(() => expect(result.current.invitations).toHaveLength(1));

    await act(async () => {
      await expect(result.current.resendInvite(1)).rejects.toThrow("boom");
    });

    expect(result.current.resendingId).toBeNull();
    // Row unchanged.
    expect(result.current.invitations[0].token).toBe("old-token");
  });
});

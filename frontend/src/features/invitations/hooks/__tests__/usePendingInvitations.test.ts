import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePendingInvitations } from "../usePendingInvitations";
import type { PendingInvitation } from "@/features/teams/types/teams.types";

vi.mock("@/features/teams/api/teamsApi", () => ({
  listMyPendingInvitations: vi.fn(),
}));

import { listMyPendingInvitations } from "@/features/teams/api/teamsApi";
const mockList = vi.mocked(listMyPendingInvitations);

const invite: PendingInvitation = {
  token: "tok-1",
  role: "member",
  organization_name: "Acme Corp",
  organization_slug: "acme",
  invited_by_email: "owner@example.com",
  expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => vi.clearAllMocks());

describe("usePendingInvitations", () => {
  it("fetches pending invitations when enabled", async () => {
    mockList.mockResolvedValueOnce([invite]);
    const { result } = renderHook(() => usePendingInvitations(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invitations).toEqual([invite]);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => usePendingInvitations(false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invitations).toEqual([]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("resolves to an empty list when the lookup fails", async () => {
    mockList.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => usePendingInvitations(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invitations).toEqual([]);
  });

  it("removes an invitation locally without refetching", async () => {
    mockList.mockResolvedValueOnce([invite, { ...invite, token: "tok-2" }]);
    const { result } = renderHook(() => usePendingInvitations(true));
    await waitFor(() => expect(result.current.invitations).toHaveLength(2));
    result.current.remove("tok-1");
    await waitFor(() => expect(result.current.invitations.map((i) => i.token)).toEqual(["tok-2"]));
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

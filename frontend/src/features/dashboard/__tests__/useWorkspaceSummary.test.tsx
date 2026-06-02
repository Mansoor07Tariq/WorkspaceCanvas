import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { WorkspaceSummary } from "../types/dashboard.types";

vi.mock("../api/dashboardApi", () => ({
  getWorkspaceSummary: vi.fn(),
}));

import { getWorkspaceSummary } from "../api/dashboardApi";
import { useWorkspaceSummary } from "../hooks/useWorkspaceSummary";

const mockGet = vi.mocked(getWorkspaceSummary);

function makeSummary(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
  return {
    organization: 10,
    offices_count: 2,
    floors_count: 3,
    layout_objects_count: 12,
    bookable_desks_count: 5,
    active_members_count: 4,
    pending_invitations_count: 1,
    has_offices: true,
    has_floors: true,
    has_layout_objects: true,
    has_bookable_desks: true,
    setup_complete: true,
    ...overrides,
  };
}

describe("useWorkspaceSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not fetch when orgId is null", () => {
    const { result } = renderHook(() => useWorkspaceSummary(null));
    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetches and returns the summary when orgId is set", async () => {
    mockGet.mockResolvedValue(makeSummary({ offices_count: 7 }));
    const { result } = renderHook(() => useWorkspaceSummary(10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary?.offices_count).toBe(7);
    expect(result.current.error).toBeNull();
  });

  it("sets an error message when the request fails", async () => {
    mockGet.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useWorkspaceSummary(10));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBe("Failed to load workspace overview.");
  });
});

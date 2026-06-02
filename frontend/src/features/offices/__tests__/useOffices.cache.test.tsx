import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { clearRequestCache, invalidateCache } from "@/lib/api/requestCache";
import type { Office } from "../types/office.types";

vi.mock("../api/officeApi", async () => {
  const actual = await vi.importActual<typeof import("../api/officeApi")>("../api/officeApi");
  return { ...actual, listOffices: vi.fn() };
});

import { listOffices } from "../api/officeApi";
import { useOffices } from "../hooks/useOffices";

const mockList = vi.mocked(listOffices);

function office(id: number, name: string): Office {
  return {
    id,
    organization: 1,
    name,
    slug: name.toLowerCase(),
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
}

describe("useOffices caching (TD-021)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRequestCache();
  });

  it("fetches on first mount", async () => {
    mockList.mockResolvedValue([office(1, "HQ")]);
    const { result } = renderHook(() => useOffices(5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(result.current.offices).toHaveLength(1);
  });

  it("second mount with same org uses the cache (no refetch, no loading flicker)", async () => {
    mockList.mockResolvedValue([office(1, "HQ")]);
    const first = renderHook(() => useOffices(5));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    const second = renderHook(() => useOffices(5));
    // Cache hit → data available immediately, no second network call.
    expect(second.result.current.offices).toHaveLength(1);
    expect(second.result.current.loading).toBe(false);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("explicit refresh bypasses the cache", async () => {
    mockList.mockResolvedValue([office(1, "HQ")]);
    const { result } = renderHook(() => useOffices(5));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it("invalidating the offices namespace (as createOffice does) forces a refetch on next mount", async () => {
    mockList.mockResolvedValue([office(1, "HQ")]);
    const first = renderHook(() => useOffices(5));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    // createOffice() calls invalidateCache("offices:") after a successful POST.
    invalidateCache("offices:");

    const second = renderHook(() => useOffices(5));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(mockList).toHaveBeenCalledTimes(2); // cache busted → refetch
  });

  it("different orgs use separate cache keys (no cross-org bleed)", async () => {
    mockList.mockImplementation((orgId?: number | null) =>
      Promise.resolve(orgId === 5 ? [office(1, "OrgFive")] : [office(9, "OrgNine")])
    );

    const five = renderHook(() => useOffices(5));
    await waitFor(() => expect(five.result.current.loading).toBe(false));
    expect(five.result.current.offices[0].name).toBe("OrgFive");
    five.unmount();

    const nine = renderHook(() => useOffices(9));
    await waitFor(() => expect(nine.result.current.loading).toBe(false));
    // Must NOT serve org 5's cached data.
    expect(nine.result.current.offices[0].name).toBe("OrgNine");
    expect(mockList).toHaveBeenCalledTimes(2);
  });
});

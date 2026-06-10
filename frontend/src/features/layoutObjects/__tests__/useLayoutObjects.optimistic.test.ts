/**
 * PR 057 (Error 5): useLayoutObjects exposes optimistic add/remove so the
 * FloorLayoutPage can apply create/delete to local state WITHOUT calling
 * refresh() (which flips page-level `loading` and remounts the lazy canvas — the
 * visible "jerk"). These tests assert add/remove mutate the object list in place
 * and never flip `loading` back to true.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../api/layoutObjectApi");
import { listLayoutObjects } from "../api/layoutObjectApi";
const mockList = vi.mocked(listLayoutObjects);

vi.mock("@/lib/api/getApiErrorMessage", () => ({
  getApiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "error"),
}));

import { useLayoutObjects } from "../hooks/useLayoutObjects";
import { clearRequestCache } from "@/lib/api/requestCache";
import type { LayoutObject } from "../types/layoutObject.types";

function obj(id: number): LayoutObject {
  return {
    id,
    floor: 3,
    object_type: "desk",
    object_type_display: "Desk",
    label: `Obj ${id}`,
    x: "10.00",
    y: "10.00",
    width: "80.00",
    height: "50.00",
    rotation: "0.00",
    is_bookable: false,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
  } as unknown as LayoutObject;
}

describe("useLayoutObjects optimistic add/remove (PR 057 Error 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRequestCache();
  });

  it("addObjectLocally appends without flipping loading back to true", async () => {
    mockList.mockResolvedValue([obj(1)]);
    const { result } = renderHook(() => useLayoutObjects(1, 2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.objects.map((o) => o.id)).toEqual([1]);

    act(() => result.current.addObjectLocally(obj(2)));

    expect(result.current.objects.map((o) => o.id)).toEqual([1, 2]);
    expect(result.current.loading).toBe(false);
    // No extra network fetch was triggered (no refresh()).
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("addObjectLocally is idempotent (never duplicates an existing id)", async () => {
    mockList.mockResolvedValue([obj(1)]);
    const { result } = renderHook(() => useLayoutObjects(1, 2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.addObjectLocally(obj(1)));

    expect(result.current.objects.map((o) => o.id)).toEqual([1]);
  });

  it("removeObjectLocally removes without flipping loading or refetching", async () => {
    mockList.mockResolvedValue([obj(1), obj(2)]);
    const { result } = renderHook(() => useLayoutObjects(1, 2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.removeObjectLocally(1));

    expect(result.current.objects.map((o) => o.id)).toEqual([2]);
    expect(result.current.loading).toBe(false);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

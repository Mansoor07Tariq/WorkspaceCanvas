import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/features/floors/api/floorApi", () => ({
  setFloorStatus: vi.fn(),
}));

import { setFloorStatus } from "@/features/floors/api/floorApi";
import { useFloorPublish } from "../useFloorPublish";
import type { Floor } from "@/features/floors/types/floor.types";

const mockSet = vi.mocked(setFloorStatus);

const floor = (status: "draft" | "published"): Floor => ({
  id: 5,
  organization: 1,
  office: 3,
  name: "Ground",
  slug: "ground",
  level_number: 0,
  boundary_width: "904",
  boundary_height: "544",
  status,
  is_active: true,
  created_at: "",
  updated_at: "",
});

beforeEach(() => mockSet.mockReset());

describe("useFloorPublish", () => {
  it("publish sets status=published and reports the new floor", async () => {
    mockSet.mockResolvedValue(floor("published"));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useFloorPublish({ officeId: 3, floorId: 5, onChanged }));
    await act(async () => {
      await result.current.publish();
    });
    expect(mockSet).toHaveBeenCalledWith(3, 5, "published");
    expect(onChanged).toHaveBeenCalledWith(floor("published"));
  });

  it("requestEdit opens the confirm; confirmEdit unpublishes and closes", async () => {
    mockSet.mockResolvedValue(floor("draft"));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useFloorPublish({ officeId: 3, floorId: 5, onChanged }));
    act(() => result.current.requestEdit());
    expect(result.current.confirmEditOpen).toBe(true);
    await act(async () => {
      await result.current.confirmEdit();
    });
    expect(mockSet).toHaveBeenCalledWith(3, 5, "draft");
    expect(result.current.confirmEditOpen).toBe(false);
  });

  it("does nothing on confirmEdit if not requested, and clearError resets", () => {
    const { result } = renderHook(() =>
      useFloorPublish({ officeId: 3, floorId: 5, onChanged: vi.fn() })
    );
    expect(result.current.confirmEditOpen).toBe(false);
    act(() => result.current.cancelEdit());
    expect(result.current.confirmEditOpen).toBe(false);
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/apiClient", () => ({ api: { patch: vi.fn() } }));
vi.mock("@/lib/api/requestCache", () => ({ invalidateCache: vi.fn() }));

import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import { setFloorStatus } from "../api/floorApi";
import type { Floor } from "../types/floor.types";

const mockPatch = vi.mocked(api.patch);

const floor: Floor = {
  id: 5,
  organization: 1,
  office: 3,
  name: "Ground",
  slug: "ground",
  level_number: 0,
  boundary_width: "904",
  boundary_height: "544",
  status: "published",
  is_active: true,
  created_at: "",
  updated_at: "",
};

beforeEach(() => {
  mockPatch.mockReset();
  vi.mocked(invalidateCache).mockReset();
});

describe("setFloorStatus", () => {
  it("PATCHes the floor status and busts floors + summary caches", async () => {
    mockPatch.mockResolvedValue(floor);
    const out = await setFloorStatus(3, 5, "published");
    expect(mockPatch).toHaveBeenCalledWith("/api/offices/3/floors/5/", { status: "published" });
    expect(out).toBe(floor);
    expect(invalidateCache).toHaveBeenCalledWith("floors:3");
    expect(invalidateCache).toHaveBeenCalledWith("summary:");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, data: unknown) {
      super("ApiError");
      this.status = status;
      void data;
    }
  },
}));

import { api } from "@/lib/api/apiClient";
import { createDesk, deleteDesk, getDesk, listDesks, updateDesk } from "../api/deskApi";

const mockApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe("deskApi", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── listDesks ──────────────────────────────────────────────────────────────

  it("listDesks calls GET with correct URL", () => {
    mockApi.get.mockResolvedValue([]);
    listDesks(1, 3);
    expect(mockApi.get).toHaveBeenCalledWith("/api/offices/1/floors/3/desks/");
  });

  // ─── createDesk ─────────────────────────────────────────────────────────────

  it("createDesk calls POST with correct URL and payload", () => {
    mockApi.post.mockResolvedValue({});
    const payload = { layout_object: 10, name: "Desk A1", code: "A1" };
    createDesk(1, 3, payload);
    expect(mockApi.post).toHaveBeenCalledWith("/api/offices/1/floors/3/desks/", payload);
  });

  it("createDesk payload does not include organization/office/floor", () => {
    mockApi.post.mockResolvedValue({});
    const payload = { layout_object: 10, name: "Desk A1" };
    createDesk(1, 3, payload);
    const sentPayload = mockApi.post.mock.calls[0][1] as Record<string, unknown>;
    expect("organization" in sentPayload).toBe(false);
    expect("office" in sentPayload).toBe(false);
    expect("floor" in sentPayload).toBe(false);
  });

  // ─── getDesk ────────────────────────────────────────────────────────────────

  it("getDesk calls GET with correct detail URL", () => {
    mockApi.get.mockResolvedValue({});
    getDesk(1, 3, 7);
    expect(mockApi.get).toHaveBeenCalledWith("/api/offices/1/floors/3/desks/7/");
  });

  // ─── updateDesk ─────────────────────────────────────────────────────────────

  it("updateDesk calls PATCH with correct URL and payload", () => {
    mockApi.patch.mockResolvedValue({});
    const payload = { name: "Updated", status: "maintenance" as const };
    updateDesk(1, 3, 7, payload);
    expect(mockApi.patch).toHaveBeenCalledWith("/api/offices/1/floors/3/desks/7/", payload);
  });

  it("updateDesk payload does not include layout_object/organization/office/floor", () => {
    mockApi.patch.mockResolvedValue({});
    const payload = { name: "Updated" };
    updateDesk(1, 3, 7, payload);
    const sentPayload = mockApi.patch.mock.calls[0][1] as Record<string, unknown>;
    expect("layout_object" in sentPayload).toBe(false);
    expect("organization" in sentPayload).toBe(false);
    expect("office" in sentPayload).toBe(false);
    expect("floor" in sentPayload).toBe(false);
  });

  // ─── deleteDesk ─────────────────────────────────────────────────────────────

  it("deleteDesk calls DELETE with correct URL", () => {
    mockApi.delete.mockResolvedValue(undefined);
    deleteDesk(1, 3, 7);
    expect(mockApi.delete).toHaveBeenCalledWith("/api/offices/1/floors/3/desks/7/");
  });
});

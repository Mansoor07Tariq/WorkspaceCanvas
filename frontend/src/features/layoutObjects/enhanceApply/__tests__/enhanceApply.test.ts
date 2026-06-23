import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/apiClient", () => ({
  api: { post: vi.fn() },
}));
vi.mock("@/lib/api/requestCache", () => ({
  invalidateCache: vi.fn(),
}));

import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import { applyEnhancePlan } from "../applyEnhancePlan";
import { undoEnhanceRun } from "../undoEnhanceRun";
import { retryEnhanceRun } from "../retryEnhanceRun";
import type { EnhancePlan } from "../../enhance";
import type { EnhanceRunResult } from "../types";

const mockPost = vi.mocked(api.post);

const plan: EnhancePlan = {
  operations: [
    {
      type: "updateObject",
      objectId: 7,
      before: { x: "100.00", y: "100.00", width: "80.00", height: "50.00", rotation: "0.00" },
      after: { x: "120.00", y: "100.00", width: "80.00", height: "50.00", rotation: "0.00" },
      patch: { x: "120.00" },
      reasonCodes: ["snapped-to-wall"],
    },
  ],
  diagnostics: [],
  summary: { changed: 1, unchanged: 0, warnings: 0, iterations: 1, converged: true },
};

const result: EnhanceRunResult = {
  enhance_run_id: 42,
  status: "success",
  applied_count: 1,
  failed_count: 0,
  skipped_count: 0,
  operation_results: [{ object_id: 7, status: "applied", reason_codes: ["snapped-to-wall"] }],
  updated_objects: [],
};

beforeEach(() => {
  mockPost.mockReset();
  vi.mocked(invalidateCache).mockReset();
});

describe("applyEnhancePlan", () => {
  it("POSTs the plan with plan_id and snake-cased operations", async () => {
    mockPost.mockResolvedValue(result);
    const out = await applyEnhancePlan(3, 5, plan, "plan-xyz");

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, payload] = mockPost.mock.calls[0];
    expect(url).toBe("/api/offices/3/floors/5/layout-objects/enhance-runs/");
    expect(payload).toMatchObject({
      plan_id: "plan-xyz",
      operations: [
        {
          object_id: 7,
          patch: { x: "120.00" },
          reason_codes: ["snapped-to-wall"],
        },
      ],
    });
    expect(out).toBe(result);
    expect(invalidateCache).toHaveBeenCalledWith("layoutObjects:3:5");
  });

  it("passes partial_success through unchanged (never claims full success)", async () => {
    const partial: EnhanceRunResult = {
      ...result,
      status: "partial_success",
      applied_count: 1,
      failed_count: 1,
    };
    mockPost.mockResolvedValue(partial);
    const out = await applyEnhancePlan(1, 1, plan, "p");
    expect(out.status).toBe("partial_success");
    expect(out.failed_count).toBe(1);
  });
});

describe("undoEnhanceRun / retryEnhanceRun", () => {
  it("undo calls the undo endpoint", async () => {
    mockPost.mockResolvedValue(result);
    await undoEnhanceRun(3, 5, 42);
    expect(mockPost).toHaveBeenCalledWith("/api/offices/3/floors/5/enhance-runs/42/undo/");
    expect(invalidateCache).toHaveBeenCalledWith("layoutObjects:3:5");
  });

  it("retry calls the retry endpoint", async () => {
    mockPost.mockResolvedValue(result);
    await retryEnhanceRun(3, 5, 42);
    expect(mockPost).toHaveBeenCalledWith("/api/offices/3/floors/5/enhance-runs/42/retry/");
  });
});

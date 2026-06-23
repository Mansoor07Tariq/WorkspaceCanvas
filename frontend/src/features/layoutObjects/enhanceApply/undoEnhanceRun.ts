/**
 * undoEnhanceRun — restore the geometry of operations that were successfully
 * applied by a previous EnhanceRun. Best-effort; returns the same result shape
 * (its own success / partial_success / failed).
 */
import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type { EnhanceRunResult } from "./types";

function undoUrl(officeId: number, floorId: number, runId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/enhance-runs/${runId}/undo/`;
}

function layoutObjectsKey(officeId: number, floorId: number): string {
  return `layoutObjects:${officeId}:${floorId}`;
}

export async function undoEnhanceRun(
  officeId: number,
  floorId: number,
  runId: number
): Promise<EnhanceRunResult> {
  const result = await api.post<EnhanceRunResult>(undoUrl(officeId, floorId, runId));
  invalidateCache(layoutObjectsKey(officeId, floorId));
  return result;
}

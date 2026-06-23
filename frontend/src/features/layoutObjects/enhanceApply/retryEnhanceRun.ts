/**
 * retryEnhanceRun — re-attempt only the FAILED operations of a previous run as a
 * new linked EnhanceRun. Stale-skipped operations are not retried (the user
 * should recompute a fresh plan). Best-effort; returns the same result shape.
 */
import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type { EnhanceRunResult } from "./types";

function retryUrl(officeId: number, floorId: number, runId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/enhance-runs/${runId}/retry/`;
}

function layoutObjectsKey(officeId: number, floorId: number): string {
  return `layoutObjects:${officeId}:${floorId}`;
}

export async function retryEnhanceRun(
  officeId: number,
  floorId: number,
  runId: number
): Promise<EnhanceRunResult> {
  const result = await api.post<EnhanceRunResult>(retryUrl(officeId, floorId, runId));
  invalidateCache(layoutObjectsKey(officeId, floorId));
  return result;
}

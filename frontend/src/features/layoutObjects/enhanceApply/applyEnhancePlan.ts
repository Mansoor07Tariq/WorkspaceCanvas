/**
 * applyEnhancePlan — POST a computed EnhancePlan to the backend as an EnhanceRun.
 *
 * Best-effort apply: the backend applies each operation independently and
 * returns per-operation results. This adapter passes the result straight
 * through (never collapses partial_success into success) and exposes the
 * authoritative `updated_objects` so the caller can resync local state exactly.
 */
import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type { EnhancePlan, EnhanceOperation } from "../enhance";
import type { ApplyEnhanceRunPayload, EnhanceRunResult, WireOperation } from "./types";

function enhanceRunsUrl(officeId: number, floorId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/layout-objects/enhance-runs/`;
}

function layoutObjectsKey(officeId: number, floorId: number): string {
  return `layoutObjects:${officeId}:${floorId}`;
}

/** Stable client-generated id so a double-submit is de-duplicated server-side. */
export function newPlanId(): string {
  return crypto.randomUUID();
}

function toWireOperation(op: EnhanceOperation): WireOperation {
  return {
    object_id: op.objectId,
    before: { ...op.before },
    after: { ...op.after },
    patch: { ...op.patch },
    reason_codes: op.reasonCodes,
  };
}

export async function applyEnhancePlan(
  officeId: number,
  floorId: number,
  plan: EnhancePlan,
  planId: string
): Promise<EnhanceRunResult> {
  const payload: ApplyEnhanceRunPayload = {
    plan_id: planId,
    operations: plan.operations.map(toWireOperation),
    summary: { ...plan.summary },
    diagnostics: plan.diagnostics,
  };
  const result = await api.post<EnhanceRunResult, ApplyEnhanceRunPayload>(
    enhanceRunsUrl(officeId, floorId),
    payload
  );
  invalidateCache(layoutObjectsKey(officeId, floorId));
  return result;
}

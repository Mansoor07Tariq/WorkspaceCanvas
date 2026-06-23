/**
 * Wire + result types for the impure Enhance apply layer. This layer talks to
 * the backend EnhanceRun endpoints; it is intentionally separate from the pure
 * engine (../enhance). It never pretends a partial run fully succeeded.
 */
import type { LayoutObject } from "../types/layoutObject.types";

export type EnhanceRunStatus = "success" | "partial_success" | "failed";
export type EnhanceOperationStatus = "applied" | "failed" | "skipped";

/** Per-operation outcome as reported by the backend. */
export interface EnhanceOperationResult {
  object_id: number;
  status: EnhanceOperationStatus;
  reason_codes: string[];
  error_code?: string | null;
  error_message?: string | null;
}

/** The result of an apply / undo / retry run. */
export interface EnhanceRunResult {
  enhance_run_id: number;
  status: EnhanceRunStatus;
  applied_count: number;
  failed_count: number;
  skipped_count: number;
  operation_results: EnhanceOperationResult[];
  /** Authoritative server state for objects that were updated — resync source. */
  updated_objects: LayoutObject[];
}

/** Snake-cased operation shape sent to the backend. */
export interface WireOperation {
  object_id: number;
  before: Record<string, string>;
  after: Record<string, string>;
  patch: Record<string, string>;
  reason_codes: string[];
}

export interface ApplyEnhanceRunPayload {
  plan_id: string;
  operations: WireOperation[];
  summary: Record<string, unknown>;
  diagnostics: unknown[];
}

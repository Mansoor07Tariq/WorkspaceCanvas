/**
 * useEnhanceTidy — orchestrates the explicit Tidy flow:
 *   preview (pure plan) → apply (best-effort backend run) → result → undo/retry.
 *
 * The pure engine computes the plan; this hook only sequences UI state and calls
 * the apply adapter. It never mutates the layout itself — the backend is the
 * source of truth and `onObjectsUpdated` resyncs local state from the run result.
 */
import { useCallback, useMemo, useState } from "react";
import { computeEnhancePlan, type EnhanceEngineInput, type EnhancePlan } from "../enhance";
import { buildTidySuggestions, type TidySuggestion } from "../enhancePreview";
import {
  applyEnhancePlan,
  undoEnhanceRun,
  retryEnhanceRun,
  newPlanId,
  type EnhanceRunResult,
} from "../enhanceApply";
import type { LayoutObject } from "../types/layoutObject.types";

export type TidyPhase = "idle" | "preview" | "result";
export type TidyAction = "apply" | "undo" | "retry";

/**
 * Short, stable hex digest of a sorted id list (djb2). Used to key the apply
 * plan_id on the current selection while keeping it within the backend's
 * 64-char `plan_id` limit — a raw id list would overflow on large selections.
 */
function hashSelection(sortedIds: number[]): string {
  let h = 5381;
  for (const id of sortedIds) {
    const s = `${id},`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

interface Params {
  officeId: number;
  floorId: number;
  /** Snapshot current layout at the moment the user opens the preview. */
  buildInput: () => EnhanceEngineInput;
  /** Resync local state from the authoritative objects a run returns. */
  onObjectsUpdated: (objects: LayoutObject[]) => void;
}

export interface UseEnhanceTidyResult {
  phase: TidyPhase;
  plan: EnhancePlan | null;
  /** Friendly, grouped preview copy derived from the plan (deterministic). */
  suggestions: TidySuggestion[];
  /** Ids of the suggestions currently ticked for apply (default: all). */
  selectedSuggestionIds: Set<string>;
  /** Toggle one suggestion in/out of the apply set. */
  toggleSuggestion: (id: string) => void;
  /** Distinct objects covered by the currently-selected suggestions. */
  selectedObjectCount: number;
  /** Operations that would be applied for the current selection. */
  selectedOperationCount: number;
  /** Whether Apply is enabled (at least one operation selected). */
  canApply: boolean;
  result: EnhanceRunResult | null;
  lastAction: TidyAction | null;
  busy: boolean;
  error: boolean;
  canUndo: boolean;
  canRetry: boolean;
  openPreview: () => void;
  cancel: () => void;
  apply: () => Promise<void>;
  undo: () => Promise<void>;
  retry: () => Promise<void>;
  close: () => void;
}

export function useEnhanceTidy({
  officeId,
  floorId,
  buildInput,
  onObjectsUpdated,
}: Params): UseEnhanceTidyResult {
  const [phase, setPhase] = useState<TidyPhase>("idle");
  const [plan, setPlan] = useState<EnhancePlan | null>(null);
  const [suggestions, setSuggestions] = useState<TidySuggestion[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [planId, setPlanId] = useState<string | null>(null);
  const [result, setResult] = useState<EnhanceRunResult | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<TidyAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const reset = useCallback(() => {
    setPhase("idle");
    setPlan(null);
    setSuggestions([]);
    setSelectedSuggestionIds(new Set());
    setPlanId(null);
    setResult(null);
    setRunId(null);
    setLastAction(null);
    setError(false);
  }, []);

  const openPreview = useCallback(() => {
    const input = buildInput();
    const nextPlan = computeEnhancePlan(input);
    const nextSuggestions = buildTidySuggestions(nextPlan, input.objects);
    setPlan(nextPlan);
    setSuggestions(nextSuggestions);
    setSelectedSuggestionIds(new Set(nextSuggestions.map((s) => s.id))); // all ticked
    setPlanId(newPlanId()); // base id for this preview; the apply id also keys on selection
    setResult(null);
    setLastAction(null);
    setError(false);
    setPhase("preview");
  }, [buildInput]);

  const toggleSuggestion = useCallback((id: string) => {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Objects/operations implied by the current suggestion selection.
  const selectedObjectIds = useMemo(() => {
    const ids = new Set<number>();
    for (const s of suggestions) {
      if (selectedSuggestionIds.has(s.id)) for (const oid of s.objectIds) ids.add(oid);
    }
    return ids;
  }, [suggestions, selectedSuggestionIds]);

  const selectedOperations = useMemo(
    () => (plan ? plan.operations.filter((op) => selectedObjectIds.has(op.objectId)) : []),
    [plan, selectedObjectIds]
  );

  const apply = useCallback(async () => {
    if (!plan || !planId || selectedOperations.length === 0) return;
    // The plan_id keys on the selected object ids (hashed → bounded length) so
    // re-applying the SAME selection is idempotent (deduped server-side), while
    // a different selection produces a distinct run.
    const selectionKey = hashSelection([...selectedObjectIds].sort((a, b) => a - b));
    const effectivePlanId = `${planId}:${selectionKey}`;
    const selectedPlan: EnhancePlan = {
      ...plan,
      operations: selectedOperations,
      summary: { ...plan.summary, changed: selectedOperations.length },
    };
    setBusy(true);
    setError(false);
    try {
      const res = await applyEnhancePlan(officeId, floorId, selectedPlan, effectivePlanId);
      onObjectsUpdated(res.updated_objects);
      setResult(res);
      setRunId(res.applied_count > 0 ? res.enhance_run_id : null);
      setLastAction("apply");
      setPhase("result");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [plan, planId, selectedOperations, selectedObjectIds, officeId, floorId, onObjectsUpdated]);

  const undo = useCallback(async () => {
    if (runId == null) return;
    setBusy(true);
    setError(false);
    try {
      const res = await undoEnhanceRun(officeId, floorId, runId);
      onObjectsUpdated(res.updated_objects);
      setResult(res);
      setRunId(null); // single-level undo
      setLastAction("undo");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [runId, officeId, floorId, onObjectsUpdated]);

  const retry = useCallback(async () => {
    if (runId == null) return;
    setBusy(true);
    setError(false);
    try {
      const res = await retryEnhanceRun(officeId, floorId, runId);
      onObjectsUpdated(res.updated_objects);
      setResult(res);
      setLastAction("retry");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [runId, officeId, floorId, onObjectsUpdated]);

  const canUndo = lastAction !== "undo" && runId != null && (result?.applied_count ?? 0) > 0;
  const canRetry = (result?.failed_count ?? 0) > 0;

  return {
    phase,
    plan,
    suggestions,
    selectedSuggestionIds,
    toggleSuggestion,
    selectedObjectCount: selectedObjectIds.size,
    selectedOperationCount: selectedOperations.length,
    canApply: selectedOperations.length > 0,
    result,
    lastAction,
    busy,
    error,
    canUndo,
    canRetry,
    openPreview,
    cancel: reset,
    apply,
    undo,
    retry,
    close: reset,
  };
}

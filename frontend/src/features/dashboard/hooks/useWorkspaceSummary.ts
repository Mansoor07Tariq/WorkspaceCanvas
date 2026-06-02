import { useEffect, useReducer, useState } from "react";
import { getWorkspaceSummary } from "../api/dashboardApi";
import type { WorkspaceSummary } from "../types/dashboard.types";

interface State {
  summary: WorkspaceSummary | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "reset" }
  | { type: "start" }
  | { type: "success"; payload: WorkspaceSummary }
  | { type: "error" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return { summary: null, loading: false, error: null };
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return { summary: action.payload, loading: false, error: null };
    case "error":
      return { ...state, loading: false, error: "Failed to load workspace overview." };
  }
}

export interface UseWorkspaceSummaryResult {
  summary: WorkspaceSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Org-wide workspace summary (TD-035). The backend resolves the organization
 * from the caller's active membership; `orgId` is used only to decide whether
 * to fetch (skipped for no-org users) and to refetch when the org changes.
 */
export function useWorkspaceSummary(orgId: number | null): UseWorkspaceSummaryResult {
  const [state, dispatch] = useReducer(reducer, {
    summary: null,
    loading: orgId !== null,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (orgId === null) {
      dispatch({ type: "reset" });
      return;
    }
    const controller = new AbortController();
    dispatch({ type: "start" });

    getWorkspaceSummary()
      .then((data) => {
        if (!controller.signal.aborted) dispatch({ type: "success", payload: data });
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: "error" });
      });

    return () => controller.abort();
  }, [orgId, tick]);

  return { ...state, refresh: () => setTick((n) => n + 1) };
}

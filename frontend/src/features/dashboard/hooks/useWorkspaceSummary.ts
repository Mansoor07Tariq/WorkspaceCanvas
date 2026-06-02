import { useEffect, useReducer, useRef, useState } from "react";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
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

// Namespaced by org so a selected-org switch (PR 055) never serves another org's summary.
function summaryCacheKey(orgId: number): string {
  return `summary:${orgId}`;
}

/**
 * Org-wide workspace summary (TD-035). `orgId` decides whether to fetch (skipped
 * for no-org users), scopes the request to the selected org (PR 055 multi-org),
 * and namespaces the TTL cache key.
 */
export function useWorkspaceSummary(orgId: number | null): UseWorkspaceSummaryResult {
  const [state, dispatch] = useReducer(reducer, {
    summary: null,
    loading: orgId !== null,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  useEffect(() => {
    if (orgId === null) {
      dispatch({ type: "reset" });
      return;
    }
    const cacheKey = summaryCacheKey(orgId);

    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = getCachedValue<WorkspaceSummary>(cacheKey);
      if (cached !== undefined) {
        dispatch({ type: "success", payload: cached });
        return;
      }
    }

    const controller = new AbortController();
    dispatch({ type: "start" });

    getWorkspaceSummary(orgId)
      .then((data) => {
        if (!controller.signal.aborted) {
          setCachedValue(cacheKey, data);
          dispatch({ type: "success", payload: data });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: "error" });
      });

    return () => controller.abort();
  }, [orgId, tick]);

  return {
    ...state,
    refresh: () => {
      forceRef.current = true;
      setTick((n) => n + 1);
    },
  };
}

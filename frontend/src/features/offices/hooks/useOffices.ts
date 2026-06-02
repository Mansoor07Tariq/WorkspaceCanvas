import { useEffect, useReducer, useRef, useState } from "react";
import { listOffices } from "../api/officeApi";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
import type { Office } from "../types/office.types";

interface State {
  offices: Office[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; offices: Office[] }
  | { type: "fetch_error" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { offices: action.offices, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: "Failed to load offices." };
  }
}

const initial: State = { offices: [], loading: true, error: null };

/** Cache key — namespaced by selected organization so switching org never bleeds. */
function officesCacheKey(orgId: number | null | undefined): string {
  return `offices:${orgId ?? "default"}`;
}

interface UseOfficesResult {
  offices: Office[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * @param orgId Optional organization id (PR 055 multi-org). When provided the
 * list is scoped to that org via `?organization=`; when omitted the backend
 * resolves the caller's first active membership (unchanged single-org behaviour).
 */
export function useOffices(orgId?: number | null): UseOfficesResult {
  const cacheKey = officesCacheKey(orgId);
  const [state, dispatch] = useReducer(reducer, {
    ...initial,
    // Seed synchronously from cache to avoid a loading flicker on remount.
    ...(getCachedValue<Office[]>(cacheKey) !== undefined
      ? { offices: getCachedValue<Office[]>(cacheKey)!, loading: false }
      : {}),
  });
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = getCachedValue<Office[]>(cacheKey);
      if (cached !== undefined) {
        dispatch({ type: "fetch_success", offices: cached });
        return;
      }
    }

    async function fetchOffices() {
      dispatch({ type: "fetch_start" });
      try {
        const data = await listOffices(orgId);
        if (!cancelled) {
          setCachedValue(cacheKey, data);
          dispatch({ type: "fetch_success", offices: data });
        }
      } catch {
        if (!cancelled) dispatch({ type: "fetch_error" });
      }
    }

    void fetchOffices();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, tick]);

  return {
    ...state,
    refresh: () => {
      forceRef.current = true;
      setTick((n) => n + 1);
    },
  };
}

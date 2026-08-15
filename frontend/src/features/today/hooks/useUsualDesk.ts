import { useEffect, useReducer } from "react";

import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getOrFetchCached } from "@/lib/api/requestCache";
import { getUsualDesk } from "../api/usualDeskApi";
import type { UsualDesk } from "../api/usualDeskApi";

/** Cache key: usual desk is per-user-per-org; short-lived, refreshed after a booking. */
function usualDeskCacheKey(orgId: number): string {
  return `usualDesk:${orgId}`;
}

interface State {
  usualDesk: UsualDesk | null;
  loading: boolean;
  error: string | undefined;
}

type Action =
  | { type: "start" }
  | { type: "success"; payload: UsualDesk | null }
  | { type: "error"; payload: string }
  | { type: "idle" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: undefined };
    case "success":
      return { usualDesk: action.payload, loading: false, error: undefined };
    case "error":
      return { usualDesk: null, loading: false, error: action.payload };
    case "idle":
      return { usualDesk: null, loading: false, error: undefined };
  }
}

/**
 * The caller's usual desk in the selected org (PR 079). Cached under `usualDesk:<orgId>`;
 * the usual desk only changes after a booking (which clears the `deskBookings:` /
 * `myBookings:` namespaces), so a short TTL keeps it fresh without its own invalidation.
 * Uses useReducer (dispatch-in-effect is allowed; the repo forbids setState-in-effect).
 */
export function useUsualDesk(orgId: number | null): State {
  const [state, dispatch] = useReducer(reducer, {
    usualDesk: null,
    loading: orgId != null,
    error: undefined,
  });

  useEffect(() => {
    if (orgId == null) {
      dispatch({ type: "idle" });
      return;
    }
    let active = true;
    dispatch({ type: "start" });
    getOrFetchCached(usualDeskCacheKey(orgId), () => getUsualDesk(orgId))
      .then((res) => {
        if (active) dispatch({ type: "success", payload: res.usual_desk });
      })
      .catch((err) => {
        if (active) dispatch({ type: "error", payload: getApiErrorMessage(err) });
      });
    return () => {
      active = false;
    };
  }, [orgId]);

  return state;
}

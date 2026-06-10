import { useCallback, useEffect, useReducer, useState } from "react";
import { listMyPendingInvitations } from "@/features/teams/api/teamsApi";
import type { PendingInvitation } from "@/features/teams/types/teams.types";

interface State {
  invitations: PendingInvitation[];
  loading: boolean;
}

type Action =
  | { type: "start" }
  | { type: "success"; payload: PendingInvitation[] }
  | { type: "error" }
  | { type: "remove"; token: string }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...state, loading: true };
    case "success":
      return { invitations: action.payload, loading: false };
    case "error":
      // A flaky invitations lookup must never block the dashboard.
      return { invitations: [], loading: false };
    case "remove":
      return {
        ...state,
        invitations: state.invitations.filter((inv) => inv.token !== action.token),
      };
    case "reset":
      return { invitations: [], loading: false };
  }
}

interface UsePendingInvitationsResult {
  invitations: PendingInvitation[];
  loading: boolean;
  refresh: () => void;
  /** Locally drop an invitation (e.g. once accepted) without a refetch. */
  remove: (token: string) => void;
}

/**
 * Fetch the authenticated user's pending invitations. Used by the dashboard to
 * auto-surface an accept prompt after sign-in / onboarding — covering the case
 * where the original /invite link state was lost across signup → verify → login.
 */
export function usePendingInvitations(enabled: boolean): UsePendingInvitationsResult {
  const [state, dispatch] = useReducer(reducer, { invitations: [], loading: enabled });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const remove = useCallback((token: string) => dispatch({ type: "remove", token }), []);

  useEffect(() => {
    if (!enabled) {
      dispatch({ type: "reset" });
      return;
    }
    let active = true;
    dispatch({ type: "start" });
    listMyPendingInvitations()
      .then((data) => {
        if (active) dispatch({ type: "success", payload: data });
      })
      .catch(() => {
        if (active) dispatch({ type: "error" });
      });
    return () => {
      active = false;
    };
  }, [enabled, tick]);

  return { invitations: state.invitations, loading: state.loading, refresh, remove };
}

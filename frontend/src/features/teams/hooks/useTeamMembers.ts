import { useCallback, useEffect, useReducer, useState } from "react";
import { listMembers } from "../api/teamsApi";
import type { TeamMember } from "../types/teams.types";

interface State {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "start" }
  | { type: "success"; payload: TeamMember[] }
  | { type: "error"; payload: string }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return { members: action.payload, loading: false, error: null };
    case "error":
      return { ...state, loading: false, error: action.payload };
    case "reset":
      return { members: [], loading: false, error: null };
  }
}

export interface UseTeamMembersResult {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTeamMembers(orgId: number | null): UseTeamMembersResult {
  const [state, dispatch] = useReducer(reducer, {
    members: [],
    loading: false,
    error: null,
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!orgId) {
      dispatch({ type: "reset" });
      return;
    }
    const controller = new AbortController();
    dispatch({ type: "start" });

    listMembers(orgId)
      .then((data) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "success", payload: data });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : "Failed to load members.";
          dispatch({ type: "error", payload: msg });
        }
      });

    return () => controller.abort();
  }, [orgId, tick]);

  return { ...state, refresh };
}

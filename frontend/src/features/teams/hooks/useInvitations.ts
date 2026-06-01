import { useCallback, useEffect, useReducer, useState } from "react";
import { cancelInvitation, createInvitation, listInvitations } from "../api/teamsApi";
import type { CreateInvitationPayload, Invitation } from "../types/teams.types";

interface State {
  invitations: Invitation[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  createError: string | null;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: Invitation[] }
  | { type: "fetch_error"; payload: string }
  | { type: "create_start" }
  | { type: "create_success"; payload: Invitation }
  | { type: "create_error"; payload: string }
  | { type: "cancel_success"; id: number }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { ...state, invitations: action.payload, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
    case "create_start":
      return { ...state, creating: true, createError: null };
    case "create_success":
      return {
        ...state,
        creating: false,
        invitations: [action.payload, ...state.invitations],
      };
    case "create_error":
      return { ...state, creating: false, createError: action.payload };
    case "cancel_success":
      return {
        ...state,
        invitations: state.invitations.filter((i) => i.id !== action.id),
      };
    case "reset":
      return { invitations: [], loading: false, error: null, creating: false, createError: null };
  }
}

export interface UseInvitationsResult {
  invitations: Invitation[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  createError: string | null;
  createInvite: (payload: CreateInvitationPayload) => Promise<Invitation | null>;
  cancelInvite: (invitationId: number) => Promise<void>;
  refresh: () => void;
}

export function useInvitations(orgId: number | null): UseInvitationsResult {
  const [state, dispatch] = useReducer(reducer, {
    invitations: [],
    loading: false,
    error: null,
    creating: false,
    createError: null,
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!orgId) {
      dispatch({ type: "reset" });
      return;
    }
    const controller = new AbortController();
    dispatch({ type: "fetch_start" });

    listInvitations(orgId)
      .then((data) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "fetch_success", payload: data });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : "Failed to load invitations.";
          dispatch({ type: "fetch_error", payload: msg });
        }
      });

    return () => controller.abort();
  }, [orgId, tick]);

  const createInvite = useCallback(
    async (payload: CreateInvitationPayload): Promise<Invitation | null> => {
      if (!orgId) return null;
      dispatch({ type: "create_start" });
      try {
        const inv = await createInvitation(orgId, payload);
        dispatch({ type: "create_success", payload: inv });
        return inv;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create invitation.";
        dispatch({ type: "create_error", payload: msg });
        return null;
      }
    },
    [orgId]
  );

  const cancelInvite = useCallback(
    async (invitationId: number): Promise<void> => {
      if (!orgId) return;
      try {
        await cancelInvitation(orgId, invitationId);
        dispatch({ type: "cancel_success", id: invitationId });
      } catch {
        refresh();
      }
    },
    [orgId, refresh]
  );

  return { ...state, createInvite, cancelInvite, refresh };
}

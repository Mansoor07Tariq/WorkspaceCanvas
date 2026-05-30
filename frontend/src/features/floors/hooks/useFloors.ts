import { useEffect, useReducer } from "react";
import { listFloors } from "../api/floorApi";
import type { Floor } from "../types/floor.types";

interface State {
  floors: Floor[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; floors: Floor[] }
  | { type: "fetch_error" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { floors: action.floors, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: "Failed to load floors." };
  }
}

const initial: State = { floors: [], loading: true, error: null };

interface UseFloorsResult {
  floors: Floor[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFloors(officeId: number): UseFloorsResult {
  const [state, dispatch] = useReducer(reducer, initial);
  const [tick, setTick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let cancelled = false;

    async function fetchFloors() {
      dispatch({ type: "fetch_start" });
      try {
        const data = await listFloors(officeId);
        if (!cancelled) dispatch({ type: "fetch_success", floors: data });
      } catch {
        if (!cancelled) dispatch({ type: "fetch_error" });
      }
    }

    void fetchFloors();

    return () => {
      cancelled = true;
    };
  }, [officeId, tick]);

  return { ...state, refresh: () => setTick() };
}

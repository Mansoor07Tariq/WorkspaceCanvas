import { useEffect, useReducer, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
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
  | { type: "fetch_error"; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { floors: action.floors, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
  }
}

const initial: State = { floors: [], loading: true, error: null };

// Office ids are globally unique, so this key is org-safe without an org segment.
function floorsCacheKey(officeId: number): string {
  return `floors:${officeId}`;
}

interface UseFloorsResult {
  floors: Floor[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFloors(officeId: number): UseFloorsResult {
  const [state, dispatch] = useReducer(reducer, initial);
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = floorsCacheKey(officeId);

    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = getCachedValue<Floor[]>(cacheKey);
      if (cached !== undefined) {
        dispatch({ type: "fetch_success", floors: cached });
        return;
      }
    }

    async function fetchFloors() {
      dispatch({ type: "fetch_start" });
      try {
        const data = await listFloors(officeId);
        if (!cancelled) {
          setCachedValue(cacheKey, data);
          dispatch({ type: "fetch_success", floors: data });
        }
      } catch (err: unknown) {
        if (!cancelled) dispatch({ type: "fetch_error", payload: getApiErrorMessage(err) });
      }
    }

    void fetchFloors();

    return () => {
      cancelled = true;
    };
  }, [officeId, tick]);

  return {
    ...state,
    refresh: () => {
      forceRef.current = true;
      setTick((n) => n + 1);
    },
  };
}

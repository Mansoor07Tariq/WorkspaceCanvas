import { useEffect, useReducer, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
import { listDesks } from "../api/deskApi";
import type { Desk } from "../types/desk.types";

interface State {
  desks: Desk[];
  loading: boolean;
  error: string | undefined;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: Desk[] }
  | { type: "fetch_error"; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: undefined };
    case "fetch_success":
      return { desks: action.payload, loading: false, error: undefined };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
  }
}

const initialState: State = { desks: [], loading: true, error: undefined };

// office+floor ids are globally unique, so this key is org-safe.
function desksCacheKey(officeId: number, floorId: number): string {
  return `desks:${officeId}:${floorId}`;
}

export function useDesks(officeId: number, floorId: number) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  function refresh() {
    forceRef.current = true;
    setTick((t) => t + 1);
  }

  useEffect(() => {
    if (!officeId || !floorId) return;
    let cancelled = false;
    const cacheKey = desksCacheKey(officeId, floorId);

    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = getCachedValue<Desk[]>(cacheKey);
      if (cached !== undefined) {
        dispatch({ type: "fetch_success", payload: cached });
        return;
      }
    }

    dispatch({ type: "fetch_start" });

    listDesks(officeId, floorId)
      .then((data) => {
        if (!cancelled) {
          setCachedValue(cacheKey, data);
          dispatch({ type: "fetch_success", payload: data });
        }
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: "fetch_error", payload: getApiErrorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [officeId, floorId, tick]);

  return { ...state, refresh };
}

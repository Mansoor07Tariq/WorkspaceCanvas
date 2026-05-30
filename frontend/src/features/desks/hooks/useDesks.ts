import { useEffect, useReducer, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
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

export function useDesks(officeId: number, floorId: number) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);

  function refresh() {
    setTick((t) => t + 1);
  }

  useEffect(() => {
    if (!officeId || !floorId) return;
    let cancelled = false;
    dispatch({ type: "fetch_start" });

    listDesks(officeId, floorId)
      .then((data) => {
        if (!cancelled) dispatch({ type: "fetch_success", payload: data });
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

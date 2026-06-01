import { useEffect, useReducer, useState } from "react";
import { listOffices } from "../api/officeApi";
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

interface UseOfficesResult {
  offices: Office[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useOffices(): UseOfficesResult {
  const [state, dispatch] = useReducer(reducer, initial);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchOffices() {
      dispatch({ type: "fetch_start" });
      try {
        const data = await listOffices();
        if (!cancelled) dispatch({ type: "fetch_success", offices: data });
      } catch {
        if (!cancelled) dispatch({ type: "fetch_error" });
      }
    }

    void fetchOffices();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { ...state, refresh: () => setTick((n) => n + 1) };
}

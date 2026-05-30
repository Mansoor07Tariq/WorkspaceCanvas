import { useReducer, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { listLayoutObjects } from "../api/layoutObjectApi";
import type { LayoutObject } from "../types/layoutObject.types";

interface State {
  objects: LayoutObject[];
  loading: boolean;
  error: string | undefined;
  savingObjectIds: ReadonlySet<number>;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: LayoutObject[] }
  | { type: "fetch_error"; payload: string }
  | { type: "patch_object"; id: number; patch: Partial<LayoutObject> }
  | { type: "set_saving"; id: number; saving: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: undefined };
    case "fetch_success":
      return {
        objects: action.payload,
        loading: false,
        error: undefined,
        savingObjectIds: new Set(),
      };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
    case "patch_object":
      return {
        ...state,
        objects: state.objects.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)),
      };
    case "set_saving": {
      const next = new Set(state.savingObjectIds);
      if (action.saving) {
        next.add(action.id);
      } else {
        next.delete(action.id);
      }
      return { ...state, savingObjectIds: next };
    }
  }
}

const initialState: State = {
  objects: [],
  loading: true,
  error: undefined,
  savingObjectIds: new Set(),
};

export function useLayoutObjects(officeId: number, floorId: number) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);

  function refresh() {
    setTick((t) => t + 1);
  }

  function updateObjectLocally(id: number, patch: Partial<LayoutObject>) {
    dispatch({ type: "patch_object", id, patch });
  }

  function setSaving(id: number, saving: boolean) {
    dispatch({ type: "set_saving", id, saving });
  }

  useEffect(() => {
    if (!officeId || !floorId) return;
    let cancelled = false;
    dispatch({ type: "fetch_start" });

    listLayoutObjects(officeId, floorId)
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

  return { ...state, refresh, updateObjectLocally, setSaving };
}

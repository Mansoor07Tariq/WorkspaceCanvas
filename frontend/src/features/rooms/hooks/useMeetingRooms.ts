import { useEffect, useReducer, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
import { listMeetingRooms } from "../api/roomApi";
import type { MeetingRoom } from "../types/room.types";

interface State {
  rooms: MeetingRoom[];
  loading: boolean;
  error: string | undefined;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: MeetingRoom[] }
  | { type: "fetch_error"; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: undefined };
    case "fetch_success":
      return { rooms: action.payload, loading: false, error: undefined };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
  }
}

const initialState: State = { rooms: [], loading: true, error: undefined };

// office+floor ids are globally unique, so this key is org-safe (mirrors the desk
// hooks, TD-044). Room resources rarely change, so no booking mutation clears it.
function roomsCacheKey(officeId: number, floorId: number): string {
  return `rooms:${officeId}:${floorId}`;
}

export function useMeetingRooms(officeId: number, floorId: number) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  function refresh() {
    forceRef.current = true;
    setTick((t) => t + 1);
  }

  useEffect(() => {
    if (!officeId || !floorId) {
      dispatch({ type: "fetch_success", payload: [] });
      return;
    }

    const cacheKey = roomsCacheKey(officeId, floorId);
    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = getCachedValue<MeetingRoom[]>(cacheKey);
      if (cached !== undefined) {
        dispatch({ type: "fetch_success", payload: cached });
        return;
      }
    }

    const controller = new AbortController();
    dispatch({ type: "fetch_start" });

    listMeetingRooms(officeId, floorId)
      .then((data) => {
        if (!controller.signal.aborted) {
          setCachedValue(cacheKey, data);
          dispatch({ type: "fetch_success", payload: data });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          dispatch({ type: "fetch_error", payload: getApiErrorMessage(err) });
      });

    return () => {
      controller.abort();
    };
  }, [officeId, floorId, tick]);

  return { ...state, refresh };
}

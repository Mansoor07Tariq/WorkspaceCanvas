import { useEffect, useReducer, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
import { listRoomBookings } from "../api/roomApi";
import type { RoomBooking } from "../types/room.types";

interface State {
  bookings: RoomBooking[];
  loading: boolean;
  error: string | undefined;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: RoomBooking[] }
  | { type: "fetch_error"; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: undefined };
    case "fetch_success":
      return { bookings: action.payload, loading: false, error: undefined };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
  }
}

const initialState: State = { bookings: [], loading: true, error: undefined };

// Mirrors deskBookings: office+floor+date is a globally-unique, org-safe scope.
// createRoomBooking/cancelRoomBooking clear the whole `roomBookings:` namespace.
function roomBookingsCacheKey(officeId: number, floorId: number, date: string): string {
  return `roomBookings:${officeId}:${floorId}:${date}`;
}

export function useRoomBookings(officeId: number, floorId: number, date: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  function refresh() {
    forceRef.current = true;
    setTick((t) => t + 1);
  }

  useEffect(() => {
    if (!officeId || !floorId || !date) {
      dispatch({ type: "fetch_success", payload: [] });
      return;
    }

    const cacheKey = roomBookingsCacheKey(officeId, floorId, date);
    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = getCachedValue<RoomBooking[]>(cacheKey);
      if (cached !== undefined) {
        dispatch({ type: "fetch_success", payload: cached });
        return;
      }
    }

    const controller = new AbortController();
    dispatch({ type: "fetch_start" });

    listRoomBookings(officeId, floorId, date)
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
  }, [officeId, floorId, date, tick]);

  return { ...state, refresh };
}

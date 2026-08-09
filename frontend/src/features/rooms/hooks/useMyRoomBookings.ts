import { useEffect, useReducer, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
import { listMyRoomBookings } from "../api/roomApi";
import type { MyRoomBookingQueryParams, RoomBooking } from "../types/room.types";

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

// Mirrors useMyBookings: the backend scopes to request.user, so only the query
// filters need to key the cache. Create/cancel clears the whole namespace.
function myRoomBookingsCacheKey(params?: MyRoomBookingQueryParams): string {
  return `myRoomBookings:${params?.status ?? ""}:${params?.from ?? ""}:${params?.to ?? ""}`;
}

export function useMyRoomBookings(params?: MyRoomBookingQueryParams) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  function refresh() {
    forceRef.current = true;
    setTick((t) => t + 1);
  }

  useEffect(() => {
    const cacheKey = myRoomBookingsCacheKey(params);
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
    let cancelled = false;
    dispatch({ type: "fetch_start" });
    listMyRoomBookings(params)
      .then((data) => {
        if (!cancelled) {
          setCachedValue(cacheKey, data);
          dispatch({ type: "fetch_success", payload: data });
        }
      })
      .catch((err) => {
        if (!cancelled && !controller.signal.aborted)
          dispatch({ type: "fetch_error", payload: getApiErrorMessage(err) });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), tick]);

  return { ...state, refresh };
}

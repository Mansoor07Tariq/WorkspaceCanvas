import { useEffect, useReducer, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
import { listFloorBookings } from "../api/bookingApi";
import type { DeskBooking } from "../types/booking.types";

interface State {
  bookings: DeskBooking[];
  loading: boolean;
  error: string | undefined;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: DeskBooking[] }
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

// TD-044: office+floor ids are globally unique, so date alone disambiguates the
// rest of the scope and this key is org-safe (a selected-org switch lands on a
// different office/floor). Book/cancel mutations clear the whole `deskBookings:`
// namespace via invalidateBookingCaches() so no stale availability is served.
function deskBookingsCacheKey(officeId: number, floorId: number, date: string): string {
  return `deskBookings:${officeId}:${floorId}:${date}`;
}

export function useDeskBookings(officeId: number, floorId: number, date: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  function refresh() {
    forceRef.current = true;
    setTick((t) => t + 1);
  }

  useEffect(() => {
    // Missing scope: render an empty list but never cache it (would mask a real
    // empty/non-empty result for a valid office/floor/date).
    if (!officeId || !floorId || !date) {
      dispatch({ type: "fetch_success", payload: [] });
      return;
    }

    const cacheKey = deskBookingsCacheKey(officeId, floorId, date);
    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = getCachedValue<DeskBooking[]>(cacheKey);
      if (cached !== undefined) {
        dispatch({ type: "fetch_success", payload: cached });
        return;
      }
    }

    const controller = new AbortController();
    dispatch({ type: "fetch_start" });

    listFloorBookings(officeId, floorId, date)
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

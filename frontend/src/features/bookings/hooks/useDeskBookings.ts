import { useEffect, useReducer, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
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

export function useDeskBookings(officeId: number, floorId: number, date: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);

  function refresh() {
    setTick((t) => t + 1);
  }

  useEffect(() => {
    if (!officeId || !floorId || !date) {
      dispatch({ type: "fetch_success", payload: [] });
      return;
    }
    let cancelled = false;
    dispatch({ type: "fetch_start" });

    listFloorBookings(officeId, floorId, date)
      .then((data) => {
        if (!cancelled) dispatch({ type: "fetch_success", payload: data });
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: "fetch_error", payload: getApiErrorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [officeId, floorId, date, tick]);

  return { ...state, refresh };
}

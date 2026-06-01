import { useEffect, useReducer, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { listMyBookings, cancelMyBooking } from "../api/bookingApi";
import type { DeskBooking, MyBookingQueryParams } from "../types/booking.types";

interface State {
  bookings: DeskBooking[];
  loading: boolean;
  error: string | undefined;
  cancelSuccess: string | undefined;
  cancelError: string | undefined;
}

type Action =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: DeskBooking[] }
  | { type: "fetch_error"; payload: string }
  | { type: "cancel_success"; payload: string }
  | { type: "cancel_error"; payload: string }
  | { type: "cancel_clear" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: undefined };
    case "fetch_success":
      return { ...state, bookings: action.payload, loading: false, error: undefined };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
    case "cancel_success":
      return { ...state, cancelSuccess: action.payload, cancelError: undefined };
    case "cancel_error":
      return { ...state, cancelError: action.payload, cancelSuccess: undefined };
    case "cancel_clear":
      return { ...state, cancelSuccess: undefined, cancelError: undefined };
  }
}

const initialState: State = {
  bookings: [],
  loading: true,
  error: undefined,
  cancelSuccess: undefined,
  cancelError: undefined,
};

export function useMyBookings(params?: MyBookingQueryParams) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);

  function refresh() {
    setTick((t) => t + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    dispatch({ type: "fetch_start" });
    listMyBookings(params)
      .then((data) => {
        if (!cancelled) dispatch({ type: "fetch_success", payload: data });
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

  async function cancelBooking(bookingId: number): Promise<void> {
    dispatch({ type: "cancel_clear" });
    try {
      await cancelMyBooking(bookingId);
      dispatch({ type: "cancel_success", payload: "Booking cancelled successfully." });
      refresh();
    } catch (err) {
      dispatch({ type: "cancel_error", payload: getApiErrorMessage(err) });
    }
  }

  return {
    ...state,
    refresh,
    cancelBooking,
  };
}

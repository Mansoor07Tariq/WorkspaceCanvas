import { useEffect, useReducer, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { getCachedValue, setCachedValue } from "@/lib/api/requestCache";
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

// TD-044: my-bookings span all of the user's active orgs (the backend scopes to
// request.user), so the per-user cache only needs the query filters in the key.
// Book/cancel anywhere clears the whole `myBookings:` namespace.
function myBookingsCacheKey(params?: MyBookingQueryParams): string {
  return `myBookings:${params?.status ?? ""}:${params?.from ?? ""}:${params?.to ?? ""}`;
}

export function useMyBookings(params?: MyBookingQueryParams) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false);

  function refresh() {
    forceRef.current = true;
    setTick((t) => t + 1);
  }

  useEffect(() => {
    const cacheKey = myBookingsCacheKey(params);
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
    let cancelled = false;
    dispatch({ type: "fetch_start" });
    listMyBookings(params)
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

  async function cancelBooking(bookingId: number): Promise<void> {
    dispatch({ type: "cancel_clear" });
    try {
      await cancelMyBooking(bookingId);
      dispatch({ type: "cancel_success", payload: "Booking cancelled successfully." });
      // cancelMyBooking() clears the myBookings:/deskBookings: namespaces; refresh
      // bypasses the cache to refetch this view immediately.
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

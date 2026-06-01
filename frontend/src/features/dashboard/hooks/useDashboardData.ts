import { useEffect, useReducer } from "react";
import { useOffices } from "@/features/offices/hooks/useOffices";
import { useMyBookings } from "@/features/bookings/hooks/useMyBookings";
import { listFloors } from "@/features/floors/api/floorApi";
import { listDesks } from "@/features/desks/api/deskApi";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import type { Floor } from "@/features/floors/types/floor.types";
import type { Desk } from "@/features/desks/types/desk.types";
import type { DeskBooking } from "@/features/bookings/types/booking.types";
import type { Office } from "@/features/offices/types/office.types";

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── Floors reducer ───────────────────────────────────────────────────────────

interface FloorsState {
  floors: Floor[];
  loading: boolean;
  error: string | null;
}

type FloorsAction =
  | { type: "reset" }
  | { type: "start" }
  | { type: "success"; payload: Floor[] }
  | { type: "error"; payload: string };

function floorsReducer(state: FloorsState, action: FloorsAction): FloorsState {
  switch (action.type) {
    case "reset":
      return { floors: [], loading: false, error: null };
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return { floors: action.payload, loading: false, error: null };
    case "error":
      return { ...state, loading: false, error: action.payload };
  }
}

// ─── Desks reducer ────────────────────────────────────────────────────────────

interface DesksState {
  desks: Desk[];
  loading: boolean;
}

type DesksAction =
  | { type: "reset" }
  | { type: "start" }
  | { type: "success"; payload: Desk[] }
  | { type: "error" };

function desksReducer(state: DesksState, action: DesksAction): DesksState {
  switch (action.type) {
    case "reset":
      return { desks: [], loading: false };
    case "start":
      return { ...state, loading: true };
    case "success":
      return { desks: action.payload, loading: false };
    case "error":
      return { ...state, loading: false };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface DashboardDataResult {
  offices: Office[];
  officesLoading: boolean;
  officesError: string | null;
  floors: Floor[];
  floorsLoading: boolean;
  floorsError: string | null;
  desks: Desk[];
  desksLoading: boolean;
  bookings: DeskBooking[];
  bookingsLoading: boolean;
  bookingsError: string | undefined;
  today: string;
  firstOffice: Office | null;
  firstFloor: Floor | null;
}

export function useDashboardData(): DashboardDataResult {
  const today = getTodayString();

  const { offices, loading: officesLoading, error: officesError } = useOffices();
  const firstOffice = offices[0] ?? null;

  const [floorsState, dispatchFloors] = useReducer(floorsReducer, {
    floors: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (officesLoading) return;
    if (!firstOffice) {
      dispatchFloors({ type: "reset" });
      return;
    }
    let cancelled = false;
    dispatchFloors({ type: "start" });
    listFloors(firstOffice.id)
      .then((data) => {
        if (!cancelled) dispatchFloors({ type: "success", payload: data });
      })
      .catch((err: unknown) => {
        if (!cancelled) dispatchFloors({ type: "error", payload: getApiErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstOffice?.id, officesLoading]);

  const firstFloor = floorsState.floors[0] ?? null;

  const [desksState, dispatchDesks] = useReducer(desksReducer, {
    desks: [],
    loading: true,
  });

  useEffect(() => {
    if (floorsState.loading) return;
    if (!firstOffice || !firstFloor) {
      dispatchDesks({ type: "reset" });
      return;
    }
    let cancelled = false;
    dispatchDesks({ type: "start" });
    listDesks(firstOffice.id, firstFloor.id)
      .then((data) => {
        if (!cancelled) dispatchDesks({ type: "success", payload: data });
      })
      .catch(() => {
        if (!cancelled) dispatchDesks({ type: "error" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstFloor?.id, floorsState.loading]);

  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useMyBookings({
    from: today,
    status: "active",
  });

  return {
    offices,
    officesLoading,
    officesError,
    floors: floorsState.floors,
    floorsLoading: floorsState.loading,
    floorsError: floorsState.error,
    desks: desksState.desks,
    desksLoading: desksState.loading,
    bookings,
    bookingsLoading,
    bookingsError,
    today,
    firstOffice,
    firstFloor,
  };
}

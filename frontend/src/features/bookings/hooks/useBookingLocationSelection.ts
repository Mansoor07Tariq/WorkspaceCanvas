import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useOffices } from "@/features/offices/hooks/useOffices";
import { useFloors } from "@/features/floors/hooks/useFloors";
import type { Office } from "@/features/offices/types/office.types";
import type { Floor } from "@/features/floors/types/floor.types";
import { todayLocalDate, validateBookingDate } from "../utils/bookingValidation";
import { loadLastOfficeFloor, saveLastOfficeFloor } from "../utils/lastOfficeFloor";

/**
 * Office/floor/date selection shared by the desk and room booking pages (PR 074).
 *
 * Owns exactly what was inline in DeskBookingPage since PR 070/071 and nothing
 * else: office + floor loading, the three selection values, URL deep-linking
 * (replace-based so Back leaves in one hit), and the remembered last office/floor
 * pair (localStorage, restored on a param-less arrival; URL params always win).
 *
 * Remembered-pair decision (PR 074): desk and room pages SHARE the same remembered
 * pair (key `wc.booking.lastOfficeFloor.v1`) — a user's office/floor doesn't change
 * with the resource type, so landing on either page restores the same last choice.
 * Resource-specific state (selected desk, room slot, feedback) stays in each page.
 */
export interface BookingLocationSelection {
  offices: Office[];
  officesLoading: boolean;
  officesError: string | null;
  floors: Floor[];
  floorsLoading: boolean;
  floorsError: string | null;
  selectedOfficeId: number | "";
  selectedFloorId: number | "";
  selectedDate: string;
  selectedFloor: Floor | undefined;
  officeSelected: boolean;
  floorSelected: boolean;
  /** Set the office and reset the floor (mirrors the desk-page cascade). */
  selectOffice: (officeId: number | "") => void;
  /** Set the floor and remember the actively-chosen office/floor pair. */
  selectFloor: (floorId: number | "") => void;
  selectDate: (date: string) => void;
}

export function useBookingLocationSelection(
  organizationId: number | null | undefined
): BookingLocationSelection {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramId = (key: string): number | null => {
    const n = Number(searchParams.get(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  // Did the URL carry an office/floor selection on arrival? If so it wins over the
  // remembered pair (captured once — before the sync effect rewrites the URL).
  const arrivedWithSelectionRef = useRef(searchParams.has("office") || searchParams.has("floor"));

  const [selectedOfficeId, setSelectedOfficeId] = useState<number | "">(
    () => paramId("office") ?? ""
  );
  const [selectedFloorId, setSelectedFloorId] = useState<number | "">(() => paramId("floor") ?? "");
  // Date from the URL if valid + in range; otherwise today (PR 071).
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = searchParams.get("date");
    return d && validateBookingDate(d) === null ? d : todayLocalDate();
  });
  // Guards the one-shot remembered-pair restore (PR 071).
  const restoredRef = useRef(false);

  const { offices, loading: officesLoading, error: officesError } = useOffices(organizationId);

  const floorOfficeId = typeof selectedOfficeId === "number" ? selectedOfficeId : 0;
  const { floors, loading: floorsLoading, error: floorsError } = useFloors(floorOfficeId);

  const floorId = typeof selectedFloorId === "number" ? selectedFloorId : 0;
  const selectedFloor = floors.find((f) => f.id === floorId);
  const officeSelected = typeof selectedOfficeId === "number" && selectedOfficeId > 0;
  const floorSelected = typeof selectedFloorId === "number" && selectedFloorId > 0;

  function selectOffice(officeId: number | "") {
    setSelectedOfficeId(officeId);
    setSelectedFloorId("");
  }

  function selectFloor(floorIdValue: number | "") {
    setSelectedFloorId(floorIdValue);
    // Remember the actively-chosen office/floor pair (PR 071) — only on real selection.
    if (typeof floorIdValue === "number" && typeof selectedOfficeId === "number") {
      saveLastOfficeFloor(selectedOfficeId, floorIdValue);
    }
  }

  function selectDate(date: string) {
    setSelectedDate(date);
  }

  // Keep the URL in sync with the current office/floor/date (PR 071) so the page is
  // shareable + refresh-safe. `replace` (not push) so Back leaves the page in one hit.
  useEffect(() => {
    const next = new URLSearchParams();
    if (typeof selectedOfficeId === "number") next.set("office", String(selectedOfficeId));
    if (typeof selectedFloorId === "number") next.set("floor", String(selectedFloorId));
    if (selectedDate) next.set("date", selectedDate);
    setSearchParams(next, { replace: true });
  }, [selectedOfficeId, selectedFloorId, selectedDate, setSearchParams]);

  // Restore the last-used office/floor when arriving WITHOUT url params (PR 071). Runs
  // in two passes (office once offices load, then floor once that office's floors load);
  // stale ids fall back to empty selection silently. URL params always win. This is a
  // genuine "set state after async lists load" — it can't be a lazy initialiser because
  // the offices/floors aren't loaded at mount — hence the targeted rule suppression.
  useEffect(() => {
    if (arrivedWithSelectionRef.current || restoredRef.current) return;
    const remembered = loadLastOfficeFloor();
    if (!remembered) {
      restoredRef.current = true;
      return;
    }
    if (selectedOfficeId === "") {
      if (officesLoading) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (offices.some((o) => o.id === remembered.office)) setSelectedOfficeId(remembered.office);
      else restoredRef.current = true; // stale office → give up silently
      return;
    }
    if (selectedOfficeId === remembered.office && !floorsLoading) {
      if (floors.some((f) => f.id === remembered.floor)) setSelectedFloorId(remembered.floor);
      restoredRef.current = true; // done (floor found or not)
    }
  }, [offices, officesLoading, floors, floorsLoading, selectedOfficeId]);

  return {
    offices,
    officesLoading,
    officesError,
    floors,
    floorsLoading,
    floorsError,
    selectedOfficeId,
    selectedFloorId,
    selectedDate,
    selectedFloor,
    officeSelected,
    floorSelected,
    selectOffice,
    selectFloor,
    selectDate,
  };
}

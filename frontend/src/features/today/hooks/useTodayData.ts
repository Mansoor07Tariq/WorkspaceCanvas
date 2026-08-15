import { useEffect, useMemo, useState } from "react";

import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useOffices } from "@/features/offices/hooks/useOffices";
import { useFloors } from "@/features/floors/hooks/useFloors";
import { useDesks } from "@/features/desks/hooks/useDesks";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { useDeskBookings } from "@/features/bookings/hooks/useDeskBookings";
import { useBookingAvailability } from "@/features/bookings/hooks/useBookingAvailability";
import {
  loadLastOfficeFloor,
  saveLastOfficeFloor,
} from "@/features/bookings/utils/lastOfficeFloor";
import { makeFloorBoundary } from "@/features/layoutObjects/utils/coordinateHelpers";
import type { DeskBooking } from "@/features/bookings/types/booking.types";
import type { Office } from "@/features/offices/types/office.types";
import type { Floor } from "@/features/floors/types/floor.types";
import { buildWeekDays } from "../utils/todayLogic";
import type { OccupantPoint, WeekDay } from "../utils/todayLogic";
import { useUsualDesk } from "./useUsualDesk";
import type { UsualDesk } from "../api/usualDeskApi";

/** Per-day summary for the week strip (light — no positions needed). */
export interface DaySummary {
  day: WeekDay;
  bookings: DeskBooking[];
  /** the viewer's active booking that day, if any */
  myBooking: DeskBooking | null;
  /** other people's active bookings that day (for avatars) */
  others: DeskBooking[];
  loading: boolean;
}

export interface TodayData {
  orgId: number | null;
  orgName: string | null;

  offices: Office[];
  selectedOffice: Office | null;
  selectOffice: (officeId: number) => void;
  /** the remembered office is treated as the DEFAULT for the badge */
  defaultOfficeId: number | null;

  floors: Floor[];
  selectedFloor: Floor | null;
  selectFloor: (floorId: number) => void;

  week: WeekDay[];
  selectedDayIndex: number;
  selectDay: (index: number) => void;

  /** per-day summaries for the week strip (index-aligned with `week`) */
  days: DaySummary[];

  /** full availability for the SELECTED day (map + near-you) */
  selectedDayBookings: DeskBooking[];
  occupants: OccupantPoint[];
  myOccupant: OccupantPoint | null;
  usualDesk: UsualDesk | null;
  usualDeskPoint: { x: number; y: number } | null;
  layoutObjects: ReturnType<typeof useLayoutObjects>["objects"];
  boundary: ReturnType<typeof makeFloorBoundary> | undefined;
  availability: ReturnType<typeof useBookingAvailability>;

  loading: {
    offices: boolean;
    floors: boolean;
    map: boolean;
    week: boolean;
  };
  errors: {
    offices: string | null;
    floors: string | null;
    map: string | null;
    usualDesk: string | undefined;
  };
}

function centre(lo: { x: string; y: string; width: string; height: string }): {
  x: number;
  y: number;
} {
  return { x: Number(lo.x) + Number(lo.width) / 2, y: Number(lo.y) + Number(lo.height) / 2 };
}

/**
 * Everything the Today screen renders (PR 079). Composes the existing per-scope hooks:
 * offices/floors/desks/layoutObjects plus five per-day floor-booking fetches (cached
 * under `deskBookings:<office>:<floor>:<date>`, invalidated on book/cancel) and the usual
 * desk. Office/floor selection persists through the shared `lastOfficeFloor` (PR 071) so
 * Today and the booking page agree on the remembered pair.
 *
 * Selection is DERIVED (no state-sync effects — the repo forbids setState-in-effect): an
 * explicit user override wins, else the remembered pair, else the first item. The
 * remembered pair is persisted by a side-effect-only effect (a localStorage write, not a
 * setState) whenever the resolved office+floor settle.
 */
export function useTodayData(): TodayData {
  const { selectedMembership } = useSelectedOrganization();
  const orgId = selectedMembership?.organization_id ?? null;
  const orgName = selectedMembership?.organization_name ?? null;

  const { offices, loading: officesLoading, error: officesError } = useOffices(orgId);

  const remembered = useMemo(() => loadLastOfficeFloor(), []);
  const defaultOfficeId = remembered?.office ?? null;

  const [officeOverride, setOfficeOverride] = useState<number | null>(null);
  const [floorOverride, setFloorOverride] = useState<number | null>(null);

  const selectedOfficeId = useMemo(() => {
    if (officeOverride != null && offices.some((o) => o.id === officeOverride)) {
      return officeOverride;
    }
    if (remembered != null && offices.some((o) => o.id === remembered.office)) {
      return remembered.office;
    }
    return offices[0]?.id ?? null;
  }, [officeOverride, offices, remembered]);

  const selectedOffice = offices.find((o) => o.id === selectedOfficeId) ?? null;

  const { floors, loading: floorsLoading, error: floorsError } = useFloors(selectedOfficeId ?? 0);
  const bookableFloors = useMemo(
    () => floors.filter((f) => f.status === "published" && f.is_active),
    [floors]
  );

  const selectedFloorId = useMemo(() => {
    if (floorOverride != null && bookableFloors.some((f) => f.id === floorOverride)) {
      return floorOverride;
    }
    if (
      remembered != null &&
      remembered.office === selectedOfficeId &&
      bookableFloors.some((f) => f.id === remembered.floor)
    ) {
      return remembered.floor;
    }
    return bookableFloors[0]?.id ?? null;
  }, [floorOverride, bookableFloors, remembered, selectedOfficeId]);

  const selectedFloor = bookableFloors.find((f) => f.id === selectedFloorId) ?? null;

  // Persist the remembered pair when the resolved selection settles. This is a pure
  // external write (no setState) so it doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    if (selectedOfficeId != null && selectedFloorId != null) {
      saveLastOfficeFloor(selectedOfficeId, selectedFloorId);
    }
  }, [selectedOfficeId, selectedFloorId]);

  const officeId = selectedOfficeId ?? 0;
  const floorId = selectedFloorId ?? 0;

  const { desks, loading: desksLoading, error: desksError } = useDesks(officeId, floorId);
  const { objects: layoutObjects, loading: layoutLoading } = useLayoutObjects(officeId, floorId);
  const { usualDesk, error: usualDeskError } = useUsualDesk(orgId);

  const week = useMemo(() => buildWeekDays(new Date()), []);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const idx = week.findIndex((d) => d.isToday);
    return idx === -1 ? 0 : idx;
  });

  // Five per-day floor-booking fetches (the week is always 5 weekdays → fixed hook count).
  const d0 = useDeskBookings(officeId, floorId, week[0].iso);
  const d1 = useDeskBookings(officeId, floorId, week[1].iso);
  const d2 = useDeskBookings(officeId, floorId, week[2].iso);
  const d3 = useDeskBookings(officeId, floorId, week[3].iso);
  const d4 = useDeskBookings(officeId, floorId, week[4].iso);
  const perDay = useMemo(() => [d0, d1, d2, d3, d4], [d0, d1, d2, d3, d4]);

  const days: DaySummary[] = useMemo(
    () =>
      week.map((day, i) => {
        const active = perDay[i].bookings.filter((b) => b.status === "active");
        const myBooking = active.find((b) => b.is_mine) ?? null;
        const others = active.filter((b) => !b.is_mine);
        return { day, bookings: active, myBooking, others, loading: perDay[i].loading };
      }),
    [week, perDay]
  );

  const selectedDayBookings = useMemo(
    () => days[selectedDayIndex]?.bookings ?? [],
    [days, selectedDayIndex]
  );
  const availability = useBookingAvailability(desks, selectedDayBookings, layoutObjects);

  const layoutById = useMemo(() => {
    const m = new Map<number, (typeof layoutObjects)[number]>();
    for (const lo of layoutObjects) m.set(lo.id, lo);
    return m;
  }, [layoutObjects]);

  const occupants: OccupantPoint[] = useMemo(
    () =>
      selectedDayBookings.map((b) => {
        const lo = layoutById.get(b.layout_object);
        const point = lo ? centre(lo) : { x: 0, y: 0 };
        return {
          deskId: b.desk,
          layoutObjectId: b.layout_object,
          userId: b.user ?? null,
          userName: b.user_name,
          isMine: b.is_mine,
          x: point.x,
          y: point.y,
        };
      }),
    [selectedDayBookings, layoutById]
  );

  const myOccupant = occupants.find((o) => o.isMine) ?? null;

  const usualDeskPoint = useMemo(() => {
    if (!usualDesk) return null;
    const lo = layoutById.get(usualDesk.layout_object);
    return lo ? centre(lo) : null;
  }, [usualDesk, layoutById]);

  const boundary = useMemo(() => {
    if (!selectedFloor) return undefined;
    const w = Number(selectedFloor.boundary_width) || 0;
    const h = Number(selectedFloor.boundary_height) || 0;
    if (w <= 0 || h <= 0) return undefined;
    return makeFloorBoundary(w, h);
  }, [selectedFloor]);

  function selectOffice(id: number) {
    setOfficeOverride(id);
    setFloorOverride(null); // re-resolve floor for the new office
  }

  function selectFloor(id: number) {
    setFloorOverride(id);
  }

  return {
    orgId,
    orgName,
    offices,
    selectedOffice,
    selectOffice,
    defaultOfficeId,
    floors: bookableFloors,
    selectedFloor,
    selectFloor,
    week,
    selectedDayIndex,
    selectDay: setSelectedDayIndex,
    days,
    selectedDayBookings,
    occupants,
    myOccupant,
    usualDesk,
    usualDeskPoint,
    layoutObjects,
    boundary,
    availability,
    loading: {
      offices: officesLoading,
      floors: floorsLoading,
      map: desksLoading || layoutLoading,
      week: perDay.some((d) => d.loading),
    },
    errors: {
      offices: officesError,
      floors: floorsError,
      map: desksError ?? null,
      usualDesk: usualDeskError,
    },
  };
}

import { useMemo } from "react";
import type { Desk } from "@/features/desks/types/desk.types";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type { DeskBooking } from "../types/booking.types";
import {
  buildDeskAvailability,
  countAvailability,
  getMyBookingForDate,
} from "../utils/bookingAvailability";
import type { DeskAvailabilityItem, AvailabilityCounts } from "../utils/bookingAvailability";

interface UseBookingAvailabilityResult {
  items: DeskAvailabilityItem[];
  counts: AvailabilityCounts;
  myBooking: DeskBooking | null;
}

export function useBookingAvailability(
  desks: Desk[],
  bookings: DeskBooking[],
  layoutObjects: LayoutObject[]
): UseBookingAvailabilityResult {
  const items = useMemo(
    () => buildDeskAvailability({ desks, bookings, layoutObjects }),
    [desks, bookings, layoutObjects]
  );

  const counts = useMemo(() => countAvailability(items), [items]);

  const myBooking = useMemo(() => getMyBookingForDate(bookings), [bookings]);

  return { items, counts, myBooking };
}

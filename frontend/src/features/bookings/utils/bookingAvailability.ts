import type { Desk } from "@/features/desks/types/desk.types";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type { DeskBooking } from "../types/booking.types";

export type DeskAvailabilityStatus = "available" | "reserved" | "bookedByMe" | "unavailable";

export interface DeskAvailabilityItem {
  desk: Desk;
  layoutObject: LayoutObject | null;
  booking: DeskBooking | null;
  status: DeskAvailabilityStatus;
  isMine: boolean;
  label: string;
}

export interface AvailabilityCounts {
  available: number;
  reserved: number;
  bookedByMe: number;
  unavailable: number;
  myBooking: DeskAvailabilityItem | null;
}

interface BuildDeskAvailabilityParams {
  desks: Desk[];
  bookings: DeskBooking[];
  layoutObjects: LayoutObject[];
}

const STATUS_LABELS: Record<DeskAvailabilityStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  bookedByMe: "Your booking",
  unavailable: "Unavailable",
};

export function buildDeskAvailability({
  desks,
  bookings,
  layoutObjects,
}: BuildDeskAvailabilityParams): DeskAvailabilityItem[] {
  const bookingByDeskId = new Map<number, DeskBooking>();
  for (const booking of bookings) {
    if (booking.status === "active") {
      bookingByDeskId.set(booking.desk, booking);
    }
  }

  const layoutObjectById = new Map<number, LayoutObject>();
  for (const lo of layoutObjects) {
    layoutObjectById.set(lo.id, lo);
  }

  return desks.map((desk): DeskAvailabilityItem => {
    const layoutObject = layoutObjectById.get(desk.layout_object) ?? null;
    const booking = bookingByDeskId.get(desk.id) ?? null;

    let status: DeskAvailabilityStatus;

    if (!desk.is_active || desk.status === "maintenance" || desk.status === "unavailable") {
      status = "unavailable";
    } else if (booking?.is_mine === true) {
      status = "bookedByMe";
    } else if (booking !== null) {
      status = "reserved";
    } else {
      status = "available";
    }

    // Only expose the booking object for the current user's own booking.
    // Reserved desks must not carry another user's identity data in the UI.
    const exposedBooking = status === "bookedByMe" ? booking : null;

    return {
      desk,
      layoutObject,
      booking: exposedBooking,
      status,
      isMine: booking?.is_mine === true,
      label: STATUS_LABELS[status],
    };
  });
}

export function getMyBookingForDate(bookings: DeskBooking[]): DeskBooking | null {
  return bookings.find((b) => b.is_mine === true && b.status === "active") ?? null;
}

export function countAvailability(items: DeskAvailabilityItem[]): AvailabilityCounts {
  let available = 0;
  let reserved = 0;
  let bookedByMe = 0;
  let unavailable = 0;
  let myBooking: DeskAvailabilityItem | null = null;

  for (const item of items) {
    switch (item.status) {
      case "available":
        available++;
        break;
      case "reserved":
        reserved++;
        break;
      case "bookedByMe":
        bookedByMe++;
        myBooking = item;
        break;
      case "unavailable":
        unavailable++;
        break;
    }
  }

  return { available, reserved, bookedByMe, unavailable, myBooking };
}

export function canBookDesk(item: DeskAvailabilityItem, hasMyBooking: boolean): boolean {
  return item.status === "available" && !hasMyBooking;
}

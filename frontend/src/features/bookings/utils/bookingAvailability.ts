import type { Desk } from "@/features/desks/types/desk.types";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type { DeskBooking } from "../types/booking.types";

export type DeskAvailabilityStatus = "available" | "reserved" | "bookedByMe" | "unavailable";

/** Who a booked desk belongs to, for the on-desk identity tile (PR 080 B3). */
export type OccupantKind = "me" | "colleague" | "guest";

export interface OccupantIdentity {
  kind: OccupantKind;
  /** Display name — used for initials + as the tile's aria label. */
  name: string;
  /** Photo URL, or null → the tile shows coloured initials instead. */
  avatarUrl: string | null;
  /** User id → stable avatar colour (`avatarColor`); null falls back to a name hash. */
  colorKey: number | null;
}

export interface DeskAvailabilityItem {
  desk: Desk;
  layoutObject: LayoutObject | null;
  booking: DeskBooking | null;
  status: DeskAvailabilityStatus;
  isMine: boolean;
  label: string;
  /**
   * Identity of the person who booked this desk, for the on-desk tile. Present only for
   * booked desks whose occupant the server let us see (same-org). Null for free desks and
   * for masked bookings (server sent `user_name === "Reserved"`) — those render no tile.
   */
  occupant: OccupantIdentity | null;
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
      occupant: deriveOccupant(status, booking),
    };
  });
}

/**
 * Derive the on-desk occupant identity from a booking. The server has already applied
 * same-org masking (PR 080 B1.5): a masked booking arrives with `user_name === "Reserved"`
 * and `user_avatar` null, so we surface NO occupant for it (the desk shows the bare booked
 * sprite, no tile). This reads the real booking (not `exposedBooking`) precisely so a
 * colleague's server-visible identity survives to the canvas — the client no longer
 * double-masks same-org colleagues the way it did before B1.5.
 */
function deriveOccupant(
  status: DeskAvailabilityStatus,
  booking: DeskBooking | null
): OccupantIdentity | null {
  if (booking === null || (status !== "bookedByMe" && status !== "reserved")) {
    return null;
  }
  const name = (booking.user_name ?? "").trim();
  // "Reserved" is the server's mask sentinel — never render it as a person.
  if (!name || name === "Reserved") {
    return null;
  }
  return {
    kind: status === "bookedByMe" ? "me" : "colleague",
    name,
    avatarUrl: booking.user_avatar ?? null,
    colorKey: booking.user ?? null,
  };
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

/**
 * Builds a map from layoutObject.id → DeskAvailabilityStatus for canvas rendering.
 * Only items that have a linked layoutObject are included.
 * No booking identity is included — status only.
 */
export function buildAvailabilityByLayoutObjectId(
  items: DeskAvailabilityItem[]
): Map<number, DeskAvailabilityStatus> {
  const map = new Map<number, DeskAvailabilityStatus>();
  for (const item of items) {
    if (item.layoutObject !== null) {
      map.set(item.layoutObject.id, item.status);
    }
  }
  return map;
}

/**
 * Builds a map from layoutObject.id → occupant identity for the on-desk tiles. Only
 * booked desks with a server-visible occupant are included; the canvas layer reads flat
 * scalars off each entry per node, so — like {@link buildAvailabilityByLayoutObjectId} —
 * the map's own reference identity does not affect the render-count guarantee.
 */
export function buildOccupantByLayoutObjectId(
  items: DeskAvailabilityItem[]
): Map<number, OccupantIdentity> {
  const map = new Map<number, OccupantIdentity>();
  for (const item of items) {
    if (item.layoutObject !== null && item.occupant !== null) {
      map.set(item.layoutObject.id, item.occupant);
    }
  }
  return map;
}

/**
 * Given an availability-by-layout-object-id map and a selected desk's availability item,
 * returns the layout object id of the selected desk, or null.
 */
export function getSelectedLayoutObjectId(
  selectedItem: DeskAvailabilityItem | null
): number | null {
  return selectedItem?.layoutObject?.id ?? null;
}

/**
 * Given an availability map and a layout object id clicked on the canvas,
 * finds the desk id for that layout object.
 */
export function findDeskIdByLayoutObjectId(
  items: DeskAvailabilityItem[],
  layoutObjectId: number
): number | null {
  const item = items.find((i) => i.layoutObject?.id === layoutObjectId);
  return item?.desk.id ?? null;
}

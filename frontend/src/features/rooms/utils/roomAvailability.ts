/**
 * Slot-aware room availability for the floor map (PR 075).
 *
 * Reuses the Slice 2 `slotConflicts` overlap math (does NOT re-implement overlap)
 * to classify each active room's status for a chosen office-local slot, reusing the
 * SAME `DeskAvailabilityStatus` palette the desk map uses. Pure + unit-tested; the
 * result is a `layoutObject.id → status` map that flows to the canvas as a memoized
 * prop (recomputed only when rooms/bookings/slot change — never per frame).
 */
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import type { MeetingRoom, RoomBooking } from "../types/room.types";
import { slotConflicts } from "./roomTimeline";

/** Status of one room for a slot: mine wins over reserved wins over available. */
export function roomSlotStatus(
  roomBookings: RoomBooking[],
  timeZone: string,
  startMin: number,
  endMin: number
): DeskAvailabilityStatus {
  const mine = roomBookings.filter((b) => b.status === "active" && b.is_mine);
  const others = roomBookings.filter((b) => b.status === "active" && !b.is_mine);
  if (slotConflicts(mine, timeZone, startMin, endMin)) return "bookedByMe";
  if (slotConflicts(others, timeZone, startMin, endMin)) return "reserved";
  return "available";
}

/**
 * Build a `layoutObject.id → DeskAvailabilityStatus` map for the room-capable
 * objects that have an active MeetingRoom, for the chosen slot. Rooms that aren't
 * bookable (inactive / maintenance / unavailable) are `unavailable`. No booking
 * identity is included — status only.
 */
export function buildRoomAvailabilityByLayoutObjectId(
  rooms: MeetingRoom[],
  bookings: RoomBooking[],
  timeZone: string,
  startMin: number,
  endMin: number
): Map<number, DeskAvailabilityStatus> {
  const byRoom = new Map<number, RoomBooking[]>();
  for (const b of bookings) {
    if (b.status !== "active") continue;
    const list = byRoom.get(b.room) ?? [];
    list.push(b);
    byRoom.set(b.room, list);
  }

  const map = new Map<number, DeskAvailabilityStatus>();
  for (const room of rooms) {
    if (!room.is_active) continue;
    const status: DeskAvailabilityStatus =
      room.status !== "available"
        ? "unavailable"
        : roomSlotStatus(byRoom.get(room.id) ?? [], timeZone, startMin, endMin);
    map.set(room.layout_object, status);
  }
  return map;
}

/** Reverse lookup: which room owns a layout object (for map-click → card focus). */
export function findRoomIdByLayoutObjectId(
  rooms: MeetingRoom[],
  layoutObjectId: number
): number | null {
  return rooms.find((r) => r.layout_object === layoutObjectId)?.id ?? null;
}

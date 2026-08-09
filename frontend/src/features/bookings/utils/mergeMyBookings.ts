import type { DeskBooking } from "../types/booking.types";
import type { RoomBooking } from "@/features/rooms/types/room.types";
import type { MyBooking } from "../types/myBookings.types";

/**
 * Tag desk + room bookings with their `resource_type` and concatenate them into a
 * single list (PR 075). Pure — grouping/sorting is `groupMyBookings`' job. Either
 * input may be empty (e.g. one endpoint failed) and the merge still returns the
 * other half, so the UI degrades to partial data rather than a blank page.
 */
export function mergeMyBookings(
  deskBookings: DeskBooking[],
  roomBookings: RoomBooking[]
): MyBooking[] {
  const desks: MyBooking[] = deskBookings.map((b) => ({ ...b, resource_type: "desk" }));
  const rooms: MyBooking[] = roomBookings.map((b) => ({ ...b, resource_type: "room" }));
  return [...desks, ...rooms];
}

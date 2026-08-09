import type { DeskBooking } from "./booking.types";
import type { RoomBooking } from "@/features/rooms/types/room.types";

/**
 * A My-Bookings entry, discriminated by `resource_type`. Desk and room bookings
 * come from two clean endpoints (`bookings/my/` + `bookings/my/rooms/`) and are
 * tagged + merged client-side (PR 075). Consumers branch on `resource_type` and
 * render only the fields the API returned (identity masking is respected upstream).
 */
export type MyBooking =
  | (DeskBooking & { resource_type: "desk" })
  | (RoomBooking & { resource_type: "room" });

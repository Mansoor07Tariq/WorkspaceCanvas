import { MyBookingCard } from "./MyBookingCard";
import { MyRoomBookingCard } from "@/features/rooms/components/MyRoomBookingCard";
import type { MyBooking } from "../types/myBookings.types";

interface Props {
  bookings: MyBooking[];
  /** Omitted for non-active views (Past/Cancelled) — no cancel affordance there. */
  onCancel?: (booking: MyBooking) => void;
  onBookAgain?: (booking: MyBooking) => void;
  cancellingId?: number | null;
  /** Office IANA timezone for a room booking's office (rooms render office-local time). */
  resolveTimeZone: (officeId: number) => string;
}

export function MyBookingsList({
  bookings,
  onCancel,
  onBookAgain,
  cancellingId,
  resolveTimeZone,
}: Props) {
  if (bookings.length === 0) return null;

  return (
    <>
      {bookings.map((booking) =>
        booking.resource_type === "room" ? (
          <MyRoomBookingCard
            key={`room-${booking.id}`}
            booking={booking}
            timeZone={resolveTimeZone(booking.office)}
            onCancel={onCancel ? () => onCancel(booking) : undefined}
            onBookAgain={onBookAgain ? () => onBookAgain(booking) : undefined}
            cancelling={cancellingId === booking.id}
          />
        ) : (
          <MyBookingCard
            key={`desk-${booking.id}`}
            booking={booking}
            onCancel={onCancel ? () => onCancel(booking) : undefined}
            onBookAgain={onBookAgain ? () => onBookAgain(booking) : undefined}
            cancelling={cancellingId === booking.id}
          />
        )
      )}
    </>
  );
}

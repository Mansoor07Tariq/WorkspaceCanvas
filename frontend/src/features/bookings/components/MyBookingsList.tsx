import { MyBookingCard } from "./MyBookingCard";
import type { DeskBooking } from "../types/booking.types";

interface Props {
  bookings: DeskBooking[];
  /** Omitted for non-active views (Past/Cancelled) — no cancel affordance there. */
  onCancel?: (id: number) => void;
  onBookAgain?: (booking: DeskBooking) => void;
  cancellingId?: number | null;
}

export function MyBookingsList({ bookings, onCancel, onBookAgain, cancellingId }: Props) {
  if (bookings.length === 0) return null;

  return (
    <>
      {bookings.map((booking) => (
        <MyBookingCard
          key={booking.id}
          booking={booking}
          onCancel={onCancel}
          onBookAgain={onBookAgain}
          cancelling={cancellingId === booking.id}
        />
      ))}
    </>
  );
}

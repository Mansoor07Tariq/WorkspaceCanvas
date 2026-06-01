import { MyBookingCard } from "./MyBookingCard";
import type { DeskBooking } from "../types/booking.types";

interface Props {
  bookings: DeskBooking[];
  onCancel: (id: number) => void;
  cancellingId?: number | null;
}

export function MyBookingsList({ bookings, onCancel, cancellingId }: Props) {
  if (bookings.length === 0) return null;

  return (
    <>
      {bookings.map((booking) => (
        <MyBookingCard
          key={booking.id}
          booking={booking}
          onCancel={onCancel}
          cancelling={cancellingId === booking.id}
        />
      ))}
    </>
  );
}

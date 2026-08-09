import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { EventRepeatOutlined, MeetingRoomOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import type { RoomBooking } from "../types/room.types";
import { officeTimeLabel } from "../utils/roomTimeline";

const m = en.myBookings;
const r = en.rooms;

interface Props {
  booking: RoomBooking;
  /** Office IANA timezone for rendering the slot in office-local time ("" → UTC). */
  timeZone: string;
  onCancel?: (bookingId: number) => void;
  /** "Book again" — deep-links the room picker to this booking's office/floor (no date). */
  onBookAgain?: (booking: RoomBooking) => void;
  cancelling?: boolean;
}

function formatBookingDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MyRoomBookingCard({
  booking,
  timeZone,
  onCancel,
  onBookAgain,
  cancelling = false,
}: Props) {
  const isActive = booking.status === "active";
  const timeRange = `${officeTimeLabel(booking.start_at, timeZone)}–${officeTimeLabel(
    booking.end_at,
    timeZone
  )}`;

  return (
    <Card variant="outlined" sx={{ mb: 2 }} data-testid={`my-room-booking-${booking.id}`}>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {formatBookingDate(booking.booking_date)}
            </Typography>
            <Chip
              icon={<MeetingRoomOutlined />}
              label={booking.status_display}
              size="small"
              color={isActive ? "success" : "default"}
            />
          </Stack>

          {(booking.office_name || booking.floor_name) && (
            <Typography variant="body2" color="text.secondary">
              {[booking.office_name, booking.floor_name].filter(Boolean).join(" — ")}
            </Typography>
          )}

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {booking.room_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {timeRange} · {r.capacityLabel}: {booking.room_capacity}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {onBookAgain && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<EventRepeatOutlined />}
                onClick={() => onBookAgain(booking)}
                aria-label={`${m.bookAgainAction} — ${booking.room_name}`}
              >
                {m.bookAgainAction}
              </Button>
            )}
            {isActive && onCancel && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={cancelling}
                onClick={() => onCancel(booking.id)}
                aria-label={`${m.cancelAction} — ${booking.room_name}, ${timeRange}`}
              >
                {m.cancelAction}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

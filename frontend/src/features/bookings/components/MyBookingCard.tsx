import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { EventRepeatOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import type { DeskBooking } from "../types/booking.types";

const c = en.myBookings;

interface Props {
  booking: DeskBooking;
  onCancel?: (bookingId: number) => void;
  /** "Book again" — deep-links the picker to this booking's office/floor/desk. */
  onBookAgain?: (booking: DeskBooking) => void;
  cancelling?: boolean;
}

function formatBookingDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD; parse as local date to avoid timezone shift
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MyBookingCard({ booking, onCancel, onBookAgain, cancelling = false }: Props) {
  const isActive = booking.status === "active";

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {formatBookingDate(booking.booking_date)}
            </Typography>
            <Chip
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
              {booking.desk_name}
            </Typography>
            {booking.desk_code && (
              <Typography variant="caption" color="text.secondary">
                {booking.desk_code}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {onBookAgain && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<EventRepeatOutlined />}
                onClick={() => onBookAgain(booking)}
                aria-label={`${c.bookAgainAction} — ${booking.desk_name}`}
              >
                {c.bookAgainAction}
              </Button>
            )}
            {isActive && onCancel && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={cancelling}
                onClick={() => onCancel(booking.id)}
                aria-label={`${c.cancelAction} — ${booking.desk_name}, ${booking.booking_date}`}
              >
                {c.cancelAction}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

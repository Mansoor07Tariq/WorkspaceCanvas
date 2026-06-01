import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { DeskBooking } from "../types/booking.types";

interface Props {
  booking: DeskBooking;
  onCancel?: (bookingId: number) => void;
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

export function MyBookingCard({ booking, onCancel, cancelling = false }: Props) {
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

          {isActive && onCancel && (
            <Box>
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={cancelling}
                onClick={() => onCancel(booking.id)}
                aria-label={`Cancel booking for ${booking.desk_name} on ${booking.booking_date}`}
              >
                Cancel booking
              </Button>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

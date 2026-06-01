import { Box, Card, CardContent, Chip, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import type { DeskBooking } from "@/features/bookings/types/booking.types";
import { ROUTES } from "@/routes/paths";
import { en } from "@/i18n/en";

interface Props {
  booking: DeskBooking;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function UpcomingBookingCard({ booking }: Props) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
          {en.app.dashboard.upcomingTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {formatDate(booking.booking_date)}
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {booking.desk_name}
        </Typography>
        {booking.office_name && (
          <Typography variant="body2" color="text.secondary">
            {booking.office_name}
          </Typography>
        )}
        {booking.floor_name && (
          <Typography variant="body2" color="text.secondary">
            {en.app.dashboard.bookingFloorLabel}: {booking.floor_name}
          </Typography>
        )}
        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Chip
            label={booking.status_display}
            color="primary"
            variant="outlined"
            size="small"
            aria-label={`Booking status: ${booking.status_display}`}
          />
          <Typography
            component={Link}
            to={ROUTES.myBookings}
            variant="body2"
            sx={{
              color: "primary.main",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {en.app.dashboard.viewMyBookings}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

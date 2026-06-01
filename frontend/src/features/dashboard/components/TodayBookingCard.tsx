import { useNavigate } from "react-router-dom";
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { WeekendOutlined } from "@mui/icons-material";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DeskBooking } from "@/features/bookings/types/booking.types";
import { ROUTES } from "@/routes/paths";
import { en } from "@/i18n/en";

interface Props {
  booking: DeskBooking | null;
  loading: boolean;
  error: string | undefined;
}

export function TodayBookingCard({ booking, loading, error }: Props) {
  const navigate = useNavigate();

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
          {en.app.dashboard.todayTitle}
        </Typography>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} aria-label={en.app.dashboard.loadingBookings} />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}

        {!loading && !error && !booking && (
          <EmptyState
            icon={<WeekendOutlined sx={{ fontSize: 36, color: "primary.main" }} />}
            title={en.app.dashboard.noBookingTodayTitle}
            description={en.app.dashboard.noBookingTodayMessage}
            actionLabel={en.app.dashboard.bookDeskAction}
            onAction={() => navigate(ROUTES.bookings)}
          />
        )}

        {!loading && !error && booking && (
          <Box>
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
            <Box
              sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}
            >
              <Chip
                label={booking.status_display}
                color="success"
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
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import { WeekendOutlined } from "@mui/icons-material";
import { useMyBookings } from "@/features/bookings/hooks/useMyBookings";
import { cancelMyBooking } from "@/features/bookings/api/bookingApi";
import { MyBookingsList } from "@/features/bookings/components/MyBookingsList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/routes/paths";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";

const c = en.myBookings;

export function MyBookingsPage() {
  const navigate = useNavigate();
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | undefined>();
  const [cancelError, setCancelError] = useState<string | undefined>();

  const { bookings, loading, error, refresh } = useMyBookings();

  async function handleCancel(bookingId: number) {
    setCancellingId(bookingId);
    setCancelSuccess(undefined);
    setCancelError(undefined);
    try {
      await cancelMyBooking(bookingId);
      setCancelSuccess("Booking cancelled successfully.");
      refresh();
    } catch (err) {
      setCancelError(getApiErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 } }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
          {c.pageTitle}
        </Typography>
        <Button variant="contained" onClick={() => navigate(ROUTES.bookings)}>
          {c.bookDeskAction}
        </Button>
      </Stack>

      {cancelSuccess && (
        <Alert severity="success" role="alert" sx={{ mb: 2 }}>
          {cancelSuccess}
        </Alert>
      )}

      {cancelError && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {cancelError}
        </Alert>
      )}

      {error && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Loading bookings" />
        </Box>
      )}

      {!loading && bookings.length === 0 && (
        <EmptyState
          icon={<WeekendOutlined sx={{ fontSize: 40, color: "primary.main" }} />}
          title={c.emptyTitle}
          description={c.emptyDesc}
          actionLabel={c.bookDeskAction}
          onAction={() => navigate(ROUTES.bookings)}
        />
      )}

      {!loading && bookings.length > 0 && (
        <MyBookingsList bookings={bookings} onCancel={handleCancel} cancellingId={cancellingId} />
      )}
    </Container>
  );
}

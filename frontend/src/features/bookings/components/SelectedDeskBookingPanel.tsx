import { useEffect, useRef } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { DeskAvailabilityItem } from "../utils/bookingAvailability";
import { formatBookingDate } from "../utils/bookingValidation";

interface Props {
  item: DeskAvailabilityItem | null;
  selectedDate: string;
  hasMyBooking: boolean;
  onBook: (deskId: number) => void;
  onCancel: (bookingId: number) => void;
  bookingLoading: boolean;
  cancelLoading: boolean;
  bookingError: string | null;
  cancelError: string | null;
  bookingSuccess: boolean;
  cancelSuccess: boolean;
}

export function SelectedDeskBookingPanel({
  item,
  selectedDate,
  hasMyBooking,
  onBook,
  onCancel,
  bookingLoading,
  cancelLoading,
  bookingError,
  cancelError,
  bookingSuccess,
  cancelSuccess,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bookingSuccess || cancelSuccess) {
      panelRef.current?.focus();
    }
  }, [bookingSuccess, cancelSuccess]);

  return (
    <Paper
      ref={panelRef}
      tabIndex={-1}
      variant="outlined"
      sx={{ p: 2 }}
      data-testid="selected-desk-booking-panel"
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Desk Details
      </Typography>

      {item === null && (
        <Typography variant="body2" color="text.secondary">
          Select a desk to see details and booking options.
        </Typography>
      )}

      {item !== null && (
        <Stack spacing={1.5}>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
            >
              Desk
            </Typography>
            <Typography variant="body2">{item.desk.name}</Typography>
          </Box>

          {item.desk.code && (
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
              >
                Code
              </Typography>
              <Typography variant="body2">{item.desk.code}</Typography>
            </Box>
          )}

          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
            >
              Date
            </Typography>
            <Typography variant="body2">{formatBookingDate(selectedDate)}</Typography>
          </Box>

          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
            >
              Status
            </Typography>
            <Typography variant="body2">{item.label}</Typography>
          </Box>

          {item.status === "bookedByMe" && item.booking !== null && (
            <>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
                >
                  Booked by
                </Typography>
                <Typography variant="body2">You</Typography>
              </Box>
            </>
          )}

          <Divider />

          {bookingSuccess && (
            <Alert severity="success" role="alert">
              Desk booked successfully.
            </Alert>
          )}

          {cancelSuccess && (
            <Alert severity="success" role="alert">
              Booking cancelled.
            </Alert>
          )}

          {bookingError && (
            <Alert severity="error" role="alert">
              {bookingError}
            </Alert>
          )}

          {cancelError && (
            <Alert severity="error" role="alert">
              {cancelError}
            </Alert>
          )}

          {item.status === "available" && !hasMyBooking && (
            <Button
              variant="contained"
              onClick={() => onBook(item.desk.id)}
              disabled={bookingLoading}
              startIcon={
                bookingLoading ? <CircularProgress size={16} color="inherit" /> : undefined
              }
              data-testid="panel-book-button"
            >
              Book this desk
            </Button>
          )}

          {item.status === "bookedByMe" && item.booking !== null && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                if (item.booking !== null) onCancel(item.booking.id);
              }}
              disabled={cancelLoading}
              startIcon={cancelLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
              data-testid="panel-cancel-button"
            >
              Cancel booking
            </Button>
          )}

          {item.status === "reserved" && (
            <Typography variant="body2" color="text.secondary">
              This desk is reserved by another user.
            </Typography>
          )}

          {item.status === "unavailable" && (
            <Typography variant="body2" color="text.secondary">
              This desk is not available for booking.
            </Typography>
          )}

          {item.status === "available" && hasMyBooking && (
            <Typography variant="body2" color="text.secondary">
              You already have a booking for this date.
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
}

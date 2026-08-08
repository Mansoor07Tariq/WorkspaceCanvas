import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import type { DeskAvailabilityItem } from "../utils/bookingAvailability";

const c = en.bookings;

interface Props {
  item: DeskAvailabilityItem;
  selected: boolean;
  onSelect: (deskId: number) => void;
  onBook: (deskId: number) => void;
  onCancel: (bookingId: number) => void;
  canBook: boolean;
  bookingLoading: boolean;
  cancelLoading: boolean;
  /** Booking error to surface ON this card (set only for the desk that was clicked). */
  error?: string | null;
}

const CHIP_COLORS: Record<string, "success" | "warning" | "default" | "primary"> = {
  available: "success",
  reserved: "warning",
  bookedByMe: "primary",
  unavailable: "default",
};

export function DeskAvailabilityCard({
  item,
  selected,
  onSelect,
  onBook,
  onCancel,
  canBook,
  bookingLoading,
  cancelLoading,
  error,
}: Props) {
  const chipColor = CHIP_COLORS[item.status] ?? "default";

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: selected ? 2 : 1,
      }}
      data-testid={`desk-availability-card-${item.desk.id}`}
    >
      <CardActionArea
        onClick={() => onSelect(item.desk.id)}
        aria-pressed={selected}
        aria-label={`Select desk ${item.desk.name}, status ${item.label}`}
      >
        <CardContent>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {item.desk.name}
            </Typography>
            <Chip label={item.label} color={chipColor} size="small" />
          </Stack>
          {item.desk.code && (
            <Typography variant="caption" color="text.secondary">
              {c.codeLabel} {item.desk.code}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>

      {error && (
        <Alert
          severity="error"
          role="alert"
          sx={{ mx: 2, mb: 1 }}
          data-testid={`card-booking-error-${item.desk.id}`}
        >
          {error}
        </Alert>
      )}

      {item.status === "available" && canBook && (
        <Stack sx={{ px: 2, pb: 1.5 }}>
          <Button
            size="small"
            variant="contained"
            onClick={() => onBook(item.desk.id)}
            disabled={bookingLoading}
            startIcon={bookingLoading ? <CircularProgress size={14} color="inherit" /> : undefined}
            aria-label={`${c.bookAction} — ${item.desk.name}`}
            data-testid={`book-desk-${item.desk.id}`}
          >
            {c.bookAction}
          </Button>
        </Stack>
      )}

      {item.status === "bookedByMe" && item.booking !== null && (
        <Stack sx={{ px: 2, pb: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => {
              if (item.booking !== null) onCancel(item.booking.id);
            }}
            disabled={cancelLoading}
            startIcon={cancelLoading ? <CircularProgress size={14} color="inherit" /> : undefined}
            aria-label={`${c.cancelAction} — ${item.desk.name}`}
            data-testid={`cancel-booking-${item.booking.id}`}
          >
            {c.cancelAction}
          </Button>
        </Stack>
      )}
    </Card>
  );
}

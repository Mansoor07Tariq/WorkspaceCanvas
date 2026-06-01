import { Box, Grid, Typography } from "@mui/material";
import type { DeskAvailabilityItem, DeskAvailabilityStatus } from "../utils/bookingAvailability";
import { DeskAvailabilityCard } from "./DeskAvailabilityCard";

const STATUS_ORDER: Record<DeskAvailabilityStatus, number> = {
  bookedByMe: 0,
  available: 1,
  reserved: 2,
  unavailable: 3,
};

interface Props {
  items: DeskAvailabilityItem[];
  selectedDeskId: number | null;
  onSelectDesk: (deskId: number) => void;
  onBookDesk: (deskId: number) => void;
  onCancelBooking: (bookingId: number) => void;
  hasMyBooking: boolean;
  bookingLoading: boolean;
  cancelLoading: boolean;
}

export function DeskAvailabilityList({
  items,
  selectedDeskId,
  onSelectDesk,
  onBookDesk,
  onCancelBooking,
  hasMyBooking,
  bookingLoading,
  cancelLoading,
}: Props) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No desks found for this floor.
      </Typography>
    );
  }

  const sorted = [...items].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <Box role="region" aria-label="Desk availability">
      <Grid container spacing={2}>
        {sorted.map((item) => (
          <Grid key={item.desk.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <DeskAvailabilityCard
              item={item}
              selected={selectedDeskId === item.desk.id}
              onSelect={onSelectDesk}
              onBook={onBookDesk}
              onCancel={onCancelBooking}
              canBook={item.status === "available" && !hasMyBooking}
              bookingLoading={bookingLoading}
              cancelLoading={cancelLoading}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

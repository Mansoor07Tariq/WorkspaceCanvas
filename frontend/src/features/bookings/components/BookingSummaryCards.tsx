import { Box, Card, CardContent, Typography } from "@mui/material";
import type { DeskAvailabilityItem } from "../utils/bookingAvailability";

interface Props {
  availableCount: number;
  reservedCount: number;
  unavailableCount: number;
  myBooking: DeskAvailabilityItem | null;
}

interface SummaryCardProps {
  count: number;
  label: string;
  color?: string;
}

function SummaryCard({ count, label, color }: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ minWidth: 120 }}>
      <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: color ?? "text.primary" }}>
          {count}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function BookingSummaryCards({
  availableCount,
  reservedCount,
  unavailableCount,
  myBooking,
}: Props) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
      <SummaryCard count={availableCount} label="Available" color="success.main" />
      <SummaryCard count={reservedCount} label="Reserved" color="warning.main" />
      <SummaryCard count={unavailableCount} label="Unavailable" color="text.disabled" />
      {myBooking !== null && (
        <Card variant="outlined" sx={{ minWidth: 160, borderColor: "primary.main" }}>
          <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
              Your booking
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {myBooking.desk.name}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

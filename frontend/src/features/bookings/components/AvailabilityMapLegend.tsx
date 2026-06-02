import { Box, Stack, Typography } from "@mui/material";
import {
  AVAILABILITY_LEGEND_ORDER,
  AVAILABILITY_LEGEND_LABELS,
  getAvailabilityCanvasStyle,
} from "../utils/bookingCanvasUtils";

export function AvailabilityMapLegend() {
  return (
    <Stack
      direction="row"
      spacing={2}
      role="list"
      aria-label="Map legend"
      // Rendered above the scrollable canvas (TD-034). flexWrap keeps every
      // status label visible on narrow viewports without horizontal overflow.
      sx={{ mb: 1, flexWrap: "wrap", rowGap: 0.5 }}
    >
      {AVAILABILITY_LEGEND_ORDER.map((status) => {
        const style = getAvailabilityCanvasStyle(status, false);
        return (
          <Stack
            key={status}
            direction="row"
            spacing={0.75}
            role="listitem"
            data-testid={`legend-item-${status}`}
            sx={{ alignItems: "center" }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 14,
                height: 14,
                borderRadius: 0.5,
                bgcolor: style.fill,
                border: `2px solid ${style.stroke}`,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {AVAILABILITY_LEGEND_LABELS[status]}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

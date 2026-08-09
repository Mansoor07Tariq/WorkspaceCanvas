import { lazy, Suspense } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { AvailabilityMapLegend } from "@/features/bookings/components/AvailabilityMapLegend";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type { FloorBoundary } from "@/features/layoutObjects/utils/coordinateHelpers";

// Reuse the exact desk booking-map plumbing (Konva, lazy-loaded): only the source
// of the availability map differs (rooms-by-slot vs desks). See BookingFloorMap.
const FloorMapCanvas = lazy(() =>
  import("@/features/layoutObjects/components/FloorMapCanvas").then((m) => ({
    default: m.FloorMapCanvas,
  }))
);

interface Props {
  layoutObjects: LayoutObject[];
  /** Pre-built (memoized by the page) layoutObject.id → status map for the chosen slot. */
  availabilityByLayoutObjectId: Map<number, DeskAvailabilityStatus>;
  selectedLayoutObjectId: number | null;
  onObjectSelect: (layoutObjectId: number) => void;
  boundary?: FloorBoundary;
}

function CanvasLoadingFallback() {
  return (
    <Box
      sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 1 }}
    >
      <CircularProgress size={20} />
      <Typography variant="body2" color="text.secondary">
        Loading map…
      </Typography>
    </Box>
  );
}

export function RoomBookingFloorMap({
  layoutObjects,
  availabilityByLayoutObjectId,
  selectedLayoutObjectId,
  onObjectSelect,
  boundary,
}: Props) {
  return (
    <Box>
      <AvailabilityMapLegend />
      <Suspense fallback={<CanvasLoadingFallback />}>
        <FloorMapCanvas
          objects={layoutObjects}
          selectedObjectId={null}
          onSelectObject={() => undefined}
          mode="booking"
          availabilityByLayoutObjectId={availabilityByLayoutObjectId}
          selectedAvailabilityLayoutObjectId={selectedLayoutObjectId}
          onAvailabilityObjectSelect={onObjectSelect}
          showGrid={false}
          boundary={boundary}
        />
      </Suspense>
    </Box>
  );
}

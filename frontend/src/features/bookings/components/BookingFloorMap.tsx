import { lazy, Suspense, useMemo } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { AvailabilityMapLegend } from "./AvailabilityMapLegend";
import {
  buildAvailabilityByLayoutObjectId,
  findDeskIdByLayoutObjectId,
  getSelectedLayoutObjectId,
} from "../utils/bookingAvailability";
import type { DeskAvailabilityItem } from "../utils/bookingAvailability";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type { FloorBoundary } from "@/features/layoutObjects/utils/coordinateHelpers";

// Konva is large — keep the same lazy-load strategy as FloorLayoutPage
const FloorMapCanvas = lazy(() =>
  import("@/features/layoutObjects/components/FloorMapCanvas").then((m) => ({
    default: m.FloorMapCanvas,
  }))
);

interface Props {
  items: DeskAvailabilityItem[];
  layoutObjects: LayoutObject[];
  selectedDeskId: number | null;
  onDeskSelect: (deskId: number) => void;
  /** The floor's saved room boundary, so booking renders at the real size. */
  boundary?: FloorBoundary;
}

function CanvasLoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 200,
        gap: 1,
      }}
    >
      <CircularProgress size={20} />
      <Typography variant="body2" color="text.secondary">
        Loading map…
      </Typography>
    </Box>
  );
}

export function BookingFloorMap({
  items,
  layoutObjects,
  selectedDeskId,
  onDeskSelect,
  boundary,
}: Props) {
  const availabilityByLayoutObjectId = useMemo(
    () => buildAvailabilityByLayoutObjectId(items),
    [items]
  );

  const selectedItem = useMemo(
    () =>
      selectedDeskId !== null ? (items.find((i) => i.desk.id === selectedDeskId) ?? null) : null,
    [items, selectedDeskId]
  );

  const selectedAvailabilityLayoutObjectId = useMemo(
    () => getSelectedLayoutObjectId(selectedItem),
    [selectedItem]
  );

  function handleAvailabilityObjectSelect(layoutObjectId: number) {
    const deskId = findDeskIdByLayoutObjectId(items, layoutObjectId);
    if (deskId !== null) {
      onDeskSelect(deskId);
    }
  }

  return (
    <Box>
      {/* TD-034: legend sits ABOVE the scrollable canvas as a persistent header
          so it never detaches from the desk map when the canvas scrolls
          horizontally on narrow viewports. */}
      <AvailabilityMapLegend />
      <Suspense fallback={<CanvasLoadingFallback />}>
        <FloorMapCanvas
          objects={layoutObjects}
          selectedObjectId={null}
          onSelectObject={() => undefined}
          mode="booking"
          availabilityByLayoutObjectId={availabilityByLayoutObjectId}
          selectedAvailabilityLayoutObjectId={selectedAvailabilityLayoutObjectId}
          onAvailabilityObjectSelect={handleAvailabilityObjectSelect}
          showGrid={false}
          boundary={boundary}
        />
      </Suspense>
    </Box>
  );
}

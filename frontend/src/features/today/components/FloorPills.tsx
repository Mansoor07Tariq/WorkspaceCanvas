import { Box, Chip, Skeleton, Stack } from "@mui/material";

import { en } from "@/i18n/en";
import type { Floor } from "@/features/floors/types/floor.types";
import * as s from "./FloorPills.styles";

interface Props {
  floors: Floor[];
  selectedFloorId: number | null;
  onSelectFloor: (floorId: number) => void;
  loading?: boolean;
}

/** Horizontally-scrollable floor pills (PR 079). The selected pill gets the mint/pine
 * treatment; scrolls when many. */
export function FloorPills({ floors, selectedFloorId, onSelectFloor, loading }: Props) {
  if (loading && floors.length === 0) {
    return (
      <Stack direction="row" spacing={0.75}>
        {[0, 1].map((i) => (
          <Skeleton key={i} variant="rounded" width={72} height={30} sx={s.skeleton} />
        ))}
      </Stack>
    );
  }

  return (
    <Box role="group" aria-label={en.app.today.floorRegionLabel} sx={s.group}>
      {floors.map((floor) => {
        const selected = floor.id === selectedFloorId;
        return (
          <Chip
            key={floor.id}
            label={floor.name}
            aria-pressed={selected}
            onClick={() => onSelectFloor(floor.id)}
            variant="outlined"
            sx={s.pill(selected)}
          />
        );
      })}
    </Box>
  );
}

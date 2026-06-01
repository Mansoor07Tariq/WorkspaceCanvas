import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { AddOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import type { Floor } from "../types/floor.types";
import { FloorCard } from "./FloorCard";

const c = en.app.floors;

interface Props {
  floors: Floor[];
  officeId: number;
  canManage?: boolean;
  onAddFloor: () => void;
}

export function FloorsList({ floors, officeId, canManage = true, onAddFloor }: Props) {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {c.listTitle}
        </Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddOutlined />} onClick={onAddFloor} size="small">
            {c.addFloor}
          </Button>
        )}
      </Stack>
      <Grid container spacing={2}>
        {floors.map((floor) => (
          <Grid key={floor.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <FloorCard floor={floor} officeId={officeId} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

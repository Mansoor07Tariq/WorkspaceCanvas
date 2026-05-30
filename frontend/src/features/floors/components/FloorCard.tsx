import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { en } from "@/i18n/en";
import { floorLayoutPath } from "@/routes/paths";
import type { Floor } from "../types/floor.types";

const c = en.app.floors;

interface Props {
  floor: Floor;
  officeId: number;
}

export function FloorCard({ floor, officeId }: Props) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2.5,
        bgcolor: "background.paper",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {floor.name}
          </Typography>
          {floor.is_active && (
            <Chip
              label={c.activeLabel}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {c.level} {floor.level_number}
        </Typography>
        <Button
          variant="text"
          size="small"
          onClick={() =>
            navigate(floorLayoutPath(officeId, floor.id), {
              state: { floorName: floor.name, levelNumber: floor.level_number },
            })
          }
          sx={{ alignSelf: "flex-start", fontSize: "0.75rem", p: 0, minWidth: 0 }}
        >
          {c.manageLayout} →
        </Button>
      </Stack>
    </Box>
  );
}

import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import type { Floor } from "../types/floor.types";

const c = en.app.floors;

interface Props {
  floor: Floor;
}

export function FloorCard({ floor }: Props) {
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
        <Tooltip title={c.buildMapTooltip} arrow>
          <span>
            <Typography
              variant="body2"
              sx={{
                color: "text.disabled",
                cursor: "default",
                display: "inline-block",
                fontSize: "0.75rem",
                mt: 0.5,
              }}
            >
              {c.buildMap} →
            </Typography>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

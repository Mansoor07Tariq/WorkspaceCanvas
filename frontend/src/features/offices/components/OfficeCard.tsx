import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { LocationOnOutlined, AccessTimeOutlined } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { en } from "@/i18n/en";
import type { Office } from "../types/office.types";

const c = en.app.offices;

interface Props {
  office: Office;
}

function locationSummary(office: Office): string {
  const parts = [office.city, office.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : c.noCity;
}

export function OfficeCard({ office }: Props) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2.5,
        bgcolor: "background.paper",
        transition: "box-shadow 0.2s",
        "&:hover": {
          boxShadow: (theme) => `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`,
        },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {office.name}
          </Typography>
          {office.is_active && (
            <Chip
              label={c.activeLabel}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
          )}
        </Stack>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <LocationOnOutlined sx={{ fontSize: 15, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">
              {locationSummary(office)}
            </Typography>
          </Stack>
          {office.timezone && (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <AccessTimeOutlined sx={{ fontSize: 15, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">
                {office.timezone}
              </Typography>
            </Stack>
          )}
        </Stack>
        <Tooltip title={c.buildFloorMapTooltip} arrow>
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
              {c.buildFloorMap} →
            </Typography>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

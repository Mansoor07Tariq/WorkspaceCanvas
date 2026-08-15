import type { SxProps, Theme } from "@mui/material";

import { fontSizeTokens, fontTokens, fontWeightTokens } from "@/theme/tokens";

/** WeekStrip styling (Layer 2). */

export const title: SxProps<Theme> = { fontWeight: fontWeightTokens.extrabold, mt: 3, mb: 1.25 };
export const hint: SxProps<Theme> = { fontWeight: fontWeightTokens.semibold };

export const grid: SxProps<Theme> = {
  display: "grid",
  gridAutoFlow: { xs: "column", sm: "unset" },
  gridTemplateColumns: { xs: "unset", sm: "repeat(5, 1fr)" },
  gridAutoColumns: { xs: "42%", sm: "unset" },
  gap: 1.25,
  overflowX: { xs: "auto", sm: "visible" },
  scrollSnapType: { xs: "x mandatory", sm: "none" },
  pb: { xs: 1, sm: 0 },
};

export const dayCard = (active: boolean, booked: boolean): SxProps<Theme> => ({
  scrollSnapAlign: "start",
  cursor: "pointer",
  minHeight: 44,
  p: 1.5,
  borderRadius: 3.5,
  bgcolor: active && booked ? "primary.main" : "background.paper",
  border: 1.5,
  borderStyle: !booked && !active ? "dashed" : "solid",
  borderColor: active ? "primary.main" : "divider",
  boxShadow: (t: Theme) => (active ? t.shadows[1] : "none"),
  transition: "transform .12s",
  "&:hover": { transform: "translateY(-2px)" },
  "&:focus-visible": {
    outline: (t: Theme) => `2px solid ${t.palette.primary.main}`,
    outlineOffset: 2,
  },
});

export const dayNumber = (activeBooked: boolean): SxProps<Theme> => ({
  fontFamily: fontTokens.display,
  fontSize: fontSizeTokens.dayNumber,
  color: activeBooked ? "primary.contrastText" : "text.primary",
});

export const dayLabel = (activeBooked: boolean): SxProps<Theme> => ({
  fontWeight: fontWeightTokens.bold,
  color: activeBooked ? "primary.light" : "text.secondary",
});

export const status = (activeBooked: boolean, booked: boolean): SxProps<Theme> => ({
  fontWeight: fontWeightTokens.bold,
  my: 1,
  color: activeBooked ? "primary.contrastText" : booked ? "text.primary" : "primary.main",
});

export const overflowCount = (activeBooked: boolean): SxProps<Theme> => ({
  ml: 0.5,
  alignSelf: "center",
  fontWeight: fontWeightTokens.bold,
  color: activeBooked ? "primary.light" : "text.secondary",
});

import type { SxProps, Theme } from "@mui/material";

import { fontSizeTokens, fontWeightTokens, radiusTokens } from "@/theme/tokens";

/** FloorPills styling (Layer 2). */

export const skeleton: SxProps<Theme> = { borderRadius: radiusTokens.pill };

export const group: SxProps<Theme> = {
  display: "flex",
  gap: 0.75,
  overflowX: "auto",
  flex: 1,
  minWidth: 0,
  py: 0.25,
};

export const pill = (selected: boolean): SxProps<Theme> => ({
  flexShrink: 0,
  minHeight: 30,
  fontWeight: fontWeightTokens.extrabold,
  fontSize: fontSizeTokens.label,
  bgcolor: selected ? "primary.light" : "transparent",
  color: selected ? "primary.dark" : "text.secondary",
  borderColor: selected ? "primary.main" : "divider",
});

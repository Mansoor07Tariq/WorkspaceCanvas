import type { SxProps, Theme } from "@mui/material";

import { fontSizeTokens, fontTokens, fontWeightTokens, radiusTokens } from "@/theme/tokens";

/** TodayHeader styling (Layer 2). */

export const greeting: SxProps<Theme> = {
  fontFamily: fontTokens.display,
  fontSize: { xs: fontSizeTokens.greetingSm, sm: fontSizeTokens.greeting },
  fontWeight: fontWeightTokens.medium,
  letterSpacing: "-0.01em",
  color: "text.primary",
};

export const officeChip: SxProps<Theme> = {
  bgcolor: "background.paper",
  py: 2.25,
  borderColor: "divider",
  boxShadow: (t) => t.shadows[1],
};

export const officeName: SxProps<Theme> = {
  fontWeight: fontWeightTokens.extrabold,
  fontSize: fontSizeTokens.strong,
};

export const defaultBadge: SxProps<Theme> = {
  fontSize: fontSizeTokens.micro,
  fontWeight: fontWeightTokens.extrabold,
  bgcolor: "primary.light",
  color: "primary.dark",
  px: 0.75,
  py: 0.125,
  borderRadius: radiusTokens.pill,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const menuItemName: SxProps<Theme> = { fontWeight: fontWeightTokens.bold };

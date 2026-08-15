import type { SxProps, Theme } from "@mui/material";

import { fontSizeTokens, fontTokens, fontWeightTokens } from "@/theme/tokens";

/** WelcomeCard styling (Layer 2). */

export const iconTile: SxProps<Theme> = {
  width: 44,
  height: 44,
  borderRadius: 2,
  bgcolor: "primary.light",
  color: "primary.dark",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const title: SxProps<Theme> = {
  fontFamily: fontTokens.display,
  fontSize: fontSizeTokens.title,
  fontWeight: fontWeightTokens.medium,
};

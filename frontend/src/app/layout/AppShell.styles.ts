import type { SxProps, Theme } from "@mui/material";

import { avatarColor, fontSizeTokens, fontTokens, fontWeightTokens } from "@/theme/tokens";

/** AppShell styling (Layer 2). */

export const appBar: SxProps<Theme> = {
  bgcolor: "background.paper",
  borderBottom: 1,
  borderColor: "divider",
};

export const brandTileSm: SxProps<Theme> = {
  width: 26,
  height: 26,
  borderRadius: 1,
  bgcolor: "primary.main",
  color: "primary.contrastText",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const brandText: SxProps<Theme> = {
  fontFamily: fontTokens.display,
  fontWeight: fontWeightTokens.semibold,
  fontSize: fontSizeTokens.brandCompact,
};

export const userAvatar = (key: string): SxProps<Theme> => ({
  width: 28,
  height: 28,
  fontSize: fontSizeTokens.label,
  fontWeight: fontWeightTokens.bold,
  bgcolor: avatarColor(key),
  borderRadius: "34%",
});

export const userName: SxProps<Theme> = {
  fontWeight: fontWeightTokens.bold,
  display: { xs: "none", md: "block" },
};

import type { SxProps, Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { fontSizeTokens, fontTokens, fontWeightTokens } from "@/theme/tokens";
import { RAIL_WIDTH, SIDEBAR_WIDTH } from "./sidebarDimensions";

/** AppSidebar styling (Layer 2) — all colour/typography/radius lives here; the .tsx is
 * structural + Layer-3 layout only. */

export const navRoot = (isRail: boolean): SxProps<Theme> => ({
  width: isRail ? RAIL_WIDTH : SIDEBAR_WIDTH,
  flexShrink: 0,
  borderRight: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
  pt: 2,
  display: "flex",
  flexDirection: "column",
  height: "100%",
});

export const brandTile: SxProps<Theme> = {
  width: 30,
  height: 30,
  borderRadius: 1.25,
  bgcolor: "primary.main",
  color: "primary.contrastText",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export const brandText: SxProps<Theme> = {
  fontFamily: fontTokens.display,
  fontWeight: fontWeightTokens.semibold,
  fontSize: fontSizeTokens.brand,
};

export const navButton = (isRail: boolean): SxProps<Theme> => ({
  borderRadius: 2,
  minHeight: 44,
  justifyContent: isRail ? "center" : "flex-start",
  px: isRail ? 0 : 1.5,
  flexDirection: isRail ? "column" : "row",
  gap: isRail ? 0.25 : 0,
});

export const navIcon = (isRail: boolean, selected: boolean): SxProps<Theme> => ({
  minWidth: 0,
  mr: isRail ? 0 : 1.5,
  color: selected ? "primary.main" : "text.secondary",
});

export const railLabel = (selected: boolean): SxProps<Theme> => ({
  fontSize: fontSizeTokens.rail,
  fontWeight: fontWeightTokens.bold,
  color: selected ? "text.primary" : "text.secondary",
});

export const navLabelSlot = (selected: boolean) => ({
  variant: "body2" as const,
  sx: { fontWeight: selected ? fontWeightTokens.extrabold : fontWeightTokens.semibold },
});

export const almostThereBox: SxProps<Theme> = {
  p: 1.75,
  borderRadius: 3,
  background: (theme: Theme) =>
    `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.07)} 0%, ${alpha(
      theme.palette.secondary.main,
      0.05
    )} 100%)`,
  border: "1px solid",
  borderColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.14),
};

export const almostThereIcon: SxProps<Theme> = {
  fontSize: 15,
  color: "primary.main",
  flexShrink: 0,
};

export const almostThereTitle: SxProps<Theme> = {
  fontWeight: fontWeightTokens.bold,
  color: "primary.main",
  lineHeight: 1.3,
};

export const almostThereBody: SxProps<Theme> = { lineHeight: 1.5 };

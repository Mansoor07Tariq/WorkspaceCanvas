import type { SxProps, Theme } from "@mui/material";

import { fontSizeTokens, fontWeightTokens } from "@/theme/tokens";

/** TodayContent styling (Layer 2). Layout-only sx (grids, padding) stays inline in the
 * .tsx; colour/typography/radius live here. */

export const heroHeaderRow: SxProps<Theme> = {
  alignItems: "center",
  p: 1.5,
  borderBottom: 1,
  borderColor: "divider",
};

export const viewFloorButton: SxProps<Theme> = {
  flexShrink: 0,
  fontWeight: fontWeightTokens.extrabold,
  fontSize: fontSizeTokens.label,
};

export const heroGrid: SxProps<Theme> = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 220px" },
};

/** The map viewport: a fixed, clamped height so greeting + hero + week strip fit one
 * screen at 1366×768 / 1280×800 without page scroll. Phone gets a shorter fixed height. */
export const mapViewport: SxProps<Theme> = {
  p: 1.5,
  minWidth: 0,
  overflow: "hidden",
  height: { xs: 240, md: "min(38vh, 340px)" },
};

export const mapSkeleton: SxProps<Theme> = { height: "100%" };

export const nearYouColumn: SxProps<Theme> = {
  borderLeft: { md: 1 },
  borderTop: { xs: 1, md: 0 },
  borderColor: "divider",
  p: 2,
};

export const noFloors: SxProps<Theme> = { color: "text.secondary", p: 3 };

export const planAlert: SxProps<Theme> = { mb: 2, borderRadius: 3 };
export const planTitle: SxProps<Theme> = { fontWeight: fontWeightTokens.extrabold };

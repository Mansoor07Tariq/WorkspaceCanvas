import type { SxProps, Theme } from "@mui/material";

import { fontSizeTokens, fontWeightTokens } from "@/theme/tokens";

/** BottomTabBar styling (Layer 2). */

export const paper: SxProps<Theme> = {
  display: { xs: "block", sm: "none" },
  position: "sticky",
  bottom: 0,
  zIndex: (t) => t.zIndex.appBar,
  borderTop: 1,
  borderColor: "divider",
};

export const nav: SxProps<Theme> = { bgcolor: "background.paper", height: 60 };

export const action: SxProps<Theme> = {
  minWidth: 44,
  "& .MuiBottomNavigationAction-label": {
    fontSize: fontSizeTokens.micro,
    fontWeight: fontWeightTokens.bold,
  },
};

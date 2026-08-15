import type { SxProps, Theme } from "@mui/material";

import { fontWeightTokens } from "@/theme/tokens";

/** AdminSetupBanner styling (Layer 2). */

export const alert: SxProps<Theme> = {
  mb: 2.5,
  borderRadius: 3,
  bgcolor: "primary.light",
  color: "primary.dark",
  border: 1,
  borderColor: "divider",
};

export const title: SxProps<Theme> = { fontWeight: fontWeightTokens.extrabold };

import type { SxProps, Theme } from "@mui/material";

import { avatarColor, colorTokens, fontWeightTokens } from "@/theme/tokens";

/** Person-tile styling (Layer 2). All visual values come from tokens; the .tsx stays
 * structural. Size-parametric, so it's a function rather than a static object. */
export function personAvatarSx(
  size: number,
  colorKey: number | string,
  ring: boolean
): SxProps<Theme> {
  return {
    width: size,
    height: size,
    fontSize: size * 0.36,
    fontWeight: fontWeightTokens.extrabold,
    borderRadius: "34%",
    bgcolor: avatarColor(colorKey),
    color: colorTokens.onPine,
    flexShrink: 0,
    boxShadow: ring ? (t) => `0 0 0 2px ${t.palette.background.paper}` : "none",
  };
}

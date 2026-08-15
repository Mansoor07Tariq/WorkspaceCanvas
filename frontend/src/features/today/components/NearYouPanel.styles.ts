import type { SxProps, Theme } from "@mui/material";

import { fontSizeTokens, fontWeightTokens } from "@/theme/tokens";

/** NearYouPanel styling (Layer 2). */

export const eyebrow: SxProps<Theme> = {
  fontWeight: fontWeightTokens.extrabold,
  letterSpacing: "0.08em",
  color: "text.secondary",
  textTransform: "uppercase",
  mb: 1.25,
};

export const row = (active: boolean, dimmed: boolean): SxProps<Theme> => ({
  alignItems: "center",
  p: 0.75,
  borderRadius: 2,
  cursor: "pointer",
  minHeight: 44,
  bgcolor: active ? "background.default" : "transparent",
  opacity: dimmed ? 0.4 : 1,
  transition: "opacity .18s, background-color .18s",
});

export const name: SxProps<Theme> = {
  fontWeight: fontWeightTokens.bold,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export const moreLink: SxProps<Theme> = {
  alignSelf: "flex-start",
  px: 0,
  mt: 0.5,
  fontWeight: fontWeightTokens.extrabold,
  fontSize: fontSizeTokens.link,
};

export const footer: SxProps<Theme> = { borderTop: 1, borderColor: "divider", pt: 1.5, mt: 1.5 };

export const bookedText: SxProps<Theme> = {
  fontWeight: fontWeightTokens.bold,
  color: "primary.dark",
};

export const bookButton: SxProps<Theme> = { fontSize: fontSizeTokens.button };

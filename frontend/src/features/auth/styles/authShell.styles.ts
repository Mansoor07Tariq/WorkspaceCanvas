import type { SxProps, Theme } from "@mui/material";

export const authShellHeaderSx: SxProps<Theme> = {
  textAlign: "center",
  mb: 3,
};

export const authShellBrandSx: SxProps<Theme> = {
  fontWeight: 900,
  letterSpacing: -0.5,
  color: "primary.main",
};

export const authShellTitleSx: SxProps<Theme> = {
  mt: 1,
};

export const authShellSubtitleSx: SxProps<Theme> = {
  color: "text.secondary",
  mt: 0.5,
};

export const authShellFooterSx: SxProps<Theme> = {
  textAlign: "center",
  color: "text.secondary",
  mt: 3,
};

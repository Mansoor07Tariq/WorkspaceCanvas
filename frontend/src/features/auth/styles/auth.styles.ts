import type { SxProps, Theme } from "@mui/material";

export const authCardContentSx: SxProps<Theme> = {
  p: 4,
  "&:last-child": { pb: 4 },
};

export const signupHeaderSx: SxProps<Theme> = {
  textAlign: "center",
  mb: 3,
};

export const signupBrandSx: SxProps<Theme> = {
  fontWeight: 900,
  letterSpacing: -0.5,
  color: "primary.main",
};

export const signupTitleSx: SxProps<Theme> = {
  mt: 1,
};

export const signupSubtitleSx: SxProps<Theme> = {
  color: "text.secondary",
  mt: 0.5,
};

export const signupFormSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

export const signupFooterSx: SxProps<Theme> = {
  textAlign: "center",
  color: "text.secondary",
  mt: 3,
};

export const signupSuccessBoxSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  textAlign: "center",
};

export const signupSuccessIconSx: SxProps<Theme> = {
  fontSize: 52,
  color: "success.main",
};

export const signupSuccessTitleSx: SxProps<Theme> = {
  fontWeight: 700,
};

export const signupSuccessMessageSx: SxProps<Theme> = {
  color: "text.secondary",
};

export const signupSuccessEmailSx: SxProps<Theme> = {
  fontWeight: 600,
  color: "text.primary",
};

export const signupSuccessHintSx: SxProps<Theme> = {
  color: "text.disabled",
};

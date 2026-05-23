import type { SxProps, Theme } from "@mui/material";

export const authCardContentSx: SxProps<Theme> = {
  p: 4,
  "&:last-child": { pb: 4 },
};

export const authFormSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
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

export const mfaToggleSx: SxProps<Theme> = {
  mt: 1,
  textAlign: "center",
};

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

export const verifyEmailCenterSx: SxProps<Theme> = {
  textAlign: "center",
  py: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
};

export const verifyEmailResendSectionSx: SxProps<Theme> = {
  mt: 3,
  pt: 3,
  borderTop: "1px solid",
  borderColor: "divider",
};

export const socialButtonsSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
  mt: 2,
};

export const socialProviderIconSx: SxProps<Theme> = {
  width: 18,
  height: 18,
  display: "block",
};

export const mfaSetupQrBoxSx: SxProps<Theme> = {
  display: "flex",
  justifyContent: "center",
  my: 2,
};

export const mfaSetupManualCodeSx: SxProps<Theme> = {
  mt: 1,
  p: 1.5,
  bgcolor: "grey.100",
  borderRadius: 1,
  fontFamily: "monospace",
  fontSize: "0.75rem",
  wordBreak: "break-all",
  textAlign: "center",
};

export const mfaCodesGridSx: SxProps<Theme> = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 1,
  my: 2,
};

export const mfaCodeItemSx: SxProps<Theme> = {
  fontFamily: "monospace",
  fontSize: "0.875rem",
  p: 0.75,
  bgcolor: "grey.100",
  borderRadius: 1,
  textAlign: "center",
};

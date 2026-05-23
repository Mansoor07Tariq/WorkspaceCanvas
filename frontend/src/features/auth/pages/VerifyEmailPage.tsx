import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { FormTextField } from "@/components/ui/FormTextField";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { SuccessAlert } from "@/components/feedback/SuccessAlert";
import { ROUTES } from "@/routes/paths";
import { AuthPageShell } from "../components/AuthPageShell";
import { useVerifyEmail } from "../hooks/useVerifyEmail";
import { useResendVerificationForm } from "../hooks/useResendVerificationForm";
import { authFormSx, verifyEmailCenterSx, verifyEmailResendSectionSx } from "../styles/auth.styles";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { status, errorMessage } = useVerifyEmail(token);
  const resend = useResendVerificationForm();

  if (status === "verifying") {
    return (
      <AuthPageShell title={en.auth.verifyEmail.verifyingTitle}>
        <Box sx={verifyEmailCenterSx}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {en.auth.verifyEmail.verifyingMessage}
          </Typography>
        </Box>
      </AuthPageShell>
    );
  }

  if (status === "success") {
    return (
      <AuthPageShell title={en.auth.verifyEmail.successTitle}>
        <Box sx={verifyEmailCenterSx}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {en.auth.verifyEmail.successMessage}
          </Typography>
          <Button component={RouterLink} to={ROUTES.login} variant="contained" fullWidth>
            {en.auth.verifyEmail.goToLogin}
          </Button>
        </Box>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title={en.auth.verifyEmail.errorTitle}>
      <ErrorAlert message={errorMessage} />
      <Typography variant="body2" sx={{ textAlign: "center", color: "text.secondary", mb: 1 }}>
        <RouterLink
          to={ROUTES.login}
          style={{ color: "#2563EB", fontWeight: 600, textDecoration: "none" }}
        >
          {en.auth.verifyEmail.backToLogin}
        </RouterLink>
      </Typography>
      <Box sx={verifyEmailResendSectionSx}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {en.auth.verifyEmail.resendTitle}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {en.auth.verifyEmail.resendSubtitle}
        </Typography>
        <SuccessAlert message={resend.submission.successMessage} />
        <ErrorAlert message={resend.submission.generalError} />
        <Box component="form" onSubmit={resend.handleSubmit} noValidate sx={authFormSx}>
          <FormTextField
            id="resend-email"
            label={en.auth.fields.email}
            type="email"
            value={resend.fields.email}
            onChange={(e) => resend.setField("email", e.target.value)}
            error={resend.fieldErrors.email}
            disabled={resend.submission.loading}
            autoComplete="email"
            placeholder={en.auth.fields.emailPlaceholder}
          />
          <LoadingButton loading={resend.submission.loading}>
            {en.auth.verifyEmail.resendSubmit}
          </LoadingButton>
        </Box>
      </Box>
    </AuthPageShell>
  );
}

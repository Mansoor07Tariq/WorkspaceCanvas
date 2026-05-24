import { Link as RouterLink, useLocation } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { FormTextField } from "@/components/ui/FormTextField";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { ROUTES } from "@/routes/paths";
import { AuthPageShell } from "../components/AuthPageShell";
import { useMfaChallengeForm } from "../hooks/useMfaChallengeForm";
import { authFormSx, mfaToggleSx } from "../styles/auth.styles";

interface LocationState {
  challengeId?: string;
  email?: string;
}

const backToLoginFooter = (
  <Typography component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
    <RouterLink to={ROUTES.login} style={{ color: "inherit", textDecoration: "none" }}>
      {en.auth.mfaChallenge.backToLogin}
    </RouterLink>
  </Typography>
);

export function MfaChallengePage() {
  const location = useLocation();
  const state = location.state as LocationState | null;
  const challengeId = state?.challengeId;
  const email = state?.email;

  const { mode, toggleMode, fields, setField, fieldErrors, submission, handleSubmit } =
    useMfaChallengeForm(challengeId ?? "");

  if (!challengeId) {
    return (
      <AuthPageShell title={en.auth.mfaChallenge.missingChallengeTitle} footer={backToLoginFooter}>
        <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
          {en.auth.mfaChallenge.missingChallengeMessage}
        </Typography>
      </AuthPageShell>
    );
  }

  const subtitle =
    mode === "totp" ? en.auth.mfaChallenge.subtitle : en.auth.mfaChallenge.recoverySubtitle;

  return (
    <AuthPageShell
      title={en.auth.mfaChallenge.title}
      subtitle={subtitle}
      footer={backToLoginFooter}
    >
      {email && (
        <Typography variant="body2" sx={{ textAlign: "center", color: "text.secondary", mb: 1 }}>
          {email}
        </Typography>
      )}
      <ErrorAlert message={submission.generalError} />
      <Box component="form" onSubmit={handleSubmit} noValidate sx={authFormSx}>
        {mode === "totp" ? (
          <FormTextField
            id="token"
            label={en.auth.mfaChallenge.codeLabel}
            placeholder={en.auth.mfaChallenge.codePlaceholder}
            value={fields.token}
            onChange={(e) => setField("token", e.target.value)}
            error={fieldErrors.token}
            disabled={submission.loading}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
          />
        ) : (
          <FormTextField
            id="recoveryCode"
            label={en.auth.mfaChallenge.recoveryCodeLabel}
            placeholder={en.auth.mfaChallenge.recoveryCodePlaceholder}
            value={fields.recoveryCode}
            onChange={(e) => setField("recoveryCode", e.target.value)}
            error={fieldErrors.recovery_code}
            disabled={submission.loading}
            autoFocus
          />
        )}
        <LoadingButton loading={submission.loading}>{en.auth.mfaChallenge.submit}</LoadingButton>
      </Box>
      <Box sx={mfaToggleSx}>
        <Button
          type="button"
          variant="text"
          size="small"
          onClick={toggleMode}
          disabled={submission.loading}
        >
          {mode === "totp"
            ? en.auth.mfaChallenge.useRecoveryCode
            : en.auth.mfaChallenge.useAuthenticatorCode}
        </Button>
      </Box>
    </AuthPageShell>
  );
}

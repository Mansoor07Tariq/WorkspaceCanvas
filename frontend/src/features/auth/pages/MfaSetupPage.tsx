import { useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { FormTextField } from "@/components/ui/FormTextField";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { ROUTES } from "@/routes/paths";
import { AuthPageShell } from "../components/AuthPageShell";
import { useMfaSetup } from "../hooks/useMfaSetup";
import {
  authFormSx,
  mfaSetupQrBoxSx,
  mfaSetupManualCodeSx,
  mfaCodesGridSx,
  mfaCodeItemSx,
  verifyEmailCenterSx,
} from "../styles/auth.styles";

export function MfaSetupPage() {
  const navigate = useNavigate();
  const {
    step,
    qrCodeBase64,
    provisioningUri,
    token,
    tokenError,
    recoveryCodes,
    generalError,
    loading,
    setToken,
    handleConfirm,
  } = useMfaSetup();

  if (step === "loading") {
    return (
      <AuthPageShell title={en.auth.mfaSetup.title}>
        <Box sx={verifyEmailCenterSx}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {en.auth.mfaSetup.loadingMessage}
          </Typography>
        </Box>
      </AuthPageShell>
    );
  }

  if (step === "error") {
    return (
      <AuthPageShell title={en.auth.mfaSetup.title}>
        <ErrorAlert message={generalError} />
      </AuthPageShell>
    );
  }

  if (step === "codes") {
    return (
      <AuthPageShell title={en.auth.mfaSetup.codesTitle} subtitle={en.auth.mfaSetup.codesSubtitle}>
        <Box sx={mfaCodesGridSx}>
          {recoveryCodes.map((code) => (
            <Box key={code} sx={mfaCodeItemSx}>
              {code}
            </Box>
          ))}
        </Box>
        <Button variant="contained" fullWidth onClick={() => navigate(ROUTES.app)}>
          {en.auth.mfaSetup.codesDone}
        </Button>
      </AuthPageShell>
    );
  }

  const secret = provisioningUri.match(/secret=([A-Z2-7]+)/i)?.[1] ?? "";

  return (
    <AuthPageShell title={en.auth.mfaSetup.title} subtitle={en.auth.mfaSetup.scanSubtitle}>
      <Box sx={mfaSetupQrBoxSx}>
        <img
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="MFA QR code"
          width={160}
          height={160}
        />
      </Box>
      {secret && (
        <>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block", textAlign: "center" }}
          >
            {en.auth.mfaSetup.manualEntry}
          </Typography>
          <Box sx={mfaSetupManualCodeSx}>{secret}</Box>
        </>
      )}
      <ErrorAlert message={generalError} />
      <Box component="form" onSubmit={handleConfirm} noValidate sx={{ ...authFormSx, mt: 2 }}>
        <FormTextField
          id="mfa-token"
          label={en.auth.mfaSetup.confirmLabel}
          placeholder={en.auth.mfaSetup.confirmPlaceholder}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          error={tokenError}
          disabled={loading}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
        />
        <LoadingButton loading={loading}>{en.auth.mfaSetup.confirmSubmit}</LoadingButton>
      </Box>
    </AuthPageShell>
  );
}

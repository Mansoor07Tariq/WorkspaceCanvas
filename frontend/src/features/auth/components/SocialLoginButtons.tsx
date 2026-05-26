import { useGoogleLogin } from "@react-oauth/google";
import { useMsal } from "@azure/msal-react";
import { Box, Button, CircularProgress, Divider, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { socialButtonsSx, socialProviderIconSx } from "../styles/auth.styles";
import type { SocialProviderConfig } from "../hooks/useSocialLogin";
import googleIconUrl from "@/assets/icons/google.svg";
import microsoftIconUrl from "@/assets/icons/microsoft.svg";

interface SocialLoginButtonsProps {
  google: SocialProviderConfig;
  microsoft: SocialProviderConfig;
  loadingProvider: "google" | "microsoft" | undefined;
  generalError?: string;
}

function ProviderIcon({ src }: { src: string }) {
  return <Box component="img" src={src} alt="" sx={socialProviderIconSx} />;
}

export function SocialLoginButtons({
  google,
  microsoft,
  loadingProvider,
  generalError,
}: SocialLoginButtonsProps) {
  const { instance } = useMsal();
  const isAnyLoading = loadingProvider !== undefined;
  const googleLoading = loadingProvider === "google";
  const msLoading = loadingProvider === "microsoft";

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: (response) => google.onToken(response.access_token),
    onError: () => google.onError(),
  });

  const handleGoogleClick = () => {
    if (!google.configured) {
      google.onUnavailable();
      return;
    }
    google.onStart();
    triggerGoogleLogin();
  };

  const handleMicrosoftClick = async () => {
    if (!microsoft.configured) {
      microsoft.onUnavailable();
      return;
    }
    microsoft.onStart();
    try {
      const result = await instance.loginPopup({ scopes: ["openid", "profile", "email"] });
      microsoft.onToken(result.idToken);
    } catch (err) {
      microsoft.onError(err);
    }
  };

  return (
    <Box sx={socialButtonsSx}>
      <Divider>
        <Typography variant="caption" color="text.secondary">
          {en.auth.social.orDivider}
        </Typography>
      </Divider>
      <ErrorAlert message={generalError} />
      <Button
        fullWidth
        variant="outlined"
        type="button"
        onClick={handleGoogleClick}
        disabled={isAnyLoading}
        startIcon={
          googleLoading ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <ProviderIcon src={googleIconUrl} />
          )
        }
      >
        {googleLoading ? en.auth.social.loadingGoogle : en.auth.social.continueWithGoogle}
      </Button>
      <Button
        fullWidth
        variant="outlined"
        type="button"
        onClick={() => void handleMicrosoftClick()}
        disabled={isAnyLoading}
        startIcon={
          msLoading ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <ProviderIcon src={microsoftIconUrl} />
          )
        }
      >
        {msLoading ? en.auth.social.loadingMicrosoft : en.auth.social.continueWithMicrosoft}
      </Button>
    </Box>
  );
}

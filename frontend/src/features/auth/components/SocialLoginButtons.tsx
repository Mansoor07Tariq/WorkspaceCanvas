import { useGoogleLogin } from "@react-oauth/google";
import { useMsal } from "@azure/msal-react";
import { Box, Button, CircularProgress, Divider, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import { socialButtonsSx, socialProviderIconSx } from "../styles/auth.styles";
import googleIconUrl from "@/assets/icons/google.svg";
import microsoftIconUrl from "@/assets/icons/microsoft.svg";

interface SocialLoginButtonsProps {
  isGoogleConfigured: boolean;
  isMicrosoftConfigured: boolean;
  onGoogleStart: () => void;
  onGoogleToken: (accessToken: string) => void;
  onGoogleError: () => void;
  onGoogleUnavailable: () => void;
  onMicrosoftStart: () => void;
  onMicrosoftToken: (idToken: string) => void;
  onMicrosoftError: (error: unknown) => void;
  onMicrosoftUnavailable: () => void;
  loadingProvider: "google" | "microsoft" | undefined;
  generalError?: string;
}

function ProviderIcon({ src }: { src: string }) {
  return <Box component="img" src={src} alt="" sx={socialProviderIconSx} />;
}

export function SocialLoginButtons({
  isGoogleConfigured,
  isMicrosoftConfigured,
  onGoogleStart,
  onGoogleToken,
  onGoogleError,
  onGoogleUnavailable,
  onMicrosoftStart,
  onMicrosoftToken,
  onMicrosoftError,
  onMicrosoftUnavailable,
  loadingProvider,
  generalError,
}: SocialLoginButtonsProps) {
  const { instance } = useMsal();
  const isAnyLoading = loadingProvider !== undefined;
  const googleLoading = loadingProvider === "google";
  const msLoading = loadingProvider === "microsoft";

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: (response) => onGoogleToken(response.access_token),
    onError: () => onGoogleError(),
  });

  const handleGoogleClick = () => {
    if (!isGoogleConfigured) {
      onGoogleUnavailable();
      return;
    }
    onGoogleStart();
    triggerGoogleLogin();
  };

  const handleMicrosoftClick = async () => {
    if (!isMicrosoftConfigured) {
      onMicrosoftUnavailable();
      return;
    }
    onMicrosoftStart();
    try {
      const result = await instance.loginPopup({ scopes: ["openid", "profile", "email"] });
      onMicrosoftToken(result.idToken);
    } catch (err) {
      onMicrosoftError(err);
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { socialAuth } from "../api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { ROUTES } from "@/routes/paths";
import { en } from "@/i18n/en";
import { isGoogleConfigured, isMicrosoftConfigured } from "../social/socialConfig";
import type { SocialProvider, SocialAuthMfaResponse } from "../types/auth.types";

function isSocialMfaResponse(res: object): res is SocialAuthMfaResponse {
  return "mfa_required" in res;
}

function isMsalUserCancelled(error: unknown): boolean {
  return (
    error instanceof Error &&
    "errorCode" in error &&
    (error as { errorCode: string }).errorCode === "user_cancelled"
  );
}

export function useSocialLogin() {
  const navigate = useNavigate();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | undefined>();
  const [generalError, setGeneralError] = useState<string | undefined>();

  function startGoogleFlow() {
    setLoadingProvider("google");
    setGeneralError(undefined);
  }

  function startMicrosoftFlow() {
    setLoadingProvider("microsoft");
    setGeneralError(undefined);
  }

  function handleGoogleError() {
    setLoadingProvider(undefined);
    setGeneralError(en.auth.social.googleError);
  }

  function handleMicrosoftError(error: unknown) {
    setLoadingProvider(undefined);
    setGeneralError(
      isMsalUserCancelled(error) ? en.auth.social.popupClosed : en.auth.social.microsoftError
    );
  }

  function handleGoogleUnavailable() {
    setGeneralError(en.auth.social.googleUnavailable);
  }

  function handleMicrosoftUnavailable() {
    setGeneralError(en.auth.social.microsoftUnavailable);
  }

  async function submitSocialToken(
    provider: SocialProvider,
    token: { access_token?: string; id_token?: string }
  ) {
    setLoadingProvider(provider);
    setGeneralError(undefined);
    try {
      const response = await socialAuth({ provider, ...token });
      if (isSocialMfaResponse(response)) {
        navigate(ROUTES.mfaChallenge, {
          state: { challengeId: response.challenge_id, email: response.email },
        });
      } else {
        tokenStorage.setTokens(response.access, response.refresh);
        navigate(ROUTES.app, { replace: true });
      }
    } catch (err: unknown) {
      setGeneralError(getApiErrorMessage(err));
    } finally {
      setLoadingProvider(undefined);
    }
  }

  function handleGoogleToken(accessToken: string) {
    void submitSocialToken("google", { access_token: accessToken });
  }

  function handleMicrosoftToken(idToken: string) {
    void submitSocialToken("microsoft", { id_token: idToken });
  }

  return {
    loadingProvider,
    generalError,
    isGoogleConfigured,
    isMicrosoftConfigured,
    startGoogleFlow,
    startMicrosoftFlow,
    handleGoogleToken,
    handleMicrosoftToken,
    handleGoogleError,
    handleMicrosoftError,
    handleGoogleUnavailable,
    handleMicrosoftUnavailable,
  };
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { socialAuth } from "../api/authApi";
import { usePostAuthNavigation } from "@/hooks/usePostAuthNavigation";
import { navigateToMfaChallenge } from "../utils/authUtils";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";
import { isGoogleConfigured, isMicrosoftConfigured } from "../social/socialConfig";
import type { SocialProvider, SocialAuthMfaResponse } from "../types/auth.types";

export interface SocialProviderConfig {
  configured: boolean;
  onStart: () => void;
  onToken: (token: string) => void;
  onError: (error?: unknown) => void;
  onUnavailable: () => void;
}

export interface SocialLoginState {
  google: SocialProviderConfig;
  microsoft: SocialProviderConfig;
  loadingProvider: SocialProvider | undefined;
  generalError: string | undefined;
}

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

export function useSocialLogin(): SocialLoginState {
  const navigate = useNavigate();
  const { navigateAfterAuth } = usePostAuthNavigation();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | undefined>();
  const [generalError, setGeneralError] = useState<string | undefined>();

  async function submitSocialToken(
    provider: SocialProvider,
    token: { access_token?: string; id_token?: string }
  ) {
    setLoadingProvider(provider);
    setGeneralError(undefined);
    try {
      const response = await socialAuth({ provider, ...token });
      if (isSocialMfaResponse(response)) {
        navigateToMfaChallenge(navigate, response.challenge_id, response.email);
      } else {
        const error = await navigateAfterAuth(response, { replace: true });
        if (error) setGeneralError(error);
      }
    } catch (err: unknown) {
      setGeneralError(getApiErrorMessage(err));
    } finally {
      setLoadingProvider(undefined);
    }
  }

  const google: SocialProviderConfig = {
    configured: isGoogleConfigured,
    onStart: () => {
      setLoadingProvider("google");
      setGeneralError(undefined);
    },
    onToken: (accessToken) => void submitSocialToken("google", { access_token: accessToken }),
    onError: () => {
      setLoadingProvider(undefined);
      setGeneralError(en.auth.social.googleError);
    },
    onUnavailable: () => setGeneralError(en.auth.social.googleUnavailable),
  };

  const microsoft: SocialProviderConfig = {
    configured: isMicrosoftConfigured,
    onStart: () => {
      setLoadingProvider("microsoft");
      setGeneralError(undefined);
    },
    onToken: (idToken) => void submitSocialToken("microsoft", { id_token: idToken }),
    onError: (error) => {
      setLoadingProvider(undefined);
      setGeneralError(
        isMsalUserCancelled(error) ? en.auth.social.popupClosed : en.auth.social.microsoftError
      );
    },
    onUnavailable: () => setGeneralError(en.auth.social.microsoftUnavailable),
  };

  return { google, microsoft, loadingProvider, generalError };
}

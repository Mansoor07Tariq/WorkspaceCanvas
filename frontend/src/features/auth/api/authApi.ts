import { api } from "../../../lib/api/apiClient";
import { AUTH_ENDPOINTS } from "./authEndpoints";
import type {
  CurrentUser,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  MfaChallengeVerifyRequest,
  MfaConfirmRequest,
  MfaConfirmResponse,
  MfaDisableRequest,
  MfaSetupResponse,
  MfaStatus,
  RegenerateRecoveryCodesRequest,
  RegenerateRecoveryCodesResponse,
  ResendVerificationRequest,
  SignupRequest,
  SocialAuthRequest,
  SocialAuthResponse,
  TokenPair,
  TokenRefreshRequest,
  TokenRefreshResponse,
  VerifyEmailRequest,
} from "../types/auth.types";

export function login(data: LoginRequest): Promise<LoginResponse> {
  return api.post<LoginResponse, LoginRequest>(AUTH_ENDPOINTS.login, data, { auth: false });
}

export function signup(data: SignupRequest): Promise<{ detail: string }> {
  return api.post<{ detail: string }, SignupRequest>(AUTH_ENDPOINTS.signup, data, { auth: false });
}

export function verifyEmail(data: VerifyEmailRequest): Promise<{ detail: string }> {
  return api.post<{ detail: string }, VerifyEmailRequest>(AUTH_ENDPOINTS.verifyEmail, data, {
    auth: false,
  });
}

export function resendVerification(data: ResendVerificationRequest): Promise<{ detail: string }> {
  return api.post<{ detail: string }, ResendVerificationRequest>(
    AUTH_ENDPOINTS.resendVerification,
    data,
    { auth: false }
  );
}

export function socialAuth(data: SocialAuthRequest): Promise<SocialAuthResponse> {
  return api.post<SocialAuthResponse, SocialAuthRequest>(AUTH_ENDPOINTS.social, data, {
    auth: false,
  });
}

export function verifyMfaChallenge(data: MfaChallengeVerifyRequest): Promise<TokenPair> {
  return api.post<TokenPair, MfaChallengeVerifyRequest>(AUTH_ENDPOINTS.mfaChallengeVerify, data, {
    auth: false,
  });
}

export function refreshToken(data: TokenRefreshRequest): Promise<TokenRefreshResponse> {
  return api.post<TokenRefreshResponse, TokenRefreshRequest>(AUTH_ENDPOINTS.refreshToken, data, {
    auth: false,
  });
}

export function getMfaStatus(): Promise<MfaStatus> {
  return api.get<MfaStatus>(AUTH_ENDPOINTS.mfaStatus);
}

export function setupMfa(): Promise<MfaSetupResponse> {
  return api.post<MfaSetupResponse>(AUTH_ENDPOINTS.mfaSetup);
}

export function confirmMfa(data: MfaConfirmRequest): Promise<MfaConfirmResponse> {
  return api.post<MfaConfirmResponse, MfaConfirmRequest>(AUTH_ENDPOINTS.mfaConfirm, data);
}

export function disableMfa(data: MfaDisableRequest): Promise<void> {
  return api.post<void, MfaDisableRequest>(AUTH_ENDPOINTS.mfaDisable, data);
}

export function regenerateRecoveryCodes(
  data: RegenerateRecoveryCodesRequest
): Promise<RegenerateRecoveryCodesResponse> {
  return api.post<RegenerateRecoveryCodesResponse, RegenerateRecoveryCodesRequest>(
    AUTH_ENDPOINTS.mfaRecoveryCodesRegenerate,
    data
  );
}

export function logout(data: LogoutRequest): Promise<void> {
  return api.post<void, LogoutRequest>(AUTH_ENDPOINTS.logout, data);
}

export function getCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>(AUTH_ENDPOINTS.me);
}

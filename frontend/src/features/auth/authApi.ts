import { apiRequest } from "../../lib/apiClient";
import { tokenStorage } from "./tokenStorage";
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
} from "./types";

function authHeaders(): Record<string, string> {
  const token = tokenStorage.getAccessToken();
  return token !== null ? { Authorization: `Bearer ${token}` } : {};
}

export function login(data: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/token/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function signup(data: SignupRequest): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyEmail(data: VerifyEmailRequest): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/api/auth/verify-email/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function resendVerification(data: ResendVerificationRequest): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/api/auth/resend-verification/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function socialAuth(data: SocialAuthRequest): Promise<SocialAuthResponse> {
  return apiRequest<SocialAuthResponse>("/api/auth/social/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyMfaChallenge(data: MfaChallengeVerifyRequest): Promise<TokenPair> {
  return apiRequest<TokenPair>("/api/auth/mfa/challenge/verify/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMfaStatus(): Promise<MfaStatus> {
  return apiRequest<MfaStatus>("/api/auth/mfa/status/", {
    headers: authHeaders(),
  });
}

export function setupMfa(): Promise<MfaSetupResponse> {
  return apiRequest<MfaSetupResponse>("/api/auth/mfa/setup/", {
    method: "POST",
    headers: authHeaders(),
  });
}

export function confirmMfa(data: MfaConfirmRequest): Promise<MfaConfirmResponse> {
  return apiRequest<MfaConfirmResponse>("/api/auth/mfa/confirm/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: authHeaders(),
  });
}

export function disableMfa(data: MfaDisableRequest): Promise<void> {
  return apiRequest<void>("/api/auth/mfa/disable/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: authHeaders(),
  });
}

export function regenerateRecoveryCodes(
  data: RegenerateRecoveryCodesRequest
): Promise<RegenerateRecoveryCodesResponse> {
  return apiRequest<RegenerateRecoveryCodesResponse>("/api/auth/mfa/recovery-codes/regenerate/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: authHeaders(),
  });
}

export function refreshToken(data: TokenRefreshRequest): Promise<TokenRefreshResponse> {
  return apiRequest<TokenRefreshResponse>("/api/auth/token/refresh/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function logout(data: LogoutRequest): Promise<void> {
  return apiRequest<void>("/api/auth/logout/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: authHeaders(),
  });
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>("/api/auth/me/", {
    headers: authHeaders(),
  });
}

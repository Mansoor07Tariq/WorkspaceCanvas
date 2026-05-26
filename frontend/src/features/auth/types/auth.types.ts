// --- Shared ---

export interface TokenPair {
  access: string;
}

// --- Current user ---

export interface MembershipInline {
  id: number;
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  organization_status: string;
  role: string;
  status: string;
  has_active_access: boolean;
}

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  phone_number: string;
  job_title: string;
  timezone: string;
  locale: string;
  is_profile_completed: boolean;
  email_verified: boolean;
  preferred_auth_provider: AuthProvider;
  mfa_enabled: boolean;
  memberships: MembershipInline[];
}

// --- Email/password login ---

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginSuccessResponse = TokenPair;

export interface MfaRequiredResponse {
  mfa_required: true;
  challenge_id: string;
  detail: string;
}

export type LoginResponse = LoginSuccessResponse | MfaRequiredResponse;

// --- Signup ---

export interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
}

// --- Email verification ---

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

// --- Social auth ---

export type SocialProvider = "google" | "microsoft";
export type AuthProvider = "email" | SocialProvider | "";

export interface SocialAuthRequest {
  provider: SocialProvider;
  access_token?: string;
  id_token?: string;
}

export interface SocialAuthSuccessResponse extends TokenPair {
  email: string;
  email_verified: boolean;
  preferred_auth_provider: AuthProvider;
}

export interface SocialAuthMfaResponse extends MfaRequiredResponse {
  email: string;
  preferred_auth_provider: AuthProvider;
}

export type SocialAuthResponse = SocialAuthSuccessResponse | SocialAuthMfaResponse;

// --- Navigation state ---

export interface MfaChallengeNavigationState {
  challengeId: string;
  email: string;
}

// --- MFA challenge (unauthenticated, post-login gate) ---

export interface MfaChallengeVerifyRequest {
  challenge_id: string;
  token?: string;
  recovery_code?: string;
}

// --- MFA management (authenticated) ---

export interface MfaStatus {
  mfa_enabled: boolean;
  has_confirmed_device: boolean;
  recovery_codes_remaining: number;
}

export interface MfaSetupResponse {
  provisioning_uri: string;
  qr_code_base64: string;
  detail: string;
  secret?: string;
}

export interface MfaConfirmRequest {
  token: string;
}

export interface MfaConfirmResponse {
  detail: string;
  recovery_codes: string[];
}

export interface MfaDisableRequest {
  password?: string;
  provider?: SocialProvider;
  access_token?: string;
  id_token?: string;
  token?: string;
  recovery_code?: string;
}

export type RegenerateRecoveryCodesRequest = MfaDisableRequest;

export interface RegenerateRecoveryCodesResponse {
  detail: string;
  recovery_codes: string[];
}

// --- Token operations ---

export interface TokenRefreshResponse {
  access: string;
}

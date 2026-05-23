export type MfaChallengeFieldErrors = {
  token?: string;
  recovery_code?: string;
};

export type MfaChallengeMode = "totp" | "recovery";

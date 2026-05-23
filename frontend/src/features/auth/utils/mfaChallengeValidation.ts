import { en } from "@/i18n/en";
import type { MfaChallengeFieldErrors, MfaChallengeMode } from "../types/mfaChallenge.types";

export function validateMfaChallengeForm(
  mode: MfaChallengeMode,
  token: string,
  recoveryCode: string
): MfaChallengeFieldErrors {
  const errors: MfaChallengeFieldErrors = {};
  if (mode === "totp") {
    if (!token.trim()) {
      errors.token = en.auth.mfaChallenge.invalidCodeRequired;
    } else if (!/^\d{6}$/.test(token)) {
      errors.token = en.auth.mfaChallenge.invalidCodeFormat;
    }
  } else {
    if (!recoveryCode.trim()) {
      errors.recovery_code = en.auth.mfaChallenge.recoveryCodeRequired;
    }
  }
  return errors;
}

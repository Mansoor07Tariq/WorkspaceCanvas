import { ApiError } from "@/lib/api/apiError";
import type { SignupFieldErrors } from "../types/signup.types";
import type { LoginFieldErrors } from "../types/login.types";
import type { MfaChallengeFieldErrors } from "../types/mfaChallenge.types";
import type { ResendVerificationFieldErrors } from "../types/emailVerification.types";

function getFirstError(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return undefined;
}

function extractFieldErrors<K extends string>(
  error: unknown,
  fields: readonly K[]
): Partial<Record<K, string>> {
  if (!(error instanceof ApiError)) return {};
  if (typeof error.data !== "object" || error.data === null) return {};
  const data = error.data as Record<string, unknown>;
  const result: Partial<Record<K, string>> = {};
  for (const field of fields) {
    const val = getFirstError(data[field]);
    if (val !== undefined) result[field] = val;
  }
  return result;
}

export function extractSignupFieldErrors(error: unknown): SignupFieldErrors {
  return extractFieldErrors(error, ["full_name", "email", "password"] as const);
}

export function extractLoginFieldErrors(error: unknown): LoginFieldErrors {
  return extractFieldErrors(error, ["email", "password"] as const);
}

export function extractMfaChallengeFieldErrors(error: unknown): MfaChallengeFieldErrors {
  return extractFieldErrors(error, ["token", "recovery_code"] as const);
}

export function extractResendVerificationFieldErrors(
  error: unknown
): ResendVerificationFieldErrors {
  return extractFieldErrors(error, ["email"] as const);
}

import type { NavigateFunction } from "react-router-dom";
import type {
  LoginResponse,
  LoginSuccessResponse,
  MfaRequiredResponse,
  MfaChallengeNavigationState,
} from "../types/auth.types";
import { ROUTES } from "@/routes/paths";

export function isMfaRequiredResponse(response: LoginResponse): response is MfaRequiredResponse {
  return "mfa_required" in response;
}

export function isLoginSuccessResponse(response: LoginResponse): response is LoginSuccessResponse {
  return !isMfaRequiredResponse(response);
}

/**
 * Returns `path` if it is a safe internal path (starts with "/" but not "//"),
 * or null if the value would cause an open-redirect vulnerability.
 */
export function getSafeReturnTo(returnTo: unknown): string | null {
  if (typeof returnTo !== "string") return null;
  if (!returnTo.startsWith("/")) return null;
  if (returnTo.startsWith("//")) return null;
  return returnTo;
}

export function navigateToMfaChallenge(
  navigate: NavigateFunction,
  challengeId: string,
  email: string
): void {
  const state: MfaChallengeNavigationState = { challengeId, email };
  navigate(ROUTES.mfaChallenge, { state });
}

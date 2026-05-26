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

export function navigateToMfaChallenge(
  navigate: NavigateFunction,
  challengeId: string,
  email: string
): void {
  const state: MfaChallengeNavigationState = { challengeId, email };
  navigate(ROUTES.mfaChallenge, { state });
}

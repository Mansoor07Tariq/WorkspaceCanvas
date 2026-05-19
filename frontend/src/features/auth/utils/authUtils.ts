import type { LoginResponse, LoginSuccessResponse, MfaRequiredResponse } from "../types/auth.types";

export function isMfaRequiredResponse(response: LoginResponse): response is MfaRequiredResponse {
  return "mfa_required" in response;
}

export function isLoginSuccessResponse(response: LoginResponse): response is LoginSuccessResponse {
  return !isMfaRequiredResponse(response);
}

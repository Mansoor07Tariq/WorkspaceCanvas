import { ApiError } from "@/lib/api/apiError";
import type { SignupFieldErrors } from "../types/signup.types";
import type { LoginFieldErrors } from "../types/login.types";

function getFirstError(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return undefined;
}

export function extractSignupFieldErrors(error: unknown): SignupFieldErrors {
  if (!(error instanceof ApiError)) return {};
  if (typeof error.data !== "object" || error.data === null) return {};
  const data = error.data as Record<string, unknown>;
  const result: SignupFieldErrors = {};
  const fullName = getFirstError(data.full_name);
  if (fullName !== undefined) result.full_name = fullName;
  const email = getFirstError(data.email);
  if (email !== undefined) result.email = email;
  const password = getFirstError(data.password);
  if (password !== undefined) result.password = password;
  return result;
}

export function extractLoginFieldErrors(error: unknown): LoginFieldErrors {
  if (!(error instanceof ApiError)) return {};
  if (typeof error.data !== "object" || error.data === null) return {};
  const data = error.data as Record<string, unknown>;
  const result: LoginFieldErrors = {};
  const email = getFirstError(data.email);
  if (email !== undefined) result.email = email;
  const password = getFirstError(data.password);
  if (password !== undefined) result.password = password;
  return result;
}

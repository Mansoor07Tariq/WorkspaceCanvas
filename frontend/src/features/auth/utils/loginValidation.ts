import { en } from "@/i18n/en";
import { isValidEmail } from "@/lib/validation";
import type { LoginFieldErrors } from "../types/login.types";

export function validateLoginForm(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  if (!email.trim()) {
    errors.email = en.auth.validation.emailRequired;
  } else if (!isValidEmail(email)) {
    errors.email = en.auth.validation.invalidEmail;
  }
  if (!password) {
    errors.password = en.auth.validation.passwordRequired;
  }
  return errors;
}

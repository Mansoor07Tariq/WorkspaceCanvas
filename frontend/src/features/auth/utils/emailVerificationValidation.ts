import { en } from "@/i18n/en";
import { isValidEmail } from "@/lib/validation";
import type { ResendVerificationFieldErrors } from "../types/emailVerification.types";

export function validateResendVerificationForm(email: string): ResendVerificationFieldErrors {
  const errors: ResendVerificationFieldErrors = {};
  if (!email.trim()) {
    errors.email = en.auth.validation.emailRequired;
  } else if (!isValidEmail(email)) {
    errors.email = en.auth.validation.invalidEmail;
  }
  return errors;
}

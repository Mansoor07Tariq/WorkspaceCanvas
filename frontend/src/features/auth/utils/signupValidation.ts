import { en } from "../../../i18n/en";
import type { SignupFieldErrors } from "../types/signup.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupForm(
  fullName: string,
  email: string,
  password: string
): SignupFieldErrors {
  const errors: SignupFieldErrors = {};
  if (fullName.length > 255) errors.full_name = en.auth.validation.fullNameMaxLength;
  if (!email.trim()) {
    errors.email = en.auth.validation.emailRequired;
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = en.auth.validation.invalidEmail;
  }
  if (!password) {
    errors.password = en.auth.validation.passwordRequired;
  } else if (password.length < 8) {
    errors.password = en.auth.validation.passwordMinLength;
  }
  return errors;
}

export function validatePasswordConfirmation(password: string, confirmPassword: string): string {
  if (!confirmPassword) return en.auth.validation.confirmPasswordRequired;
  if (confirmPassword !== password) return en.auth.validation.passwordMismatch;
  return "";
}

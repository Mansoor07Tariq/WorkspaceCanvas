import { en } from "@/i18n/en";
import type { ProfileFieldErrors } from "../types/profile.types";

const PHONE_RE = /^[0-9\s+()-]+$/;

export function validateProfileForm(fullName: string, phoneNumber: string): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  const name = fullName.trim();
  if (!name) {
    errors.fullName = en.app.profile.fullNameRequired;
  } else if (name.length > 255) {
    errors.fullName = en.auth.validation.fullNameMaxLength;
  }

  const phone = phoneNumber.trim();
  if (phone && !PHONE_RE.test(phone)) {
    errors.phoneNumber = en.app.profile.phoneNumberInvalid;
  }

  return errors;
}

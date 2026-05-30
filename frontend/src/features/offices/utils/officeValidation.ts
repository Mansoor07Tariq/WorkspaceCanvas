import { en } from "@/i18n/en";
import type { OfficeFieldErrors, OfficeFormFields } from "../types/office.types";

const c = en.app.offices;

// Matches Python's zoneinfo for common formats: Region/City, UTC, etc.
const TIMEZONE_RE = /^[A-Za-z][A-Za-z0-9+\-_]*(\/[A-Za-z0-9+\-_]+)*$/;

export function validateOfficeName(name: string): string | undefined {
  if (!name.trim()) return c.nameRequired;
  return undefined;
}

export function validateOfficeTimezone(tz: string): string | undefined {
  const trimmed = tz.trim();
  if (!trimmed) return undefined;
  if (!TIMEZONE_RE.test(trimmed)) return c.timezoneInvalid;
  return undefined;
}

export function validateOfficeStep(
  step: string,
  fields: Pick<OfficeFormFields, "name" | "timezone">
): OfficeFieldErrors {
  const errors: OfficeFieldErrors = {};
  if (step === "name") {
    const nameErr = validateOfficeName(fields.name);
    if (nameErr) errors.name = nameErr;
  }
  if (step === "location") {
    const tzErr = validateOfficeTimezone(fields.timezone);
    if (tzErr) errors.timezone = tzErr;
  }
  return errors;
}

export function buildOfficePayload(fields: OfficeFormFields) {
  return {
    name: fields.name.trim(),
    ...(fields.address_line_1.trim() && { address_line_1: fields.address_line_1.trim() }),
    ...(fields.address_line_2.trim() && { address_line_2: fields.address_line_2.trim() }),
    ...(fields.city.trim() && { city: fields.city.trim() }),
    ...(fields.county_or_state.trim() && { county_or_state: fields.county_or_state.trim() }),
    ...(fields.country.trim() && { country: fields.country.trim() }),
    ...(fields.timezone.trim() && { timezone: fields.timezone.trim() }),
  };
}

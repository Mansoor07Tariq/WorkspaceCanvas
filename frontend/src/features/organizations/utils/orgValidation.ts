import { en } from "@/i18n/en";
import type { OrgFieldErrors } from "../types/organization.types";

const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function validateOrgName(name: string): string | undefined {
  if (!name.trim()) return en.app.orgSetup.nameRequired;
  return undefined;
}

export function validateAllowedDomain(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("@")) {
    return "Enter a domain, not an email address (e.g. example.com).";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return "Enter a domain without a protocol (e.g. example.com).";
  }
  if (trimmed.includes("/")) {
    return "Enter a domain without a path (e.g. example.com).";
  }
  if (!DOMAIN_RE.test(trimmed)) {
    return "Enter a valid domain (e.g. example.com).";
  }
  return undefined;
}

export function validateOrgSetupStep(
  step: string,
  name: string,
  allowedDomain: string
): OrgFieldErrors {
  const errors: OrgFieldErrors = {};
  if (step === "name") {
    const nameErr = validateOrgName(name);
    if (nameErr) errors.name = nameErr;
  }
  if (step === "domain") {
    const domainErr = validateAllowedDomain(allowedDomain);
    if (domainErr) errors.allowed_email_domain = domainErr;
  }
  return errors;
}

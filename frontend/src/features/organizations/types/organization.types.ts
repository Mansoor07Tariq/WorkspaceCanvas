export type OrgType = "company" | "coworking_space" | "other";

export interface CreateOrganizationRequest {
  name: string;
  organization_type: OrgType;
  allowed_email_domain?: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  organization_type: OrgType;
  organization_type_display: string;
  allowed_email_domain: string;
  status: string;
}

export type OrgSetupStep = "welcome" | "name" | "type" | "domain" | "review";

export const ORG_SETUP_STEPS: OrgSetupStep[] = ["welcome", "name", "type", "domain", "review"];

export interface OrgFieldErrors {
  name?: string;
  allowed_email_domain?: string;
}

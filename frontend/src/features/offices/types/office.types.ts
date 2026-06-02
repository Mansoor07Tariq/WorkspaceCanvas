export interface Office {
  id: number;
  /** Owning organization id (TD-045: used to resolve per-office UI role). */
  organization: number;
  name: string;
  slug: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  county_or_state: string;
  country: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOfficePayload {
  name: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  county_or_state?: string;
  country?: string;
  timezone?: string;
}

export type OfficeCreationStep = "welcome" | "name" | "location" | "review";

export const OFFICE_CREATION_STEPS: OfficeCreationStep[] = [
  "welcome",
  "name",
  "location",
  "review",
];

export interface OfficeFormFields {
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  county_or_state: string;
  country: string;
  timezone: string;
}

export interface OfficeFieldErrors {
  name?: string;
  timezone?: string;
}

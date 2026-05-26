import { api } from "@/lib/api/apiClient";
import type { CreateOrganizationRequest, Organization } from "../types/organization.types";

export function createOrganization(data: CreateOrganizationRequest): Promise<Organization> {
  return api.post<Organization, CreateOrganizationRequest>("/api/accounts/organizations/", data);
}

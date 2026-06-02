import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type { CreateOfficePayload, Office } from "../types/office.types";

/**
 * @param orgId Optional organization id (PR 055 multi-org). Adds `?organization=`
 * so the list is scoped to a selected org; omitted → backend resolves the
 * caller's first active membership.
 */
export function listOffices(orgId?: number | null): Promise<Office[]> {
  const query = orgId != null ? `?organization=${orgId}` : "";
  return api.get<Office[]>(`/api/offices/${query}`);
}

export async function createOffice(
  data: CreateOfficePayload,
  orgId?: number | null
): Promise<Office> {
  const query = orgId != null ? `?organization=${orgId}` : "";
  const office = await api.post<Office, CreateOfficePayload>(`/api/offices/${query}`, data);
  // New office changes the offices list + the org-wide workspace summary.
  invalidateCache("offices:");
  invalidateCache("summary:");
  return office;
}

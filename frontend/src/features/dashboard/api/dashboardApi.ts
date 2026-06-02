import { api } from "@/lib/api/apiClient";
import type { WorkspaceSummary } from "../types/dashboard.types";

/**
 * Fetch the org-wide workspace summary.
 *
 * @param orgId Optional organization id (PR 055 multi-org). Adds `?organization=`
 * so the summary is scoped to a selected org; omitted → backend resolves the
 * caller's first active membership (unchanged single-org behaviour).
 */
export function getWorkspaceSummary(orgId?: number | null): Promise<WorkspaceSummary> {
  const query = orgId != null ? `?organization=${orgId}` : "";
  return api.get<WorkspaceSummary>(`/api/offices/summary/${query}`);
}

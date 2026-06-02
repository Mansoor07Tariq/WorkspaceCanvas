import { api } from "@/lib/api/apiClient";
import type { WorkspaceSummary } from "../types/dashboard.types";

/** Fetch the org-wide workspace summary for the current user's organization. */
export function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  return api.get<WorkspaceSummary>("/api/offices/summary/");
}

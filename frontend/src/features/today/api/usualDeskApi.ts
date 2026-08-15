import { api } from "@/lib/api/apiClient";

/** The caller's resolved "usual desk" (PR 079 read-only endpoint). */
export interface UsualDesk {
  id: number;
  office: number;
  office_name: string;
  floor: number;
  floor_name: string;
  layout_object: number;
  name: string;
  code: string;
}

interface UsualDeskResponse {
  usual_desk: UsualDesk | null;
}

/**
 * GET /api/bookings/my/usual-desk/ — the caller's usual desk in the selected org (or
 * null). Optional `organizationId` maps to the selected-org query param the backend
 * validates against the caller's memberships.
 */
export function getUsualDesk(organizationId?: number | null): Promise<UsualDeskResponse> {
  const qs = organizationId != null ? `?organization=${encodeURIComponent(organizationId)}` : "";
  return api.get<UsualDeskResponse>(`/api/bookings/my/usual-desk/${qs}`);
}

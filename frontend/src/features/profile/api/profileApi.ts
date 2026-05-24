import { api } from "@/lib/api/apiClient";
import type { CurrentUser } from "@/features/auth/types/auth.types";

export interface ProfileUpdateData {
  full_name: string;
  job_title?: string;
  phone_number?: string;
  timezone?: string;
  locale?: string;
}

export function updateProfile(data: ProfileUpdateData): Promise<CurrentUser> {
  return api.patch<CurrentUser, ProfileUpdateData>("/api/auth/me/", data);
}

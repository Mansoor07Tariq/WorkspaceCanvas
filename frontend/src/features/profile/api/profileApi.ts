import { api } from "@/lib/api/apiClient";
import type { CurrentUser } from "@/features/auth/types/auth.types";

export interface ProfileUpdateData {
  full_name?: string;
  job_title?: string;
  phone_number?: string;
  timezone?: string;
  locale?: string;
}

export function updateProfile(data: ProfileUpdateData): Promise<CurrentUser> {
  return api.patch<CurrentUser, ProfileUpdateData>("/api/auth/me/", data);
}

export function uploadAvatar(file: File): Promise<CurrentUser> {
  const form = new FormData();
  form.append("avatar", file);
  return api.patch<CurrentUser, FormData>("/api/auth/me/", form);
}

export function removeAvatar(): Promise<CurrentUser> {
  const form = new FormData();
  form.append("remove_avatar", "true");
  return api.patch<CurrentUser, FormData>("/api/auth/me/", form);
}

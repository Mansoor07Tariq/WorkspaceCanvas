import { API_BASE_URL } from "@/config/env";

/**
 * Converts a Django root-relative media path (/media/...) to an absolute URL
 * so the browser can fetch it directly from the backend in any environment.
 * Pass-through for already-absolute URLs and null/undefined.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return url;
}

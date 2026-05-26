import { apiRequest } from "@/lib/api/rawRequest";
import { tokenStorage } from "@/lib/tokenStorage";
import { AUTH_ENDPOINTS } from "../api/authEndpoints";
import type { TokenRefreshResponse } from "../types/auth.types";

export async function refreshStoredTokens(): Promise<boolean> {
  try {
    // No body needed — the httpOnly refresh cookie is sent automatically.
    const response = await apiRequest<TokenRefreshResponse>(AUTH_ENDPOINTS.refreshToken, {
      method: "POST",
    });
    tokenStorage.setAccessToken(response.access);
    return true;
  } catch {
    tokenStorage.clearTokens();
    return false;
  }
}

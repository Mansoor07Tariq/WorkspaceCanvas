import { apiRequest } from "@/lib/api/rawRequest";
import { tokenStorage } from "@/lib/tokenStorage";
import { AUTH_ENDPOINTS } from "../api/authEndpoints";
import type { TokenRefreshResponse } from "../types/auth.types";

export async function refreshStoredTokens(): Promise<boolean> {
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) {
    tokenStorage.clearTokens();
    return false;
  }
  try {
    const response = await apiRequest<TokenRefreshResponse>(AUTH_ENDPOINTS.refreshToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (response.refresh) {
      tokenStorage.setTokens(response.access, response.refresh);
    } else {
      tokenStorage.setAccessToken(response.access);
    }
    return true;
  } catch {
    tokenStorage.clearTokens();
    return false;
  }
}

import { tokenStorage } from "@/lib/tokenStorage";
import { sessionEvents } from "@/lib/sessionEvents";
import { refreshStoredTokens } from "@/features/auth/utils/sessionRefresh";
import { ApiError } from "./apiError";
import { apiRequest } from "./rawRequest";
import type { RequestOptions } from "./types";

// These endpoints are public auth calls that must never trigger a refresh retry.
// Includes the refresh endpoint itself to prevent recursive loops.
const NO_REFRESH_PATHS = new Set([
  "/api/auth/token/",
  "/api/auth/signup/",
  "/api/auth/verify-email/",
  "/api/auth/resend-verification/",
  "/api/auth/token/refresh/",
  "/api/auth/logout/",
  "/api/auth/social/",
  "/api/auth/mfa/challenge/verify/",
]);

async function executeWithRetry<TResponse>(
  path: string,
  buildInit: () => RequestInit,
  requiresAuth: boolean
): Promise<TResponse> {
  try {
    return await apiRequest<TResponse>(path, buildInit());
  } catch (err: unknown) {
    if (
      !requiresAuth ||
      !(err instanceof ApiError) ||
      err.status !== 401 ||
      NO_REFRESH_PATHS.has(path)
    ) {
      throw err;
    }

    const refreshed = await refreshStoredTokens();
    if (!refreshed) {
      sessionEvents.emitSessionExpired();
      throw err;
    }

    // Retry once — buildInit() re-reads tokenStorage so it picks up the new access token.
    try {
      return await apiRequest<TResponse>(path, buildInit());
    } catch (retryErr: unknown) {
      if (retryErr instanceof ApiError && retryErr.status === 401) {
        sessionEvents.emitSessionExpired();
      }
      throw retryErr;
    }
  }
}

function buildHeaders(options: RequestOptions, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false) {
    const token = tokenStorage.getAccessToken();
    if (token !== null) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  return headers;
}

export const api = {
  get<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    return executeWithRetry<TResponse>(
      path,
      () => ({ headers: buildHeaders(options, false) }),
      options.auth !== false
    );
  },

  post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: RequestOptions = {}
  ): Promise<TResponse> {
    const hasBody = body !== undefined;
    return executeWithRetry<TResponse>(
      path,
      () => ({
        method: "POST",
        body: hasBody ? JSON.stringify(body) : undefined,
        headers: buildHeaders(options, hasBody),
      }),
      options.auth !== false
    );
  },

  patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: RequestOptions = {}
  ): Promise<TResponse> {
    const hasBody = body !== undefined;
    return executeWithRetry<TResponse>(
      path,
      () => ({
        method: "PATCH",
        body: hasBody ? JSON.stringify(body) : undefined,
        headers: buildHeaders(options, hasBody),
      }),
      options.auth !== false
    );
  },

  delete<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    return executeWithRetry<TResponse>(
      path,
      () => ({ method: "DELETE", headers: buildHeaders(options, false) }),
      options.auth !== false
    );
  },
};

export { ApiError };
export { apiRequest } from "./rawRequest";

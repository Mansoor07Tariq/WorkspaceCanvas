import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "@/lib/tokenStorage";
import { ApiError } from "./apiError";
import type { RequestOptions } from "./types";

// Low-level fetch wrapper — callers supply the full RequestInit.
export async function apiRequest<TResponse>(
  path: string,
  init: RequestInit = {}
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

function buildHeaders(options: RequestOptions, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  // auth defaults to true — skip only when explicitly set to false.
  // TODO: replace direct tokenStorage call with a configurable getter
  //       when AuthContext / Zustand is added in a later PR.
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
    return apiRequest<TResponse>(path, {
      headers: buildHeaders(options, false),
    });
  },

  post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: RequestOptions = {}
  ): Promise<TResponse> {
    const hasBody = body !== undefined;
    return apiRequest<TResponse>(path, {
      method: "POST",
      body: hasBody ? JSON.stringify(body) : undefined,
      headers: buildHeaders(options, hasBody),
    });
  },

  patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: RequestOptions = {}
  ): Promise<TResponse> {
    const hasBody = body !== undefined;
    return apiRequest<TResponse>(path, {
      method: "PATCH",
      body: hasBody ? JSON.stringify(body) : undefined,
      headers: buildHeaders(options, hasBody),
    });
  },

  delete<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    return apiRequest<TResponse>(path, {
      method: "DELETE",
      headers: buildHeaders(options, false),
    });
  },
};

export { ApiError };

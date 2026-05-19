# 017 — Frontend Architecture Foundation

## Purpose

This PR refactors the frontend auth infrastructure (added in PR 016) into a cleaner, scalable structure before any UI screens are built. It removes repetition from the API layer, centralizes environment access and endpoint strings, and organizes files into a structure that future PRs can extend without friction. No new features are added; no UI is built.

## What Was Changed

- Reorganized `src/` into a scalable folder structure
- Added `src/config/env.ts` for centralized environment access
- Refactored `src/lib/apiClient.ts` into `src/lib/api/` with a typed `api` helper object
- Moved auth types, utils, and API functions into `src/features/auth/{types,utils,api}/`
- Added `src/features/auth/api/authEndpoints.ts` to centralize all backend URL strings
- Eliminated repeated `JSON.stringify`, `authHeaders()`, and inline `import.meta.env` access
- Updated all test files to match the new structure; added tests for new behavior

## Folder Structure

```
src/
  config/
    env.ts                        ← API_BASE_URL constant

  features/
    auth/
      api/
        authApi.ts                ← 14 typed API functions
        authEndpoints.ts          ← AUTH_ENDPOINTS constant
      types/
        auth.types.ts             ← all auth TypeScript types
      utils/
        authUtils.ts              ← isMfaRequiredResponse, isLoginSuccessResponse
      __tests__/
        authApi.test.ts
        authUtils.test.ts
      index.ts                    ← public barrel export

  lib/
    api/
      apiClient.ts                ← apiRequest + api helper + ApiError re-export
      apiError.ts                 ← ApiError class
      types.ts                    ← RequestOptions interface
    tokenStorage.ts               ← localStorage token store
    __tests__/
      apiClient.test.ts
      tokenStorage.test.ts
```

## API Client Design

### `apiRequest<TResponse>(path, init?)`

Low-level `fetch` wrapper. Reads `API_BASE_URL` from `config/env.ts`. Handles 204 (returns `undefined`), non-OK responses (throws `ApiError`), and JSON parsing. No auth logic; callers supply `RequestInit` directly.

### `api` — convenience helper object

```typescript
api.get<T>(path, options?)
api.post<T, B>(path, body?, options?)
api.patch<T, B>(path, body?, options?)
api.delete<T>(path, options?)
```

`RequestOptions`:
```typescript
interface RequestOptions {
  auth?: boolean;            // defaults to true
  headers?: Record<string, string>;
}
```

**Auth behavior:**
- `auth` defaults to `true` — the access token is automatically attached if present in `tokenStorage`
- `auth: false` — Authorization header is not attached (used for login, signup, and other unauthenticated endpoints)
- When no token is stored, the header is simply omitted (no error thrown; the backend will return 401)

**Body handling:**
- `api.post/patch` with a body: automatically calls `JSON.stringify`, sets `Content-Type: application/json`
- `api.post/patch` without a body: no Content-Type header, no body in the request

**204 handling:** `apiRequest` checks `response.status === 204` and returns `undefined` before calling `.json()`.

**No automatic token refresh.** 401 errors surface as `ApiError` to the caller. A refresh interceptor will be added when `AuthContext`/Zustand is introduced. A `TODO` comment marks the `tokenStorage.getAccessToken()` call in `buildHeaders` as the replacement point.

### `ApiError`

```typescript
class ApiError extends Error {
  readonly status: number;   // HTTP status code
  readonly data: unknown;    // parsed response body, or null if not JSON
}
```

Re-exported from `apiClient.ts` for convenience. Also importable directly from `apiError.ts`.

## Auth API Refactor

### Before

```typescript
export function login(data: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/token/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>("/api/auth/me/", {
    headers: authHeaders(),
  });
}
```

### After

```typescript
export function login(data: LoginRequest): Promise<LoginResponse> {
  return api.post<LoginResponse, LoginRequest>(AUTH_ENDPOINTS.login, data, { auth: false });
}

export function getCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>(AUTH_ENDPOINTS.me);
}
```

## DRY Improvements

| Before | After |
|---|---|
| `JSON.stringify(data)` repeated 11× | Handled once inside `api.post/patch` |
| `headers: authHeaders()` repeated 7× | `auth: true` is the default |
| `{ auth: false }` explicit only where needed | Unauthenticated calls opt out cleanly |
| Endpoint strings scattered in `authApi.ts` | All in `AUTH_ENDPOINTS` object |
| `import.meta.env.VITE_API_BASE_URL` in `apiClient.ts` | Read once in `env.ts` |
| `authHeaders()` private helper in `authApi.ts` | `buildHeaders()` inside `apiClient.ts` |

## Files Involved

| File | Change |
|---|---|
| `frontend/src/vite-env.d.ts` | Made `VITE_API_BASE_URL` optional (`?`) so `?? fallback` is type-safe |
| `frontend/src/config/env.ts` | New — `API_BASE_URL` with fallback |
| `frontend/src/lib/api/apiError.ts` | New — `ApiError` class |
| `frontend/src/lib/api/types.ts` | New — `RequestOptions` interface |
| `frontend/src/lib/api/apiClient.ts` | New — `apiRequest`, `api` helpers, re-exports `ApiError` |
| `frontend/src/lib/tokenStorage.ts` | Moved from `features/auth/tokenStorage.ts` |
| `frontend/src/features/auth/types/auth.types.ts` | Moved from `features/auth/types.ts` |
| `frontend/src/features/auth/utils/authUtils.ts` | Moved from `features/auth/authUtils.ts` |
| `frontend/src/features/auth/api/authEndpoints.ts` | New — `AUTH_ENDPOINTS` object |
| `frontend/src/features/auth/api/authApi.ts` | Moved + refactored to use `api` helpers |
| `frontend/src/features/auth/index.ts` | New — barrel re-export |
| `frontend/src/lib/__tests__/tokenStorage.test.ts` | Moved; same 9 tests |
| `frontend/src/lib/__tests__/apiClient.test.ts` | Replaced; 20 tests covering `api.get/post` auth, body, headers |
| `frontend/src/features/auth/__tests__/authApi.test.ts` | Updated; mocks `api`, asserts `AUTH_ENDPOINTS` usage |
| `frontend/src/features/auth/__tests__/authUtils.test.ts` | Updated import paths; same 4 tests |
| **Deleted** `features/auth/types.ts` | Moved |
| **Deleted** `features/auth/authApi.ts` | Moved + refactored |
| **Deleted** `features/auth/authUtils.ts` | Moved |
| **Deleted** `features/auth/tokenStorage.ts` | Moved to `lib/` |
| **Deleted** `features/auth/__tests__/tokenStorage.test.ts` | Moved to `lib/__tests__/` |
| **Deleted** `lib/apiClient.ts` | Replaced by `lib/api/apiClient.ts` |
| `docs/017-frontend-architecture-foundation.md` | This file |
| `README.md` | Added docs link |

## How To Run / Test

```bash
cd frontend
npm run lint
npm run format:check
npm run test
npm run build
```

## What Is Not Included Yet

- No login UI
- No signup UI
- No email verification UI
- No MFA challenge or setup UI
- No Google/Microsoft frontend SDK buttons
- No React Router routes
- No Zustand store or AuthContext
- No protected routes
- No automatic token refresh interceptor

## Future Notes

- **Token refresh interceptor:** When `AuthContext`/Zustand is added, replace the `tokenStorage.getAccessToken()` call in `buildHeaders` with a configurable getter injected by the auth context. The `TODO` comment in `apiClient.ts` marks this location.
- **`api.patch` and `api.delete`:** Added now for completeness; no auth endpoints use them yet. They will be needed for profile update and organization management endpoints.
- **Barrel import:** `import { login, isMfaRequiredResponse } from "@/features/auth"` will be possible once a path alias is configured. For now, imports use relative paths.

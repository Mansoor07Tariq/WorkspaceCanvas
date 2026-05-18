# 016 — Frontend Auth API Foundation

## Purpose

This PR adds the frontend auth infrastructure layer: TypeScript types, localStorage token storage, a generic `fetch` wrapper, and typed API functions for every auth endpoint. No UI, no routing, no state management — just the API layer that future screens will call.

## What Was Added

- `frontend/.env.example` — `VITE_API_BASE_URL` environment variable
- `frontend/src/vite-env.d.ts` — TypeScript declaration for `import.meta.env.VITE_API_BASE_URL`
- `frontend/src/features/auth/types.ts` — All auth TypeScript types and interfaces
- `frontend/src/features/auth/tokenStorage.ts` — `getAccessToken`, `getRefreshToken`, `setTokens`, `clearTokens` backed by `localStorage`
- `frontend/src/lib/apiClient.ts` — `apiRequest<TResponse>` fetch wrapper and `ApiError` class
- `frontend/src/features/auth/authApi.ts` — 14 typed functions covering every auth endpoint
- `frontend/src/features/auth/authUtils.ts` — `isMfaRequiredResponse` and `isLoginSuccessResponse` type guards
- Test files for each module (Vitest + jsdom)

## Files Involved

| File | Change |
|---|---|
| `frontend/.env.example` | New — `VITE_API_BASE_URL=http://localhost:8000` |
| `frontend/src/vite-env.d.ts` | New — extends `ImportMetaEnv` for TypeScript |
| `frontend/src/features/auth/types.ts` | New — all auth types |
| `frontend/src/features/auth/tokenStorage.ts` | New — localStorage token store |
| `frontend/src/lib/apiClient.ts` | New — `apiRequest` + `ApiError` |
| `frontend/src/features/auth/authApi.ts` | New — 14 auth API functions |
| `frontend/src/features/auth/authUtils.ts` | New — login response type guards |
| `frontend/src/features/auth/__tests__/tokenStorage.test.ts` | New — 7 tests |
| `frontend/src/lib/__tests__/apiClient.test.ts` | New — 10 tests |
| `frontend/src/features/auth/__tests__/authApi.test.ts` | New — 18 tests |
| `frontend/src/features/auth/__tests__/authUtils.test.ts` | New — 4 tests |
| `docs/016-frontend-auth-api-foundation.md` | This file |
| `README.md` | Added docs link |

## Architecture

```
src/
  lib/
    apiClient.ts          ← fetch wrapper, ApiError
  features/
    auth/
      types.ts            ← TypeScript types (no runtime code)
      tokenStorage.ts     ← localStorage read/write
      authApi.ts          ← one function per endpoint
      authUtils.ts        ← type guards
      __tests__/
        tokenStorage.test.ts
        authApi.test.ts
        authUtils.test.ts
  lib/
    __tests__/
      apiClient.test.ts
```

## Token Storage

Keys used in `localStorage`:

| Key | Value |
|---|---|
| `workspacecanvas.accessToken` | JWT access token |
| `workspacecanvas.refreshToken` | JWT refresh token |

```typescript
import { tokenStorage } from "./features/auth/tokenStorage";

tokenStorage.setTokens(access, refresh);
tokenStorage.getAccessToken();
tokenStorage.getRefreshToken();
tokenStorage.clearTokens();
```

## API Client

`apiRequest<TResponse>` is a thin wrapper around `fetch`:
- Prepends `VITE_API_BASE_URL` to the path
- Always includes `Content-Type: application/json`
- Merges caller-provided headers
- Returns parsed JSON for 2xx responses
- Returns `undefined` for 204 responses
- Throws `ApiError` for non-OK responses

```typescript
import { apiRequest, ApiError } from "./lib/apiClient";

try {
  const user = await apiRequest<CurrentUser>("/api/auth/me/", {
    headers: { Authorization: `Bearer ${token}` },
  });
} catch (err) {
  if (err instanceof ApiError) {
    console.error(err.status, err.data);
  }
}
```

## Auth API Functions

### Unauthenticated

| Function | Method | Endpoint |
|---|---|---|
| `login(data)` | POST | `/api/auth/token/` |
| `signup(data)` | POST | `/api/auth/signup/` |
| `verifyEmail(data)` | POST | `/api/auth/verify-email/` |
| `resendVerification(data)` | POST | `/api/auth/resend-verification/` |
| `socialAuth(data)` | POST | `/api/auth/social/` |
| `verifyMfaChallenge(data)` | POST | `/api/auth/mfa/challenge/verify/` |
| `refreshToken(data)` | POST | `/api/auth/token/refresh/` |

### Authenticated (reads access token from `tokenStorage`)

| Function | Method | Endpoint |
|---|---|---|
| `getMfaStatus()` | GET | `/api/auth/mfa/status/` |
| `setupMfa()` | POST | `/api/auth/mfa/setup/` |
| `confirmMfa(data)` | POST | `/api/auth/mfa/confirm/` |
| `disableMfa(data)` | POST | `/api/auth/mfa/disable/` |
| `regenerateRecoveryCodes(data)` | POST | `/api/auth/mfa/recovery-codes/regenerate/` |
| `logout(data)` | POST | `/api/auth/logout/` |
| `getCurrentUser()` | GET | `/api/auth/me/` |

## MFA Login Flow

```typescript
import { login } from "./features/auth/authApi";
import { isMfaRequiredResponse } from "./features/auth/authUtils";
import { tokenStorage } from "./features/auth/tokenStorage";

const response = await login({ email, password });

if (isMfaRequiredResponse(response)) {
  // Redirect to MFA challenge screen, pass response.challenge_id
} else {
  tokenStorage.setTokens(response.access, response.refresh);
  // Redirect to app
}
```

## Type Guards

```typescript
import { isMfaRequiredResponse, isLoginSuccessResponse } from "./features/auth/authUtils";
import type { LoginResponse } from "./features/auth/types";

// Narrows LoginResponse → MfaRequiredResponse
isMfaRequiredResponse(response); // true if mfa_required is present

// Narrows LoginResponse → LoginSuccessResponse (TokenPair)
isLoginSuccessResponse(response); // true if access + refresh tokens present
```

## Environment Variables

Copy `frontend/.env.example` to `frontend/.env` before running the dev server:

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL for the Django backend |

## What Is Not Included

- No UI screens (login form, signup form, MFA setup UI)
- No React Router routes
- No Zustand store or AuthContext
- No protected routes
- No Google/Microsoft frontend SDKs
- No auto token refresh interceptor

## How To Run Tests

```bash
cd frontend
npm run test
npm run lint
npm run format:check
npm run build
```

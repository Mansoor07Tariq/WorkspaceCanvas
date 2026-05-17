# 013 — Social Auth Foundation

## Purpose

This PR adds Google and Microsoft social login before organization setup. Users can authenticate using their Google or Microsoft identity, which is then mapped to the same `users.User` model used by email/password login. Authentication proves who the user is — it does not create organizations or memberships.

## What Was Added

- `django-allauth` dependency with `allauth.socialaccount`, Google provider, and Microsoft provider
- `requests`, `cryptography`, `PyJWT`, and related packages
- `django.contrib.sites` app and `SITE_ID = 1`
- `allauth.account.middleware.AccountMiddleware`
- `SOCIALACCOUNT_PROVIDERS` settings for Google and Microsoft (credentials from environment)
- `users/social_auth.py` — isolated service functions for token verification:
  - `SocialAuthError(message, code)` — structured exception with machine-readable `code` field
  - `verify_google_token()` — calls Google's tokeninfo endpoint with audience validation
  - `verify_microsoft_token()` — dispatches to Graph API (access token) or full JWKS verification (ID token)
  - `_verify_microsoft_id_token()` — full signature verification via OIDC JWKS + manual issuer validation
  - `_get_microsoft_oidc_metadata()` / `_get_microsoft_jwks()` — cached with 1-hour TTL
- `SocialAuthSerializer` — validates the provider token, calls the verification service, finds or creates `users.User` inside `transaction.atomic()` with `select_for_update()`, returns SimpleJWT tokens
- `SocialAuthView` — `POST /api/auth/social/` — catches `SocialAuthError` and returns `{"detail": ..., "code": ...}`
- 32 tests in `users/tests/test_social_auth.py` (three layers: view-level, Google service unit, Microsoft ID token unit with real RSA key pairs)

## Files Involved

| File | Change |
|---|---|
| `backend/requirements.txt` | Added `django-allauth`, `requests`, `cryptography`, `PyJWT`, and transitive deps |
| `backend/config/settings.py` | Added allauth apps, `SITE_ID`, `AccountMiddleware`, allauth settings, `SOCIALACCOUNT_PROVIDERS` |
| `backend/.env.example` | Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` |
| `backend/users/social_auth.py` | New — provider verification service |
| `backend/users/serializers.py` | Added `SocialAuthSerializer` |
| `backend/users/views.py` | Added `SocialAuthView` |
| `backend/users/urls.py` | Added `POST /api/auth/social/` route |
| `backend/users/tests/test_social_auth.py` | New — 32 tests |

## How It Works

1. Frontend obtains a provider token from Google (ID token from Google Sign-In) or Microsoft (access token or ID token from MSAL).
2. Frontend sends `{ "provider": "google"|"microsoft", "id_token": "..." }` or `{ "provider": "...", "access_token": "..." }` to `POST /api/auth/social/`.
3. Backend calls the appropriate verification function in `social_auth.py`:
   - **Google**: calls `https://oauth2.googleapis.com/tokeninfo` — Google verifies the token server-side and returns claims including `email_verified`. Audience is validated against `GOOGLE_CLIENT_ID` when configured.
   - **Microsoft (access token)**: calls `https://graph.microsoft.com/v1.0/me` — Microsoft validates the token and returns the user's profile.
   - **Microsoft (ID token)**: full local verification — fetches OIDC metadata (`/.well-known/openid-configuration`), retrieves JWKS, matches the token's `kid` to a signing key, verifies signature/audience/expiry via `PyJWT`, then manually validates the issuer with `{tenantid}` substitution for multi-tenant endpoints. Both OIDC metadata and JWKS are cached for 1 hour.
4. Backend rejects the request if the email is missing or not verified by the provider.
5. Backend finds `users.User` by email (case-insensitive) inside `transaction.atomic()` with `select_for_update()`, or creates a new one:
   - New users: `email = username = normalized email`, `email_verified = True`, `preferred_auth_provider = provider`.
   - Existing users: `email_verified` set to `True` if provider confirms it and it was previously `False`; `preferred_auth_provider` set if blank.
6. Backend returns WorkspaceCanvas SimpleJWT `access` and `refresh` tokens — the same format as email/password login.

## API Endpoint

`POST /api/auth/social/`

**Google (ID token):**
```json
{
  "provider": "google",
  "id_token": "<google-id-token>"
}
```

**Microsoft (access token):**
```json
{
  "provider": "microsoft",
  "access_token": "<microsoft-access-token>"
}
```

**Microsoft (ID token):**
```json
{
  "provider": "microsoft",
  "id_token": "<microsoft-id-token>"
}
```

**Success response:**
```json
{
  "access": "<jwt-access-token>",
  "refresh": "<jwt-refresh-token>",
  "email": "user@example.com",
  "email_verified": true,
  "preferred_auth_provider": "google"
}
```

**Error response (400):**
```json
{
  "detail": "Human-readable error message.",
  "code": "machine_readable_code"
}
```

Error codes: `missing_token`, `invalid_token`, `expired_token`, `invalid_audience`, `invalid_issuer`, `unverified_email`, `missing_email`, `provider_unavailable`, `social_auth_failed`.

## Authentication vs Organization Access

| Layer | What it proves |
|---|---|
| Google / Microsoft token | User identity is confirmed by the provider |
| WorkspaceCanvas JWT | User is authenticated in WorkspaceCanvas |
| `Membership.status == active` | User can access a specific organization |

Social login proves identity. It does **not** grant organization access. A user who signs in with Google has zero memberships until they are invited to an organization. Email domain alone does not grant access.

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `MICROSOFT_CLIENT_ID` | Azure AD application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Azure AD client secret |
| `MICROSOFT_TENANT_ID` | Azure AD tenant (`common` for multi-tenant) |

Set these in `backend/.env`. Never commit real credentials.

## Security Notes

- **Google**: tokens are verified server-side by Google's tokeninfo endpoint. Audience is validated against `GOOGLE_CLIENT_ID` when configured.
- **Microsoft access tokens**: verified server-side by Microsoft Graph — tokens are never decoded locally.
- **Microsoft ID tokens**: fully verified locally — JWKS signature, audience, expiry, and issuer. The issuer check handles `{tenantid}` substitution for the `common` (multi-tenant) endpoint.
- Unverified provider emails are rejected; the endpoint returns 400 with a structured `{"detail", "code"}` response.
- Users are linked by normalized (lowercase) email.
- The user find-or-create path runs inside `transaction.atomic()` with `select_for_update()` to prevent duplicate user creation under concurrent requests.
- OIDC metadata and JWKS are cached for 1 hour to avoid re-fetching Microsoft's keys on every request.
- OAuth client secrets live only in environment variables.

## What Is Not Included Yet

- No frontend Google/Microsoft login buttons
- No MFA/TOTP after social login
- No organization application or invitation acceptance
- No domain-based auto-join

## How To Run / Test

```bash
make migrate
make backend-check
make backend-test
make ci
```

**Manual test (requires real provider credentials in `.env`):**

```bash
# Start the backend
make backend-docker-serve

# Send a Google ID token obtained from the frontend
curl -s -X POST http://localhost:8000/api/auth/social/ \
  -H "Content-Type: application/json" \
  -d '{"provider": "google", "id_token": "<real-google-id-token>"}' | jq .
```

## Future Notes

- Frontend will add Google Sign-In and Microsoft MSAL buttons that obtain provider tokens and call `POST /api/auth/social/`.
- MFA will be checked after primary authentication when `mfa_enabled = True`.
- Microsoft tenant validation can be strengthened for enterprise orgs (restrict to specific tenant IDs via `MICROSOFT_TENANT_ID`).
- Organization setup (draft → pending → approved) begins only after the user has a verified identity.

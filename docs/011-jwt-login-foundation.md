# 011 — JWT Login Foundation

## Purpose

This PR adds email/password JWT login for existing users. Authentication is intentionally separate from organization setup — a user proves their identity first, then organization access is granted through membership later.

## What Was Added

- `djangorestframework-simplejwt` dependency
- JWT authentication class in `REST_FRAMEWORK` settings
- `SIMPLE_JWT` settings (15-minute access tokens, 7-day refresh, rotation + blacklisting)
- `rest_framework_simplejwt.token_blacklist` app + migrations
- Email/password login endpoint — looks up user by email, authenticates with Django's password system
- Token refresh endpoint (SimpleJWT built-in)
- Token verify endpoint (SimpleJWT built-in)
- Current user endpoint — returns user profile + memberships
- Logout endpoint — blacklists the refresh token
- Post-login field updates: `preferred_auth_provider` set to `email` if blank, `last_login_ip` recorded
- drf-spectacular schema annotations on all auth views

## Files Involved

| File | Change |
|---|---|
| `backend/config/settings.py` | Added `token_blacklist` app, `DEFAULT_AUTHENTICATION_CLASSES`, `SIMPLE_JWT` settings |
| `backend/config/urls.py` | Added `api/auth/` include |
| `backend/users/serializers.py` | New — `EmailTokenObtainPairSerializer`, `CurrentUserSerializer`, `LogoutSerializer` |
| `backend/users/views.py` | New — `EmailTokenObtainPairView`, `CurrentUserView`, `LogoutView` |
| `backend/users/urls.py` | New — auth URL patterns |
| `backend/users/tests/test_auth.py` | New — 17 auth tests |
| `backend/requirements.txt` | Added `djangorestframework-simplejwt==5.5.1` |

## How It Works

1. Client sends `email` + `password` to `POST /api/auth/token/`.
2. Backend finds the user by email (case-insensitive lookup).
3. Backend authenticates using Django's `authenticate()` with `username=user.username`.
4. On success: `preferred_auth_provider` is set to `email` if blank; `last_login_ip` is recorded.
5. Backend returns `access` and `refresh` JWT tokens.
6. Client uses `Authorization: Bearer <access_token>` for all authenticated requests.
7. Client calls `POST /api/auth/token/refresh/` with the refresh token to get a new access token.
8. Client calls `POST /api/auth/logout/` with the refresh token to blacklist it.

Refresh tokens rotate on use (`ROTATE_REFRESH_TOKENS = True`) and are blacklisted after rotation (`BLACKLIST_AFTER_ROTATION = True`), so each refresh token can only be used once.

## API Endpoints

| Method | URL | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/token/` | None | Login — returns access + refresh tokens |
| `POST` | `/api/auth/token/refresh/` | None | Exchange refresh token for new access token |
| `POST` | `/api/auth/token/verify/` | None | Verify an access token is valid |
| `GET` | `/api/auth/me/` | Bearer | Return current user profile and memberships |
| `POST` | `/api/auth/logout/` | Bearer | Blacklist the refresh token |

**Example login request:**

```json
POST /api/auth/token/
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Example login response:**

```json
{
  "access": "<access_token>",
  "refresh": "<refresh_token>"
}
```

**Example authenticated request:**

```http
GET /api/auth/me/
Authorization: Bearer <access_token>
```

**Example logout:**

```json
POST /api/auth/logout/
{
  "refresh": "<refresh_token>"
}
```

## Authentication vs Organization Access

JWT proves the user is authenticated. It does **not** grant organization dashboard access.

| Layer | What it proves |
|---|---|
| JWT token | User exists and authenticated |
| `Membership.status == active` | User can access the organization |
| `Organization.status == active` | The organization is approved on the platform |

Signup, organization application, invitations, Google, Microsoft, and MFA are separate future PRs.

## Dev Notes

The HMAC key length warning during tests (`InsecureKeyLengthWarning`) is because the dev `DJANGO_SECRET_KEY` in `.env` is short. This is expected in local dev. Use a proper 32+ character secret key in production — SimpleJWT uses `DJANGO_SECRET_KEY` for token signing by default.

## What Is Not Included Yet

- No signup endpoint
- No email verification sending
- No Google OAuth
- No Microsoft OAuth
- No MFA/TOTP
- No organization setup/application flow
- No invitation acceptance flow
- No frontend UI changes

## How To Run / Test

```bash
make migrate
make backend-check
make backend-test
make ci
```

**Manual test:**

```bash
# 1. Start the backend
make backend-docker-serve

# 2. Login
curl -s -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@workspacecanvas.local", "password": "admin123"}' | jq .

# 3. Use the access token
curl -s http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer <access_token>" | jq .
```

## Future Notes

- Signup will create users with `email_verified=False` and send a verification email
- Email verification endpoint will call `user.mark_email_verified()`
- Google and Microsoft sign-in will also map to `users.User` and can set `email_verified=True` immediately
- MFA will be checked after primary authentication when `mfa_enabled=True`
- Organization setup (draft → pending → approved) begins only after the user has a verified identity

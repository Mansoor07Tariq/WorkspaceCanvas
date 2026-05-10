# 012 — Signup and Email Verification

## Purpose

This PR adds user signup and email address verification. New users register with an email and password, receive a one-time verification link, and must click it before their identity is considered verified.

## What Was Added

- `EmailVerificationToken` model — UUID token with `expires_at`, `used_at`, `is_used`/`is_expired`/`is_valid` properties, `mark_used()`, and `create_for_user()` class method
- `EmailVerificationTokenAdmin` — registered in Django admin
- Signup endpoint — creates the user, issues a token, sends a verification email
- Verify-email endpoint — validates the token, calls `user.mark_email_verified()`
- Resend-verification endpoint — issues a new token if the previous one is no longer valid, with a 60-second cooldown to prevent spam; always returns 200 to prevent email enumeration
- `users/emails.py` — `send_email_verification(user, token)` helper, builds the verification URL from `FRONTEND_URL`
- `EMAIL_BACKEND`, `DEFAULT_FROM_EMAIL`, `FRONTEND_URL` settings — configurable via environment variables, default to console backend and localhost in development
- Migration `users/0003_emailverificationtoken.py`
- 24 tests in `users/tests/test_signup.py`

## Files Involved

| File | Change |
|---|---|
| `backend/config/settings.py` | Added `EMAIL_BACKEND`, `DEFAULT_FROM_EMAIL`, `FRONTEND_URL` |
| `backend/.env.example` | Added email env vars |
| `backend/users/models.py` | Added `EmailVerificationToken` model + `EMAIL_VERIFICATION_TOKEN_LIFETIME` |
| `backend/users/admin.py` | Registered `EmailVerificationTokenAdmin` |
| `backend/users/emails.py` | New — `send_email_verification()` |
| `backend/users/serializers.py` | Added `SignupSerializer`, `EmailVerificationSerializer`, `ResendEmailVerificationSerializer` |
| `backend/users/views.py` | Added `SignupView`, `VerifyEmailView`, `ResendEmailVerificationView` |
| `backend/users/urls.py` | Added 3 new routes |
| `backend/users/migrations/0003_emailverificationtoken.py` | New migration |
| `backend/users/tests/test_signup.py` | New — 24 tests |

## How It Works

1. Client sends `email` + `password` (+ optional `full_name`) to `POST /api/auth/signup/`.
2. Backend validates: email format, email uniqueness (case-insensitive), password min length (8).
3. A `User` is created with `email_verified=False`. Username is auto-derived from the email local part (`alice@example.com` → `alice`); a numeric suffix is appended on collision.
4. An `EmailVerificationToken` is created with a 24-hour expiry.
5. A verification email is sent containing `{FRONTEND_URL}/verify-email?token={uuid}`.
6. Client submits the token to `POST /api/auth/verify-email/`.
7. Backend finds the token, checks `is_valid` (not used, not expired), calls `mark_used()` then `user.mark_email_verified()`.
8. To resend, client calls `POST /api/auth/resend-verification/` with the email. The response is always a generic 200 regardless of whether the email exists or is already verified, to prevent enumeration. A new token is only issued if no token was created within the last 60 seconds.

## API Endpoints

| Method | URL | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup/` | None | Create a new user account |
| `POST` | `/api/auth/verify-email/` | None | Verify email address with token |
| `POST` | `/api/auth/resend-verification/` | None | Resend the verification email |

**Signup request:**

```json
POST /api/auth/signup/
{
  "email": "alice@example.com",
  "password": "strongpass123",
  "full_name": "Alice Smith"
}
```

**Signup response:**

```json
HTTP 201
{
  "detail": "Account created. Check your email to verify your address."
}
```

**Verify email request:**

```json
POST /api/auth/verify-email/
{
  "token": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Resend request:**

```json
POST /api/auth/resend-verification/
{
  "email": "alice@example.com"
}
```

## Email Settings

| Setting | Default (dev) | Description |
|---|---|---|
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Prints emails to stdout in dev |
| `DEFAULT_FROM_EMAIL` | `WorkspaceCanvas <noreply@workspacecanvas.local>` | Sender address |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL prepended to verification links |

For local development, verification tokens are printed to the console. Set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` (and the SMTP vars) in production.

## Token Lifecycle

| State | Meaning |
|---|---|
| `is_valid = True` | Not used, not expired — can be consumed |
| `is_used = True` | Already verified — cannot be reused |
| `is_expired = True` | Created more than 24 hours ago — cannot be consumed |

## Security Notes

- Resend and verify endpoints both return generic messages for unknown emails/tokens — no enumeration.
- Tokens are one-time use; `mark_used()` is called before `mark_email_verified()` to prevent double-use on concurrent requests.
- Resend has a 60-second cooldown to prevent token flooding.

## What Is Not Included Yet

- No JWT tokens issued at signup (user must login separately after verifying)
- No Google / Microsoft OAuth signup
- No password reset flow
- No frontend UI
- No organization setup flow (begins after email is verified)

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

# 2. Sign up
curl -s -X POST http://localhost:8000/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "strongpass123"}' | jq .

# 3. Copy the token from the console output and verify
curl -s -X POST http://localhost:8000/api/auth/verify-email/ \
  -H "Content-Type: application/json" \
  -d '{"token": "<token-from-console>"}' | jq .

# 4. Log in
curl -s -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "strongpass123"}' | jq .
```

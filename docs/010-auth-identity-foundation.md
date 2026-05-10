# 010 — Auth Identity Foundation

## Purpose

This PR prepares the custom `users.User` model for strong authentication before organization setup is introduced. It adds identity and security fields that will be used by email verification, social login, MFA, and audit logging — without adding any API endpoints yet.

## What Was Added

- `email_verified` and `email_verified_at` — tracks whether the user has proved ownership of their email address
- `preferred_auth_provider` — stores the user's chosen login method (email, Google, or Microsoft)
- `mfa_enabled` and `mfa_verified_at` — prepares the model for future two-factor authentication
- `last_login_ip` — captures the IP for security auditing
- `has_verified_identity` property — returns `True` when email is verified
- `requires_mfa` property — returns `True` when MFA is enabled for the user
- `mark_email_verified()` method — atomically sets `email_verified=True` and records the timestamp
- Django admin "Authentication Security" fieldset with readonly timestamp fields
- Tests for all new fields, defaults, properties, and methods

## Files Involved

| File | Change |
|---|---|
| `backend/users/models.py` | Added `AuthProvider` choices, 6 new fields, 2 properties, 1 method |
| `backend/users/admin.py` | Added new fields to `list_display`, `list_filter`, `readonly_fields`, and new fieldset |
| `backend/users/migrations/0002_user_email_verified_...py` | Migration for the 6 new fields |
| `backend/users/tests/test_users.py` | Extended with 9 new auth identity tests |
| `docs/010-auth-identity-foundation.md` | This document |
| `README.md` | Doc link added |

## How It Works

A user can exist independently before joining or creating an organization. Authentication happens first:

1. A user signs up with email/password (or via Google/Microsoft later).
2. Their `email_verified` starts as `False`.
3. An email verification flow (added later) calls `mark_email_verified()` to confirm ownership.
4. Google and Microsoft sign-in can set `email_verified=True` immediately when the provider confirms a verified email.
5. If MFA is enabled, `mfa_enabled=True` and the auth flow will require a second factor.
6. Organization access is entirely separate — it is controlled by `Membership` and `Organization.status`.

## Authentication vs Organization Access

| Concern | Where it lives |
|---|---|
| Prove who the user is | `users.User` — email verification, auth provider, MFA |
| Prove the user can access an org | `accounts.Membership` — role, status |
| Prove the org is allowed on the platform | `accounts.Organization` — status (approved/rejected) |

Email domain alone does not grant access. In the first version, users join organizations by **invitation only**. Organization setup/application comes after the auth layer is stable.

## AuthProvider Choices

| Value | Meaning |
|---|---|
| `email` | User authenticates with email and password |
| `google` | User authenticates via Google OAuth |
| `microsoft` | User authenticates via Microsoft OAuth |

`preferred_auth_provider` is blank by default — it is set during signup or first social login.

## What Is Not Included Yet

- No signup or login endpoints
- No JWT tokens
- No Google OAuth flow
- No Microsoft OAuth flow
- No actual MFA/TOTP setup or verification
- No email sending for verification
- No organization setup/application flow
- No invitation acceptance flow
- No frontend UI changes

## How To Run / Test

```bash
make makemigrations
make migrate
make backend-check
make backend-test
make ci
```

## Future Notes

- Email/password signup will create users with `email_verified=False` and trigger a verification email
- `mark_email_verified()` will be called by the email verification endpoint
- Google and Microsoft sign-in will set `email_verified=True` when the provider confirms a verified email
- `mfa_enabled` and `mfa_verified_at` will be used by the TOTP/MFA setup flow
- `last_login_ip` will be updated on each successful login by the auth middleware
- Organization setup begins only after the user has a verified identity

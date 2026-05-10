# 009 — Users and Approval Foundation

## Purpose

This PR adds the custom `User` model and the organization approval foundation before authentication endpoints are built. It establishes the identity layer (`users` app) and the business-access layer (`accounts` app) so that all future auth, social login, subscriptions, and permission work has a solid base to build on.

## What Was Added

- `users` Django app with a custom `User` model
- Global user profile fields (full name, avatar, phone, job title, timezone, locale)
- `AUTH_USER_MODEL = "users.User"` set in Django settings
- Media file settings for local avatar storage (`MEDIA_URL`, `MEDIA_ROOT`)
- Media file serving in development (`DEBUG=True` mode)
- Organization approval statuses (`draft`, `pending_approval`, `active`, `rejected`, `suspended`)
- `pending` membership status (new default)
- Django admin actions to approve, reject, suspend, and submit organizations for approval

## Files Involved

| File | Change |
|---|---|
| `backend/users/models.py` | New — custom `User` model extending `AbstractUser` |
| `backend/users/admin.py` | New — `CustomUserAdmin` with profile fieldsets |
| `backend/users/apps.py` | New — `UsersConfig` |
| `backend/users/migrations/0001_initial.py` | New — creates `users_user` table |
| `backend/users/tests/test_users.py` | New — user model tests |
| `backend/accounts/models.py` | Updated — `Organization.Status`, `Membership.Status.PENDING`, helper properties |
| `backend/accounts/admin.py` | Updated — approval/rejection/suspension actions |
| `backend/accounts/migrations/0002_organization_status_alter_membership_status.py` | New — adds status to Organization, alters Membership status choices |
| `backend/accounts/tests/test_models.py` | New — Organization/Membership model tests |
| `backend/accounts/tests/test_admin_actions.py` | New — approval action behavior tests |
| `backend/config/settings.py` | Updated — `AUTH_USER_MODEL`, `MEDIA_URL`, `MEDIA_ROOT` |
| `backend/config/urls.py` | Updated — media file serving in development |
| `backend/requirements.txt` | Updated — added `Pillow` |

## User vs Membership

| Concern | Where it lives |
|---|---|
| Identity (who this person is) | `users.User` |
| Organization-specific access | `accounts.Membership` |
| Role (owner, admin, member) | `accounts.Membership.role` |
| Platform-wide permissions | `users.User.is_staff`, `is_superuser` |

A `User` can later belong to multiple organizations through separate `Membership` records. Roles, statuses, and organization-specific settings belong on `Membership`, not on `User`.

## User Profile Fields

| Field | Purpose |
|---|---|
| `email` | Unique email — primary contact and login identifier |
| `full_name` | Display name for UI and notifications |
| `avatar` | Profile photo, stored in `media/users/avatars/` locally |
| `phone_number` | Optional contact number |
| `job_title` | Role within the person's organization |
| `timezone` | User's local timezone for date/time display (default: `UTC`) |
| `locale` | User's locale for formatting (default: `en`) |
| `is_profile_completed` | Flag set when user has filled in their full profile |
| `last_seen_at` | Tracks last activity — updated by middleware or auth logic later |

Not all fields are required at signup. They support a later "complete your profile" onboarding flow.

## Approval Flow

```
1. Admin signs up (auth endpoint, added next)
2. User account is created
3. Organization is created with status = draft
4. Owner Membership is created with status = pending
5. Admin submits the organization for approval
6. WorkspaceCanvas superuser reviews in Django admin
7. Superuser approves → Organization status = active, Owner Membership status = active
8. Admin can now access the dashboard
```

## Django Admin Actions

| Action | What it does |
|---|---|
| Submit for approval | Moves `draft` organizations to `pending_approval` |
| Approve organizations | Sets status to `active`, sets `is_active=True`, activates owner memberships |
| Reject organizations | Sets status to `rejected`, disables owner memberships |
| Suspend organizations | Sets status to `suspended`, sets `is_active=False`, disables all memberships |

## Why Custom User Now

Django strongly recommends creating a custom user model at the very start of a project, before any migrations are applied. Changing `AUTH_USER_MODEL` after migrations are in place is a painful, error-prone process that requires squashing migrations and manually altering foreign keys.

WorkspaceCanvas will later need:
- JWT authentication
- Google and Microsoft social login
- Two-factor authentication
- Profile completion and onboarding flows
- Subscription-based access control
- User-level audit logging

All of these features are much simpler to implement when the user model is owned by the project from the start.

## What Is Not Included Yet

- No JWT endpoints
- No login/signup API
- No Google/Microsoft sign-in
- No 2FA
- No frontend auth UI
- No subscription/payment models
- No invitation acceptance flow

## How To Run / Test

**First time or after DB reset:**

```bash
make makemigrations
make migrate
```

**Run tests:**

```bash
make backend-test
make backend-check
make ci
```

**Local PostgreSQL note:**

If running tests outside Docker, `POSTGRES_HOST` must be `localhost`. The `.env` file uses `POSTGRES_HOST=db` for Docker. To test locally, either:

- Temporarily edit `.env` to set `POSTGRES_HOST=localhost`
- Or run: `POSTGRES_HOST=localhost make backend-test`

**Docker DB reset** (if needed after switching `AUTH_USER_MODEL`):

```bash
cd backend
docker compose down -v
docker compose up --build
```

This wipes the PostgreSQL volume and re-runs all migrations from scratch, which is the correct approach when `AUTH_USER_MODEL` changes in early development.

## Future Notes

- Auth foundation (next PR) will use this `User` model to create JWT-based login and admin signup
- Admin signup will create a `draft` organization and a `pending` owner membership
- Invitation onboarding will create additional `Membership` records for team members
- Subscriptions will later control paid access — that state will live on `Organization`, not `User`
- Avatar storage will likely move to S3 or another object storage service before production

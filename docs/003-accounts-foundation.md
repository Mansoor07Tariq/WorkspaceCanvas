# 003 — Accounts Foundation

## Purpose

The accounts app provides the foundation for a multi-organization system. WorkspaceCanvas must support both companies and co-working spaces, each with their own users, roles, and invite flows.

## What Was Added

- `accounts` Django app created inside `backend/`
- `Organization` model
- `Membership` model
- `Invitation` model
- Django admin registered for all three models
- `accounts` added to `INSTALLED_APPS`
- Initial migration generated

## Files Involved

| File | Purpose |
|---|---|
| `backend/accounts/models.py` | Organization, Membership, Invitation models |
| `backend/accounts/admin.py` | Admin registration for all three models |
| `backend/accounts/apps.py` | App configuration |
| `backend/accounts/migrations/` | Database migrations |
| `backend/config/settings.py` | `accounts` added to `INSTALLED_APPS` |

## How It Works

### Organization

Represents a company or a co-working space.

| Field | Description |
|---|---|
| `name` | Display name |
| `slug` | URL-safe unique identifier |
| `organization_type` | `company` or `coworking_space` |
| `allowed_email_domain` | Optional — e.g. `propylon.com` for companies |
| `is_active` | Whether the organization is active |

The `allowed_email_domain` field is optional because co-working spaces accept members with any email address (Gmail, Outlook, startup domains, etc.), while companies may restrict membership to their corporate email domain.

### Membership

Connects a Django user to an organization with a role and a status. A user can only have one membership per organization (enforced by a `UniqueConstraint`).

**Roles:**

| Role | Description |
|---|---|
| `owner` | Full control over the organization |
| `admin` | Can manage members and settings |
| `member` | Standard access |

**Statuses:**

| Status | Description |
|---|---|
| `active` | User has normal access |
| `disabled` | User's access has been revoked |

Default role: `member`. Default status: `active`.

### Invitation

Represents a pending invite sent to an email address before the recipient has joined. The invited person may not yet have a Django user account.

**Statuses:**

| Status | Description |
|---|---|
| `pending` | Invite sent, not yet accepted |
| `accepted` | Invite was accepted and a Membership was created |
| `expired` | Invite passed its expiry date |
| `cancelled` | Invite was manually cancelled |

Default role: `member`. Default status: `pending`.

Each invitation has a UUID `token` field used for secure invite links. An `is_expired` property returns `True` if `expires_at` is set and has passed.

### Why Invitation and Membership are Separate

- An `Invitation` exists before someone joins — the person may not have a Django account yet.
- A `Membership` exists after someone joins — it links a real Django `User` to an organization.
- Keeping them separate allows the invite flow to be fully tracked independently of actual membership state.

## How To Run / Test

```bash
cd backend
source .venv/bin/activate
python manage.py migrate
python manage.py runserver
```

Open [http://localhost:8000/admin/](http://localhost:8000/admin/) and log in with your superuser.

**Check in admin:**

- Create an Organization of each type
- Assign a Membership to a user with a role
- Try creating a second Membership for the same user and organization — it should be rejected
- Create an Invitation with a `pending` status and verify the token is auto-generated and read-only

## Important Decisions

**Using Django's built-in `User` model:** No custom user model was created at this stage. `settings.AUTH_USER_MODEL` is used throughout so that a custom user model can be swapped in later without changing the foreign keys.

**No JWT or SSO yet:** Authentication endpoints, JWT tokens, and Microsoft SSO were intentionally left out of this step to keep the scope focused on the data model.

**Separate Invitation and Membership:** This separation supports a clean invite flow where the invited person's account does not need to exist yet at invite time.

## Future Notes

- Microsoft SSO (Azure AD) will be added for company organizations
- JWT authentication will be added for API access
- Email sending for invitation links will be added (via Celery + SMTP or Microsoft Graph)
- The `allowed_email_domain` field may be used to auto-approve join requests from matching email domains
- A custom `User` model may be introduced later if additional user profile fields are needed

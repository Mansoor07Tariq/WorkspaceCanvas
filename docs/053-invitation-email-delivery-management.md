# PR 053 — Invitation Email Delivery and Invite Management

## Purpose

PR 047 shipped the member-invitation flow, but invitations could only be shared
by manually copying the invite link. This PR makes the flow production-like for
an MVP/pilot by:

- Sending an invitation **email** when an owner/admin creates an invitation.
- Surfacing invitation **expiry** in the admin pending-invitations UI.
- Allowing admins to **resend** an invitation (refreshing its token and expiry).

It resolves three technical-debt items:

- **TD-038** — invitation expiry not surfaced in the pending-invitations UI.
- **TD-039** — no email delivery for invitations.
- **TD-040** — no resend-invitation button.

This PR deliberately does **not** add a notification system, background workers,
a third-party email SDK, email verification, bulk invites, reminders, or any
booking/calendar emails.

---

## Why This PR Exists

Copy-paste invite links are fine for a demo but poor onboarding for a pilot:
the inviter has to find the recipient's address out-of-band and paste a link.
Real email delivery, a visible expiry, and a one-click resend close that gap
without expanding scope.

---

## Email Backend Configuration

Email uses the standard Django email framework, configured entirely through
environment variables (already present in `config/settings.py`; this PR added
`EMAIL_USE_SSL`):

| Variable | Default | Notes |
|----------|---------|-------|
| `EMAIL_BACKEND` | `console.EmailBackend` | Prints emails to stdout in local dev |
| `DEFAULT_FROM_EMAIL` | `WorkspaceCanvas <noreply@workspacecanvas.local>` | From address |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP only |
| `EMAIL_PORT` | `587` | SMTP only |
| `EMAIL_USE_TLS` | `True` | STARTTLS (port 587) |
| `EMAIL_USE_SSL` | `False` | Implicit SSL (port 465); mutually exclusive with TLS |
| `EMAIL_HOST_USER` | `""` | SMTP only |
| `EMAIL_HOST_PASSWORD` | `""` | SMTP only — **never** logged or printed |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL used to build invite links |

### Local development

The default `console.EmailBackend` prints the full email (including the invite
link) to the backend stdout — no SMTP setup needed. Creating or resending an
invitation prints the email to the console.

### Production

Set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` and fill the
SMTP block via environment variables. Credentials are never hardcoded and never
printed. See `backend/.env.example` for a Gmail app-password example.

### Tests

Django's test environment swaps in the in-memory `locmem` backend, so tests
capture mail via the `mailoutbox` fixture without any real SMTP traffic.

---

## Invitation Email Behavior

A small service, `accounts/emails.py`:

- `build_invite_url(invitation)` — `FRONTEND_URL.rstrip("/") + "/invite/{token}"`.
  The URL is always built from the configured `FRONTEND_URL`, never the request
  `Host`, to avoid open-redirect / host-header injection into the link.
- `send_invitation_email(invitation)` — renders the plain-text template
  `accounts/templates/accounts/invitation_email.txt` and sends via `send_mail`.

The email contains the organization name, the invited role, the accept link,
the expiry date, and a "if you weren't expecting this, ignore it" note.

Subject: `You're invited to join {organization} on WorkspaceCanvas`.

On **create** (`POST .../invitations/`), the invitation is created and the email
sent inside a single `transaction.atomic()` block:

- If delivery fails (`SMTPException` / `OSError` / `ConnectionError`), the view
  raises `EmailDeliveryError` → **HTTP 503** with a generic message, and the
  transaction rolls back so **no orphaned pending invitation** is left behind.
- SMTP internals are never leaked to the client.
- On success the response is unchanged from PR 047 (includes `token`,
  `expires_at`, etc.), so the copy-link flow still works.

---

## Resend Invitation Behavior

New endpoint:

```
POST /api/accounts/organizations/{org_id}/invitations/{inv_id}/resend/
```

- **Permissions:** active owner/admin only (`_require_manager`). Members,
  disabled memberships, and cross-org callers are rejected (403 / 404).
- **Throttling:** shares the `invite_write` scope (POST-only).
- **Status guard:** only **pending** invitations can be resent. Accepted and
  cancelled invitations return 400. An expired *pending* invitation **can** be
  resent.

### Token/expiry refresh policy (Option B)

Resend **refreshes both the token and the expiry** (`now + 7 days`) and emails
the new link. Rationale: if the original link leaked, generating a new token
invalidates the old one. The old token immediately returns 404 from the public
detail/accept endpoints.

The token/expiry update and the email send happen in one `transaction.atomic()`
block: if delivery fails, the update rolls back and the **old token/expiry
remain intact** (the previously shared link keeps working).

No duplicate invitation rows are created — the same row is updated in place.

---

## Pending Invitation Expiry UI (TD-038)

- The manager-scoped `InvitationSerializer` already returns `expires_at`.
- `PendingInvitationsList` renders an expiry chip per row using a
  dependency-free helper, `formatInvitationExpiry(expiresAt)`:
  - future → `Expires in N days` / `Expires tomorrow` / `Expires today`
  - past → `Expired` (red chip)
  - null/invalid → `No expiry`
- Copy-link and cancel continue to work; expiry updates after a resend.

---

## Frontend Resend UI (TD-040)

- `PendingInvitationsList` shows a **Resend** button per pending invitation with
  `aria-label="Resend invitation to {email}"`.
- While a resend is in flight the row's buttons are disabled and a spinner
  replaces the send icon (`resendingId` drives this).
- `useInvitations` exposes `resendInvite(id)`; on success it replaces the row
  in-place with the refreshed token/expiry, so the copy-link control uses the
  new token immediately.
- `PeoplePage` shows a `role="alert"` snackbar: success
  ("Invitation resent to {email}.") or a generic error.
- Members never see the pending-invitations section or the resend button.

---

## Accept Flow Compatibility

- Public invitation detail still exposes only status/role/org (never the token
  or invited email).
- Accepting with a refreshed token works; the old token 404s.
- Email-match enforcement is unchanged.
- Expired/cancelled/accepted invitations cannot be accepted.

---

## Security / Privacy Notes

- SMTP password is read from env and never logged or returned in any response.
- Invite token remains manager-only in the API; the public detail endpoint does
  not expose it.
- Invite URLs are built from `FRONTEND_URL`, not the request `Host` — no open
  redirect.
- Resend is manager-only and IDOR-safe (scoped to the caller's org).
- Email delivery failures surface as a generic 503; no internals leak.

---

## Tests

### Backend (`accounts/tests/`)

- `test_invitation_email.py` — create sends exactly one email; recipient is the
  normalized address; subject/body contain org name, role, invite URL, and
  expiry; URL uses configured `FRONTEND_URL`; no email on invalid role / lacking
  permission / duplicate member; delivery failure returns 503 and persists
  nothing; success still returns the invitation payload.
- `test_invitation_resend.py` — owner/admin can resend; member / disabled /
  cross-org rejected; token and expiry refresh forward; old token invalid after
  resend; expired-pending can be resent; accepted/cancelled rejected; new token
  accepts successfully; delivery failure rolls back token/expiry.
- `test_invitation_throttle.py` — added a resend throttle test (shares
  `invite_write`).

### Frontend (`features/teams/__tests__/`)

- `teamsApi.test.ts` — `resendInvitation` posts to the correct URL.
- `invitationExpiry.test.ts` — formatter covers expired/future/tomorrow/null/invalid.
- `useInvitations.test.ts` — exposes `resendInvite`; updates row on success;
  rethrows and clears `resendingId` on error.
- `PendingInvitationsList.test.tsx` — expiry label, Expired chip, resend button,
  onResend handler, disabled-while-resending, copy link uses current token.
- `PeoplePage.test.tsx` — owner sees/uses resend; success and error alerts;
  member sees no resend button.

---

## Manual Test Checklist

1. Console backend configured → email prints to console on invite create.
2. Admin invites a guest → pending invitation created, email sent, expiry shown.
3. Admin copies the invite link → link works.
4. Admin clicks Resend → email re-sent, expiry updates, token/link refresh.
5. Old token after resend → returns 404 (invalid).
6. Member tries to resend → no UI control; direct API call rejected.
7. Expired pending invite resend → allowed; expiry refreshed.
8. Accepted/cancelled invite resend → rejected.
9. Matching email accepts the (new) token → lands on member dashboard.
10. Email mismatch on accept → rejected.

---

## What This PR Does Not Include

- Notification system, in-app notifications, or digests.
- Celery / background workers (delivery is synchronous within the request).
- SendGrid/Mailgun SDKs (standard Django SMTP only).
- Email verification, bulk invites, invite reminders, or booking/calendar emails.
- Resending accepted or cancelled invitations.

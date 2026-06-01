# PR 047 — Member Invitations and Team Access

## Purpose

This PR implements the MVP team invitation flow for WorkspaceCanvas. It lets admins and owners invite people to their organization, manage pending invitations, and ensures invited members land on the correct dashboard path after accepting.

## Why This PR Exists

After PR 046 (dashboard), the admin setup checklist showed "Invite team" as permanently deferred with a "Coming soon" chip. The product flow was incomplete: an admin could build a full office, but had no way to bring team members in. This PR closes that gap.

## Admin Invitation Flow

1. Admin opens the **People** page (`/app/people`).
2. Admin enters an email address and selects a role (Member or Admin) in the invite form.
3. Backend creates an `Invitation` with a UUID token, 7-day expiry, and `status=pending`.
4. The pending invitation appears in the **Pending invitations** list.
5. Admin copies the invite link (displayed inline; no email delivery required for MVP).
6. Admin can cancel any pending invitation.

## Invited Member Flow

1. Invited user opens `/invite/<token>`.
2. If unauthenticated: shown "Sign in / Create account" buttons. Token preserved in navigation state.
3. If authenticated with matching email: shown a **Join** button.
4. On accept: `Membership` created with role from invitation, `status=active`. Invitation marked `accepted`.
5. User redirected to `/app` (dashboard as member). Sees booking actions only, not admin setup checklist.

## Existing Member Flow

- Any active member can view the **Team members** list.
- Only owners/admins see the invite form and pending invitations list.
- Members see role chips (Owner / Admin / Member) for each teammate.

## Backend Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| `GET` | `/api/accounts/organizations/{org_id}/members/` | Active member | List active members |
| `GET` | `/api/accounts/organizations/{org_id}/invitations/` | Active owner/admin | List pending invitations |
| `POST` | `/api/accounts/organizations/{org_id}/invitations/` | Active owner/admin | Create invitation |
| `POST` | `/api/accounts/organizations/{org_id}/invitations/{inv_id}/cancel/` | Active owner/admin | Cancel pending invitation |
| `GET` | `/api/accounts/invitations/{token}/` | AllowAny | Public details for accept page (no token, no email) |
| `POST` | `/api/accounts/invitations/{token}/accept/` | IsAuthenticated | Accept invitation |

## Permissions

- `MemberListView` — any active member of the org.
- `InvitationListCreateView` — active owner/admin only.
- `InvitationCancelView` — active owner/admin only.
- `InvitationDetailView` — public (AllowAny), returns only `status`, `role`, `organization_name`, `organization_slug`, `is_expired`. Token is never exposed here.
- `InvitationAcceptView` — authenticated. `request.user.email` must match `invitation.email` (case-insensitive). Status must be `pending`. Must not be expired.

## Security Decisions

- **Token**: UUID4 (122 bits of entropy). Not guessable in practice.
- **Email match**: Accepting user's email must exactly match the invitation email. This prevents invitations from being stolen by users with different emails.
- **No token in public endpoint**: `InvitationDetailView` returns only org name and role — not the invite token.
- **Manager-only token exposure**: Invitation token appears in the manager list endpoint only.
- **Cross-org IDOR prevented**: All org-scoped views check the invitation's organization matches the URL parameter.
- **Disabled membership blocked**: `has_active_access` check ensures disabled memberships cannot invite or cancel.
- **Owner role not invitable**: `CreateInvitationSerializer` rejects `role=owner`.
- **Idempotent accept**: Already-accepted invitations return 400. Active memberships cannot be double-accepted.
- **Disabled membership reactivation**: A user with a disabled membership who accepts a new invite gets their membership reactivated with the new role.
- **Open-redirect prevention**: `getSafeReturnTo(value)` in `authUtils.ts` only allows paths that start with `/` and do not start with `//`. External URLs and protocol-relative URLs are rejected; navigation falls back to `/app`.

## Unauthenticated Invite Return Flow

When an unauthenticated user opens `/invite/:token`:

1. `AcceptInvitationPage` shows sign-in / create-account guidance.
2. Clicking **Sign in** navigates to `/login` with `state: { returnTo: "/invite/<token>" }`.
3. Clicking **Create account** navigates to `/signup` with the same state.
4. After successful login, `usePostAuthNavigation` reads `location.state.returnTo`, validates it via `getSafeReturnTo`, and redirects to `/invite/<token>` instead of `/app`.
5. `AcceptInvitationPage` then renders with the authenticated user and shows the **Join** button.
6. After successful signup, the success screen's **Back to sign in** link includes `state: { returnTo }` so the subsequent login also redirects back to the invite page.

**Limitation (MFA + invite)**: If the user has MFA enabled, `navigateToMfaChallenge` does not thread the `returnTo` state through to the MFA challenge page. After MFA verification the user is redirected to `/app` not back to the invite. They can then navigate to the invite link again. This edge case is acceptable for MVP.

## Email / Link-Based MVP Decision

Real email delivery is not configured. Invitations are link-based:

- Backend creates the invitation and returns the token.
- Frontend constructs `window.location.origin + /invite/<token>` and shows a copy button.
- Admin copies the link and shares it manually (Slack, email, etc.).
- This is a deliberate MVP choice — email sending can be added later without model changes.

## Dashboard Integration

- The admin setup checklist **Invite team** item now:
  - Links to `/app/people` (instead of being deferred/coming soon).
  - Is marked complete when `memberCount > 1` (i.e., at least one other member has joined).
- The "Coming soon" chip and `deferred: true` flag are removed from the invite item.
- `DashboardPage` fetches member count via `useTeamMembers` for owner/admin users only.

## Frontend Structure

```
src/features/teams/
  api/teamsApi.ts              — API functions (listMembers, listInvitations, ...)
  types/teams.types.ts         — TeamMember, Invitation, InvitationPublic types
  hooks/useTeamMembers.ts      — useReducer-based member list hook
  hooks/useInvitations.ts      — useReducer-based invitation CRUD hook
  components/InviteMemberForm.tsx
  components/MembersList.tsx
  components/PendingInvitationsList.tsx
  components/InvitationLinkCopy.tsx
  pages/PeoplePage.tsx
  __tests__/teamsApi.test.ts
  __tests__/PeoplePage.test.tsx
  __tests__/AcceptInvitationPage.test.tsx

src/features/invitations/
  pages/AcceptInvitationPage.tsx

src/routes/paths.ts            — Added ROUTES.inviteAccept, inviteAcceptPath()
src/app/router/AppRouter.tsx   — PeoplePage replaces ComingSoonPage; /invite/:token added
```

## Tests

### Backend (accounts/) — 82 tests, all passing
- `test_members.py` — 12 tests covering auth, cross-org, inactive membership, response shape, disabled members hidden
- `test_invitations.py` — 55 tests covering all create/list/cancel/detail/accept scenarios
- All existing `test_models.py`, `test_organization_create.py`, `test_admin_actions.py` still passing

### Frontend — 989 tests, 71 files, all passing
- `teamsApi.test.ts` — 6 URL contract tests
- `PeoplePage.test.tsx` — 14 component/integration tests
- `AcceptInvitationPage.test.tsx` — 11 tests covering all accept states
- `dashboardState.test.ts` — updated 4 tests for invite item behavior change

## Manual Test Checklist

1. Admin opens `/app/people`. Expected: invite form + pending list + members list visible.
2. Admin invites email. Expected: pending invitation created, appears in list with copy button.
3. Admin copies link. Expected: `<origin>/invite/<token>` copied to clipboard.
4. Member role user opens `/app/people`. Expected: no invite form, only members list.
5. Admin cancels invitation. Expected: invitation removed from pending list.
6. Invited user (unauthenticated) opens invite link. Expected: org name + role shown, sign in / create account buttons.
7. Invited user (authenticated, matching email) opens invite link. Expected: join button shown; on click, redirected to `/app`.
8. Invited user (authenticated, wrong email) opens invite link. Expected: 403 error message shown.
9. Cancelled invite link. Expected: "This invitation has been cancelled." shown, no join button.
10. Expired invite link. Expected: "This invitation has expired." shown.
11. Already accepted invite link. Expected: "already accepted" message shown.
12. Accepted member lands on dashboard. Expected: member dashboard (no admin setup checklist).
13. Accepted member books a desk. Expected: booking flow works normally.
14. Dashboard checklist "Invite team" item. Expected: links to `/app/people`, marked done when >1 member.

## What Is Not Included

- Real email delivery (SMTP/SendGrid/etc.).
- Resend invitation (deferred until email is wired up).
- Organization switching for multi-org users.
- Invite link expiry UI in the admin list (token has expiry in model, not surfaced).
- Bulk CSV invite.
- SCIM/SAML/SSO.
- Audit log.
- Seat limits / billing.

## Deferred Items

- TD-036 (invite checklist deferred) — resolved by this PR.
- Email delivery for invitations — add when email infrastructure is configured. Model supports it already.
- Resend invitation button — straightforward once email exists.
- Token expiry surfaced in UI — show "Expires in X days" on the pending invitation row.

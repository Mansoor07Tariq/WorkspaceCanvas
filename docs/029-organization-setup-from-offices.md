# 029 — Organization Setup from Offices

## Overview

Adds self-service organization creation to WorkspaceCanvas. When an authenticated
user with a completed profile navigates to **Offices** and has no active membership,
they are shown a 5-step wizard to create their first organization. After creation
they become the **owner** with an **active** membership and see the Offices empty
state.

Organization setup is **route-level** — it appears inside the Offices page only.
It is not a global forced gate. The sidebar unlocks as soon as `is_profile_completed`
is `true` and does not re-lock if the user has no organization.

---

## Backend Changes

### Model: `accounts.Organization`

- Added `OTHER = "other", "Other"` to `OrgType` choices.
- Added `generate_slug(name)` classmethod — wraps `django.utils.text.slugify` with
  a loop that appends `-1`, `-2`, etc. until the slug is unique.
- Migration: `accounts/migrations/0003_add_other_org_type.py`.

### Serializer: `accounts/serializers.py`

`CreateOrganizationSerializer` validates:

| Field | Rule |
|---|---|
| `name` | Required, stripped, max 255 chars |
| `organization_type` | One of `company`, `coworking_space`, `other` |
| `allowed_email_domain` | Optional. No `@`, no `http://`/`https://`, no `/`, must match `example.com` format |

`OrganizationResponseSerializer` returns: `id`, `name`, `slug`, `organization_type`,
`organization_type_display`, `allowed_email_domain`, `status`.

**Slug race condition:** `generate_slug()` is called inside `transaction.atomic()`.
If two concurrent requests produce the same slug, the second request receives an
`IntegrityError` and retries up to 5 times with a freshly generated slug.

### View: `POST /api/accounts/organizations/`

`CreateOrganizationView` (IsAuthenticated, throttle: `5/hour` per user):

1. Returns **403** if `request.user.is_profile_completed` is `False`.
2. Validates the body via `CreateOrganizationSerializer`.
3. Creates `Organization` (status = **active**) + `Membership` (role = **owner**,
   status = **active**) atomically inside `transaction.atomic()`.
4. Returns the new org as `201 Created`.

### URL wiring

`config/urls.py` now includes:
```python
path("api/accounts/", include("accounts.urls")),
```

---

## Frontend Changes

### Feature module: `features/organizations/`

```
features/organizations/
  api/organizationApi.ts          POST /api/accounts/organizations/
  components/
    OrganizationSetupFlow.tsx     5-step wizard (wrapper)
    OfficesEmptyState.tsx         Shown after org creation
    steps/
      OrgStepWelcome.tsx
      OrgStepName.tsx
      OrgStepType.tsx
      OrgStepDomain.tsx
      OrgStepReview.tsx
  hooks/useOrgSetupForm.ts        All wizard state + submission logic
  types/organization.types.ts     OrgType, Organization, OrgSetupStep, etc.
  utils/
    membershipUtils.ts            hasActiveMembership()
    orgValidation.ts              validateOrgName(), validateAllowedDomain()
  __tests__/                      Frontend unit and component tests
  index.ts                        Barrel exports
```

### `OrganizationSetupFlow`

5 steps: Welcome → Name → Type → Domain → Review & Create.

- Progress bar (with `aria-label`) tracks completion (10% → 100%). Bar animation
  respects `prefers-reduced-motion`.
- Step counter shows `Name · 1 / 4`.
- Domain step has a **Skip** button that clears the field and advances without
  validation (calling `goSkip()`, not `goNext()`).
- Review step shows a summary card before the create call.
- On create: calls `POST /api/accounts/organizations/`, then `refreshUser()` to
  update memberships in `AuthContext`, then calls `onCreated()`.

### `OfficesEmptyState`

Shows after org creation. Includes a disabled **"Add your first office"** button
with a tooltip — office creation is intentionally not implemented in this PR.

### `AppOfficesPage`

```tsx
const hasOrg = orgJustCreated || hasActiveMembership(user);
if (!hasOrg) return <OrganizationSetupFlow onCreated={...} />;
return <OfficesEmptyState />;
```

`orgJustCreated` is a local boolean that flips to `true` in the `onCreated`
callback, preventing a brief flash-back to the setup flow while `refreshUser()`
propagates through React state.

### Router

`ROUTES.offices` now renders `<AppOfficesPage />` instead of `<ComingSoonPage />`.

### Sidebar

No change. The sidebar already unlocks all items as soon as `is_profile_completed`
is `true`. No re-locking for missing org — organization setup happens inside the
Offices page itself.

---

## Validation

### Domain field

| Input | Result |
|---|---|
| `(empty)` | Valid — org has no domain restriction |
| `example.com` | Valid |
| `ACME.COM` | Valid — lowercased before store (frontend + backend) |
| `user@example.com` | Error — email not domain |
| `https://example.com` | Error — URL not domain |
| `example.com/team` | Error — domain with path |
| `notadomain` | Error — no TLD |

Both frontend and backend validate with matching rules (frontend: immediate
feedback; backend: authoritative source of truth).

---

## Access Control

| Scenario | Result |
|---|---|
| Unauthenticated | 401 |
| Profile incomplete | 403 |
| Authenticated, profile complete | 201 |

---

## Org Status

Organizations created via this endpoint are set to **active** immediately. No
admin approval step is required for self-service creation. The admin can still
change the status via the Django admin interface.

---

## Multi-org Support

The model and backend support multiple organizations per user. The frontend
defaults to showing the setup flow when `memberships.every(m => !m.has_active_access)`.
Joining additional organizations via invitation will be addressed in a future PR.

---

## Tests

### Backend

`backend/accounts/tests/test_organization_create.py` — **21 tests** covering:

- Auth: unauthenticated → 401, incomplete profile → 403
- Creation: company, coworking_space, other types
- Response: slug, active status, membership role
- Atomicity: org + membership created together
- Domain: valid/invalid formats, lowercasing
- Slug collision: unique suffix appended
- Validation: blank name, invalid org_type, email/URL/path domain rejections

### Frontend

`frontend/src/features/organizations/__tests__/` — **4 test files**:

- `membershipUtils.test.ts` — null user, empty/inactive/active memberships
- `orgValidation.test.ts` — name required, domain optional/valid/invalid formats
- `AppOfficesPage.test.tsx` — shows flow vs empty state, `orgJustCreated` guard
- `OrganizationSetupFlow.test.tsx` — each step, Skip fix, blocking Next, submit, error

---

## Manual Test Checklist

### Setup flow

- [ ] Navigate to Offices with no organization → wizard appears
- [ ] Welcome step has icon + CTA
- [ ] Name step: blank name shows validation error
- [ ] Type step: all three types selectable, card highlights on selection
- [ ] Domain step: Skip button advances without domain even if invalid text typed
- [ ] Domain step: Next button blocks when invalid domain is entered
- [ ] Review step: shows entered values before creating
- [ ] Create button shows spinner during submission
- [ ] After creation: OfficesEmptyState appears with disabled "Add your first office" button

### Access control

- [ ] Log in with an incomplete profile → Offices link is disabled in sidebar
- [ ] Complete profile → Offices link enabled
- [ ] After completing profile, navigate to Offices → wizard shown (no org yet)
- [ ] After creating org, reload page → OfficesEmptyState (membership persisted)

### Edge cases

- [ ] Two organizations with the same name → second gets `-1` slug suffix
- [ ] Domain `ACME.COM` → stored as `acme.com` (lowercased in frontend state)
- [ ] Domain `user@acme.com` → validation error shown in form

# 030 — Create First Office

## Purpose

Enables users who have set up an organization to create their first physical office. The "Add your first office" button on the Offices empty state becomes fully functional. After creation, the office is shown in a list view. Floor maps, desks, and seat booking are deferred.

---

## Architecture Decision: Separate `offices` Django App

The `Office` model lives in a new `backend/offices/` Django app rather than in `accounts`.

**Reasoning:**

| `accounts` owns | `offices` owns |
|---|---|
| Organization | Office |
| Membership | Floor (future) |
| Invitation | Desk / Seat (future) |
| Roles and access | Office map layout (future) |

Keeping them separate prevents `accounts` from becoming a dumping ground for workplace entities. The `offices` app imports from `accounts` for Organization and MemberRole references, but the reverse import never occurs.

---

## User Flow

```
User clicks Offices in sidebar
    ↓
No active org membership?
    → OrganizationSetupFlow (PR 029)
    ↓
Org exists, offices loading
    → Loading state
    ↓
Org exists, no offices
    → OfficesEmptyState with active "Add your first office" button
    ↓
User clicks Add your first office
    → OfficeCreationFlow (4 steps)
    ↓
Office created
    → OfficesList showing new office
```

---

## Backend

### App structure

```
backend/offices/
  __init__.py
  admin.py
  apps.py
  models.py
  permissions.py
  serializers.py
  views.py
  urls.py
  migrations/
    0001_initial.py
  tests/
    __init__.py
    test_office_create.py   (21 tests)
    test_office_list.py     (9 tests)
```

### Office model (`offices/models.py`)

| Field | Type | Notes |
|---|---|---|
| organization | FK → accounts.Organization | CASCADE |
| name | CharField(255) | required |
| slug | SlugField(255) | unique per org |
| address_line_1 | CharField(255) | optional |
| address_line_2 | CharField(255) | optional |
| city | CharField(120) | optional |
| county_or_state | CharField(120) | optional |
| country | CharField(120) | optional |
| timezone | CharField(64) | optional, validated against zoneinfo |
| is_active | BooleanField | default True |
| created_at | DateTimeField | auto |
| updated_at | DateTimeField | auto |

Constraint: `unique_office_slug_per_organization` on `(organization, slug)`.

### Slug generation

`Office.generate_slug(name, organization)` — unique per organization. Same name in different organizations gets the same slug. Same name in the same organization gets a suffix:
- `dublin-office`
- `dublin-office-1`
- `dublin-office-2`

### Endpoints

**`GET /api/offices/`**
- Auth required.
- Returns active offices for the current user's first active organization membership.
- 403 if no active membership.

**`POST /api/offices/`**
- Auth required.
- Organization determined from current user's first active membership (not from payload).
- 403 if no active membership.
- 403 if membership role is `member`.
- Owner/admin can create.
- Slug generated and collision-safe (retry loop + `IntegrityError` catch).
- Throttled: `office_create: 30/hour`.

### Permissions (`offices/permissions.py`)

```python
get_first_active_membership(user) -> Membership | None
user_can_manage_offices(membership) -> bool
```

`get_first_active_membership` selects memberships where:
- `status == "active"`
- `organization__status == "active"`

`user_can_manage_offices` returns `True` for `OWNER` and `ADMIN` roles.

---

## Frontend

### Offices page states (`AppOfficesPage.tsx`)

| Condition | What renders |
|---|---|
| No active org membership | `OrganizationSetupFlow` |
| Office creation flow active | `OfficeCreationFlow` |
| Loading | `LoadingState` |
| Org exists, no offices | `OfficesEmptyState` with active button |
| Org exists, offices present | `OfficesList` |

### Feature module

```
frontend/src/features/offices/
  api/
    officeApi.ts          listOffices(), createOffice()
  components/
    OfficesEmptyState.tsx  Active "Add your first office" button
    OfficeCreationFlow.tsx 4-step wizard
    OfficeCard.tsx         Single office card
    OfficesList.tsx        Grid of cards + "Add office" button
    steps/
      OfficeWelcomeStep.tsx
      OfficeNameStep.tsx
      OfficeLocationStep.tsx
      OfficeReviewStep.tsx
  hooks/
    useOffices.ts          Fetches and refreshes office list
    useOfficeCreationForm.ts Step state, validation, submission
  utils/
    officeValidation.ts    Name + timezone validation, payload builder
  types/
    office.types.ts        Office, CreateOfficePayload, OfficeFormFields, etc.
  __tests__/
    officeValidation.test.ts
    OfficeCreationFlow.test.tsx
```

### Office Creation Flow steps

| Step | Label | Content |
|---|---|---|
| 1 | Welcome | Title, subtitle, "Get started" CTA |
| 2 | Name | Office name field (required) |
| 3 | Location | Address, city, county/state, country, timezone (all optional) |
| 4 | Review | Summary of name, location, timezone → "Create office" |

Browser timezone pre-fills the timezone field via `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### Validation

Frontend:
- Name: required, trimmed
- Timezone: optional; if provided, must match IANA pattern regex
- All other location fields: optional, trimmed

Backend is the source of truth and validates timezone against `zoneinfo.available_timezones()`.

---

## Organization Selection

For this MVP, both frontend and backend use the user's first active membership. No org switcher is built yet.

---

## Tests

### Backend (30 new tests)

**`test_office_create.py`** (21 tests):
- unauthenticated → 401
- no active membership → 403
- inactive membership → 403
- member role → 403
- owner can create
- admin can create
- optional fields saved and trimmed
- name trimmed
- response has timestamps
- office linked to correct org (not from payload)
- organization_id in payload ignored
- slug generated from name
- duplicate name in same org gets suffix
- same name in different org allowed
- missing name → 400
- blank name → 400
- invalid timezone → 400
- valid timezone accepted
- UTC accepted
- empty timezone accepted

**`test_office_list.py`** (9 tests):
- unauthenticated → 401
- no active membership → 403
- inactive membership → 403
- active member can list
- empty list returns `[]`
- returns multiple offices
- does not return offices from other orgs
- inactive offices excluded
- response fields verified

### Frontend

**`officeValidation.test.ts`**: name validation, timezone validation, payload builder

**`OfficeCreationFlow.test.tsx`**: welcome renders, name validation blocks, step progression, timezone validation blocks, submit calls API + onCreated, API error displayed, back button works

**`AppOfficesPage.test.tsx`** (updated from PR 029): all 4 prior tests updated + 2 new (offices list, creation flow trigger)

---

## Manual Test Checklist

- [ ] User with no org → Organization Setup flow
- [ ] User creates org → Offices empty state with active "Add your first office" button
- [ ] Click "Add your first office" → Office creation flow opens
- [ ] Submit empty name → Validation error shown
- [ ] Submit invalid timezone → Validation error shown
- [ ] Create office with name only → Office created and listed
- [ ] Create office with all location fields → Details saved and shown on card
- [ ] Refresh `/app/offices` → Office list persists
- [ ] Member role user cannot POST to `/api/offices/` → 403
- [ ] User cannot see offices from another organization
- [ ] Duplicate office name in same org → unique slug suffix (e.g. `dublin-office-1`)
- [ ] Same office name in different org → allowed, same slug
- [ ] "Build floor map" on office card → disabled/coming soon tooltip, no action

---

## Deferred

- Floor creation and map editor
- Desk / seat management
- Seat booking
- Office archive / delete
- Office settings
- Org switching UI
- People management
- Invitations
- Billing

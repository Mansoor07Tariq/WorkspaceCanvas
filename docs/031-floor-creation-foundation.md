# PR 031 — Floor Creation Foundation

## Purpose

Extends the office management domain by adding the Floor layer beneath Office. Users can now create and list floors for an office. The map builder and desk/seat assignment remain deferred to future PRs.

## Domain Hierarchy

```
Organization
  → Office          (PR 030)
    → Floor         (PR 031)
      → [Desk/Seat] (future)
```

Floors are the structural containers for map data. Creating floors before the map editor ensures the data model is in place before the canvas work begins.

## Floor Model

**App**: `offices` (same app as Office — floors are tightly coupled to the physical office concept)

| Field        | Type        | Notes                                               |
|--------------|-------------|-----------------------------------------------------|
| id           | BigAutoField| Auto PK                                             |
| office       | FK → Office | CASCADE delete, `related_name="floors"`             |
| name         | CharField(255) | Required                                          |
| slug         | SlugField(255) | Generated server-side from name                   |
| level_number | IntegerField | Default 0, can be negative (basement = -1)        |
| is_active    | BooleanField| Default True                                        |
| created_at   | DateTimeField | auto_now_add                                      |
| updated_at   | DateTimeField | auto_now                                          |

**Constraints**:
- `unique_floor_slug_per_office` — slug unique per office
- `unique_floor_level_per_office` — level_number unique per office
- `ordering = ["level_number", "name"]`

## Backend Endpoints

### GET /api/offices/{office_id}/floors/

Returns active floors for the given office, ordered by level_number then name.

- Requires authenticated user with active membership
- Returns 403 if no active membership
- Returns 404 if office does not exist or belongs to another organization
- Returns 200 `[]` if no floors exist

Response shape:
```json
[
  {
    "id": 1,
    "office": 5,
    "name": "Ground Floor",
    "slug": "ground-floor",
    "level_number": 0,
    "is_active": true,
    "created_at": "2026-05-27T...",
    "updated_at": "2026-05-27T..."
  }
]
```

### POST /api/offices/{office_id}/floors/

Creates a floor under the given office.

- Requires authenticated user with active membership and OWNER or ADMIN role
- Returns 403 for MEMBER role
- Returns 404 if office does not exist or belongs to another organization
- Returns 400 for blank name, duplicate level_number in same office
- Returns 201 on success

Request body:
```json
{
  "name": "Ground Floor",
  "level_number": 0
}
```

`level_number` is optional, defaults to 0.

## Permissions

| Action         | Owner | Admin | Member |
|----------------|-------|-------|--------|
| List floors    | ✓     | ✓     | ✓      |
| Create floor   | ✓     | ✓     | ✗      |

Permission helpers reused from PR 030 (`get_first_active_membership`, `user_can_manage_offices`). New helper added: `get_office_for_membership(membership, office_id)` — returns the Office if it belongs to the user's org and is active, or None. Both non-existent and cross-org offices return 404 to avoid leaking data.

## Slug Behaviour

Slugs are generated server-side from the floor name using Django's `slugify`. If a collision occurs (same office, same slug), a numeric suffix is appended:

- "Ground Floor" → `ground-floor`
- Second "Ground Floor" in same office → `ground-floor-1`

The same name is allowed across different offices. Slug collision under concurrent requests is handled via a 5-attempt retry loop with `transaction.atomic()` catching `IntegrityError`.

## Level Number Behaviour

- Default is 0 (ground floor) if not provided
- Negative values allowed (basement = -1, sub-basement = -2)
- Must be unique per office — two floors cannot share a level_number
- Duplicate level_number returns 400 with a clear validation message
- Race condition duplicate caught via `IntegrityError` handler, also returns 400

Convention (not enforced):
- -1 → Basement
- 0 → Ground Floor
- 1 → First Floor

## Throttling

`floor_create` scope applied to POST only via `_FloorPostScopedThrottle`. Default rate: `60/hour` (env-overridable via `THROTTLE_FLOOR_CREATE`).

## Frontend Route / Page Flow

```
/app/offices           → AppOfficesPage (office list / creation)
/app/offices/:officeId → OfficeDetailPage (floor list / creation)
```

### OfficeCard navigation

The "Build floor map" disabled button was replaced with an active "Manage floors →" button that navigates to `/app/offices/{office.id}`.

### OfficeDetailPage states

1. Invalid officeId in URL → redirect to `/app/offices`
2. Create mode → renders `FloorCreationFlow`
3. Error (403/404 from API) → shows ErrorAlert + back link
4. Loading → shows LoadingState
5. No floors → shows `FloorsEmptyState` with "Create first floor" CTA
6. Floors exist → shows `FloorsList` with floor cards and "Add floor" button

## Floor Creation UI

2-step wizard (no welcome step, simpler than office creation flow):

**Step 1 — Floor details**
- Floor name (required, max 255)
- Level number (default 0, integer, allows negative)
- Level number helper text: "Use 0 for ground floor, 1 for first floor, -1 for basement."
- Cancel button on first step returns to floor list

**Step 2 — Review**
- Shows floor name and level number
- "Create floor" submit button

Progress bar shown on both steps (50% → 100%).

## Frontend Module

```
frontend/src/features/floors/
├── types/floor.types.ts         — Floor, CreateFloorPayload, FloorFormFields, FloorFieldErrors
├── api/floorApi.ts              — listFloors(officeId), createFloor(officeId, data)
├── utils/floorValidation.ts     — validateFloorName, validateFloorLevel, buildFloorPayload
├── hooks/
│   ├── useFloors.ts             — fetch reducer hook, similar to useOffices
│   └── useFloorCreationForm.ts  — 2-step wizard state
├── components/
│   ├── FloorsEmptyState.tsx
│   ├── FloorCard.tsx
│   ├── FloorsList.tsx
│   ├── FloorCreationFlow.tsx
│   └── steps/
│       ├── FloorDetailsStep.tsx
│       └── FloorReviewStep.tsx
└── __tests__/
    ├── floorValidation.test.ts
    └── FloorCreationFlow.test.tsx
```

## Tests

### Backend

| File                    | Count | Coverage                                                            |
|-------------------------|-------|---------------------------------------------------------------------|
| test_floor_create.py    | 21    | Auth, membership, office access, creation, slug, level uniqueness, validation, scoping |
| test_floor_list.py      | 13    | Auth, membership, office access, listing, ordering, inactive exclusion, org isolation, response fields |

### Frontend

| File                        | Count | Coverage                                               |
|-----------------------------|-------|--------------------------------------------------------|
| floorValidation.test.ts     | 15    | Name validation, level validation, buildFloorPayload   |
| FloorCreationFlow.test.tsx  | 8     | Render, validation blocks, step progression, submit, error, back, cancel |

## Manual Test Checklist

- [ ] User with office clicks "Manage floors →" on OfficeCard → navigates to `/app/offices/:id`
- [ ] Office with no floors → FloorsEmptyState with "Create first floor" button
- [ ] Click "Create first floor" → FloorCreationFlow opens with details step
- [ ] Empty floor name → validation error, cannot advance
- [ ] Non-integer level (e.g. "abc") → validation error, cannot advance
- [ ] Valid name, level 0 → advances to review, shows correct summary
- [ ] Submit → floor created, returns to list, floor card visible
- [ ] Level -1 (Basement) → accepted, ordered before level 0 in list
- [ ] Create second floor with same level_number → 400 error shown in wizard
- [ ] Same level_number in different office → allowed
- [ ] Member role user → cannot create floor (403)
- [ ] Navigate to `/app/offices/99999` → shows error state with back link
- [ ] "Build map →" on FloorCard → tooltip visible, no action taken
- [ ] "Back to offices" button → returns to office list
- [ ] Cancel button on floor creation details step → returns to floor list
- [ ] Refresh `/app/offices/:id` → floors still listed

## Deferred Items

- Map editor / canvas (Konva/Fabric)
- Floor plan image upload
- Floor layout data model (zones, rooms)
- Desks and seats
- Seat booking
- Floor edit / archive / delete
- Floor-level roles or permissions
- Pagination on floor list

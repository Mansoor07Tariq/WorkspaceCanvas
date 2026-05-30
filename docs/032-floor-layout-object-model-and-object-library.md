# PR 032 — Floor Layout Object Model and Object Library

## Purpose

Extends the floor management domain by adding a flexible layout object data model beneath Floor. Users can now create, list, update, and soft-delete layout objects for a floor. A frontend object library catalogs all 36 supported types. A placeholder floor layout page provides create/list/delete UI, deferring the visual canvas editor to PR 033.

## Domain Hierarchy

```
Organization
  → Office          (PR 030)
    → Floor         (PR 031)
      → Layout Objects (PR 032)
        → [Canvas Editor] (future PR 033)
```

## Architecture Decision: Generic Layout Object Model

All layout objects share a single `FloorLayoutObject` model with an `object_type` field rather than a separate table per type. This avoids table explosion (36+ types × future growth) while supporting the full object library. The `metadata` JSONField provides per-type extensibility without schema migrations.

---

## FloorLayoutObject Model

**App**: `offices` (same app as Office and Floor)

| Field        | Type                  | Notes                                      |
|--------------|-----------------------|--------------------------------------------|
| id           | BigAutoField          | Auto PK                                    |
| floor        | FK → Floor            | CASCADE delete, `related_name="layout_objects"` |
| object_type  | CharField(40)         | Choices from `ObjectType` (36 values)      |
| label        | CharField(120)        | Optional, blank allowed                    |
| x            | DecimalField(10,2)    | Required                                   |
| y            | DecimalField(10,2)    | Required                                   |
| width        | DecimalField(10,2)    | Required, must be > 0                      |
| height       | DecimalField(10,2)    | Required, must be > 0                      |
| rotation     | DecimalField(6,2)     | Default 0                                  |
| is_bookable  | BooleanField          | Default False, future-facing flag          |
| metadata     | JSONField             | Default `{}`, must be dict                 |
| is_active    | BooleanField          | Default True, soft delete                  |
| created_at   | DateTimeField         | auto_now_add                               |
| updated_at   | DateTimeField         | auto_now                                   |

**Ordering**: `["created_at"]`

**Indexes**:
- `layout_obj_floor_idx` — (floor)
- `layout_obj_floor_type_idx` — (floor, object_type)
- `layout_obj_floor_active_idx` — (floor, is_active)

---

## Object Type Categories (36 types)

| Category     | Types                                                                 |
|--------------|-----------------------------------------------------------------------|
| Workstations | desk, standing_desk, hot_desk, private_desk                          |
| Seating      | chair, office_chair, meeting_chair, lounge_chair, bench, sofa        |
| Tables       | table, lunch_table, boardroom_table, coffee_table                    |
| Rooms & Zones| room, meeting_room, quiet_room, focus_zone, phone_booth, meeting_pod |
| Structure    | wall, door, window, column, partition                                 |
| Facilities   | toilet, sink, kitchen_sink, cabinet, locker, printer, tv, whiteboard |
| Decor        | plant, label, shape                                                   |

---

## Backend API Endpoints

### GET /api/offices/{office_id}/floors/{floor_id}/layout-objects/

Returns active layout objects for the given floor, ordered by `created_at`.

- Requires authenticated user with active membership
- Returns 403 if no active membership
- Returns 404 if office or floor does not exist, is inactive, or belongs to another organization
- Returns 200 `[]` if no active objects exist

Response shape:
```json
[
  {
    "id": 1,
    "floor": 3,
    "object_type": "desk",
    "object_type_display": "Desk",
    "label": "Desk A1",
    "x": "100.00",
    "y": "150.00",
    "width": "80.00",
    "height": "50.00",
    "rotation": "0.00",
    "is_bookable": false,
    "metadata": {"color": "#2563EB"},
    "is_active": true,
    "created_at": "2026-05-27T...",
    "updated_at": "2026-05-27T..."
  }
]
```

### POST /api/offices/{office_id}/floors/{floor_id}/layout-objects/

Creates a layout object under the given floor.

- Requires authenticated user with active OWNER or ADMIN membership
- Returns 403 for MEMBER role
- Returns 404 if office or floor does not exist or belongs to another organization
- Returns 400 for invalid object_type, missing required fields, width/height ≤ 0, non-dict metadata
- Returns 201 on success

Request body:
```json
{
  "object_type": "desk",
  "label": "Desk A1",
  "x": "100.00",
  "y": "150.00",
  "width": "80.00",
  "height": "50.00",
  "rotation": "0.00",
  "is_bookable": false,
  "metadata": {"color": "#2563EB"}
}
```

`label`, `rotation`, `is_bookable`, `metadata` are optional. `floor_id` is NOT accepted in the body.

### PATCH /api/offices/{office_id}/floors/{floor_id}/layout-objects/{object_id}/

Partially updates an existing layout object.

- Requires OWNER or ADMIN role (403 for MEMBER before object lookup)
- Returns 404 if office, floor, or object does not exist or belongs to another organization
- Can update: object_type, label, x, y, width, height, rotation, is_bookable, metadata
- Cannot change floor — `floor` field ignored even if present in body
- Returns 200 with updated object

### DELETE /api/offices/{office_id}/floors/{floor_id}/layout-objects/{object_id}/

Soft-deletes an existing layout object (sets `is_active = False`).

- Requires OWNER or ADMIN role (403 for MEMBER before object lookup)
- Returns 404 if office, floor, or object is not found
- Returns 204 on success
- Object no longer returned by GET after deletion

---

## Permissions

| Action           | Owner | Admin | Member |
|------------------|-------|-------|--------|
| List objects     | ✓     | ✓     | ✓      |
| Create object    | ✓     | ✓     | ✗      |
| Update object    | ✓     | ✓     | ✗      |
| Delete object    | ✓     | ✓     | ✗      |

For PATCH/DELETE, the role check fires before any object lookup to prevent MEMBER users from probing object existence.

New helper: `get_floor_for_office(office, floor_id)` in `permissions.py` — returns Floor if it belongs to the office and is active, or None.

---

## Throttling

`layout_object_write` scope applied to POST, PATCH, and DELETE via `_LayoutObjectWriteThrottle`.

Default rate: `120/hour` (env-overridable via `THROTTLE_LAYOUT_OBJECT_WRITE`).

---

## Frontend Object Library

**File**: `frontend/src/features/layoutObjects/utils/layoutObjectLibrary.ts`

- `LAYOUT_OBJECT_LIBRARY` — 36 `LayoutObjectDefinition` objects with type, label, category, defaultSize, bookableCandidate
- `LAYOUT_OBJECT_CATEGORIES` — ordered list of 7 categories
- `CATEGORY_LABELS` — i18n-mapped display names per category
- `VALID_OBJECT_TYPES` — Set for O(1) type validation
- `getLayoutObjectDefinition(type)` — lookup by type
- `getDefaultSizeForObjectType(type)` — returns width/height defaults
- `getObjectsByCategory()` — groups library into Map keyed by category

Library types match backend `FloorLayoutObject.ObjectType` choices exactly.

---

## Frontend Floor Layout Page

**Route**: `/app/offices/:officeId/floors/:floorId/layout`

**Floor context display**: FloorCard passes `{ floorName, levelNumber }` as React Router navigation state when navigating to the layout page. The page uses `useLocation().state` to display the floor name as the heading and the semantic `level_number` (e.g., -1, 0, 1) in a chip. On direct URL navigation or page refresh, the state is unavailable — the heading falls back to "Floor layout" and no level chip is shown, avoiding any display of the database PK as a level.

**Page states**:
1. Invalid URL params → redirect to `/app/offices`
2. Error (403/404 from API) → ErrorAlert + "Back to floors" link
3. Loading → LoadingState
4. No objects + form → LayoutObjectEmptyState
5. Objects exist → LayoutObjectList + LayoutObjectCreateForm + LayoutObjectLibrary

**Layout**:
- Left panel (md: 4/12): Object library (chips by category) + create form
- Right panel (md: 8/12): Object list (or empty state)

**Object library panel**: Selecting an object type chip pre-selects it in the create form.

**Create form fields**: object_type (Select, grouped by category), label, x, y, width, height, rotation, is_bookable (checkbox).

**Object list**: Shows each object with type, label, position, size, rotation, bookable flag, and delete button.

**Delete**: Inline soft-delete — refreshes list after success.

---

## Frontend Module

```
frontend/src/features/layoutObjects/
├── types/layoutObject.types.ts
├── api/layoutObjectApi.ts
├── utils/
│   ├── layoutObjectLibrary.ts
│   └── layoutObjectValidation.ts
├── hooks/
│   ├── useLayoutObjects.ts
│   └── useLayoutObjectForm.ts
├── components/
│   ├── LayoutObjectEmptyState.tsx
│   ├── LayoutObjectLibraryCategory.tsx
│   ├── LayoutObjectLibrary.tsx
│   ├── LayoutObjectCreateForm.tsx
│   ├── LayoutObjectListItem.tsx
│   └── LayoutObjectList.tsx
└── __tests__/
    ├── layoutObjectLibrary.test.ts
    ├── layoutObjectValidation.test.ts
    └── LayoutObjectCreateForm.test.tsx
```

---

## Validation

### Backend

| Field       | Rule                                          |
|-------------|-----------------------------------------------|
| object_type | Required, must be valid ObjectType choice     |
| label       | Optional, strip whitespace, max 120 chars     |
| x, y        | Required, decimal                             |
| width       | Required, decimal, > 0                        |
| height      | Required, decimal, > 0                        |
| rotation    | Optional, decimal, default 0                  |
| metadata    | Optional, must be dict/object, default `{}`   |
| is_bookable | Optional, boolean, default False              |

### Frontend

| Field       | Rule                                                        |
|-------------|-------------------------------------------------------------|
| object_type | Required, must exist in VALID_OBJECT_TYPES set              |
| label       | Optional, trim, max 120                                     |
| x, y        | Required, must be numeric                                   |
| width       | Required, numeric, > 0                                      |
| height      | Required, numeric, > 0                                      |
| rotation    | Optional, numeric, default "0.00"                           |
| is_bookable | Boolean, default false                                      |

Payload built by `buildLayoutObjectPayload` — trims label, defaults empty rotation to "0.00", passes all fields as strings matching DRF `DecimalField` input format.

---

## Tests

### Backend

| File                              | Count | Coverage                                                           |
|-----------------------------------|-------|--------------------------------------------------------------------|
| test_layout_object_list.py        | 13    | Auth, inactive membership, membership, org isolation, floor isolation, inactive exclusion, response fields, object_type_display |
| test_layout_object_create.py      | 28    | Auth, inactive membership, roles, org/floor isolation, valid types, label trim, max, x/y/w/h required, width/height >0 and not negative, rotation default, metadata default, metadata validation, is_bookable default, floor linked to URL, response fields |
| test_layout_object_update_delete.py| 18   | PATCH: roles, label/position/size/rotation/metadata/type update, invalid width/height/type, cross-org, floor ignored; DELETE: roles, soft-delete, list exclusion, cross-org |

### Frontend

| File                              | Count | Coverage                                                      |
|-----------------------------------|-------|---------------------------------------------------------------|
| layoutObjectLibrary.test.ts       | 12    | Library count, backend type sync, categories, dimensions, labels, uniqueness; getLayoutObjectDefinition, getDefaultSizeForObjectType, getObjectsByCategory |
| layoutObjectValidation.test.ts    | 26    | validateObjectType, validateLabel, validatePosition, validateSize, validateRotation, validateLayoutObjectFields, buildLayoutObjectPayload, makeDefaultFields |
| LayoutObjectCreateForm.test.tsx   | 11    | Render, fields present, submit, error states, disabled state, onFieldChange |

---

## Modified Files (Summary)

**Backend:**
- `offices/models.py` — FloorLayoutObject model added
- `offices/migrations/0003_floorlayoutobject.py` — auto-generated
- `offices/permissions.py` — `get_floor_for_office` helper added
- `offices/serializers.py` — 3 new serializers
- `offices/views.py` — 2 new views + `_LayoutObjectWriteThrottle`
- `offices/urls.py` — 2 new URL patterns
- `offices/admin.py` — `FloorLayoutObjectAdmin` registered
- `config/settings.py` — `layout_object_write` throttle rate added

**Frontend:**
- `routes/paths.ts` — `floorLayout` route + `floorLayoutPath` helper
- `app/router/AppRouter.tsx` — FloorLayoutPage route added
- `features/floors/components/FloorCard.tsx` — "Manage layout →" active navigation
- `features/floors/components/FloorsList.tsx` — `officeId` prop added, passed to FloorCard
- `app/pages/OfficeDetailPage.tsx` — passes `officeId` to FloorsList
- `i18n/en.ts` — `app.layoutObjects` section added; `floors.manageLayout` replaces `floors.buildMap`

---

## Manual Test Checklist

- [ ] Open office with floors → FloorCard shows "Manage layout →" as active link
- [ ] Click "Manage layout →" → navigates to `/app/offices/:officeId/floors/:floorId/layout`
- [ ] Floor layout page loads, shows floor name as heading with "Level X" chip (X = level_number, not DB ID)
- [ ] No objects → LayoutObjectEmptyState shown
- [ ] Object library panel shows all 7 categories with chips
- [ ] Click "Desk" chip → object type select in form updates to "Desk"
- [ ] Create form: select object type, enter label, x, y, width, height, click "Add object"
- [ ] Valid creation → object appears in list
- [ ] Empty x or y → validation error shown, submit blocked
- [ ] Width = 0 → validation error, submit blocked
- [ ] Negative height → validation error, submit blocked
- [ ] Create desk object → appears in list as "Desk — <label>"
- [ ] Create lunch_table, tv, door, window, toilet, kitchen_sink, cabinet, plant objects
- [ ] Delete object → removed from list (soft-deleted on backend)
- [ ] Refresh page → objects persist
- [ ] MEMBER role user → create returns 403 error shown in form
- [ ] Navigate to `/app/offices/1/floors/99999/layout` → error state with "Back to floors"
- [ ] Navigate to `/app/offices/abc/floors/1/layout` → redirected to `/app/offices`
- [ ] "Back to floors" button → returns to OfficeDetailPage
- [ ] User from another org cannot access objects at another org's floor URL

---

## Deferred Items

- Visual canvas editor (Konva/Fabric) — PR 033
- Drag-and-drop object placement
- Snapping/grid UI
- Resize/rotate handles
- Object grouping / layers
- Floor plan background image upload
- Layout publishing / versioning
- Desk/seat booking model
- Seat availability and booking flows
- Advanced metadata schema enforcement
- Floor-level role permissions
- Object edit (inline PATCH UI)
- Pagination on layout object list

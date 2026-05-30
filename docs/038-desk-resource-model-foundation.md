# PR 038 — Desk Resource Model Foundation

## Purpose

Introduce a proper `Desk` domain model that represents real bookable workplace resources,
separate from generic visual `FloorLayoutObject` entries.

---

## Why Desk is separate from FloorLayoutObject

`FloorLayoutObject` is a visual map element. It includes objects like walls, windows, plants,
toilets, and TVs — most of which cannot be booked. A desk that is booked needs a business
identity: a name, a code, a status, and eventually booking records.

Combining booking state directly on the layout object would:
- pollute the visual model with domain logic
- make it impossible to soft-delete desks independently of the floor map
- prevent historical booking records from surviving layout changes

The clean separation is:

```
Organization → Office → Floor → FloorLayoutObject (visual)
                                           ↓
                                         Desk (bookable resource)
```

---

## Domain hierarchy

```
Organization
└─ Office
   └─ Floor
      └─ FloorLayoutObject   (visual, all types)
         └─ Desk             (bookable, desk-capable types only)
```

A `Desk` always references exactly one `FloorLayoutObject`. The FK (not
`OneToOneField`) allows historical records: if a desk is soft-deleted, a new one
can be created for the same layout object without losing the old record.

---

## Backend model (`offices.Desk`)

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | PK |
| `organization` | FK → Organization | Denormalized for query performance |
| `office` | FK → Office | Denormalized |
| `floor` | FK → Floor | Denormalized |
| `layout_object` | FK → FloorLayoutObject | Source of truth for visual position |
| `name` | CharField(120) | Required |
| `code` | CharField(50, blank) | Optional; unique per office among active desks |
| `status` | TextChoices | `available` / `unavailable` / `maintenance` |
| `amenities` | JSONField | Free-form dict (`monitor`, `docking_station`, etc.) |
| `notes` | TextField(blank) | Optional free text |
| `is_active` | BooleanField | Soft-delete flag |
| `created_at` | DateTimeField(auto) | |
| `updated_at` | DateTimeField(auto) | |

**Partial unique constraint:** at most one active `Desk` per `layout_object`
(`unique_active_desk_per_layout_object` with `condition=Q(is_active=True)`).

---

## Allowed layout object types

Only these four types can be converted to a Desk resource:

| Type | Display |
|---|---|
| `desk` | Desk |
| `standing_desk` | Standing Desk |
| `hot_desk` | Hot Desk |
| `private_desk` | Private Desk |

All other types (table, sofa, wall, plant, toilet, TV, etc.) are rejected at the
API level with a `400 Bad Request`.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/offices/{office_id}/floors/{floor_id}/desks/` | List active desks on a floor |
| POST | `/api/offices/{office_id}/floors/{floor_id}/desks/` | Create a desk (owner/admin only) |
| PATCH | `/api/offices/{office_id}/floors/{floor_id}/desks/{desk_id}/` | Update desk (owner/admin only) |
| DELETE | `/api/offices/{office_id}/floors/{floor_id}/desks/{desk_id}/` | Soft-delete desk (owner/admin only) |

### Response shape

```json
{
  "id": 1,
  "organization": 1,
  "office": 2,
  "floor": 3,
  "layout_object": 10,
  "layout_object_type": "desk",
  "layout_object_label": "Desk A1",
  "name": "Desk A1",
  "code": "A1",
  "status": "available",
  "status_display": "Available",
  "amenities": { "monitor": true, "docking_station": false },
  "notes": "",
  "is_active": true,
  "created_at": "...",
  "updated_at": "..."
}
```

### Create payload

```json
{
  "layout_object": 10,
  "name": "Desk A1",
  "code": "A1",
  "status": "available",
  "amenities": { "monitor": true },
  "notes": ""
}
```

`organization`, `office`, and `floor` are derived from the URL and validated
layout object — never trusted from the request body.

### Update payload (PATCH, partial)

```json
{
  "name": "Desk A2",
  "code": "A2",
  "status": "maintenance",
  "amenities": {},
  "notes": "Being repaired"
}
```

`layout_object`, `organization`, `office`, `floor` cannot be changed via PATCH.

---

## Permission rules

| Action | Role required |
|---|---|
| List / view desks | Any active member |
| Create desk | Owner or Admin |
| Update desk | Owner or Admin |
| Soft-delete desk | Owner or Admin |

- Unauthenticated requests: `401`
- No active membership: `403`
- Cross-org access: `404` (office not found for membership)
- Member trying to write: `403`

---

## Tenant isolation

- Office must belong to the authenticated user's organization.
- Floor must belong to the requested office.
- Layout object must belong to the requested floor.
- Desk must belong to the requested floor.
- `organization`/`office`/`floor` in the request body are silently ignored (derived
  from URL + validated scope only).

---

## Frontend integration

### Feature module

```
frontend/src/features/desks/
├── api/deskApi.ts           listDesks / createDesk / updateDesk / deleteDesk
├── hooks/useDesks.ts        data fetching hook (reducer pattern)
├── types/desk.types.ts      Desk, DeskStatus, CreateDeskPayload, …
├── utils/deskHelpers.ts     isDeskCapableLayoutObject, getDeskForLayoutObject
├── components/
│   ├── DeskBadge.tsx        "Bookable" chip
│   ├── DeskStatusChip.tsx   status chip (Available / Unavailable / Maintenance)
│   ├── DeskCreateForm.tsx   create form (name, code, amenities, notes)
│   └── DeskResourcePanel.tsx  inspector section showing desk state
└── __tests__/
    ├── deskHelpers.test.ts
    ├── deskApi.test.ts
    └── DeskResourcePanel.test.tsx
```

### DeskResourcePanel states

| Condition | Owner/Admin sees | Member sees |
|---|---|---|
| Object not selected | Nothing | Nothing |
| Non-desk type selected | "This object type cannot be set up as a bookable desk." | Same |
| Desk-capable, no desk | Create form | "Not yet set up as a bookable desk." |
| Desk-capable, desk exists | Desk details + Remove Desk button | Desk details (read-only) |

### Canvas bookable indicator

`FloorMapCanvas` accepts a `bookableObjectIds: ReadonlySet<number>` prop.
`LayoutObjectCanvasNode` renders a small green dot (Konva `Circle`) in the
top-right corner of any object whose ID is in the set.

### List bookable badge

`LayoutObjectList` / `LayoutObjectListItem` accept a `bookableObjectIds` prop.
Objects with a linked desk show a green "Bookable" chip next to their title.

### FloorLayoutPage wiring

```
useDesks(officeId, floorId) → desks[]
bookableObjectIds = new Set(desks.map(d => d.layout_object))
→ passed to FloorMapCanvas, LayoutObjectList
DeskResourcePanel → shown below LayoutObjectInspector for selected object
```

---

## Tests

### Backend

| File | Count | Coverage |
|---|---|---|
| `test_desk_list.py` | 13 | auth, membership, cross-org, floor scope, inactive exclusion, response fields |
| `test_desk_create.py` | 27 | auth, role, scope, type/inactive validation, duplicate, code uniqueness, field defaults |
| `test_desk_update_delete.py` | 18 | update role/fields/validation, soft-delete, cross-org protection |

### Frontend

| File | Count | Coverage |
|---|---|---|
| `deskHelpers.test.ts` | 18 | isDeskCapableLayoutObject (all types), getDeskForLayoutObject (active/inactive) |
| `deskApi.test.ts` | 7 | URL construction, payload shape, no org/office/floor in body |
| `DeskResourcePanel.test.tsx` | 16 | all states, create success/fail, deactivate success/fail, badge visibility, stale state reset |
| `LayoutObjectListItem.test.tsx` | 3 | Bookable badge shown/hidden based on hasDesk prop |

---

## Manual test checklist

1. Select a `desk`-type layout object → owner/admin sees create form.
2. Fill name + create → desk appears, inspector shows desk details, green badge on canvas and list item.
3. Refresh page → desk still linked.
4. Select `plant`/`wall`/`table` → "cannot be booked" message; no create form.
5. Try creating a second desk on the same layout object → backend returns `409`.
6. Enter duplicate code for same office → backend returns `400`.
7. Same code in a different office → allowed.
8. Member opens floor layout → can view desk details and badges; no create/remove actions.
9. Owner clicks "Remove desk" → desk disappears from panel and list, badge removed from canvas.
10. Cross-org user attempts API access → `404`.
11. Existing map editor (drag/resize/snap) → unchanged, all tests still pass.

---

## Deferred items

- **DeskBooking model** — booking domain, availability rules, calendar
- **Recurring bookings** — rule-based recurring slots
- **Meeting room booking** — multi-occupant room booking (different model)
- **Desk check-in** — QR code or button-based check-in
- **Inline edit UI** — inline editing of name/code/status/amenities in panel (PATCH API exists; UI deferred)
- **GET /desks/{desk_id}/** — single-desk detail endpoint (list + write endpoints exist; GET detail deferred)
- **Bulk desk creation** — create many desks at once from a floor
- **Advanced amenities schema** — typed schema instead of free-form dict
- **Persisted amenity presets** — organization-level amenity catalogue
- **Floor plan image upload** — background image behind canvas objects

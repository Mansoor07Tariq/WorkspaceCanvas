# PR 039 — Desk Inline Edit UI and Desk Detail Endpoint

## Purpose

Complete desk resource management before booking by adding a GET detail endpoint
and an inline edit UI for existing desks inside the floor layout inspector panel.

---

## Why this PR exists

PR 038 added the Desk model, list/create/update/soft-delete API, and the
`DeskResourcePanel` UI. The PATCH API was implemented but no UI existed to use it.
The GET detail endpoint was deferred. This PR closes both gaps:

- Owners and admins can now edit desk name, code, status, amenities, and notes
  directly from the inspector without leaving the floor layout page.
- A GET detail endpoint exists for completeness and future use (e.g. deep-linking,
  mobile clients, booking flows that fetch a single desk).

---

## What changed

### Backend

#### GET `/api/offices/{office_id}/floors/{floor_id}/desks/{desk_id}/`

Added `get()` method to the existing `DeskDetailView` class, which already handled
PATCH and DELETE. The implementation reuses `_get_desk()` which selects the related
layout object and enforces floor/org scope.

- Any active member can retrieve a desk detail (same as list).
- Owner/admin privilege not required for GET.
- Inactive desk → 404.
- Cross-org access → 404.
- Inactive membership → 403.
- Response shape identical to list items.

No new model fields, no migration required.

#### Confirmed PATCH still enforces

- name / code / status / amenities / notes only.
- Duplicate code in same office rejected (400).
- Same code in different office allowed.
- Invalid status rejected (400).
- `layout_object`, `organization`, `office`, `floor` cannot be changed via PATCH.

---

### Frontend

#### `deskApi.ts`

Added `getDesk(officeId, floorId, deskId)` for the new GET endpoint.

#### `deskFormConstants.ts` (new)

Extracted `STATUS_OPTIONS` and `AMENITY_OPTIONS` into a shared utility so
`DeskCreateForm` and `DeskEditForm` do not duplicate label strings.

#### `DeskEditForm.tsx` (new)

Edit form pre-filled from the current `Desk` object. Fields: name, code, status,
amenities, notes. On save: calls `updateDesk` (PATCH), calls `onSaved(updatedDesk)`
on success. On 403: shows permission error. On other failure: shows generic error.
Cancel calls `onCancel`.

#### `DeskResourcePanel.tsx`

Added `mode: "view" | "edit"` state.

| Mode | What renders |
|---|---|
| `view` + desk exists | Detail rows + Edit button + Remove button (owner/admin) |
| `edit` + desk exists | `DeskEditForm` (owner/admin only; mode set by clicking Edit) |
| No desk, desk-capable | `DeskCreateForm` (unchanged) |
| Non-desk type | Not-capable message (unchanged) |

- `onSaved`: exits edit mode, calls `onDeskUpdated()` to refresh the desk list.
- `onCancel`: returns to view mode.
- `key={selectedObject?.id ?? "none"}` on `DeskResourcePanel` from `FloorLayoutPage`
  ensures all local state (mode, errors) resets when the selected object changes.

New prop: `onDeskUpdated: () => void` (wired to `refreshDesks` in `FloorLayoutPage`).

---

## Permissions

| Action | Role required |
|---|---|
| GET detail | Any active member |
| Edit desk (PATCH) | Owner or Admin |
| Soft-delete (DELETE) | Owner or Admin |

Members see read-only desk details. The Edit and Remove buttons are hidden.

---

## Validation and error handling

| Scenario | Response |
|---|---|
| Generic update failure | "Could not update desk. Please try again." |
| 403 Forbidden | "You do not have permission to edit this desk." |
| 400 with `code` field error | Backend message shown (e.g. "A desk with this code already exists in this office.") |
| Blank name | Save button disabled |
| Clearing code field | Sends `code: ""` — backend clears the existing code |
| While saving | Save button disabled, spinner shown |
| Cancel | Discards all unsaved changes, returns to view mode |

---

## Accessibility

- All edit form fields are labelled via MUI `label` prop.
- Status select has label.
- Amenity checkboxes have `FormControlLabel`.
- Save / Cancel buttons have text labels.
- Error alerts are rendered inline and visible without assistive technology.
- Keyboard: Tab into Edit button → Enter → form focus → Tab through fields →
  Enter to submit or Tab to Cancel.

---

## Tests

### Backend

| File | Count | Coverage |
|---|---|---|
| `test_desk_update_delete.py` — GET detail section | 12 | auth, membership, inactive desk, cross-org, cross-floor, response shape, layout_object_info |
| `test_desk_update_delete.py` — PATCH/DELETE section | 18 | unchanged from PR 038 |
| `test_desk_update_delete.py` — **total** | **30** | |
| `test_desk_create.py` | 27 | unchanged |
| `test_desk_list.py` | 13 | unchanged |

### Frontend

| File | Count | Coverage |
|---|---|---|
| `DeskEditForm.test.tsx` | 10 | pre-fill, validation, success, 403/400-field/generic error, cancel, payload shape, code clearing, duplicate code message |
| `DeskResourcePanel.test.tsx` | 26 | all prior states + edit button, edit flow, error, cancel, member read-only, badge persistence, defense-in-depth member guard |
| `deskApi.test.ts` | 8 | getDesk URL added |
| `deskHelpers.test.ts` | 18 | unchanged |
| `LayoutObjectListItem.test.tsx` | 3 | unchanged |

---

## Manual test checklist

1. Select layout object with existing desk → desk details shown.
2. Owner/admin clicks "Edit desk" → edit form appears with current values.
3. Update name → Save → view mode shows updated name.
4. Update code → Save → updated code shown.
5. Clear code field → Save → code removed (field shows empty / hidden).
6. Enter duplicate code in same office → backend rejects → field-specific error shown.
7. Change status to maintenance → Save → status chip updates.
8. Toggle amenities → Save → updated amenities shown.
9. Add notes → Save → notes shown.
10. Click Cancel after edits → changes discarded, view mode restored.
11. Switch selected object while editing → edit mode resets, stale errors gone.
12. Member user selects desk → can view details, no Edit / Remove buttons.
13. Remove / deactivate still works.
14. Refresh page → updated desk details persist.
15. Existing map editor (drag / resize / rotate / snap) → unchanged.

---

## Deferred items

- **DeskBooking model** — booking domain, availability rules, calendar
- **Recurring bookings** — rule-based recurring slots
- **Meeting room booking** — multi-occupant room booking
- **Desk check-in** — QR code or button-based check-in
- **Bulk desk creation** — create many desks at once from a floor
- **Advanced amenities schema** — typed schema instead of free-form dict
- **Persisted amenity presets** — organization-level amenity catalogue
- **Floor plan image upload** — background image behind canvas objects
- **Audit trail / history** — change log for desk edits

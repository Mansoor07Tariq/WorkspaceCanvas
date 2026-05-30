# PR 034 — Drag/Move Persistence for Layout Objects

## Purpose

Allows owner/admin users to drag layout objects on the floor map canvas and persist their new positions. When a drag ends, the frontend calls the existing PATCH endpoint with the new x/y coordinates, applies an optimistic local update for immediate feedback, and rolls back on failure.

## What This PR Adds

- **Draggable canvas objects** — Konva `draggable` prop enabled per-node when user is owner/admin
- **Drag-end persistence** — `onDragEnd → PATCH /api/.../layout-objects/{id}/` with `{ x, y }`
- **Optimistic update + rollback** — position updates locally before network call; reverts if PATCH fails
- **Saving state** — `savingObjectIds: ReadonlySet<number>` in `useLayoutObjects`; inspector shows "Saving…" chip
- **Duplicate-drag guard** — if an object is already saving, new drag events on that object are ignored
- **Role-based UI** — `canManageLayout` derived from `useAuth()` membership; members see read-only banner, hidden create form, hidden delete buttons, non-draggable canvas
- **Move error Alert** — dismissible error message below header when PATCH fails
- **Coordinate helpers** — `formatCoordinate`, `getTopLeftFromCenterPosition` in `coordinateHelpers.ts`
- Hover cursor: `grab` cursor on draggable objects via Konva Stage container style
- 19 new frontend tests (14 coordinate helpers, 3 drag canvas, 2 inspector saving state)
- Full suite: 539 tests passing

## What This PR Does Not Add

- Resize handles
- Rotate handles
- Snapping/grid alignment
- Zoom/pan
- Multi-select
- Object grouping/layers
- Floor plan image upload
- Seat/desk booking
- Booking availability
- Conflict resolution (concurrent edits)
- Layout publishing/versioning

---

## Coordinate Model

**Critical invariant**: The backend stores top-left (x, y) coordinates, but PR 033 renders each Konva `Group` at the center of its bounding box for correct rotation behavior:

```
groupX = obj.x + width  / 2   (center of bbox, horizontally)
groupY = obj.y + height / 2   (center of bbox, vertically)
```

After dragging, Konva's `onDragEnd` event returns the Group's new position (`e.target.x(), e.target.y()`), which is the new center. Converting back to top-left:

```
newTopLeftX = e.target.x() - width  / 2
newTopLeftY = e.target.y() - height / 2
```

This conversion is implemented in `LayoutObjectCanvasNode.handleDragEnd` using the pure helper `getTopLeftFromCenterPosition(centerX, centerY, width, height)`. The helper is tested exhaustively in `coordinateHelpers.test.ts`.

**The critical mistake to avoid**: saving `e.target.x()` directly (the center coordinate) as the top-left x. This would shift every object by `width/2` and `height/2` on each drag. This PR is explicitly tested to prevent this regression.

---

## Role / Read-Only Behavior

`canManageLayout` is derived in `FloorLayoutPage`:

```typescript
const { user } = useAuth();
const membership = getFirstActiveMembership(user);
const canManageLayout = membership?.role === "owner" || membership?.role === "admin";
```

| Condition | Effect |
|-----------|--------|
| `!canManageLayout` | Read-only banner shown; create form hidden; delete buttons hidden; canvas nodes non-draggable |
| `canManageLayout` | Full edit capability; drag enabled; create + delete visible |

The backend independently enforces all write permissions — a MEMBER calling PATCH directly receives 403. Frontend read-only is a UX enhancement, not a security boundary.

---

## Optimistic Update / Rollback

```
handleObjectMove(objectId, newX, newY):
  1. Guard: if already saving this object, return early (no duplicate save)
  2. Snapshot: capture prevObj = objects.find(id)
  3. Optimistic: updateObjectLocally(id, { x: xStr, y: yStr })
  4. Mark saving: setSaving(id, true); clear moveError
  5. PATCH: await updateLayoutObject(officeId, floorId, id, { x, y })
  6. Success: setSaving(id, false)
  7. Failure: updateObjectLocally(id, { x: prevObj.x, y: prevObj.y })
             setSaving(id, false); setMoveError(...)
```

403 → "You do not have permission to edit this layout."
Any other error → "Could not save position. Please try again."

---

## API Usage

Uses the existing endpoint from PR 032:

```
PATCH /api/offices/{office_id}/floors/{floor_id}/layout-objects/{object_id}/
{ "x": "100.00", "y": "150.00" }
```

Payload uses string-formatted coordinates (matching the backend's `DecimalField` output format). `formatCoordinate(value: number): string` rounds to 2 decimal places and returns `"0.00"` for NaN/Infinity.

---

## State Management Changes (`useLayoutObjects`)

New reducer actions:

| Action | Effect |
|--------|--------|
| `patch_object { id, patch }` | Immutably updates one object with the given patch |
| `set_saving { id, saving }` | Adds/removes `id` from `savingObjectIds` Set |

New exposed functions:

| Function | Description |
|----------|-------------|
| `updateObjectLocally(id, patch)` | Dispatches `patch_object` |
| `setSaving(id, saving)` | Dispatches `set_saving` |

New state field:

| Field | Type | Description |
|-------|------|-------------|
| `savingObjectIds` | `ReadonlySet<number>` | IDs of objects with in-flight PATCH requests |

`fetch_success` resets `savingObjectIds` to an empty Set (refresh clears all saving state).

---

## Component Changes

### `LayoutObjectCanvasNode`
New props: `draggable?`, `onDragEnd?(objectId, newX, newY)`, `isSaving?`.
- When `draggable=true`: Konva Group has `draggable` + cursor handlers + `onDragStart` (selects object)
- `onDragEnd` converts center position to top-left before calling the callback
- `isSaving=true`: shape opacity multiplied by 0.65 as visual feedback

### `FloorMapCanvas`
New props: `canManageLayout?`, `onObjectDragEnd?`, `savingObjectIds?`.
- Passes `draggable={canManageLayout}`, `onDragEnd={onObjectDragEnd}`, `isSaving={savingObjectIds?.has(id)}` to each node.

### `LayoutObjectInspector`
New prop: `isSaving?`.
- Shows amber "Saving…" chip next to Inspector title when true.

### `LayoutObjectListItem`
New prop: `canDelete?` (defaults `true`).
- When `false`: delete button is hidden.

### `LayoutObjectList`
New prop: `canManageLayout?` (defaults `true`).
- Passed as `canDelete` to each `LayoutObjectListItem`.

### `FloorLayoutPage`
- Imports `useAuth` + `getFirstActiveMembership` to derive `canManageLayout`
- Owns `moveError` state (dismissible Alert)
- Owns `handleObjectMove` async function (optimistic update + rollback)
- Shows `!canManageLayout` read-only info banner
- Hides create form when `!canManageLayout`

---

## Files Changed

**New files:**
- `frontend/src/features/layoutObjects/utils/coordinateHelpers.ts`
- `frontend/src/features/layoutObjects/__tests__/coordinateHelpers.test.ts`
- `docs/034-drag-move-persistence-for-layout-objects.md`

**Modified files:**
- `frontend/src/features/layoutObjects/hooks/useLayoutObjects.ts` — patch_object, set_saving actions
- `frontend/src/features/layoutObjects/components/LayoutObjectCanvasNode.tsx` — draggable, drag handlers
- `frontend/src/features/layoutObjects/components/FloorMapCanvas.tsx` — canManageLayout, onObjectDragEnd
- `frontend/src/features/layoutObjects/components/LayoutObjectInspector.tsx` — isSaving prop
- `frontend/src/features/layoutObjects/components/LayoutObjectListItem.tsx` — canDelete prop
- `frontend/src/features/layoutObjects/components/LayoutObjectList.tsx` — canManageLayout prop
- `frontend/src/features/layoutObjects/index.ts` — new exports
- `frontend/src/app/pages/FloorLayoutPage.tsx` — full drag orchestration
- `frontend/src/i18n/en.ts` — 3 new strings (inspectorSaving, moveError, movePermissionError, readOnlyBanner)
- `frontend/src/features/layoutObjects/__tests__/FloorMapCanvas.test.tsx` — 3 new drag tests
- `frontend/src/features/layoutObjects/__tests__/LayoutObjectInspector.test.tsx` — 2 isSaving tests

---

## Manual Test Checklist

- [ ] Open floor layout as owner/admin → objects are draggable (cursor changes to grab on hover)
- [ ] Drag desk object → object moves immediately (optimistic update)
- [ ] Release drag → PATCH fires; inspector shows "Saving…" chip briefly
- [ ] Refresh page → object remains at new position (persisted)
- [ ] Drag object to new position → inspector shows new x/y after drag
- [ ] Drag object with non-zero rotation → position saves correctly without double-offset
- [ ] Network failure during drag save → error Alert appears; object reverts to previous position
- [ ] Dismiss error Alert → clears (× button)
- [ ] Drag again after error → redrags correctly
- [ ] Member user opens floor layout → read-only banner shown; create form hidden; delete buttons hidden; objects non-draggable
- [ ] Member tries PATCH directly → 403 returned (backend enforcement)
- [ ] Select object on canvas → inspector shows details with no "Saving…" chip
- [ ] Delete selected object → selection clears; inspector shows empty state
- [ ] Create new object, then drag it → new position persists

---

## Deferred Items

| Item | Notes |
|------|-------|
| Resize handles | Konva `Transformer` component — PR 035 |
| Rotate handles | Part of `Transformer` — PR 035 |
| Snapping/grid alignment | Coordinate rounding on drag end |
| Zoom/pan | Konva Stage scale + position |
| Multi-select | Shift+click + batch PATCH |
| Object grouping/layers | Z-order management |
| Conflict resolution | Last-write-wins currently; real-time sync deferred |
| Booking/availability | Separate feature domain |
| Layout publishing/versioning | History/undo system |
| Canvas boundary clamping | Prevent dragging objects outside floor boundary |
| Rotation via drag | Requires Konva Transformer |

# PR 035 — Resize, Rotate, and Canvas Quality Improvements

## Purpose

Extends the floor map canvas editor with resize and rotate capabilities, reduces the initial bundle size by lazy-loading Konva, adds keyboard movement for selected objects, integrates the "Saved" feedback chip, adds optimistic-rollback integration tests, and enforces the role helper pattern introduced at the end of PR 034.

## What This PR Adds

- **Resize handles** — Konva `Transformer` attached to the selected object; handles appear only for owners/admins
- **Rotate handle** — enabled via `rotateEnabled={true}` on the Transformer
- **Transform persistence** — on `transformend`, computes new width/height/rotation/x/y and calls PATCH
- **Lazy-load Konva** — `FloorMapCanvas` is now loaded via `React.lazy` + `Suspense`; Konva moves into a separate chunk (`FloorMapCanvas-*.js`, ~95 KB gzip) out of the initial bundle
- **"Saved" feedback** — inspector shows amber "Saving…" chip while PATCH is in-flight; green "Saved" chip appears for 2 seconds on success
- **Keyboard movement** — ArrowKey on selected object moves 1 px; Shift+Arrow moves 10 px; `e.repeat` is ignored to prevent PATCH flooding
- **`useCallback` on all handlers** — `handleObjectMove`, `handleObjectTransform`, `handleCanvasKeyDown` with correct dependency arrays
- **Role helper** — `canManageWorkspaceContent(role?)` in `membershipUtils.ts`; unit-tested (6 cases); FloorLayoutPage uses it instead of raw string comparison
- **Coordinate helpers** — `buildMovePatch`, `buildTransformPatch`, `calculateTransformResult`, `MIN_OBJECT_SIZE` in `coordinateHelpers.ts`
- **Integration tests** — optimistic update, rollback, saved state, double-drag guard, 403 vs 500 error discrimination (10 tests)
- **Saving opacity floor** — rooms/zones with `config.opacity < 0.35` are clamped: `Math.max(config.opacity * 0.65, 0.35)` prevents nearly-invisible objects during save
- **Canvas aria-label** — `aria-label="Floor map canvas"` (distinct from page heading "Floor map"); i18n key `canvasAriaLabel`
- **Full suite**: 569 tests passing (42 test files)

## What This PR Does Not Add

- Snapping/grid alignment
- Zoom/pan
- Multi-select
- Grouping/layers
- Floor plan image upload
- Seat/desk booking
- Booking availability
- Object edit form
- Keyboard resize/rotate

---

## Resize / Rotate Behavior

**Transformer placement**: `Transformer` lives in the object Layer of `FloorMapCanvas`. It attaches to the selected node via refs (`Map<id, Konva.Group>`) in a `useEffect` that fires when `selectedObjectId` or `canManageLayout` changes.

**Minimum dimensions**: `MIN_OBJECT_SIZE = 10` px enforced by `Transformer.boundBoxFunc` (prevents dragging handles past the minimum) and also clamped in `LayoutObjectCanvasNode.handleTransformEnd`.

**Transformer visibility**: only rendered when `canManageLayout === true`. Members never see handles.

**Circle objects**: The Transformer resizes by scaling the Group's bounding box. Circle objects use `Circle` inside the Group; scaling the bounding box changes the radius uniformly. Objects whose intrinsic shape is a circle may appear elliptical if resized non-uniformly — this is documented as an acceptable limitation.

---

## Coordinate Conversion Details

### Rendering model (unchanged from PR 033)
```
Group.x = obj.x + width  / 2   ← center of bounding box
Group.y = obj.y + height / 2
Rect.x  = -width  / 2
Rect.y  = -height / 2
```

### Drag conversion
```
newTopLeftX = group.x() - width  / 2
newTopLeftY = group.y() - height / 2
```

### Transform conversion (Konva applies scale to the Group)
```
newWidth    = Math.max(MIN_OBJECT_SIZE, oldWidth  * group.scaleX())
newHeight   = Math.max(MIN_OBJECT_SIZE, oldHeight * group.scaleY())

// CRITICAL: reset scale before React re-renders with new dimensions
group.scaleX(1);  group.scaleY(1);

newTopLeftX = group.x() - newWidth  / 2
newTopLeftY = group.y() - newHeight / 2
newRotation = group.rotation()
```

**Why scale reset is critical**: After transform, Konva stores `scaleX/Y != 1` on the node. React's next render passes `width=newWidth, height=newHeight, scaleX=1 (default)` to the shapes. Without the imperative reset, the Group would display at `newWidth × scaleX`, doubling the visual size.

Implemented in `coordinateHelpers.calculateTransformResult` (pure function, unit tested) and called from `LayoutObjectCanvasNode.handleTransformEnd`.

---

## Lazy-Loading / Bundle Impact

```
Before PR 035:
  dist/assets/index-*.js   1,213 KB │ gzip: 356 KB   (Konva bundled in main)

After PR 035 (verified in final build):
  dist/assets/FloorMapCanvas-*.js   312 KB │ gzip:  95 KB  ← Konva chunk
  dist/assets/index-*.js            902 KB │ gzip: 261 KB  ← main bundle
```

Initial load savings: **~94 KB gzip** on the first visit. Konva is fetched only when the user opens a floor layout page. The Vite chunk size warning (main bundle > 500 KB) remains from MUI; Konva is no longer contributing to it.

Implementation:
```typescript
// FloorLayoutPage.tsx
const FloorMapCanvas = lazy(() =>
  import("@/features/layoutObjects/components/FloorMapCanvas").then((m) => ({
    default: m.FloorMapCanvas,
  }))
);
// ...
<Suspense fallback={canvasFallback}>
  <FloorMapCanvas ... />
</Suspense>
```

Tests mock `@/features/layoutObjects/components/FloorMapCanvas` directly so the lazy import resolves synchronously in jsdom.

---

## Keyboard Movement

Handler: `handleCanvasKeyDown` (attached to the canvas wrapper via `FloorMapCanvas.onKeyDown` prop).

| Key | Move |
|-----|------|
| ArrowUp | y − 1 |
| ArrowDown | y + 1 |
| ArrowLeft | x − 1 |
| ArrowRight | x + 1 |
| Shift + Arrow | 10 px instead of 1 |

Guards: `if (!selectedObjectId || !canManageLayout) return` — members and no-selection cases are handled before computing the step. `if (e.repeat) return` — ignores held-key repeat events to prevent PATCH flooding.

The canvas wrapper `Box` has `tabIndex={0}` and `onKeyDown={handleCanvasKeyDown}`. Focus is required for keyboard events — clicking the canvas focuses it.

---

## Optimistic Update / Rollback / Saved State

**Move flow** (same for drag, keyboard, transform):
1. Guard: `savingObjectIds.has(objectId)` → skip if already saving (prevents double-PATCH)
2. Snapshot `prevObj` from `objects` array
3. `updateObjectLocally(id, patch)` — optimistic update to local state
4. `setSaving(id, true)` — marks object as saving
5. `setMoveError(undefined)` — clears previous error
6. `await updateLayoutObject(...)` — PATCH to backend
7. **Success**: `flashSaved(id)` — shows "Saved" chip for 2 s
8. **Failure**: `updateObjectLocally(id, prevObj fields)` reverts; `setMoveError(buildMoveError(err))` shows error

**Saved state**: `savedObjectId: number | null` local state + `savedTimeoutRef` for the 2-second clear. Not in the reducer — kept simple in page state. Cleanup in `useEffect` on unmount.

**Error differentiation**: 403 → "You do not have permission to edit this layout." · Other → "Could not save layout changes. Please try again."

---

## Role / Read-Only Behavior

`canManageLayout` is derived using the new typed helper:
```typescript
const membership = getFirstActiveMembership(user);
const canManageLayout = canManageWorkspaceContent(membership?.role);
// membership?.role === "owner" || "admin"
```

**Applied to**: `draggable` prop on nodes, Transformer visibility, `onKeyDown` guard, create form visibility, delete button visibility.

Backend enforcement is independent and remains the security boundary.

---

## Accessibility

- Canvas wrapper: `role="img"`, `aria-label={c.canvasAriaLabel}` (= "Floor map canvas"), `tabIndex={0}`
- Keyboard hint: shown below the header when `canManageLayout && selectedObjectId !== null`
  - "Arrow keys move the selected object. Hold Shift to move 10 px."
- Focus-visible outline on canvas wrapper (`&:focus-visible: outline: 2px solid primary.main`)
- Object list and inspector remain as non-canvas access paths

---

## Tests

**Total: 569 tests, 42 test files**

### New test files

| File | Tests | Coverage |
|------|-------|---------|
| `coordinateHelpers.test.ts` | 24 | `formatCoordinate` (8 cases), `getTopLeftFromCenterPosition` (5 cases), `buildMovePatch`, `buildTransformPatch`, `calculateTransformResult` (6 cases incl. min dimension enforcement) |
| `FloorLayoutPageIntegration.test.tsx` | 10 | Load, successful drag, optimistic update, failed drag (reverts + error), 403 error, successful transform, failed transform, saving state, saved chip, double-drag guard |

### Updated test files

| File | New tests | Coverage |
|------|-----------|---------|
| `FloorMapCanvas.test.tsx` | +6 drag/transform/keyboard/accessibility | draggable group, non-draggable group, drag end top-left conversion, transform end dimensions/position, keydown handler forwarded, canvas aria-label |
| `LayoutObjectInspector.test.tsx` | +4 | isSaving chip, isSaved chip, saving takes precedence over saved |
| `membershipUtils.test.ts` | +6 | `canManageWorkspaceContent` — owner ✓, admin ✓, member ✗, undefined ✗, empty string ✗, unknown role ✗ |

### Test strategies

- **Konva mocked**: `vi.mock("react-konva", ...)` renders Groups as `<div>`, Transformer as `null`. Transform end simulated via `fireEvent.doubleClick` on the Group mock.
- **FloorMapCanvas mocked in integration tests**: `vi.mock("@/features/layoutObjects/components/FloorMapCanvas", ...)` injects test-control buttons for drag/transform/select triggers.
- **Coordinate helpers**: pure functions tested without any mocking.

---

## Files Changed

**New files:**
- `frontend/src/features/layoutObjects/utils/coordinateHelpers.ts`
- `frontend/src/features/layoutObjects/__tests__/coordinateHelpers.test.ts`
- `frontend/src/features/layoutObjects/__tests__/FloorLayoutPageIntegration.test.tsx`
- `docs/035-resize-rotate-and-canvas-quality-improvements.md`

**Modified files:**
- `frontend/src/features/organizations/utils/membershipUtils.ts` — `canManageWorkspaceContent` helper added
- `frontend/src/i18n/en.ts` — `canvasLoading`, `keyboardHint`, `inspectorSaving`, `inspectorSaved`, `moveError`, `movePermissionError`, `readOnlyBanner` added
- `frontend/src/features/layoutObjects/hooks/useLayoutObjects.ts` — `patch_object`, `set_saving` actions; `savingObjectIds`, `updateObjectLocally`, `setSaving` exposed
- `frontend/src/features/layoutObjects/components/LayoutObjectCanvasNode.tsx` — `forwardRef<Konva.Group>`, `draggable`, `onDragEnd`, `onTransformEnd`, `isSaving` props; `handleDragEnd`, `handleTransformEnd` with scale reset; cursor handlers
- `frontend/src/features/layoutObjects/components/FloorMapCanvas.tsx` — `Transformer` with refs, `tabIndex={0}`, `onKeyDown`, `canManageLayout`, `onObjectDragEnd`, `onObjectTransformEnd`, `savingObjectIds`; `aria-label` + `role="img"` + focus-visible outline
- `frontend/src/features/layoutObjects/components/LayoutObjectInspector.tsx` — `isSaving`, `isSaved` props; "Saving…" and "Saved" chips
- `frontend/src/features/layoutObjects/components/LayoutObjectListItem.tsx` — `canDelete` prop; delete button conditional
- `frontend/src/features/layoutObjects/components/LayoutObjectList.tsx` — `canManageLayout` prop passed as `canDelete`
- `frontend/src/features/layoutObjects/index.ts` — new exports for coordinateHelpers
- `frontend/src/app/pages/FloorLayoutPage.tsx` — lazy canvas, `useAuth`+`canManageWorkspaceContent`, `handleObjectMove`/`handleObjectTransform`/`handleCanvasKeyDown` (all `useCallback`), saved state, error state, keyboard hint, read-only banner

---

## Manual Test Checklist

- [ ] Open floor layout — "Loading map canvas…" briefly appears before canvas loads (lazy chunk)
- [ ] Select object as owner/admin → Transformer handles visible (resize + rotate)
- [ ] Resize object → object resizes visually → release → inspector shows "Saving…" then "Saved"
- [ ] Refresh page → resized dimensions persist (width/height/x/y correct)
- [ ] Rotate object → rotation changes visually → release → rotation saves
- [ ] Refresh page → rotation persists
- [ ] Drag after resize → no position jump; saves correctly
- [ ] Arrow keys with object selected → moves 1px; saves; "Saved" chip appears
- [ ] Shift+Arrow → moves 10px
- [ ] No object selected + Arrow → nothing moves
- [ ] Network failure during drag → object reverts; "Could not save..." error shown; error dismissible
- [ ] Member user → read-only banner; no create form; no delete buttons; no drag; no Transformer; canvas still shows objects
- [ ] Inspector shows updated x/y/width/height/rotation after drag/transform
- [ ] Delete selected object → removed from canvas + list; selection clears

---

## Deferred Items

| Item | Notes |
|------|-------|
| Snapping/grid alignment | Coordinate rounding on drag/transform end |
| Zoom/pan | Konva Stage scale + offset |
| Multi-select | Shift+click + Transformer.nodes([...]) |
| Keyboard resize/rotate | Transformer API |
| Canvas boundary clamping | Constrain drag/keyboard to floor area |
| Circle distortion on non-uniform scale | Accepted limitation; fix in future by forcing aspect ratio |
| Frontend role-gating integration tests | Full-page render requires heavy mocking |
| Undo/redo | History stack |
| Live collaboration | WebSocket / real-time sync |
| Floor plan image upload | Background Konva Image layer |
| Layout publishing/versioning | State management + backend versioning |

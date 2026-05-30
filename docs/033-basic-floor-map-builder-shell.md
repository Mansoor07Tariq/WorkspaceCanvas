# PR 033 — Basic Floor Map Builder Shell

## Purpose

Adds the first visual floor map to WorkspaceCanvas. Users can now see their layout objects rendered as colored shapes on a canvas surface, select objects to inspect their details, and continue creating/deleting objects via the existing form. This PR establishes the canvas foundation that PR 034 will extend with drag-and-drop.

## What This PR Adds

- **React Konva** (`konva` + `react-konva`) added as a dependency
- **`FloorMapCanvas`** — Konva Stage rendering all layout objects visually
- **`LayoutObjectCanvasNode`** — individual shape node per object (rect or circle, color-coded by category)
- **`LayoutObjectInspector`** — right-panel inspector showing selected object details
- **`layoutObjectRenderConfig.ts`** — centralized color/shape config for all 36 object types
- **`FloorLayoutPage`** restructured to 3-panel desktop layout (library | canvas | inspector+list)
- **Selection state** — `selectedObjectId` wired to canvas click, list click, and inspector
- **Empty canvas state** — text overlay when floor has no objects
- Grid background and dashed floor boundary on canvas
- `LayoutObjectListItem` updated with selection highlight and click-to-select
- `LayoutObjectList` updated with `selectedObjectId` + `onSelectObject` props
- 33 new frontend tests (render config: 11, inspector: 12, canvas: 8; 2 more test files)
- Full suite: 520 tests passing

## What This PR Intentionally Does Not Add

- Drag-and-drop position persistence (deferred to PR 034)
- Resize or rotate handles
- Snapping/grid alignment
- Zoom/pan controls
- Real icon library (uses short text codes as fallback)
- Floor plan image upload/background
- Desk/seat booking
- Booking availability
- Layout publishing or versioning
- Frontend role-gating of write actions (backend enforces permissions; API errors surface in the form)

## Why a Shell Before the Full Editor

The canvas renders all objects at their saved coordinates, but does not write back any changes from canvas interaction. This separation allows:
1. Visual feedback to be tested and validated before drag infrastructure is added
2. A clean diff — Konva is introduced in two files (`FloorMapCanvas`, `LayoutObjectCanvasNode`) without leaking into the rest of the app
3. PR 034 can add `onDragEnd → PATCH` on top of the existing node structure without a page rewrite

---

## Canvas / Rendering Approach

**Library**: React Konva (`konva ^10.3`, `react-konva ^19.2`)

**Canvas size**: 1000 × 640 logical pixels. Wrapped in a scrollable Box; no viewport scaling in this PR.

**Layers**:
1. Background layer (`listening={false}`): white fill, 50px grid, dashed boundary rect
2. Objects layer: one `LayoutObjectCanvasNode` per FloorLayoutObject

**Node positioning**: Each `Group` is placed at `(obj.x + w/2, obj.y + h/2)` — the center of the bounding box — so that `rotation` is applied around the object's center.

**Empty state**: HTML overlay (`position: absolute, pointerEvents: none`) centered over the Stage when `objects.length === 0`. Pure MUI Typography, not a Konva Text node.

**Click-to-deselect**: Stage `onClick` checks `e.target === e.target.getStage()` to detect clicks on empty canvas space and calls `onSelectObject(null)`.

---

## Object Render Config

**File**: `features/layoutObjects/utils/layoutObjectRenderConfig.ts`

Maps every `LayoutObjectType` to a `RenderConfig`:

| Field | Description |
|-------|-------------|
| `category` | One of 7 categories |
| `fill` | Background color (hex) |
| `stroke` | Border color (hex) |
| `strokeWidth` | Border width in pixels |
| `dashPattern` | Empty = solid; `[8, 4]` = dashed (rooms/zones) |
| `opacity` | 1 for most; 0.35–0.4 for room overlays |
| `cornerRadius` | Rounding; 100 for circles |
| `shape` | `"rect"` or `"circle"` |
| `shortCode` | 2–3 char fallback label (e.g. `DSK`, `CHR`, `WLL`) |

**Colors by category** (centralized in palette constant `P`):

| Category | Fill | Stroke |
|----------|------|--------|
| Workstations | `#BFDBFE` (blue-200) | `#2563EB` (blue-600) |
| Seating | `#BBF7D0` (green-200) | `#16A34A` (green-600) |
| Tables | `#FDE68A` (amber-200) | `#D97706` (amber-600) |
| Rooms & Zones | `#DDD6FE` (violet-200) | `#7C3AED` (violet-600) |
| Structure | `#D1D5DB` (gray-300) | `#4B5563` (gray-600) |
| Facilities | `#A5F3FC` (cyan-200) | `#0891B2` (cyan-600) |
| Decor | `#FBCFE8` (pink-200) | `#DB2777` (pink-600) |

**Selected stroke**: `SELECTED_STROKE = "#F59E0B"` (amber-500), `SELECTED_STROKE_WIDTH = 3`

---

## Floor Map Page Layout

```
┌──────────────── Header: Back | Floor name | Level chip ────────────────────┐
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────────────────┐  ┌───────────────┐  │
│  │  Object Library  │  │        Floor Map Canvas      │  │  Inspector    │  │
│  │  (chip selector) │  │  (Konva Stage, 1000×640px)   │  │               │  │
│  ├─────────────────┤  │  Grid + colored shapes        │  │  Selected obj │  │
│  │  Create Form     │  │  Click = select              │  │  details or   │  │
│  │  (type, label,   │  │  Empty = text overlay         │  │  "select an   │  │
│  │   x/y/w/h/rot)  │  └──────────────────────────────┘  │  object..."   │  │
│  └─────────────────┘                                     ├───────────────┤  │
│   (md:3)                        (md:6)                   │  Object List  │  │
│                                                          │  (selectable) │  │
│                                                          └───────────────┘  │
│                                                               (md:3)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

On mobile (xs/sm): panels stack vertically — left (library + form), center (canvas), right (inspector + list).

---

## Selection / Inspector Behavior

`selectedObjectId: number | null` lives in `FloorLayoutPage` state.

| Interaction | Effect |
|-------------|--------|
| Click object on canvas | `onSelectObject(obj.id)` |
| Click empty canvas area | `onSelectObject(null)` |
| Click object row in list | `onSelectObject(obj.id)` |
| Delete object | `setSelectedObjectId(null)` then refresh |

**LayoutObjectInspector** receives the resolved `selectedObject` (or `null`):
- `null` → "Select an object to inspect its details."
- Object → shows type, label, position, size, rotation, bookable chip, and metadata preview (only when non-empty)

**LayoutObjectListItem** receives `isSelected` and `onSelect` props. Selected items show a `primary.main` border and `primary.50` background.

---

## Read-Only Behavior

Frontend does not gate write actions behind the user's role in this PR. The backend from PR 032 enforces all permissions:
- MEMBER → 403 from POST/DELETE → `generalError` shown in the create form
- Unauthenticated → 401 → redirect handled by `ProtectedRoute`

Explicit frontend role-hiding (hiding the create form and delete buttons for members) is deferred to PR 034 when drag persistence requires knowing the user's role anyway.

---

## Testing Notes

**React Konva in jsdom**: Konva uses the HTML5 Canvas API, which jsdom does not fully support. All tests that render `FloorMapCanvas` mock `react-konva` with simple HTML elements:

```typescript
vi.mock("react-konva", () => ({
  Stage: ({ children, onClick }) => <div data-testid="floor-map-stage" onClick={...}>{children}</div>,
  Group: ({ children, onClick }) => <div data-testid="canvas-object-group" onClick={onClick}>{children}</div>,
  Text: ({ text }) => text ? <span>{text}</span> : null,
  // Rect, Circle, Line: () => null
}));
```

The mock Stage's click handler correctly simulates `e.target === e.target.getStage()` by using a self-referencing object, so click-to-deselect is testable.

**`layoutObjectRenderConfig.ts`** — tested directly (pure TS, no canvas):
- All 36 types have a config
- All configs have required fields with correct types
- Opacity is in range (0, 1]
- Shape is "rect" or "circle"
- Category matches one of 7 valid categories

**`LayoutObjectInspector.tsx`** — plain MUI, no mocking needed:
- Empty state text, inspector title
- Object type, label, (no label) fallback, position, size, rotation
- Yes/No bookable chip
- Metadata preview only when non-empty

---

## Files Changed

**New files:**
- `frontend/src/features/layoutObjects/utils/layoutObjectRenderConfig.ts`
- `frontend/src/features/layoutObjects/components/FloorMapCanvas.tsx`
- `frontend/src/features/layoutObjects/components/LayoutObjectCanvasNode.tsx`
- `frontend/src/features/layoutObjects/components/LayoutObjectInspector.tsx`
- `frontend/src/features/layoutObjects/__tests__/layoutObjectRenderConfig.test.ts`
- `frontend/src/features/layoutObjects/__tests__/LayoutObjectInspector.test.tsx`
- `frontend/src/features/layoutObjects/__tests__/FloorMapCanvas.test.tsx`
- `docs/033-basic-floor-map-builder-shell.md`

**Modified files:**
- `frontend/package.json` — added `konva ^10.3`, `react-konva ^19.2`
- `frontend/src/app/pages/FloorLayoutPage.tsx` — 3-panel layout, selection state
- `frontend/src/features/layoutObjects/components/LayoutObjectList.tsx` — `selectedObjectId`, `onSelectObject` props
- `frontend/src/features/layoutObjects/components/LayoutObjectListItem.tsx` — `isSelected`, `onSelect` props, selection styling
- `frontend/src/features/layoutObjects/index.ts` — barrel exports for new components/utils
- `frontend/src/i18n/en.ts` — canvas + inspector strings added

---

## Manual Test Checklist

- [ ] Open an office with at least one floor → click "Manage layout" on a FloorCard
- [ ] Floor layout page shows 3-panel layout: library (left), canvas (center), inspector (right)
- [ ] Floor with no objects → canvas shows "Nothing on this floor yet" overlay
- [ ] Create a desk object (x=100, y=100, w=80, h=50) → blue rectangle appears on canvas
- [ ] Create a chair → green circle appears
- [ ] Create a sofa → green rounded rect appears
- [ ] Create a boardroom_table → amber rect appears
- [ ] Create a wall → gray thin rect appears
- [ ] Create a meeting_room → violet dashed semi-transparent rect appears
- [ ] Create a plant → pink circle appears
- [ ] Click an object on the canvas → object gets amber highlight border; inspector shows its type/label/position
- [ ] Click a different object in the list → selection moves; inspector updates
- [ ] Click empty canvas area → selection clears; inspector shows empty state
- [ ] Delete an object via list → object disappears from canvas and list; inspector clears
- [ ] Refresh page → all objects still render at correct positions
- [ ] Member role user: create/delete return 403 → error shown in form; canvas still shows objects
- [ ] No drag handles, no resize handles, no rotate handles visible

---

## Deferred Items

| Item | Target PR |
|------|-----------|
| Drag-and-drop with PATCH persistence | PR 034 |
| Resize handles | future |
| Rotate handles | future |
| Snapping/grid alignment | future |
| Zoom/pan controls | future |
| Real icon library per object type | future |
| Frontend role-gating of write actions | PR 034 |
| Floor plan image upload/background | future |
| Desk/seat booking model | future |
| Booking availability display | future |
| Layout publishing / versioning | future |
| Canvas scaling to container width | future |

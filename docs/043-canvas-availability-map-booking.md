# PR 043 — Canvas Availability Colouring and Map-Based Booking Interaction

## Purpose

Extend the desk booking UI so users can see desk availability **directly on the visual floor map**
and select desks from the map. This PR closes TD-031 (canvas availability colouring deferred from
PR 042).

## Why This PR Exists

PR 042 delivered the full list-based booking flow (`/app/bookings`) but explicitly deferred canvas
availability colouring as TD-031. Users could book from the list but had no visual context on the
floor map. PR 043 adds that visual context while keeping the list as the primary accessible path.

## What Changed

### New utility functions — `bookingAvailability.ts`

| Function | Purpose |
|---|---|
| `buildAvailabilityByLayoutObjectId(items)` | Builds `Map<layoutObjectId, DeskAvailabilityStatus>` from availability items. Only status is stored — no booking identity. |
| `getSelectedLayoutObjectId(item)` | Returns the layout object id for a selected desk item, or null. |
| `findDeskIdByLayoutObjectId(items, loId)` | Reverse lookup: layout object id → desk id. |

### New utility — `bookingCanvasUtils.ts`

| Export | Purpose |
|---|---|
| `getAvailabilityCanvasStyle(status, isSelected)` | Returns `{fill, stroke, strokeWidth, opacity}` for a desk in booking mode. Selection applies amber stroke (matches editor). |
| `AVAILABILITY_LEGEND_LABELS` | Full text labels for the map legend. |
| `AVAILABILITY_LEGEND_ORDER` | Canonical display order of statuses. |

Status is communicated to users by three non-colour-alone mechanisms: canvas fill/stroke colour,
`AvailabilityMapLegend` text labels (visible below the map), and the desk availability list
(fully text-based fallback). Canvas shapes in booking mode continue to show the desk's own label
(e.g., "Desk A1") — no additional status badge letter is overlaid on the shape.

### Extended — `FloorMapCanvas.tsx`

New optional props (all no-op when omitted, so editor mode is unchanged):

| Prop | Type | Purpose |
|---|---|---|
| `mode` | `"editor" \| "booking"` | Switches canvas between edit and booking behaviour. Default: `"editor"`. |
| `availabilityByLayoutObjectId` | `ReadonlyMap<number, DeskAvailabilityStatus>` | Availability status per layout object. |
| `selectedAvailabilityLayoutObjectId` | `number \| null` | Layout object id of the currently selected desk in booking mode. |
| `onAvailabilityObjectSelect` | `(layoutObjectId: number) => void` | Called when a bookable desk is clicked in booking mode. |

Booking mode behaviour:
- `aria-label` changed to `"Floor booking map"`.
- `onKeyDown` is not wired (keyboard editing disabled).
- All nodes rendered with `draggable={false}`.
- Transformer not rendered.
- Clicking a desk object with an availability status calls `onAvailabilityObjectSelect`.
- Clicking a non-bookable object (no availability entry) falls through to `onSelectObject` but does not call `onAvailabilityObjectSelect`.

### Extended — `LayoutObjectCanvasNode.tsx`

New optional props:

| Prop | Type | Purpose |
|---|---|---|
| `availabilityStatus` | `DeskAvailabilityStatus` | When set, applies availability colour overlay instead of editor config colours. |
| `isAvailabilitySelected` | `boolean` | When true, applies amber selection stroke. |
| `onAvailabilitySelect` | `() => void` | When set, replaces `onSelect` as the click handler. |

Style precedence:
1. When `availabilityStatus` is set → use `getAvailabilityCanvasStyle()` result.
2. When `isSelected` is true (editor mode) → use `SELECTED_STROKE`.
3. Otherwise → use config colours.

### New component — `AvailabilityMapLegend.tsx`

Renders four status items in a horizontal row: Available (green), Reserved (slate), Your booking
(blue), Unavailable (amber). Each item has a colour swatch and a text label. Uses
`role="list"` / `role="listitem"` for screen reader accessibility.

### New component — `BookingFloorMap.tsx`

Thin wrapper that:
1. Builds `availabilityByLayoutObjectId` from `items` via `useMemo`.
2. Derives `selectedAvailabilityLayoutObjectId` from the currently selected desk item.
3. Translates `onAvailabilityObjectSelect` calls back to `onDeskSelect(deskId)`.
4. Renders lazy-loaded `FloorMapCanvas` in `mode="booking"` + `AvailabilityMapLegend`.
5. Shows a `CircularProgress` fallback while Konva loads (consistent with `FloorLayoutPage`).

Props: `items`, `layoutObjects`, `selectedDeskId`, `onDeskSelect`.

### Updated — `DeskBookingPage.tsx`

Adds a "Floor map" section between the summary cards and the desk list/panel grid. The section
renders `BookingFloorMap` only when `layoutObjects.length > 0`. Empty floors show only the list.

Layout (top to bottom):
1. Filters (office / floor / date selectors)
2. Summary cards
3. **Floor map + legend** *(new, conditional)*
4. Desk availability list (8 cols) + Selected desk panel (4 cols)

## Booking Map Mode

### Availability Colour Mapping

| Status | Fill | Stroke | Opacity | Meaning |
|---|---|---|---|---|
| `available` | `#DCFCE7` (green-100) | `#16A34A` (green-600) | 1.0 | Desk is free to book |
| `reserved` | `#F1F5F9` (slate-100) | `#94A3B8` (slate-400) | 0.8 | Desk booked by someone else |
| `bookedByMe` | `#DBEAFE` (blue-100) | `#4F46E5` (indigo-600) | 1.0 | Current user's booking |
| `unavailable` | `#FEF3C7` (amber-100) | `#D97706` (amber-600) | 0.55 | Inactive or maintenance |

Selected desk (any status): stroke changes to `#F59E0B` (amber), width 3 — same as editor selection.

Non-bookable layout objects (no entry in the availability map) keep their normal editor colours.

### How Map Selection Works

1. User clicks a desk on the map → `onAvailabilityObjectSelect(layoutObjectId)` fires.
2. `BookingFloorMap` looks up `deskId = findDeskIdByLayoutObjectId(items, layoutObjectId)`.
3. `onDeskSelect(deskId)` is called → `DeskBookingPage.handleSelectDesk(deskId)`.
4. `selectedDeskId` state updates → list card highlights and booking panel updates.
5. `selectedAvailabilityLayoutObjectId` propagates back to the map → amber selection stroke.

Clicking the list card → `handleSelectDesk(deskId)` → same state path → map selected object
highlights.

**Empty canvas click:** Clicking empty canvas space (no desk object) calls `onSelectObject(null)`
internally, but `BookingFloorMap` passes `onSelectObject={() => undefined}`, so the call is a
no-op. The current desk selection is **kept** — it does not clear. Users change the selection by
clicking another desk on the map or in the list.

**Grid:** The booking map hides the editor grid (`showGrid={false}`) to keep availability colours
visually uncluttered and to make the status overlay as readable as possible.

## Privacy Behaviour

- `buildAvailabilityByLayoutObjectId` maps layout object ids to **status only**. No booking object,
  user id, or user name is passed into the canvas props.
- `FloorMapCanvas` receives only `DeskAvailabilityStatus` per object — it cannot render or hold
  another user's identity.
- The `reserved` status carries no user identity at any layer (enforced from
  `buildDeskAvailability` in PR 042 — `exposedBooking = null` for reserved desks).
- Tests explicitly assert `JSON.stringify(map)` does not contain `"Jane Smith"`.

## Accessibility

- Canvas in booking mode uses `aria-label="Floor booking map"` (distinct from editor's
  `"Floor map canvas"`).
- `AvailabilityMapLegend` uses `role="list"` / `role="listitem"` with visible text labels for each
  status — colour is not the only differentiator.
- The list (`DeskAvailabilityList`) and booking panel (`SelectedDeskBookingPanel`) remain the
  primary accessible paths. Booking and cancellation are possible entirely through the list.
- Keyboard users: arrow key movement is disabled in booking mode; Tab and Enter/Space work on the
  list and panel buttons.

## Editor Regression Safety

- All `FloorMapCanvas` and `FloorLayoutPage` props and tests are unchanged.
- Booking mode props are all optional and default to no-op.
- Editor mode receives `mode="editor"` (default) and the availability props are omitted → zero
  behaviour change.
- The 30+ existing `FloorMapCanvas.test.tsx` tests pass unchanged.
- The `FloorLayoutPageIntegration.test.tsx` drag/snap/clamp tests pass unchanged.

## Tests Added / Updated

| File | New Tests | Notes |
|---|---|---|
| `bookingAvailability.test.ts` | +11 | `buildAvailabilityByLayoutObjectId`, `findDeskIdByLayoutObjectId`, `getSelectedLayoutObjectId`, privacy assertions |
| `bookingCanvasUtils.test.ts` | 10 | New file; style function, legend labels/order constants |
| `AvailabilityMapLegend.test.tsx` | 4 | New file; all status labels, accessible list roles |
| `BookingFloorMap.test.tsx` | 7 | New file; canvas mode, legend, availability status, selection, click→onDeskSelect, privacy, no-layout-objects |
| `FloorMapCanvas.test.tsx` | +7 | Booking mode aria-label, onKeyDown disabled, non-draggable nodes, availability click, editor regression |
| `DeskBookingPage.test.tsx` | +2 | BookingFloorMap mock, floor map not shown before selection, privacy |
| **Total new** | **41** | All pass in 64 test files, 874 tests total |

## Manual Test Checklist

1. Open `/app/bookings`.
   Expected: page loads with office/floor/date selectors.

2. Select office → floor → date.
   Expected: desk list loads; floor map appears above the list with availability colours; legend shows
   Available / Reserved / Your booking / Unavailable.

3. Hover over green desk on map.
   Expected: available status visually distinct.

4. Click an available desk on the map.
   Expected: selected desk panel updates; the clicked desk highlights with amber stroke; list card
   highlights.

5. Click a desk in the list.
   Expected: map highlights the corresponding desk with amber stroke.

6. Book the selected desk.
   Expected: desk status updates to blue "Your booking" on map.

7. Cancel own booking.
   Expected: desk returns to green "Available" on map.

8. Click a reserved desk (slate).
   Expected: panel shows "Reserved" — no other user's name displayed anywhere.

9. Use keyboard/list to complete a booking without touching the map.
   Expected: full flow works without canvas interaction.

10. Navigate to a floor with no layout objects.
    Expected: floor map section does not appear; list shows desks normally.

11. Navigate to the floor layout editor (`/app/offices/:id/floors/:id`).
    Expected: editor drag/resize/rotate/snap/grid all work unchanged.

## What Is Not Included

- Recurring bookings
- Half-day or time-slot bookings
- Meeting room booking
- Canvas popovers or tooltips for booking/cancel (Book/Cancel remains in the panel)
- My Bookings dashboard
- Admin booking management
- Route-level caching or request deduplication (TD-020, TD-021)
- `FloorLayoutPage` callback extraction to `useCanvasInteractions` hook (TD-019)

## Deferred Items

| ID | Summary |
|---|---|
| TD-019 | `FloorLayoutPage` handler extraction to custom hook |
| TD-020 | Request deduplication in hooks |
| TD-021 | TTL-based caching between navigations |
| TD-003/005/006/011 | Backend data integrity items (booking race, cascade, denormalization) |

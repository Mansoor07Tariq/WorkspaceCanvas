# PR 061 — Floor Boundary, Object Containment, and Canvas Pan/Zoom

## Why this PR exists

The floor map previously rendered objects on an effectively borderless board with
a faint dashed rectangle near the stage edge. It read like a drawing surface, not
an office. This PR makes the canvas feel like a real room:

- a visible rectangular office **boundary** (walls) with a white interior,
- **object containment** so objects stay inside the room,
- natural **pan/zoom** with on-canvas zoom controls.

It deliberately touches only canvas/view interaction code. No backend data,
booking rules, or stored coordinate formats change.

## Boundary architecture

The boundary is **system-owned canvas UI**, not a layout object.

- `DEFAULT_FLOOR_BOUNDARY` is derived in `coordinateHelpers.ts` from the logical
  stage size (`CANVAS_WIDTH × CANVAS_HEIGHT` = 1000 × 640) with a symmetric
  `FLOOR_BOUNDARY_INSET` of 48 px → `{ x: 48, y: 48, width: 904, height: 544 }`.
- It is rendered in `FloorMapCanvas` inside the existing **non-listening**
  background layer as:
  1. a full-stage grey margin rect (`#F3F4F6`),
  2. a white interior rect (`#FFFFFF`),
  3. the grid lines,
  4. **four wall segments** styled to match the library `wall` object (Structure
     palette: grey fill `#D1D5DB`, darker stroke `#4B5563`, 2 px) — solid bands
     `WALL_THICKNESS` (12 px) thick, not a thin line. They extend **outward** from
     the boundary (top/bottom span the full width incl. corners) and are drawn
     last so they sit cleanly above the grid, with a subtle shadow for depth.
- Because the walls extend outward, the containment region
  (`DEFAULT_FLOOR_BOUNDARY`) remains the **inner wall face** — objects sit flush
  against the inside of the walls.
- Because it lives in the `listening={false}` layer it never captures clicks,
  never intercepts booking selection, and never hides availability colours or
  isometric assets (objects render in the layer above).

### Why the boundary is not a backend object

Storing four wall rows (or a boundary field) would:

- require a migration and mutate existing floor data,
- let users select/delete/move the walls like normal objects,
- couple a purely visual frame to booking/desk logic.

Instead the boundary is a frontend constant. There are **no migrations, no
auto-created wall rows, and no mutation of floor data on load.**

## Containment rules

Containment uses the unrotated bounding box in **world coordinates** and is
applied wherever an object position/size is produced:

- **Default placement** — `makeDefaultFields` now defaults new objects to the
  boundary top-left (48, 48) instead of the raw stage origin (0, 0), which now
  sits in the grey margin.
- **Drag** — `handleObjectDragEnd` snaps (if enabled) then
  `clampObjectToBoundary`.
- **Keyboard move** — `handleCanvasKeyDown` clamps to the boundary.
- **Resize/transform** — `handleObjectTransform` clamps via
  `clampObjectTransformToBoundary`, which first shrinks an oversized object to the
  room then clamps position. Objects larger than the room are pinned to the
  top-left and never crash (the max-bound math is floored at the boundary
  origin).
- The **optimistic update + rollback** flow is unchanged — the clamped value is
  what gets optimistically applied and rolled back on failure.

**Rotation containment is best-effort.** Clamping uses the axis-aligned bounding
box, so a rotated object's visual corners can still poke a few pixels past the
wall. This matches the pre-existing canvas-clamp behaviour and is documented as a
deferred item rather than silently "fixed".

**Existing layouts are not migrated.** Objects already stored outside the
boundary render exactly where they are. They are only clamped back inside when
the user next moves/resizes them. There is no on-load auto-save.

## Viewport / pan / zoom architecture

A local camera is modelled as:

```ts
interface CanvasViewport { scale: number; x: number; y: number; }
```

- Pure math lives in `utils/canvasViewport.ts` (`clampScale`, `zoomAroundPoint`,
  `wheelZoomFactor`, `formatZoomPercent`) — fully unit-tested without React.
- State + actions live in `hooks/useCanvasViewport.ts` (`zoomIn`, `zoomOut`,
  `reset`, `zoomAt`, `setViewport`).
- The viewport is applied to the **Konva `Stage`** (`scaleX/scaleY` + `x/y`), so
  the background, boundary, grid, objects, and transformer all pan/zoom together.
  The MUI toolbar and the on-canvas zoom controls live outside Konva and do **not**
  scale.

Limits: `MIN_SCALE = 0.5`, `MAX_SCALE = 3`, `ZOOM_STEP = 1.15`, default scale 1.

### Object coordinates vs viewport coordinates

This is the critical safety property:

- **Layout object data stays in world coordinates.** Pan/zoom only transform the
  Stage camera; they never touch object x/y/width/height.
- Konva drags a node in its **parent's** coordinate space, which is unaffected by
  the Stage's scale/position. So `node.x()/node.y()` on `dragend`/`transformend`
  already return **world** coordinates — the existing
  `getTopLeftFromCenterPosition` / `calculateTransformResult` math needs no
  change, and we never persist screen coordinates.
- Wheel zoom converts the pointer to the world point under the cursor and keeps it
  pinned (cursor-anchored zoom). Containment clamps in world space.

### Pan behaviour

- The Stage is `draggable`. Dragging empty space pans the viewport; on `dragend`
  we sync `viewport` from the Stage node.
- Dragging an **object** drags that object instead (Konva drags the top-most
  draggable target). Object/transformer `dragend` events bubble to the Stage
  handler, so we sync the viewport **only when the Stage itself was the dragged
  node** (`e.target === stage`).
- Transformer anchors handle their own drag and never start a pan.

### Zoom controls

`CanvasZoomControls` is a screen-space MUI overlay (bottom-right of the canvas
frame), rendered in **all** modes:

- zoom in / zoom out (disabled at the scale limits),
- a live zoom percentage (`100%`),
- reset / fit-to-office (returns to scale 1, origin 0,0 — at which the whole room
  is visible with margin). A true fit-to-arbitrary-content transform is deferred
  (see below); reset is sufficient because the room already fills the canvas at
  scale 1.

## Door/window wall placement

Doors and windows are placed onto walls by hovering and clicking, instead of
typing coordinates into the create form.

- **Trigger** — when the selected library type is a wall-mounted type
  (`door`/`window`, see `WALL_MOUNTED_TYPES` in `utils/wallPlacement.ts`) and the
  user can manage the layout, the create panel swaps to a hint and the canvas
  enters placement mode.
- **Target walls** — both the **system boundary walls** and any user-placed
  `wall` layout objects (any position/rotation). All walls are reduced to a
  common centreline descriptor (`SnapWall {centerX, centerY, length, thickness,
  angleDeg}`) so one projection routine serves both.
- **Snapping** — the pointer (converted to **world** coords via
  `stage.getRelativePointerPosition()`, so it is correct under any pan/zoom) is
  projected onto the nearest wall within a hover band. The opening is clamped to
  stay within the wall's ends (centred if it is longer than the wall) and
  rotated to align with the wall (`angleDeg`, +90 for vertical/portrait walls).
- **Preview + commit** — a semi-transparent ghost (the type's render-config
  colours, dashed) follows the snap; clicking calls `onPlaceObject`, which
  creates a normal layout object at the snapped `x/y/width/height/rotation` and
  selects it. After creation the door/window behaves like any other object
  (drag, resize, delete, inspector).
- **Capture overlay** — a transparent, full-extent capture rect sits above the
  objects layer while placing, so a click near a user `wall` object places a
  door rather than selecting the wall. Wheel zoom still works; object
  selection/drag is suspended only while in placement mode.
- **Flush fit** — the opening takes the host wall's *thickness* (12px for
  boundary walls, `min(w,h)` for user walls) and its centre sits on the wall's
  visual centreline, so it lands line-on-line over the wall.
- **No overlap on placement** — the ghost/click is rejected (cursor
  `not-allowed`, `onPlaceObject` not fired) when the opening would overlap an
  existing door/window on the same wall (`isAlongFree` / `openingsOnWall`).
- **One-shot** — after a successful place the canvas selection *and* the library
  selection clear, so placement mode turns off (no chained placements on every
  click); re-select door/window to place another.

### Moving a placed door/window

A placed opening is constrained to its wall, not free on the canvas:

- **Drag** uses a Konva `dragBoundFunc` (built per node in `FloorMapCanvas`,
  evaluated in world coords via the stage transform so it is pan/zoom-safe) that
  projects the pointer onto the host wall's centreline, clamps it within the wall
  ends, and clamps it within the free gap containing its pre-drag position — so
  it slides along the wall and can never cross another opening.
- **Drag-end + keyboard** go through `constrainWallObjectMove` in
  `useCanvasInteractions` instead of the room boundary clamp (which would yank the
  opening into the room, since walls sit outside the boundary). Perpendicular
  motion is ignored; the opening only slides along its wall.
- **Transform** of a wall-mounted type skips the boundary clamp for the same
  reason. Resizing a door fully off its wall is an accepted edge case (deferred).

Geometry is pure and unit-tested (`utils/wallPlacement.ts`); the canvas wires it
to hover/click. The door/window box is stored axis-aligned with a `rotation`, so
the same best-effort rotated-containment caveat as above applies if it is later
dragged.

## Neighbour alignment snapping + live guides

Normal objects align to **adjacent** objects so items placed beside each other
line up flush (like design-tool smart guides), with pink guide lines shown live
during the drag.

- `computeNeighborSnap` (`utils/objectSnapping.ts`) is the pure core: it returns
  the snapped top-left **and** the guide lines (every coincident edge after
  snapping). `snapToNeighbors` is the top-left-only wrapper.
- Only objects within `NEIGHBOR_PROXIMITY` (40px) in **both** axes count as
  targets ("right beside it"), so far-away objects never tug the dragged one.
- Per axis it considers align-left/right/centre and butt-adjacent (the dragged
  edge touches the neighbour's opposite edge) candidates; the closest within
  `NEIGHBOR_SNAP_THRESHOLD` (14px) wins. The threshold is deliberately forgiving
  so small gaps left by imperfect manual placement auto-close (objects connect
  flush). Axes are independent, so a desk dropped to the right of another snaps
  flush in X and aligns tops in Y at once.
- **Live** — `FloorMapCanvas` passes `onDragMove` to normal objects; on each move
  it converts the node centre to world top-left, runs `computeNeighborSnap`,
  imperatively repositions the Konva node (so it snaps as you drag), and stores
  the guides in state. The guides render as dashed pink `Line`s in a
  non-listening layer (world coords, so they pan/zoom with the canvas) and are
  cleared on drag-end. (React never resets the node mid-drag because the group's
  x/y props — derived from the unchanged object state — don't change until the
  drag-end PATCH lands.)
- **On release** the same snap runs in `useCanvasInteractions` (after grid snap,
  before the boundary clamp) so the persisted position matches the live preview.
- Door/window wall-sliding and keyboard nudges are unaffected (own constraints).

## Overlap prevention + push-aside

Objects may not overlap each other. The rule is a relationship (`blocksDrag` in
`utils/objectSnapping.ts`): **everything blocks everything** — desks may not sit
on walls, windows, doors, tables, rooms/zones, or decor — with one exception: a
**wall** carries its mounted doors/windows, so those openings do not block the
wall when it is the object being dragged. Doors/windows never reach this path as
the dragged object (they have their own on-wall slide). Overlap uses each
obstacle's **rotation-aware** bounding box, so a 90° lunch table or a vertical
wall is matched against its real footprint, not its unrotated box.

- **Drag** — on drop the hook runs `resolveDrop`:
  - 0 overlaps → keep.
  - exactly 1 overlap → **push aside** along the axis of least penetration, so it
    lands flush against the side it came from (drag from the left → placed on the
    left).
  - 2+ overlaps (or a push that still overlaps) → **revert** to the pickup
    position (the previous behaviour, for the genuinely ambiguous case).
  Order on drop: grid-snap → neighbour-align → boundary-clamp → `resolveDrop`.
- **Node settle** — `handleObjectDragEnd` returns the final top-left and
  `FloorMapCanvas` imperatively sets the Konva node there (and `batchDraw`s).
  This is required: react-konva does not reliably reconcile a node back to a
  controlled position after a drag, so without it a pushed/reverted object would
  visually "stay where dropped" even though state is correct. Persistence is the
  hook's job; the node settle is purely visual.
- **Keyboard** — a nudge that would overlap is simply dropped (no PATCH).
- **Rotation** — both the obstacles AND the dragged object use a rotation-aware
  bounding box (`halfExtents`/`aabb`): a wall stored 200×10 at 90° is treated as
  the 10×200 vertical strip it actually is, so dragging it no longer slips over
  desks, and push-aside seats its real edge flush against the neighbour. Exact at
  0°/90°; a tight envelope for other angles (precise polygon overlap deferred).
- Edge-touching is allowed (strict inequality), so flush-aligned neighbours are
  not "overlapping".
- Consequence (accepted): you can no longer drop an object **into** a Room/Zone
  (it gets pushed back out), and an object that already overlaps another is
  pushed to the nearest free side when first moved.

## Walls carry their doors/windows

A door/window is "part of" the wall it sits on until deleted: moving the wall
moves them with it.

- `attachedOpenings(wall, objects)` (`utils/wallPlacement.ts`) finds the
  door/window objects whose centre lies on the wall's footprint.
- **Move** — `moveWallAndOpenings` translates each attached opening by the wall's
  move delta (drag and keyboard), keeping it at the same spot on the wall.
- **Resize/rotate** — `transformOpeningWithWall` maps each opening through the
  wall's transform: its offset and size in the wall's local frame are scaled by
  the wall's per-axis size change (and rotated by the wall's rotation delta), so
  a longer wall makes its door proportionally longer and a thicker wall makes it
  thicker — they behave as one entity. Wired into `handleObjectTransform`.
- Each wall + opening update is an independent optimistic PATCH (shared
  `persistTransform` helper).
- **Constrained independent resize** — a selected door/window shows only the
  left/right transformer handles (`enabledAnchors` + `rotateEnabled={false}` for
  wall-mounted types), so the user can change only its **length along the wall**.
  `resizeOpeningOnWall` then locks the cross dimension to the wall thickness and
  rotation to the wall, and clamps the length to the free gap (within the wall
  ends, not over a neighbouring opening). Thickness/rotation otherwise come from
  the wall.

## Rotation snapping

Object rotation always lands on a **multiple of 10°** (86 → 90, 82 → 80). Live,
the transformer snaps the rotate handle (`rotationSnaps` = every 10°,
`rotationSnapTolerance` 5, so it always snaps); on persist, `snapRotation`
(`coordinateHelpers.ts`) rounds and normalises to [0, 360) as the source of
truth. Doors/windows inherit their wall's (already-snapped) angle.

## Editor / member / booking behaviour

- **Admin editor** — pan/zoom; add/drag/resize/rotate/keyboard-move objects, all
  clamped to the boundary; Saving/Saved unchanged; isometric assets still render.
- **Member read-only** — pan/zoom; boundary visible; objects not draggable; no
  admin controls.
- **Booking** — pan/zoom; boundary visible; desk click still selects the desk;
  availability colours still shown; empty/boundary clicks do not select; non-desk
  objects are not bookable. The boundary is non-listening so it never intercepts a
  desk selection.

## Existing layout compatibility

- Existing objects render where they are; no migration, no on-load auto-save.
- New objects are created inside the boundary.
- Out-of-bounds objects clamp back inside on the next move/resize.

## Isometric renderer compatibility

The boundary and pan/zoom are orthogonal to the renderer registry (PR 059/060).
Objects still render through `getLayoutObjectRenderer`; the Enhance toggle and the
isometric desk/meeting-room assets are unaffected.

## Tests

New / updated frontend tests:

- `coordinateHelpers.test.ts` — `DEFAULT_FLOOR_BOUNDARY`, `clampObjectToBoundary`,
  `clampObjectTransformToBoundary` (in-bounds, negative, right/bottom edge,
  oversized-object safety, custom boundary).
- `canvasViewport.test.ts` — scale clamping, cursor-anchored zoom invariant, wheel
  factor, percentage formatting.
- `useCanvasViewport.test.tsx` — zoom in/out, min/max clamping, reset, zoomAt
  anchor.
- `CanvasZoomControls.test.tsx` — percentage, callbacks, disabled at limits.
- `FloorMapCanvas.test.tsx` — boundary white interior + wall stroke, non-listening
  layer, boundary in booking mode, boundary does not block object clicks, zoom
  controls present in editor/member/booking, zoom-in raises %, reset restores %.
- `useCanvasInteractions.test.tsx` / `FloorLayoutPageIntegration.test.tsx` —
  clamp targets updated from stage (0,0 / 920,590) to boundary (48,48 / 872,542),
  including out-of-bounds objects clamping back in on edit and rollback.

Pan and wheel-zoom are exercised through the pure viewport helpers and the hook
rather than through a Konva-mocked drag, to avoid brittle pixel/event mocks; the
Stage-level pan/zoom wiring is verified by manual QA.

## Manual QA checklist

Admin: open a demo floor → confirm rectangular walls + white interior; add object
→ appears inside the room; drag to each edge → stops at the wall, not the stage
edge; resize/keyboard-move near edges → clamps; wheel zoom → cursor-anchored;
drag empty space → pans; drag object while zoomed → object moves correctly;
zoom in/out/reset controls work; Saving/Saved works; isometric assets render.

Member: boundary visible; pan/zoom works; objects not draggable.

Booking: boundary visible; pan/zoom works; availability colours visible; click
desk while zoomed → selects + list/panel sync; click wall/empty → no selection;
non-desk objects not bookable.

## Deferred items

- editable floor dimensions
- non-rectangular office shapes
- editable wall segments
- minimap
- saved viewport preference (pan/zoom is intentionally not persisted)
- touch-gesture (pinch) polish beyond browser wheel events
- fit-to-selected-object / fit-to-content transform
- precise rotated-object boundary containment (currently AABB best-effort)
- door/window placement: swing/opening direction
- live (during-drag) overlap push-aside and wall→openings follow (currently
  resolved on release)
- precise rotated-object overlap (currently axis-aligned bounding box)

# PR 059 — Renderer Registry Widening

## Why this PR exists

The floor canvas needs a path toward a deterministic **enhanced renderer** (polished
per-type icons/illustrations) without an LLM, without moving objects, and without
touching booking hitboxes. The architecture review (PRs 032–056) found the canvas is
already well-positioned: rendering is centralised and data-driven, not scattered.

This PR is a **foundation-only** refactor. It introduces a renderer-registry seam so
future PRs can register richer per-type visuals safely. It deliberately ships **zero**
visual change.

## Current rendering chokepoint (before this PR)

`LayoutObjectCanvasNode` (`frontend/src/features/layoutObjects/components/`) is the single
component that renders every layout object. It owns:

- the Konva `Group` geometry (origin at the bounding-box centre, for correct rotation/drag)
- position, rotation, drag/transform binding, click/selection binding
- the label `Text`, the green "bookable" dot, and (via `getLayoutObjectNodeStyle`)
  selection/saving/booking-availability styling

The **inner visual** was an inline branch:

```tsx
config.shape === "circle"
  ? <Circle radius={Math.min(w, h) / 2} {...shapeProps} />
  : <Rect width={w} height={h} cornerRadius={config.cornerRadius} {...shapeProps} />
```

That inline branch is the only thing a future enhanced renderer needs to vary.

## New renderer registry seam

New folder: `frontend/src/features/layoutObjects/renderers/`

| File | Responsibility |
|------|----------------|
| `types.ts` | `LayoutObjectRendererProps` and `LayoutObjectRenderer` (a Konva-returning React component type) |
| `DefaultLayoutObjectRenderer.tsx` | Reproduces the old inline Rect/Circle exactly — fallback for all types today |
| `index.ts` | `getLayoutObjectRenderer(type)` → registered override, else the default renderer |

```ts
const rendererRegistry: Partial<Record<LayoutObjectType, LayoutObjectRenderer>> = {};

export function getLayoutObjectRenderer(objectType: LayoutObjectType): LayoutObjectRenderer {
  return rendererRegistry[objectType] ?? DefaultLayoutObjectRenderer;
}
```

`renderers` props handed to every renderer:

```ts
interface LayoutObjectRendererProps {
  object: LayoutObject;            // full object (id, type, label, geometry, metadata)
  config: RenderConfig;            // static visual config for object_type
  style: LayoutObjectNodeStyle;    // resolved fill/stroke/opacity/dash (selection+saving+availability folded in)
  width: number;                   // parseFloat(object.width)
  height: number;                  // parseFloat(object.height)
  isSelected: boolean;
  isSaving: boolean;
  isBookingMode: boolean;
}
```

## What changed

- Added `renderers/` (types, default renderer, registry index).
- `LayoutObjectCanvasNode` now resolves `const Renderer = getLayoutObjectRenderer(obj.object_type)`
  and renders `<Renderer … />` in place of the inline Rect/Circle. It still owns the Group,
  label, bookable dot, drag/transform/selection, and style resolution.
- Added an `isBookingMode` prop to `LayoutObjectCanvasNode`, threaded from `FloorMapCanvas`
  (`mode === "booking"`). This gives renderers an accurate booking signal (a non-desk object
  in booking mode has no availability status, so availability alone is not a reliable flag).

## What did NOT change

- No geometry, hitboxes, dragging, resizing, rotation, snapping, clamping, keyboard, or saving behaviour.
- No fill/stroke/strokeWidth/dash/opacity/cornerRadius/shape values — `DefaultLayoutObjectRenderer`
  spreads the same `style` and reads the same `config` the node previously used. Output is pixel-identical.
- No label, shortcode, or bookable-dot change (those stay centralised in the node — Option A).
- No booking logic, availability mapping, or selection-callback change.
- No object types added/removed; no object library curation.
- No Schematic/Visual toggle, no enhanced icons.
- No backend change; no migration.

## Why no backend migration is needed

Renderer selection is a pure function of `object_type`, which is already stored. The 36 existing
types and their configs are unchanged. Per-instance overrides (future) can live in the existing
empty `metadata` JSONField. The registry is frontend-only, so old/demo objects render exactly as before.

## How this prepares future enhanced renderers (PR 061)

A future enhanced renderer is a new component implementing `LayoutObjectRenderer`, registered in
`rendererRegistry` by type:

```ts
// renderers/index.ts (PR 061)
const rendererRegistry = {
  desk: DeskRenderer,
  meeting_room: MeetingRoomRenderer,
  // …
};
```

Guidance for those renderers:

- Draw with react-konva primitives (`Rect`, `Circle`, `Path`, `Line`) — never HTML/DOM (keeps the Konva scene graph intact, so rotation/transform/hitbox keep working).
- Spread `style` onto the base shape so **selection, saving dim, and booking-availability colours keep working for free**.
- Coordinates are relative to the centred group origin (`[-w/2, -h/2]`…`[w/2, h/2]`).
- The node still draws the label and bookable dot, so renderers must not duplicate them.

Unregistered types automatically fall back to `DefaultLayoutObjectRenderer`, so PR 061 can ship
enhanced renderers incrementally, one type at a time, with zero risk to the rest.

## Test coverage

- `renderers/__tests__/rendererRegistry.test.ts`
  - every `ALL_LAYOUT_OBJECT_TYPES` value resolves to a renderer (no throw)
  - all types fall back to `DefaultLayoutObjectRenderer` today
  - unknown/unregistered type falls back to the default renderer
- `renderers/__tests__/DefaultLayoutObjectRenderer.test.tsx`
  - rect-shaped config → `Rect`; circle-shaped config → `Circle`
  - rect centred (`-w/2`, `-h/2`), width/height + `cornerRadius` passed through
  - fill/stroke/strokeWidth/opacity passed through from `style`
  - dash pattern passed through when present
  - circle radius = `min(w, h) / 2`
- Existing `FloorMapCanvas.test.tsx`, `FloorLayoutPageIntegration.test.tsx`, and
  `BookingFloorMap.test.tsx` continue to pass unchanged (selection, drag, transform, label,
  shortcode, non-draggable read-only, booking availability click) — proving behaviour parity.

Full frontend suite: **1210 tests green** (95 files). `tsc --noEmit`, `eslint`, `prettier --check`
clean. Vite bundles successfully (`FloorMapCanvas` chunk ~60 kB gzip, unchanged in magnitude).
`npm audit --audit-level=high`: 0 vulnerabilities.

> Note: `npm run build` (which runs `tsc -b`) currently fails on
> `frontend/src/features/invitations/components/PendingInvitationsPrompt.tsx` — a **pre-existing**
> PR 058 type error (TD-047), verified by reproducing it with PR 059 changes stashed. It is
> unrelated to this PR. Vite bundling of PR 059 code was verified directly.

## Manual QA checklist

1. Admin opens a floor layout — existing objects look identical to before.
2. Select an object — amber selection highlight appears.
3. Move (drag) an object — position persists; Saving → Saved chip shows.
4. Resize an object via the transformer handles — dimensions persist.
5. Rotate an object — rotation persists.
6. Saving/Saved indicators behave as before.
7. Member opens the same floor — read-only: no library, no create form, no drag, read-only banner.
8. Booking page map shows availability colours (available/reserved/bookedByMe/unavailable).
9. Booking page object selection still works (click desk → list/panel sync).
10. Non-desk objects in booking mode are not clickable for booking.

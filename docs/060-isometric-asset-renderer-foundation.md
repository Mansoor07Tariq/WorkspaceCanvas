# PR 060 — Isometric/SVG Asset Renderer Foundation

**Branch:** `feature/060-isometric-asset-renderer-foundation`
**Title:** feat(canvas): add isometric asset renderer foundation

---

## 1. Why this PR exists

PR 059 introduced a renderer registry (`getLayoutObjectRenderer(type)`) so the
inner visual of a layout object can vary per type without touching geometry,
hitboxes, or booking logic. This PR uses that seam to start the **pre-built
SVG / isometric asset** direction: replacing plain coloured boxes with reusable,
product-owned visual assets/prefabs for selected object types.

No LLM, no image generation, no moving objects, no hitbox changes. The backend
remains the single source of truth for object type and geometry; the frontend
just draws a nicer visual inside the same box.

## 2. Backend layout data vs frontend visual assets

| Concern | Owner |
|---|---|
| object type, `x/y`, `width/height`, `rotation`, bookable/desk link | **Backend** (layout object API) — unchanged |
| the visual drawn inside that box | **Frontend** asset (this PR) |

`object_type = desk` still arrives from the backend with the same fields. The
renderer draws a pre-built desk visual *inside that same object box*. Assets are
bundled frontend files; they carry no positioning authority.

## 3. Asset folder structure

```
frontend/src/assets/floor-map/isometric/
  desk-isometric.svg
  meeting-room-isometric.svg
```

These are simple, project-owned placeholder SVGs (clearly isometric, visibly
different from boxes). They are intended to be replaced by final designer art
later — the import path and registry stay the same.

## 4. Asset registry

`frontend/src/features/layoutObjects/renderers/isometric/assetRegistry.ts`

```ts
export interface IsometricAssetDefinition {
  src: string;            // Vite turns the SVG import into a bundled URL
  alt: string;
  preserveAspectRatio?: string;
}

export const isometricAssetRegistry: Partial<Record<LayoutObjectType, IsometricAssetDefinition>> = {
  desk: { src: deskIsometric, alt: "Desk", preserveAspectRatio: "xMidYMid meet" },
  meeting_room: { src: meetingRoomIsometric, alt: "Meeting room", preserveAspectRatio: "xMidYMid meet" },
};

export function getIsometricAsset(type): IsometricAssetDefinition | undefined { ... }
```

Only the proof-of-concept types are registered. `getIsometricAsset` returns
`undefined` for everything else, which drives safe fallback.

## 5. Renderer implementation

`renderers/isometric/IsometricAssetRenderer.tsx` receives the standard
`LayoutObjectRendererProps` and:

- looks up the asset for `object.object_type`;
- loads the SVG via `useKonvaImage(src)` — a tiny hook that loads an
  `HTMLImageElement` and **caches it by src in a module-level Map** so a floor
  full of desks loads the bitmap once (synchronous cache-hit, no per-node
  flicker). Status is derived during render and only mutated inside the async
  load callbacks (no synchronous setState-in-effect, no stale image on src
  change);
- when loaded, **contain-fits** the `Konva.Image` inside the object box: it
  scales the artwork to the largest size that fits (`min(w/naturalW, h/naturalH)`)
  and centres it, so the asset is never distorted. When natural dimensions are
  unavailable it falls back to filling the box. Then it draws two overlays from
  the resolved `style`: a translucent full-box *tint* and a full-box *border*;
- the full-box **tint rect is the listening hit target** (the image is
  `listening={false}`). Because the contain-fitted image can be smaller than the
  box, making the always-full-box tint the hit target keeps the clickable/
  draggable region equal to the default rect's box — the hitbox never shrinks
  with the artwork. The border rect is non-interactive;
- falls back to `DefaultLayoutObjectRenderer` when the asset is missing, still
  loading, or failed to load.

Registered in `renderers/index.ts`:

```ts
const rendererRegistry = { desk: IsometricAssetRenderer, meeting_room: IsometricAssetRenderer };
```

## 6. Types converted in this PR

- `desk`
- `meeting_room`

Every other type is unchanged (still `DefaultLayoutObjectRenderer`).

## 7. Fallback behavior

An object is **never invisible**:

- type has no asset → default renderer;
- asset still loading → default renderer (box) until the image decodes;
- asset failed to load → default renderer;
- in the test environment (jsdom, where images don't decode) desks render via
  the default fallback — which is why all existing canvas tests stay green.

## 8. Booking / geometry safety

- **Geometry:** position, size, and rotation are still owned by
  `LayoutObjectCanvasNode`'s Group; the renderer only draws inside the box. The
  artwork is contain-fitted and centred within `[-w/2, -h/2, w, h]`.
- **Hitbox:** the full-box tint rect (listening) is the hit target, so click/
  drag/resize hit areas equal the default rect's box even though the contain-fit
  image may be smaller; during fallback the default rect is the hit target. No
  hitbox gap or shrink at any load state.
- **Booking availability:** colours are **not** baked into the SVG. The
  availability palette (from the resolved `style`) is applied as a translucent
  tint + border overlay, stronger in booking mode (`opacity 0.45`) so
  reserved/unavailable/available states stay legible over the artwork.
- **Selection / saving:** editor selection shows through the border (amber
  `style.stroke`); saving dims the asset (`opacity 0.6`), mirroring the default
  renderer's save-dim.
- **Label & bookable dot:** still rendered by `LayoutObjectCanvasNode`, not the
  renderer.

## 9. What this PR does NOT include

- Does not convert all object types (only desk + meeting_room).
- No kitchen/bathroom/stairs assets, no object-library curation.
- No Schematic/3D-view toggle, no Three.js / 3D engine.
- No backend changes, no migrations, no new object types.
- No changes to booking logic or the layout object API.
- No LLM / image generation; no external/remote/copyrighted assets.

## 10. Manual QA checklist

Admin floor layout: open a demo floor → desk and meeting-room objects show the
new isometric prefab; other types still show default shapes; select / drag /
resize / rotate a desk; confirm Saving/Saved; confirm the label and bookable dot
still render.

Member floor layout: read-only behaviour intact; no drag/admin controls; visuals
still visible.

Booking page: select office/floor/date → desk asset still shows availability
state (translucent colour + border); click a desk on the map → list/panel sync;
reserved/unavailable states remain understandable.

## 11. Future plan

- Curated object library with per-type prefabs.
- Kitchen / bathroom / stairs and the rest of the catalogue.
- Replace placeholder SVGs with final designer art (same import paths/registry).
- Optional Schematic ↔ Isometric view toggle (the editor `Enhance` toggle is the
  first step; a persisted, possibly admin-only preference can follow).

## 12. Tests / checks

New/updated frontend tests:

- `assetRegistry.test.ts` — desk/meeting_room have definitions; unregistered
  types return undefined; registry contains exactly the POC types.
- `rendererRegistry.test.ts` (updated) — desk/meeting_room resolve to the
  isometric renderer; all other and unknown types fall back to default.
- `IsometricAssetRenderer.test.tsx` — renders the image when loaded, falls back
  on loading/error, contain-fits without distortion and centres the artwork,
  falls back to filling the box when natural dimensions are unavailable, keeps
  the image non-interactive while the full-box tint is the hit target, applies
  tint/border from style, uses the stronger booking-mode tint, dims while saving,
  and renders no label/dot.
- `useKonvaImage.test.ts` (new) — directly tests the image-loading hook with a
  stubbed `window.Image`: successful load → loaded, error → error, undefined src
  builds no Image, cache hit serves synchronously without a second Image,
  unmount-before-load updates no state and leaves the cache empty, and a src
  change drops the stale image (shows loading for the new src).
- `rendererRegistry.test.ts` / `assetRegistry.test.ts` — registry resolution and
  asset definitions (desk + meeting_room only).
- Existing `FloorMapCanvas`, `FloorLayoutPageIntegration`, `BookingFloorMap`,
  and `DefaultLayoutObjectRenderer` tests still pass unchanged.

No new technical debt introduced. The asset registry uses the optimized
`meeting-room-isometric.svg` (≈1 KB) — the earlier oversized AI-exported SVG was
removed before merge so it never ships in the bundle.

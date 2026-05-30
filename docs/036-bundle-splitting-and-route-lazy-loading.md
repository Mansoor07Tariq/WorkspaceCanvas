# PR 036 — Bundle Splitting, Route-Level Lazy Loading, and Canvas Cleanup

## Purpose

Reduce the initial JavaScript bundle size, eliminate the Vite chunk-size warning, and fix all
minor quality issues left from PR 035 code review. This is a performance/build-architecture
and cleanup PR — no product features were added.

## Why this PR exists

PR 035 lazy-loaded Konva/FloorMapCanvas, but the Vite chunk-size warning remained because
the main `index` chunk was approximately 903 KB / 261 KB gzip, caused by every route page
and all vendor libraries being bundled eagerly.

Additionally, the PR 035 review found five cleanup items that were minor but not deferred:
they were correctness, accessibility, and code-quality fixes safe to land immediately.

---

## PR 035 cleanup items included

### 2.1 — `calculateTransformResult` used in `LayoutObjectCanvasNode`

`LayoutObjectCanvasNode.handleTransformEnd` previously reimplemented the transform math
inline (`w * scaleX`, `getTopLeftFromCenterPosition`, `Math.max(MIN_OBJECT_SIZE, ...)`) instead of calling the
`calculateTransformResult` pure helper that was already defined and tested in `coordinateHelpers.ts`.

Fix: `handleTransformEnd` now calls `calculateTransformResult(node.x(), node.y(), w, h, scaleX, scaleY, node.rotation())`.
The imperative scale reset (`node.scaleX(1); node.scaleY(1)`) still happens before the call, which is correct.

### 2.2 — `buildMovePatch` / `buildTransformPatch` used in `FloorLayoutPage`

`FloorLayoutPage` previously called `formatCoordinate` directly in both `handleObjectMove`
and `handleObjectTransform`, ignoring the `buildMovePatch` and `buildTransformPatch` helpers
that were defined, tested, and documented in `coordinateHelpers.ts`.

Fix: `handleObjectMove` uses `buildMovePatch(newX, newY)`. `handleObjectTransform` uses
`buildTransformPatch(newX, newY, newWidth, newHeight, newRotation)`. The patch shapes are
unchanged; no new fields are sent.

### 2.3 — Interactive canvas `role="region"` (was `role="img"`)

The canvas wrapper `Box` in `FloorMapCanvas` had `role="img"` despite being keyboard-interactive
(`tabIndex={0}`, `onKeyDown`). `role="img"` is semantically a non-interactive static image.

Fix: changed to `role="region"` with the same `aria-label="Floor map canvas"`.
`FloorMapCanvas.test.tsx` updated from `getByRole("img")` to `getByRole("region")`.
The non-interactive Suspense fallback placeholder in `FloorLayoutPage` retains `role="img"`
since it has no keyboard interaction.

### 2.4 — Keyboard movement integration tests

Five integration tests added to `FloorLayoutPageIntegration.test.tsx`:

| Test | What it proves |
| --- | --- |
| ArrowRight on selected object | `updateLayoutObject` called with `x + 1` |
| Shift+ArrowDown on selected object | `updateLayoutObject` called with `y + 10` |
| ArrowLeft with no selection | `updateLayoutObject` not called |
| ArrowRight as member user | `updateLayoutObject` not called |
| ArrowRight optimistic update | local `x` updates before PATCH resolves |

The `FloorMapCanvas` mock was updated to forward `onKeyDown` on the canvas div so tests can
fire keyboard events. The auth mock was refactored to use `vi.hoisted` so role can be
overridden per-test without affecting the rest of the suite.

### 2.5 — `moveError` renamed to `layoutSaveError`

`moveError` state in `FloorLayoutPage` was misleadingly named — it covers drag, keyboard move,
resize, and rotate errors. Renamed to `layoutSaveError` / `setLayoutSaveError`. Error copy
unchanged (`c.moveError` / `c.movePermissionError` i18n keys are separate and untouched).

---

## Before bundle sizes (from PR 035)

| Chunk | Size (minified) | Size (gzip) |
| --- | --- | --- |
| `index` (main) | ~903 KB | ~261 KB |
| `FloorMapCanvas` + Konva | ~312 KB | ~95 KB |

Vite chunk-size warning on the main `index` chunk.

---

## Bundle analyzer setup

Installed as a dev dependency: `rollup-plugin-visualizer`.

Configured behind an environment flag in `vite.config.ts`:

```ts
process.env.ANALYZE === "true" &&
  visualizer({
    filename: "dist/stats.html",
    gzipSize: true,
    brotliSize: true,
    template: "treemap",
  }),
```

### How to run

```bash
ANALYZE=true npm run build
# then open dist/stats.html in a browser
```

`dist/` is already in `.gitignore` — `stats.html` is never committed.

### Analyzer findings

- **MUI + Emotion** is the largest dependency group (~288 KB gzip) — expected and acceptable.
- **MSAL** (Azure auth) is the next heaviest, ending up in the `vendor` catch-all.
- **Konva / react-konva** correctly stays with the lazy `FloorMapCanvas` chunk, not in any eager bundle.
- Every route page was previously bundled eagerly — after lazy-loading they are each ~0.7–24 KB individually.

---

## Route-level lazy loading

**File:** [src/app/router/AppRouter.tsx](../frontend/src/app/router/AppRouter.tsx)

All 10 top-level pages are now wrapped in `React.lazy()`:

Auth: `LoginPage`, `SignupPage`, `VerifyEmailPage`, `MfaChallengePage`, `MfaSetupPage`

App: `AppPlaceholderPage`, `AppOfficesPage`, `OfficeDetailPage`, `FloorLayoutPage`, `ComingSoonPage`

Auth pages are imported directly from their page files (not the `@/features/auth` barrel) so
each gets its own chunk without unintentional cross-page dependencies.

A single `<Suspense fallback={<PageLoading />}>` wraps the entire `<Routes>` tree.

### PageLoading component

**File:** [src/components/feedback/PageLoading.tsx](../frontend/src/components/feedback/PageLoading.tsx)

Full-viewport centred spinner used as the route Suspense fallback:
- `minHeight: 100vh` — prevents layout jank while a chunk loads.
- `role="status"` + `aria-label="Loading page"` — accessible announcement.

---

## Vendor chunking strategy

`vite.config.ts` — `build.rollupOptions.output.manualChunks`:

| Chunk | Contents |
| --- | --- |
| `vendor-react` | `react`, `react-dom`, `react-router-dom` |
| `vendor-mui` | `@mui/*`, `@emotion/*` |
| `vendor-icons` | `lucide-react` (if added; not currently installed) |
| _(included in `vendor-mui`)_ | `@mui/icons-material` — matched by the `/@mui/` prefix, not a separate chunk |
| `vendor` | MSAL, Google OAuth, all other `node_modules` |
| _(none — Rolldown default)_ | Konva, react-konva |

Konva returns `undefined` from `manualChunks` so Rolldown keeps it co-located with the
lazy `FloorMapCanvas` chunk rather than pulling it into any eager vendor bundle.

---

## Import hygiene findings

- No wildcard icon imports found.
- Auth pages are imported directly from page files in the router, not from the auth barrel.
- No other problematic eager imports found in the app shell or router.
- No MUI barrel-import issues that would bloat individual route chunks.

---

## After bundle sizes

| Chunk | Size (minified) | Size (gzip) | Notes |
| --- | --- | --- | --- |
| `index` (main) | **8.98 KB** | **3.20 KB** | Was 903 KB. Router + runtime only. |
| `vendor-react` | 216.94 KB | 69.51 KB | React/DOM/Router. Long-lived cache. |
| `vendor-mui` | 287.65 KB | 86.36 KB | MUI + Emotion. Long-lived cache. |
| `vendor` (MSAL etc.) | 395.60 KB | 112.06 KB | All other node_modules. |
| `FloorMapCanvas` + Konva | 194.94 KB | 59.71 KB | Lazy — only loads on /layout route. |
| `AppPlaceholderPage` | 23.59 KB | 6.56 KB | Lazy route page. |
| `AppOfficesPage` | 20.35 KB | 5.19 KB | Lazy route page. |
| `FloorLayoutPage` | 20.83 KB | 6.20 KB | Lazy route page. |
| `OfficeDetailPage` | 9.11 KB | 3.13 KB | Lazy route page. |
| Auth pages (each) | 0.5–4.6 KB | 0.2–2.1 KB | Lazy route pages. |

**Vite chunk-size warning: RESOLVED.** All chunks are under 500 KB.

---

## Tests and checks

| Check | Result |
| --- | --- |
| `npm run test` | **574 / 574 passed (42 test files)** — up from 569 |
| `npx tsc --noEmit` | Clean |
| `npm run lint` | Clean |
| `npm run format:check` | Clean |
| `npm run build` | Clean, no warnings |
| `ANALYZE=true npm run build` | Clean, generates `dist/stats.html` |
| `npm audit` | 0 vulnerabilities |

---

## Files changed

| File | Change |
| --- | --- |
| `vite.config.ts` | Visualizer plugin (ANALYZE flag) + manualChunks |
| `src/app/router/AppRouter.tsx` | Route-level lazy loading for all 10 pages |
| `src/components/feedback/PageLoading.tsx` | New full-viewport Suspense fallback |
| `src/features/layoutObjects/components/LayoutObjectCanvasNode.tsx` | Use `calculateTransformResult` in handleTransformEnd (cleanup 2.1) |
| `src/app/pages/FloorLayoutPage.tsx` | Use `buildMovePatch`/`buildTransformPatch`; rename `moveError` → `layoutSaveError` (cleanup 2.2, 2.5) |
| `src/features/layoutObjects/components/FloorMapCanvas.tsx` | `role="region"` on interactive canvas wrapper (cleanup 2.3) |
| `src/features/layoutObjects/__tests__/FloorMapCanvas.test.tsx` | Update `getByRole("img")` → `getByRole("region")` |
| `src/features/layoutObjects/__tests__/FloorLayoutPageIntegration.test.tsx` | 5 keyboard movement integration tests; vi.hoisted auth mock; onKeyDown forwarding in canvas mock (cleanup 2.4) |
| `package.json` | Added `rollup-plugin-visualizer` devDep |
| `docs/036-bundle-splitting-and-route-lazy-loading.md` | This document |

---

## Manual test checklist

1. App loads from `/` — brief spinner → redirect to login
2. Login / signup / email verify / MFA flows work
3. Profile incomplete → onboarding appears
4. Profile complete → app shell loads
5. `/app/offices` — offices list / org setup works
6. `/app/offices/:id` — floors page works
7. `/app/offices/:id/floors/:fid/layout` — canvas loading fallback appears then map loads
8. Direct URL refresh on all three routes above — loads correctly
9. Member/read-only layout access — read-only banner, no handles, no drag
10. Canvas `role="region"` — inspectable in browser accessibility tree
11. Arrow key movement — selects object, ArrowRight moves 1 px, Saved chip appears
12. Shift+Arrow — moves 10 px
13. Production build preview (`npm run preview`) — no runtime import errors

---

## Deferred items

| Item | Notes |
| --- | --- |
| Deeper MUI import audit | Some MUI barrel imports may pull unneeded icons. Low priority now warning is resolved. |
| MSAL chunk isolation | If MSAL grows, `vendor-msal` could be split so it only loads on auth routes. Not needed now. |
| Route prefetching | Hover-to-prefetch nav links. Deferred. |
| Further sub-panel lazy loading | Panels within pages (e.g. LayoutObjectLibrary). Deferred. |
| `chunkSizeWarningLimit` adjustment | Not needed — all chunks are naturally under 500 KB. |

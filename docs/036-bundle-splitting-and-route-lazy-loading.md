# PR 036 — Bundle Splitting and Route-Level Lazy Loading

## Purpose

Reduce the initial JavaScript bundle size that Vite delivers to the browser on first load.
This is a performance and build-architecture PR only — no product behaviour changed.

## Why this PR exists

PR 035 successfully lazy-loaded Konva/FloorMapCanvas into its own chunk (~312 KB / 95 KB gzip).
However, the Vite chunk-size warning remained because the main `index` chunk was approximately
903 KB / 261 KB gzip — caused by:

- Every route page being imported eagerly into the router.
- MUI, Emotion, MSAL, Google OAuth, and other heavy vendors all landing in the same bundle.

---

## Before bundle sizes (from PR 035)

| Chunk              | Size (minified) | Size (gzip) |
| ------------------ | --------------- | ----------- |
| `index` (main)     | ~903 KB         | ~261 KB     |
| `FloorMapCanvas`   | ~312 KB         | ~95 KB      |

Vite reported a chunk-size warning on the main `index` chunk.

---

## Bundle analyzer setup

Install (dev dependency, already committed):

```
npm install -D rollup-plugin-visualizer
```

Configuration is gated behind an environment flag in `vite.config.ts` so it never runs in normal builds:

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

`dist/` is already in `.gitignore`, so `stats.html` is never committed.

---

## Route-level lazy loading

**File:** `src/app/router/AppRouter.tsx`

Every top-level page is now wrapped in `React.lazy()` with a single `<Suspense>` boundary
wrapping the entire `<Routes>` tree.

Pages lazy-loaded:

- `LoginPage`
- `SignupPage`
- `VerifyEmailPage`
- `MfaChallengePage`
- `MfaSetupPage`
- `AppPlaceholderPage`
- `AppOfficesPage`
- `OfficeDetailPage`
- `FloorLayoutPage`
- `ComingSoonPage`

Auth pages are imported directly from their page files (not from the `@/features/auth` barrel)
so each gets its own chunk and there are no unintended cross-page dependencies.

### Loading fallback

**File:** `src/components/feedback/PageLoading.tsx`

A new `PageLoading` component provides the Suspense fallback for all routes:

- Full-viewport centred spinner (`minHeight: 100vh`).
- `role="status"` and `aria-label` for accessibility.
- Does not cause layout jank (fills the viewport so content does not shift when it resolves).

Existing `LoadingState` is kept for use within pages (partial-page spinners).

---

## Vendor chunking strategy

**File:** `vite.config.ts` — `build.rollupOptions.output.manualChunks`

| Chunk          | Contents                                               |
| -------------- | ------------------------------------------------------ |
| `vendor-react` | `react`, `react-dom`, `react-router-dom`               |
| `vendor-mui`   | `@mui/*`, `@emotion/*`                                 |
| `vendor-icons` | `@mui/icons-material`, `lucide-react` (if added later) |
| `vendor`       | MSAL, Google OAuth, everything else from `node_modules` |
| _(none)_       | Konva / react-konva — left to Rolldown's default       |

Konva is deliberately excluded from all named chunks (returns `undefined`) so that Rolldown
keeps it co-located with the lazy `FloorMapCanvas` chunk rather than pulling it into the
eager `vendor` bundle.

---

## Import hygiene findings

- No wildcard icon imports (`import * as Icons`) found.
- Auth pages were previously re-exported from a barrel (`@/features/auth`). The router now
  imports each page file directly to prevent barrel-induced over-bundling.
- No unexpected eager imports of heavy feature modules found in the router or app shell.
- Konva is only referenced from `FloorMapCanvas`, which was already lazy-loaded in PR 035.

---

## After bundle sizes

| Chunk                    | Size (minified) | Size (gzip)  | Notes                         |
| ------------------------ | --------------- | ------------ | ----------------------------- |
| `index` (main)           | **8.98 KB**     | **3.20 KB**  | Was 903 KB. Router + runtime only. |
| `vendor-react`           | 216.94 KB       | 69.51 KB     | React/DOM/Router. Stable cache. |
| `vendor-mui`             | 287.65 KB       | 86.36 KB     | MUI + Emotion. Stable cache.  |
| `vendor` (MSAL etc.)     | 395.60 KB       | 112.06 KB    | All other node_modules.       |
| `FloorMapCanvas` + Konva | 194.94 KB       | 59.72 KB     | Lazy. Only loads on /layout.  |
| `AppPlaceholderPage`     | 23.59 KB        | 6.56 KB      | Lazy route page.              |
| `AppOfficesPage`         | 20.35 KB        | 5.19 KB      | Lazy route page.              |
| `FloorLayoutPage`        | 20.87 KB        | 6.22 KB      | Lazy route page.              |
| `OfficeDetailPage`       | 9.11 KB         | 3.13 KB      | Lazy route page.              |
| Auth pages (each)        | 0.5–4.6 KB      | 0.2–2.1 KB   | Lazy route pages.             |

**Vite chunk-size warning: RESOLVED.** All chunks are under 500 KB.

---

## Tests and checks

| Check              | Result  |
| ------------------ | ------- |
| `npm run test`     | 569/569 passed (42 test files) |
| `npx tsc --noEmit` | Clean   |
| `npm run lint`     | Clean   |
| `npm run format:check` | Clean |
| `npm run build`    | Clean, no warnings |
| `ANALYZE=true npm run build` | Passes, generates `dist/stats.html` |
| `npm audit`        | 0 vulnerabilities |

---

## Files changed

| File                                                   | Change                                  |
| ------------------------------------------------------ | --------------------------------------- |
| `vite.config.ts`                                       | Visualizer plugin + manualChunks        |
| `src/app/router/AppRouter.tsx`                         | Route-level lazy loading                |
| `src/components/feedback/PageLoading.tsx`              | New full-viewport Suspense fallback     |
| `package.json`                                         | Added `rollup-plugin-visualizer` devDep |
| `docs/036-bundle-splitting-and-route-lazy-loading.md`  | This document                           |

---

## Manual test checklist

1. **App loads from root** — No blank screen. Brief spinner then redirect to login.
2. **Login/auth flow** — Works as before. LoginPage chunk loads on navigation.
3. **Profile incomplete user** — Profile onboarding still appears.
4. **Profile complete user** — App shell and AppPlaceholderPage load.
5. **Offices route** — Organization setup / offices list still works.
6. **Office detail route** — Floors page still works.
7. **Floor layout route** — Canvas lazy-load spinner appears, then map loads.
8. **Direct URL refresh:**
   - `/app/offices` — loads correctly.
   - `/app/offices/:officeId` — loads correctly.
   - `/app/offices/:officeId/floors/:floorId/layout` — loads correctly.
9. **Member/read-only layout access** — Still works.
10. **Production build preview** — No runtime import errors.

---

## Deferred items

- **Deeper MUI import audit** — some MUI barrel imports may still pull in unneeded icons or
  components. Low priority now that the warning is resolved.
- **MSAL chunk isolation** — if MSAL grows further, `vendor-msal` could be split out so it
  only loads for auth routes. Not needed today.
- **Route prefetching** — hovering a nav link could prefetch its chunk. Deferred.
- **Further feature panel lazy loading** — sub-panels within pages (e.g. LayoutObjectLibrary)
  could be split further. Deferred until profiling justifies it.
- **`chunkSizeWarningLimit` adjustment** — not needed; all chunks are naturally under 500 KB.

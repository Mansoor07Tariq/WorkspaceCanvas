# 063 — Safe Enhance plan, preview, best-effort apply & undo

## Why the old behaviour was unsafe

Before this PR, the isometric **view toggle** (`enhanced`) did two unrelated
things at once:

1. swapped simple boxes for detailed isometric assets (harmless, reversible), and
2. as a side effect in a `useEffect`, **computed a tidy normalization and
   immediately PATCHed many layout objects to the backend** — no preview, no
   confirmation, no undo.

So merely switching to "detailed" view could silently rewrite a hand-made
layout, with per-object PATCHes that could partially fail and leave the layout
inconsistent. That is unacceptable for a premium product where admins curate
floor maps.

## New architecture (plan-first)

```
  Pure engine (no React/Konva/API)        Apply adapter (HTTP)        Backend
  ────────────────────────────────        ────────────────────        ───────
  computeEnhancePlan(input)        ──▶     applyEnhancePlan()   ──▶    EnhanceRun (apply)
    → { operations, diagnostics,           undoEnhanceRun()     ──▶    EnhanceRun (undo)
        summary }                          retryEnhanceRun()    ──▶    EnhanceRun (retry)
```

- **`features/layoutObjects/enhance/`** — the pure engine. `computeEnhancePlan`
  wraps the existing geometry core (`utils/enhanceNormalize.ts`) and returns a
  plan: `operations[]` (each with `before`, `after`, `patch`, `reasonCodes`),
  `diagnostics[]`, and a `summary`. Deterministic; never mutates inputs; imports
  no React / Konva / MUI / hooks / API.
- **`features/layoutObjects/enhanceApply/`** — the impure adapter. Sends the plan
  to the backend and returns the run result. Never collapses `partial_success`
  into `success`.
- **`hooks/useEnhanceTidy.ts`** — sequences the UI state machine
  (`idle → preview → result`) and calls the adapter. Does not mutate the layout
  itself; resyncs local state from the run's authoritative `updated_objects`.
- **`components/EnhanceTidyDialog.tsx`** — preview + result UI.

The view toggle is now **view-only** and never moves, resizes, or persists
objects.

## Best-effort apply (product decision)

Tidy is **not** all-or-nothing. The backend applies each operation
independently so one bad object never blocks the rest. Failures are tracked and
surfaced; applied changes are undoable; failed operations are retryable.

### Failure taxonomy

**Whole-request rejection** (HTTP 4xx, nothing applied, no run created):
- unauthenticated → 403/401
- not owner/admin of the floor's org → 403
- office/floor not found for the caller → 404
- invalid payload (missing `plan_id`, empty `operations`) → 400

**Per-operation outcomes** (HTTP 200, run recorded):
- `applied` — object updated.
- `failed` — patch failed serializer validation (`validation_error`) or an
  unexpected save error (`save_error`).
- `skipped` — `object_not_available_for_floor` (also covers cross-tenant ids —
  no existence leak), `object_inactive`, or `stale_geometry` (the object changed
  since the plan was generated; not an error — re-run Tidy).

Run `status` = `success` (all applied), `failed` (none applied), else
`partial_success`.

## Idempotency

The client generates one `plan_id` per previewed plan. The apply endpoint is
unique on `(floor, plan_id)` for `kind=apply`: a repeat submit (double-click,
retry) returns the existing run's result instead of applying twice. A concurrent
race is caught via the unique constraint and resolved the same way.

## Undo

`POST …/enhance-runs/{id}/undo/` restores `before_geometry` for **only the
`applied`** operations of that run, best-effort, as a new
`EnhanceRun(kind=undo, parent_run=…)`. Failed/skipped operations are untouched.
Single-level undo of the most recent applied run is supported.

## Retry

`POST …/enhance-runs/{id}/retry/` re-attempts **only the `failed`** operations
as a new `EnhanceRun(kind=retry, parent_run=…)`. Stale-`skipped` operations are
**not** auto-retried — the plan is outdated, so the user should run Tidy again.

## Backend model

- `EnhanceRun` — `floor`, `triggered_by`, `kind (apply|undo|retry)`,
  `parent_run`, `plan_id`, `status`, `total/applied/failed/skipped_count`,
  `diagnostics`, `summary`, `created_at`. Unique `(floor, plan_id)`.
- `EnhanceRunOperation` — `enhance_run`, `object_id` (plain int, **not** a FK so
  history survives object deletion), `status`, `before_geometry`,
  `after_geometry`, `patch`, `reason_codes`, `error_code`, `error_message`.

Tenancy is scoped through `EnhanceRun.floor`. Apply uses per-operation
`transaction.atomic()` savepoints so one failure rolls back only that op.

## Endpoints

- `POST /api/offices/{officeId}/floors/{floorId}/layout-objects/enhance-runs/`
- `POST /api/offices/{officeId}/floors/{floorId}/enhance-runs/{runId}/undo/`
- `POST /api/offices/{officeId}/floors/{floorId}/enhance-runs/{runId}/retry/`

Apply response: `{ enhance_run_id, status, applied_count, failed_count,
skipped_count, operation_results[], updated_objects[] }`. `updated_objects`
carries authoritative server state so the canvas resyncs exactly.

## Reason codes

`repositioned`, `resized`, `rotated`, `wall-extended` are emitted today (derived
from the object type and which fields changed). `equalized`, `snapped-to-wall`,
`arranged`, `clamped-inside`, `moved-out-of-cutout` are reserved for when the
engine threads per-rule provenance.

## Tidy suggestion copy

The preview shows **friendly, human-readable suggestions** instead of raw
counts — e.g. "A few desks are unevenly spaced → I can align and space them for
a cleaner layout."

- **Deterministic, no AI/LLM.** Copy is built entirely on the client by
  `features/layoutObjects/enhancePreview/buildTidySuggestions.ts` from the plan's
  `reasonCodes` + object metadata. No network or model calls.
- **Pure & testable.** The builder imports no React/MUI/Konva/API; it doesn't
  mutate inputs. Strings come from `i18n` (`app.layoutObjects.tidySuggestions`),
  interpolated with the object's friendly name
  (`getFriendlyLayoutObjectName`: label → `object_type_display` → "Object").
  Grouped lines use the **pluralized library name** when the group shares one
  type (`getFriendlyGroupName`, e.g. "Standing desks look slightly misaligned")
  and fall back to "Objects" only for mixed-type groups.
- **Grouped.** Operations are bucketed into one **dominant category** chosen by
  reason-code priority (cutout → boundary → wall-extend → wall-snap → arrange →
  resize → rotate → align). A category with one object gets an object-specific
  line; multiple objects get a single grouped line. Warnings (cutout/boundary)
  sort first; the dialog caps the visible list at 5 and shows "…and N more".
- **Backend unchanged.** The backend still stores the raw `reasonCodes` and
  per-operation results on `EnhanceRun`/`EnhanceRunOperation` for audit; the
  friendly copy is presentation-only.
- **Reason→suggestion map:** `moved-out-of-cutout`→overlaps a cutout area;
  `clamped-inside`→outside the office boundary; `wall-extended`→wall segment can
  connect; `snapped-to-wall`→close to a wall; `arranged`→unevenly spaced;
  `resized`/`equalized`→different sizes; `rotated`→slightly rotated;
  `repositioned`/unknown→looks slightly misaligned.
- **Selective apply.** Each suggestion has a checkbox (all ticked by default).
  "Apply selected" sends only the operations belonging to the ticked
  suggestions, so the admin can resolve all or just some in one run. The backend
  is unchanged — it already applies any subset best-effort. The apply `plan_id`
  is keyed on the selected object ids (`<previewId>:<sorted ids>`) so re-applying
  the **same** selection is idempotent while a **different** selection is a
  distinct run.
- **Future:** a ghost overlay of proposed positions can build on this layer
  without backend changes.

## UI flow

1. Admin clicks **Tidy layout** (admin-only; separate from the view toggle).
2. Preview dialog: a friendly, checkbox-per-suggestion list (all ticked by
   default), an "_X_ of _Y_ selected · _N_ objects" summary, warnings, and
   Cancel / **Apply selected**. A clean layout shows "already looks tidy" and
   disables Apply.
3. Apply → result summary: success / partial / failed, with per-operation
   details. **Undo applied** when `applied_count > 0`; **Retry failed** when
   `failed_count > 0`.
4. Members/read-only users never see Tidy/Undo/Retry.

## Manual QA checklist

See the PR description (admin / member / booking / failure sections). Key
invariants: the view toggle never persists; preview Cancel changes nothing; a
clean layout does not apply; partial success shows details and offers
retry/undo; undo restores only applied ops and persists across refresh.

## Remaining limitations / acceptable debt

- Single-level undo only (no full history stack).
- Preview is textual (no ghost overlay of the proposed positions).
- Reason codes are heuristic (type + changed fields), not per-rule provenance.
- Rotated-object boundary collision still uses the unrotated AABB (see PR 061 /
  TECHNICAL_DEBT).
- No backend bulk-transaction apply — by design (best-effort), per-op savepoints.

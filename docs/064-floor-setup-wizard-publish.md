# 064 — Floor setup wizard + draft/published lifecycle

Builds on PR 063 (Enhance/Tidy plan + preview). Turns floor editing into a
guided, responsive **setup wizard** and adds a real **draft → published**
lifecycle so only finished floors are bookable. Resolves **TD-046** (no
publish/draft state for floors).

## Lifecycle (backend)

`Floor.status` — `draft | published` (migration `0011`). **Default `published`**
so existing floors, seed data, and the ~580 existing tests stay bookable with no
data migration.

- Only **published** floors are bookable. The booking service raises
  `BookingFloorNotPublishedError` (HTTP 409) inside the locking transaction when
  a desk's floor is draft — drafts can't be booked even via a direct API call.
- Transitions go through the existing floor PATCH (`UpdateFloorSerializer` now
  accepts `status`), owner/admin-gated like the boundary edit. `status` is
  exposed on `FloorResponseSerializer`.
- The wizard publishes on **Finish** and unpublishes when the admin chooses to
  **Edit** a published floor (after a confirm). Existing bookings are kept.

## The wizard (frontend)

`features/layoutObjects/wizard/`:

- **`steps.ts` / `useFloorSetupSteps`** — the four guided steps
  (`build → openings → tidy → review`). Steps are **guidance, not gates**: any
  step is reachable at any time; step state is local UI only.
- **`FloorSetupStepper`** — responsive top progress bar: a clickable horizontal
  stepper on ≥ sm, a compact "Step X of Y · Label" with Back/Next on xs.
- **`EnhanceTidyPanel`** — the Tidy step's left-rail panel; reuses the PR 063
  `useEnhanceTidy` state verbatim (checkbox suggestions, Apply selected,
  undo/retry) — no new tidy logic.
- **`FloorReviewPanel`** — the Review step: status chip + Publish (draft) /
  Edit (published).
- **`FloorEditConfirmDialog`** — confirms unpublishing a live floor for editing.
- **`useFloorPublish`** — publish / unpublish + edit-confirm state, via
  `floorApi.setFloorStatus`.

### Flow in `FloorLayoutPage`

- The wizard is the default for managers; a **Free editing** toggle drops the
  stepper (and restores the modal Tidy + toolbar Tidy button). Members keep the
  existing read-only view — the wizard is manager-only.
- **Build** = the existing editor (object library + canvas + inspector), so the
  drag/transform/role-gate integration tests are unchanged.
- **Doors & windows** = library + guidance hint; openings are placed with the
  existing hover-to-place wall flow.
- **Tidy** = the left-rail `EnhanceTidyPanel`; the preview is computed on entry.
- **Review** = the canvas in **read-only isometric** (`enhanced` + editing off)
  with Publish/Edit. A published floor opens here on load.

## What was intentionally NOT done (kept simple / deferred)

- No deep Konva changes: the "doors & windows" step guides placement but does
  not add a wall-glow overlay (avoids destabilising the canvas). Deferred polish.
- Booking visibility in the booking UI still lists floors as before; the hard
  gate is the backend booking check. Hiding draft floors from the booking floor
  picker is a small follow-up.
- Single floor at a time; no multi-admin concurrency handling.

## Tests

- Backend: `test_floor_publish.py` — default published, publish/unpublish PATCH,
  member-forbidden, invalid status, booking blocked on draft (409), booking ok
  on published. Full backend suite green (584).
- Frontend: `useFloorSetupSteps`, `FloorSetupStepper`, `EnhanceTidyPanel`,
  `FloorReviewPanel`, `useFloorPublish`, `floorApi.setFloorStatus`; existing page
  + booking + boundary tests updated for the new `Floor.status` field.

## Manual QA

Admin: walk Build → Doors → Tidy → Review; publish; refresh and confirm status
persists; Edit (confirm) returns to Build and unpublishes; Free-editing toggle
restores the classic editor. Member: no wizard, read-only map. Booking: a draft
floor's desks cannot be booked (409); publishing makes them bookable.

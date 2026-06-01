# PR 044 — Backend Booking Data Integrity Hardening

## Purpose

This PR strengthens the booking backend before adding user-facing features such as My Bookings, dashboards, or notifications. It resolves four open data-integrity items (TD-003, TD-005, TD-006, TD-011) that were previously protected only at the serializer/view layer.

## Why This PR Exists

Prior to this PR:

- Booking validity (inactive desk, wrong status, mismatched FK fields) was enforced only in the view/serializer. A booking created via the Django admin, a management command, or directly via the ORM could violate these rules silently.
- Booking creation did not use row-level locking; two concurrent requests for the same desk could both pass pre-checks before either was persisted.
- Desk deactivation triggered booking cancellation only when driven through the API. A direct `desk.save()` (admin, script) left active bookings orphaned.

## Data Integrity Problems Addressed

### TD-003 — Guard Against Bookings on Inactive/Non-Available Desks

**Problem:** No model/service-level protection. The API checked `desk.is_active` and `desk.status`, but direct ORM usage bypassed these checks.

**Fix:** Added `DeskBooking.clean()` which asserts:
- `desk.is_active is True`
- `desk.status == Desk.Status.AVAILABLE`

The booking service (`create_booking_for_user`) also checks desk status *inside* the row-level lock before constructing the booking, and calls `booking.clean()` before `booking.save()`. The service layer's `Desk.objects.select_for_update().get(..., is_active=True)` ensures inactive desks raise `Desk.DoesNotExist` before any booking object is created.

### TD-005 — Denormalized FK Consistency

**Problem:** `DeskBooking` stores `organization`, `office`, and `floor` redundantly alongside `desk`. A manually constructed booking with mismatched FKs would corrupt queries that filter on these denormalized fields.

**Fix:** `DeskBooking.clean()` asserts:
- `booking.organization == booking.desk.organization`
- `booking.office == booking.desk.office`
- `booking.floor == booking.desk.floor`

The service derives these values from the URL/membership scope (not the request body), so normal API use always passes this check. The model-level guard protects non-API paths.

### TD-006 — select_for_update / Row-Level Locking

**Problem:** Booking creation ran pre-checks outside a row lock, leaving a TOCTOU window. Two concurrent requests could both pass the duplicate-booking pre-check and attempt to insert simultaneously. The second insert was caught by the DB unique constraint and converted to a 409, but the race window was wider than necessary.

**Fix:** Created `offices/services/booking_service.py` → `create_booking_for_user(...)`:

```python
with transaction.atomic():
    desk = Desk.objects.select_for_update().get(
        id=desk_id, floor=floor, office=office, organization=organization, is_active=True
    )
    # status check
    # duplicate pre-checks (inside the lock)
    booking = DeskBooking(...)
    booking.clean()
    booking.save()
```

The Desk row is locked before any pre-checks run. Concurrent booking attempts for the same desk are serialised. `IntegrityError` handling is kept as a last-resort race guard.

### TD-011 — Signal / Model-Level Cascade on Desk Soft Delete

**Problem:** `DeskDetailView.delete` cancelled active bookings with `cancelled_by=request.user`, but a direct `desk.save()` (admin, management command, script) that set `is_active=False` left active bookings intact.

**Fix:** Created `offices/signals.py` with two handlers on `Desk`:

1. **`pre_save`** — captures the current DB-persisted `is_active` value before the save (`_pre_save_is_active`).
2. **`post_save`** — if the transition `True → False` occurred, calls `cancel_active_bookings_for_desk(desk, cancelled_by=None)`.

`cancelled_by=None` indicates a system-driven cancellation (no request user). The API path continues to set `cancelled_by=request.user` explicitly *before* calling `desk.save()`; the signal fires afterwards but finds no `ACTIVE` bookings remaining — it is a safe no-op.

Signals are registered in `OfficesConfig.ready()`.

## Booking Service

New file: `offices/services/booking_service.py`

Functions:
- `create_booking_for_user(*, organization, office, floor, desk_id, user, booking_date)` — transactional booking creation with row-level lock.
- `cancel_active_bookings_for_desk(desk, *, cancelled_by=None)` — shared helper used by both the API and the signal.

Custom exceptions:
- `BookingDeskNotAvailableError` — raised when `desk.status != AVAILABLE`.
- `DuplicateBookingError(constraint)` — raised for duplicate pre-checks; `.constraint` is `"desk_date"` or `"user_org_date"`.

## API Compatibility

No API contract changes. All existing response shapes, status codes, and error messages are preserved:

| Scenario | Before | After |
|---|---|---|
| Create valid booking | 201 | 201 (unchanged) |
| Inactive desk | 404 | 404 (unchanged) |
| Unavailable/maintenance desk | 400 | 400 (unchanged) |
| Duplicate desk+date | 409 | 409 (unchanged) |
| Duplicate user+org+date | 409 | 409 (unchanged) |
| Cancel booking | same response shape | same response shape |
| API desk deactivation | 204, cancelled_by=user | 204, cancelled_by=user (unchanged) |

## Signal Limitations

- **Bulk queryset updates** (`Desk.objects.filter(...).update(is_active=False)`) do **not** trigger Django signals. Active bookings will not be cascade-cancelled by this PR's signal in that case.
- Any code path that bulk-updates `is_active` must explicitly call `cancel_active_bookings_for_desk()` or use the API/service layer.
- This limitation is documented in `offices/signals.py`.

## Tests

New test files:

### `test_desk_booking_model_validation.py`
- Valid booking passes `clean()`.
- Inactive desk rejected by `clean()`.
- Unavailable desk rejected by `clean()`.
- Maintenance desk rejected by `clean()`.
- Mismatched organization rejected.
- Mismatched office rejected.
- Mismatched floor rejected.
- Service rejects inactive desk (Desk.DoesNotExist path).
- Service rejects unavailable desk (BookingDeskNotAvailableError).
- Service rejects maintenance desk (BookingDeskNotAvailableError).
- Service creates valid booking.
- Service raises DuplicateBookingError("desk_date").
- Service raises DuplicateBookingError("user_org_date").

### `test_desk_booking_signals.py`
- Direct `desk.save()` active→inactive cancels active bookings.
- `cancelled_at` is populated.
- `cancelled_by` is None for signal-driven cancellation.
- Multiple active bookings all cancelled.
- Already-cancelled bookings unchanged.
- Active→active save does not cancel.
- `is_active=True` explicit save does not cancel.
- Inactive→inactive save is a no-op.
- `save(update_fields=["name"])` without `is_active` does not cancel.
- API deactivation still sets `cancelled_by=request.user`.

### Updated `test_desk_booking_create.py`
- Two IntegrityError mock tests updated to patch `DeskBooking.save` (the new save path in the service) instead of `DeskBooking.objects.create`.

## Manual Test Checklist

1. **Create booking on active available desk** → 201 created.
2. **Try booking inactive desk** → 404 not found.
3. **Try booking unavailable/maintenance desk** → 400 bad request.
4. **Try duplicate desk+date** → 409 conflict.
5. **Try duplicate user+org+date** → 409 conflict.
6. **Cancel booking and rebook same desk+date** → 201 allowed.
7. **Deactivate desk through API** → 204; active bookings cancelled with `cancelled_by=request.user`.
8. **Deactivate desk via `desk.is_active = False; desk.save()` in shell** → active bookings cancelled with `cancelled_by=None`.
9. **Bulk `Desk.objects.filter(...).update(is_active=False)`** → signal does NOT fire; document and use service/API instead.

## Files Changed

| File | Change |
|---|---|
| `offices/models.py` | Added `DeskBooking.clean()` |
| `offices/apps.py` | Wire `offices.signals` in `ready()` |
| `offices/signals.py` | New — `pre_save`/`post_save` handlers for Desk cascade |
| `offices/services/__init__.py` | New — package init |
| `offices/services/booking_service.py` | New — `create_booking_for_user`, `cancel_active_bookings_for_desk` |
| `offices/views.py` | Use booking service; use `cancel_active_bookings_for_desk` in desk delete |
| `offices/tests/test_desk_booking_model_validation.py` | New — 13 tests for clean() and service validation |
| `offices/tests/test_desk_booking_signals.py` | New — 11 tests for signal-driven cascade |
| `offices/tests/test_desk_booking_create.py` | Update 2 IntegrityError mock tests |
| `docs/044-booking-data-integrity-hardening.md` | This document |
| `docs/TECHNICAL_DEBT.md` | TD-003/005/006/011 moved to resolved |

## What This PR Does Not Include

- My Bookings page or any booking history UI.
- Booking dashboard or calendar view.
- Recurring or half-day bookings.
- Notifications or email alerts.
- Bulk queryset signal support (deferred — document-only limitation).
- TD-009 (`DeskBooking.user` on_delete=CASCADE → SET_NULL) — deferred to PR 045.
- TD-015 (throttle tests for booking endpoints) — deferred to PR 045.
- Frontend UI changes.

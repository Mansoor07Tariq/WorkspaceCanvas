# PR 045 — My Bookings View and Booking Request Hygiene

## Purpose

This PR delivers the My Bookings feature: a dedicated page at `/app/bookings/my` where users can view their own upcoming and past desk bookings and cancel any active one. Alongside the feature, three deferred technical debt items are resolved: the `DeskBooking.user` FK is switched from `CASCADE` to `SET_NULL` to preserve booking history on user deletion (TD-009), throttle tests are added for all booking endpoints (TD-015), and `AbortController`-based request hygiene is added to the booking hooks to prevent stale response races (TD-020).

## Changes

- **Backend My Bookings endpoint** — new `GET /api/bookings/my/` list endpoint returning the authenticated user's own bookings, scoped to their membership organisation; new `POST /api/bookings/my/{id}/cancel/` endpoint allowing the user to cancel one of their own active bookings.
- **TD-009: DeskBooking.user FK change to SET_NULL** — `DeskBooking.user` changed from `on_delete=CASCADE` to `on_delete=SET_NULL, null=True, blank=True`; migration generated; serializer extended to handle a null user with a `"Former user"` display value; booking history is preserved on user deletion.
- **TD-015: Throttle tests** — new `test_desk_booking_throttle.py` covering the `desk_booking_read` and `desk_booking_write` throttle scopes across all booking endpoints including the new my-bookings endpoints.
- **TD-020: AbortController request hygiene in hooks** — `useDeskBookings` and `useMyBookings` now create an `AbortController` per fetch; the signal is passed to the fetch call; stale (aborted) responses are dropped; the controller is aborted on unmount to prevent state updates on unmounted components.
- **Frontend My Bookings page** — new route `/app/bookings/my` rendering a `MyBookingsPage` component; uses `useMyBookings` hook; displays upcoming and past booking cards with cancel action for active bookings.

## Route

```
/app/bookings/my
```

Protected route — requires authentication. Accessible from the main bookings navigation.

## Backend Endpoint

### GET /api/bookings/my/

Returns a paginated list of the authenticated user's own bookings, ordered by `booking_date` descending then `created_at` descending.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Optional. Filter by booking status: `active`, `cancelled`. Omit for all. |
| `upcoming` | boolean | Optional. `true` returns only bookings with `booking_date >= today`. |
| `page` | integer | Optional. Pagination cursor. |

**Permissions:** `IsAuthenticated`. Users may only see their own bookings. Admins and owners use the general booking list endpoint for organisation-wide views.

**Response shape:**

```json
{
  "count": 12,
  "next": "...",
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "desk": { "id": "uuid", "code": "D-01", "name": "Window Desk" },
      "floor": { "id": "uuid", "name": "Ground Floor" },
      "office": { "id": "uuid", "name": "Main Office" },
      "booking_date": "2026-06-10",
      "status": "active",
      "created_at": "2026-06-01T09:00:00Z",
      "cancelled_at": null,
      "cancelled_by": null
    }
  ]
}
```

### POST /api/bookings/my/{id}/cancel/

Cancels the specified booking if it belongs to the authenticated user and is currently active.

**Permissions:** `IsAuthenticated`. The booking must belong to `request.user`. Admins cannot use this endpoint to cancel other users' bookings — the general cancel endpoint handles that.

**Response:** `200 OK` with the updated booking object. Returns `403` if the booking does not belong to the requesting user. Returns `400` if the booking is already cancelled.

## Privacy Behavior

- The My Bookings endpoint applies a hard filter: `queryset.filter(user=request.user)`. No booking from another user can appear in the response regardless of organisation membership.
- Membership scoping: the queryset is additionally filtered by `organization=request.user.membership.organization` to prevent cross-tenant data leakage in edge cases where a user's ID appears across tenants.
- Null user handling: if `booking.user` is `None` (user was deleted, TD-009 SET_NULL behaviour), the serializer returns `"user_name": "Former user"` and `"user": null`. This value is display-only and never used for identity decisions. The null case cannot appear in the My Bookings endpoint by definition (a null-user booking has no authenticated owner to request it), but the serializer handles it consistently for admin and general list views.

## User Deletion Behavior (TD-009)

**Before this PR:** `DeskBooking.user = ForeignKey(..., on_delete=CASCADE)`. Deleting a user account silently deleted all of their booking records, permanently destroying audit trail, desk utilisation analytics, and any "booked by" context visible to admins.

**After this PR:** `DeskBooking.user = ForeignKey(..., null=True, blank=True, on_delete=SET_NULL)`.

- Deleting a user sets `booking.user = NULL` on all their bookings via the DB-level `SET_NULL` cascade. No application code is required.
- A migration is generated to apply `null=True` to the column and change the FK constraint.
- The serializer's `_can_see_identity` method already handles the `request.user == booking.user` path; null user falls through to the masked display (`"Former user"`) for all viewer roles.
- Booking history (booking date, desk, floor, office, status, cancelled_at) is fully preserved. Only the direct user FK is nulled.
- Django admin and analytics queries that previously relied on `booking.user` being non-null must now handle `None`; this is documented with inline comments in the serializer.

## Request Hygiene (TD-020)

**Problem:** `useDeskBookings` and `useMyBookings` (and other booking hooks) issued a new `fetch` on every dependency change (floor, date, mount) without cancelling the previous in-flight request. A user navigating quickly could receive responses out of order.

**Fix:** Each hook creates an `AbortController` at the start of the effect:

```typescript
const controller = new AbortController();
fetchDesks({ signal: controller.signal }).then((data) => {
  if (controller.signal.aborted) return;   // drop stale response
  setDesks(data);
});
return () => controller.abort();           // cancel on unmount or re-run
```

- The `signal` is passed through the `bookingApi` layer to the underlying `fetch` call.
- If the component unmounts before the response arrives, `controller.abort()` fires in the cleanup function; the `signal.aborted` guard inside the `.then()` prevents a state update on an unmounted component.
- If the effect re-runs (dependency change) before the previous fetch resolves, the cleanup function from the previous run aborts the stale request.
- This pattern is applied consistently in `useDeskBookings` and `useMyBookings`; the same approach is recommended for any future booking hooks.

## Throttle Tests (TD-015)

**Problem:** The booking `create` and `cancel` endpoints and the new `my-bookings` endpoints use DRF `ScopedRateThrottle`, but no test verified that the throttle actually triggers a `429` response when the limit is exceeded.

**New test file:** `offices/tests/test_desk_booking_throttle.py`

**Tests (5):**

| Test | Scope | Description |
|------|-------|-------------|
| `test_desk_booking_write_throttle_create` | `desk_booking_write` | Overrides limit to `2/min`; fires 3 create requests; asserts third returns `429` |
| `test_desk_booking_write_throttle_cancel` | `desk_booking_write` | Same limit override; fires 3 cancel requests; asserts third returns `429` |
| `test_desk_booking_read_throttle_list` | `desk_booking_read` | Overrides limit to `1/min`; fires 2 list requests; asserts second returns `429` |
| `test_desk_booking_read_throttle_detail` | `desk_booking_read` | Same read limit override on detail endpoint; asserts second request `429` |
| `test_my_bookings_read_throttle` | `desk_booking_read` | Overrides limit to `1/min` on `/api/bookings/my/`; asserts second request `429` |

`override_settings` is used to set `DESK_BOOKING_READ_RATE` and `DESK_BOOKING_WRITE_RATE` to low limits (`1/min`, `2/min`) for test isolation. The throttle cache is cleared between tests via `cache.clear()` to prevent inter-test pollution.

## Tests and Checks

| Check | Result |
|-------|--------|
| Ruff lint (backend) | Pass |
| Django system check (`manage.py check`) | Pass |
| Django migration check (`--check`) | Pass |
| Backend test suite (`pytest`) | Pass — all existing tests green; new tests green |
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint (frontend) | Pass |
| Vite build | Pass |
| Frontend test suite (`vitest`) | Pass |

## Manual Test Checklist

1. Log in as a member user who has made bookings. Navigate to `/app/bookings/my`. Verify own bookings appear with correct desk, floor, office, date, and status.
2. Verify bookings from other users do not appear on the My Bookings page.
3. Cancel an active booking from the My Bookings page. Verify status updates to `cancelled` in the list immediately (optimistic or re-fetch).
4. Attempt to cancel an already-cancelled booking. Verify the cancel action is disabled or returns an appropriate error.
5. Navigate rapidly between `/app/bookings` and `/app/bookings/my`. Verify no console errors about state updates on unmounted components.
6. Open DevTools Network tab; navigate away before a slow request resolves (throttle in DevTools if needed). Verify the stale request is aborted (status: cancelled in Network tab) and no stale data appears.
7. Delete a user account via Django admin. Verify that user's bookings still exist in the database with `user = NULL`. Verify the booking appears in the admin booking list as `"Former user"`.
8. As the deleted user's admin, view the booking list. Verify `"Former user"` is shown in the `user_name` field and no identity leak occurs.
9. Trigger the booking write throttle: send more than the configured `DESK_BOOKING_WRITE_RATE` create requests within a minute. Verify `429 Too Many Requests` is returned.
10. Trigger the booking read throttle on the My Bookings endpoint. Verify `429` is returned after the limit is exceeded.

## What Is Not Included

- Recurring bookings (daily, weekly, multi-day ranges).
- Calendar view or date-range picker for My Bookings.
- Booking approval workflow (manager must approve before a booking is confirmed).
- Email or push notifications on booking confirmation or cancellation.
- Admin booking management UI (bulk cancel, booking dashboard).
- Bulk queryset signal support for desk deactivation (documented limitation from PR 044).
- Soft-delete for user accounts (SET_NULL is the chosen approach; soft-delete is a separate architectural decision).

## Deferred Items

The following technical debt items remain open after this PR:

| ID | Summary | Target |
|----|---------|--------|
| TD-019 | `FloorLayoutPage` is 477 lines; `useCanvasInteractions` extraction deferred | PR 046 |
| TD-021 | No TTL-based caching between route navigations in feature hooks | Future milestone |
| TD-032 | No unit test verifying `LayoutObjectCanvasNode` fill/stroke props from `getAvailabilityCanvasStyle` | PR 046 |
| TD-033 | `DeskBookingPage.test.tsx` has no integration test for the floor-selection path | PR 046 |
| TD-034 | `AvailabilityMapLegend` visual disconnect on narrow viewports | Future UX pass |

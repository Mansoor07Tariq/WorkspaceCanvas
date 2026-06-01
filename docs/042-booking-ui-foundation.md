# PR 042 — Booking UI Foundation

## Purpose

Wire the previously-dead bookings feature slice into a live production page. This PR introduces `DeskBookingPage` at `/app/bookings`, replacing the `ComingSoonPage` placeholder. Users can now select an office and floor, pick a date, view desk availability, book an available desk, and cancel their own booking.

---

## Route

**`/app/bookings`** — protected route; requires an authenticated user with a completed profile.

---

## User Flow

1. User navigates to `/app/bookings` via the sidebar "Desk Booking" link.
2. User selects an **Office** from the dropdown (populated via `useOffices`).
3. User selects a **Floor** within that office (populated via `useFloors`).
4. User picks a **Booking Date** (defaults to today; min-clamped to today).
5. The page fetches desks, layout objects, and bookings for the selected floor and date.
6. **Summary cards** display counts by status (Available, Reserved, Unavailable) and a "Your booking" card if the user has an active booking on that date.
7. The **availability list** shows one card per desk, sorted: Your booking → Available → Reserved → Unavailable.
8. Clicking a card selects it and populates the **detail panel** on the right.
9. Clicking **Book** on an available desk (or in the panel) creates a booking via `createDeskBooking`.
10. Clicking **Cancel booking** on a `bookedByMe` desk cancels it via `cancelDeskBooking`.
11. Success and error feedback is shown inline; success banners auto-dismiss after 3 seconds.

---

## Desk Availability Statuses

| Status | Condition | Label |
|--------|-----------|-------|
| `available` | Desk is active, status is `available`, no active booking | "Available" |
| `reserved` | Active booking exists by another user (`is_mine === false`) | "Reserved" |
| `bookedByMe` | Active booking exists and `is_mine === true` | "Your booking" |
| `unavailable` | Desk `is_active === false`, or `status === "maintenance"` / `"unavailable"` | "Unavailable" |

---

## Date Handling

- Default date is computed at module scope via `getTodayLocalDate()` using the JS `Date` class (local time, no timezone conversion).
- The date picker is min-clamped to today; past dates cannot be selected via the native UI.
- When the date or floor changes the booking list is refreshed automatically via `useDeskBookings`.

---

## Privacy

Bookings from other users appear as "Reserved" with no identity information exposed in the UI. The `is_mine` field from the API controls whose bookings show the cancel action. This matches the backend privacy model (non-owner members see `user_name: "Reserved"`).

Reserved booking objects are sanitized in the availability pipeline. In `buildDeskAvailability`, any booking where `is_mine === false` is not attached to the `DeskAvailabilityItem.booking` field. Only `bookedByMe` items carry the full booking object (needed for the cancel action). This means another user's `user`, `user_name`, `user_id`, or any other identity field is never reachable via the `DeskAvailabilityItem` type in any component.

---

## Error Handling

`extractBookingError(err)` inspects API errors in priority order:

1. `err.response.data.detail` string
2. `err.response.data.non_field_errors` array joined with spaces
3. HTTP 409 → "This desk is already booked for this date."
4. HTTP 403 → "You do not have permission to book this desk."
5. `err.message`
6. Fallback: "An unexpected error occurred."

---

## Components

| File | Description |
|------|-------------|
| `bookingAvailability.ts` | Pure utility: `buildDeskAvailability`, `getMyBookingForDate`, `countAvailability`, `canBookDesk` |
| `useBookingAvailability.ts` | `useMemo` hook wrapping the pure utility; returns `items`, `counts`, `myBooking` |
| `BookingDateSelector.tsx` | MUI `TextField` type=date with min-date clamping and error display |
| `BookingSummaryCards.tsx` | Row of MUI Cards showing Available / Reserved / Unavailable counts, plus optional "Your booking" card |
| `DeskAvailabilityCard.tsx` | MUI Card per desk with status Chip, Book button (available + canBook), Cancel button (bookedByMe) |
| `DeskAvailabilityList.tsx` | Sorted grid of `DeskAvailabilityCard`; empty-state text when no desks |
| `SelectedDeskBookingPanel.tsx` | MUI Paper detail panel; shows desk details, date, status, and Book/Cancel actions with inline alerts |
| `DeskBookingPage.tsx` | Page orchestrator: office/floor/date selects, summary cards, availability list, detail panel |

---

## Tests

| File | Coverage |
|------|----------|
| `bookingAvailability.test.ts` | 10 tests: all four statuses, inactive desk, maintenance desk, cancelled booking ignored, `getMyBookingForDate`, `countAvailability`, `canBookDesk` edge cases |
| `BookingDateSelector.test.tsx` | Renders, onChange fires, error text, disabled state |
| `BookingSummaryCards.test.tsx` | Shows counts, myBooking card rendered/omitted |
| `DeskAvailabilityCard.test.tsx` | Book button for available, Cancel for bookedByMe, no action for reserved, click handlers |
| `DeskAvailabilityList.test.tsx` | Empty state, card per item, aria-label, sort order |
| `DeskBookingPage.test.tsx` | Smoke test: heading, selects, date input, empty prompt |

---

## Not Included

- **Canvas availability colours**: floor map canvas does not overlay availability status on desk shapes (tracked as TD-031).
- **Past date viewing**: the date picker min-clamps to today; viewing historical bookings is not supported.
- **Admin/manager view**: no elevated identity visibility in this UI; all non-mine bookings show as "Reserved".
- **Recurring bookings**: single-date bookings only.
- **Booking notifications**: no email or push notification triggers from the frontend.

---

## Manual Test Checklist

1. Navigate to `/app/bookings` — page loads, heading "Desk Booking" is visible.
2. Select an office from the dropdown — floor selector becomes active.
3. Select a floor — desk list loads with availability statuses.
4. Verify date defaults to today in YYYY-MM-DD format.
5. Click an available desk — it becomes selected, detail panel shows Book button.
6. Click Book — booking succeeds, success message appears, desk shows as "Your booking".
7. Try clicking Book on a second available desk for the same date — Book button is not shown (existing booking blocks it).
8. Click Cancel on your booking — success message appears, desk returns to Available.
9. Observe a reserved desk — label shows "Reserved", no other user's name or email is visible anywhere on the page.
10. Select a past date — date input restricts to today's minimum; Book action is not possible.
11. Select a floor with no desks — empty state message shown in the desk list.

---

## Deferred Items

| ID | Description | Target PR |
|----|-------------|-----------|
| TD-031 | Canvas availability badge colouring (desk shapes coloured by status on the floor map) | PR 043 |
| TD-003 | Backend: no cascade-cancel on desk deactivation outside the API view path | PR 043 (targeted at PR 042 but deferred) |
| TD-005 | Backend: `DeskBooking` denormalization has no DB-level referential check | PR 043 (targeted at PR 042 but deferred) |
| TD-006 | Backend: no `select_for_update()` in booking creation | PR 043 (targeted at PR 042 but deferred) |
| TD-011 | Backend: no signal-based cascade when desk is soft-deleted outside API path | PR 043 (targeted at PR 042 but deferred) |
| TD-020 | No request deduplication in feature hooks | PR 043 |

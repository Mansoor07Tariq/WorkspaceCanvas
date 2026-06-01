# PR 040 — Desk Booking Model and API Foundation

## Purpose

Introduce the `DeskBooking` domain model and a complete CRUD-like booking API
that allows authenticated members to book desks by date, view floor-level
bookings, and cancel reservations — while preventing double-booking through
database-level partial unique constraints and business rule validation.

---

## Why This PR Exists

Desks were modelled and exposed via the API in PR 039, but there was no way to
reserve one. This PR closes that gap by adding:

- A date-based `DeskBooking` model (one booking per desk per calendar date).
- Four REST endpoints nested under offices/floors (not under individual desks).
- Privacy-aware serialization that hides identity from regular members.
- A frontend API layer, hook, and validation utilities ready for the booking UI.

The deliberate choice to use a plain `DateField` rather than `start_time` /
`end_time` fields reflects the product decision that bookings are full-day only
for this release. Time-range and half-day support are explicitly deferred.

---

## DeskBooking Model

### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | AutoField | Primary key |
| `organization` | ForeignKey → Organization | on_delete=CASCADE |
| `office` | ForeignKey → Office | on_delete=CASCADE |
| `floor` | ForeignKey → Floor | on_delete=CASCADE |
| `desk` | ForeignKey → Desk | on_delete=PROTECT |
| `user` | ForeignKey → User | on_delete=CASCADE; the person who booked |
| `booking_date` | DateField | Calendar date of the booking (no time component) |
| `status` | CharField(20) | Choices: `active`, `cancelled`; default `active` |
| `cancelled_at` | DateTimeField | Nullable; set when status transitions to cancelled |
| `cancelled_by` | ForeignKey → User | Nullable; on_delete=SET_NULL; who performed the cancellation |
| `created_at` | DateTimeField | auto_now_add |
| `updated_at` | DateTimeField | auto_now |

### Status Choices

| Value | Display |
|---|---|
| `active` | Active |
| `cancelled` | Cancelled |

### Meta

- **ordering**: `["-booking_date", "created_at"]`
- **indexes** (5 composite):
  1. `(organization, booking_date, status)`
  2. `(office, booking_date, status)`
  3. `(floor, booking_date, status)`
  4. `(desk, booking_date, status)`
  5. `(user, booking_date, status)`
- **constraints** (2 partial unique):
  1. `unique_active_booking_per_desk_date` — UNIQUE `(desk, booking_date)` WHERE `status='active'`
  2. `unique_active_booking_per_user_org_date` — UNIQUE `(organization, user, booking_date)` WHERE `status='active'`

### on_delete Summary

| FK | on_delete |
|---|---|
| organization | CASCADE |
| office | CASCADE |
| floor | CASCADE |
| desk | PROTECT |
| user | CASCADE |
| cancelled_by | SET_NULL |

---

## Date-Based Booking Rules

- One active booking per desk per calendar date (enforced by DB constraint + application check).
- One active booking per user per organisation per calendar date (enforced by DB constraint + application check).
- `booking_date` cannot be in the past (validated in serializer).
- `booking_date` cannot be more than 365 days in the future (validated in serializer).
- The target desk must have `is_active=True` (enforced via queryset filter; returns 404 if not found).
- The target desk must have `status='available'` (validated in serializer; returns 400 otherwise).
- No time ranges — bookings are always full calendar-day.
- No recurring bookings.
- No half-day bookings.

---

## Status Lifecycle

```
active ──cancel──▶ cancelled
```

- A booking is created with `status='active'`.
- The only allowed transition is `active → cancelled` via the cancel endpoint.
- Cancellation is always soft: the row is retained with `status='cancelled'`,
  `cancelled_at` set to the current UTC timestamp, and `cancelled_by` set to
  the user who performed the action.
- Hard delete of bookings is not supported.
- A cancelled booking does not block a new active booking for the same
  desk+date combination (the partial unique constraint only covers active rows).

---

## API Endpoints

All endpoints require authentication and an active organisation membership.

### 1. List Floor Bookings

**GET** `/api/offices/{office_id}/floors/{floor_id}/bookings/?date=YYYY-MM-DD`

- **Auth required**: Yes
- **Request params**: `date` (query string, mandatory, format `YYYY-MM-DD`)
- **Response**: Array of booking objects for the given floor and date
- **Privacy**: Members see `user_name="Reserved"` and `user=null` for bookings
  that do not belong to them; admins and owners see full identity for all bookings.
- **Status codes**:
  - `200 OK` — success
  - `400 Bad Request` — `date` param missing or invalid format
  - `401 Unauthorized` — not authenticated
  - `404 Not Found` — office or floor not found / not in resolved org

### 2. Create Booking

**POST** `/api/offices/{office_id}/floors/{floor_id}/bookings/`

- **Auth required**: Yes
- **Request body**: `{ "desk": <int>, "booking_date": "YYYY-MM-DD" }`
- **Response**: Created booking object
- **Status codes**:
  - `201 Created` — booking created
  - `400 Bad Request` — validation error (past date, date too far ahead, desk unavailable, etc.)
  - `401 Unauthorized`
  - `404 Not Found` — office, floor, or desk not found / not in resolved org
  - `409 Conflict` — duplicate active booking for the same desk+date or same user+org+date

### 3. Get Booking Detail

**GET** `/api/offices/{office_id}/floors/{floor_id}/bookings/{booking_id}/`

- **Auth required**: Yes
- **Response**: Single booking object
- **Privacy**: Same identity-masking rules as the list endpoint.
- **Status codes**:
  - `200 OK`
  - `401 Unauthorized`
  - `404 Not Found` — booking not found on this floor

### 4. Cancel Booking

**POST** `/api/offices/{office_id}/floors/{floor_id}/bookings/{booking_id}/cancel/`

- **Auth required**: Yes
- **Request body**: empty / no body required
- **Response**: Updated booking object with `status='cancelled'`
- **Status codes**:
  - `200 OK` — booking cancelled
  - `400 Bad Request` — booking is already cancelled
  - `401 Unauthorized`
  - `403 Forbidden` — member attempting to cancel another user's booking
  - `404 Not Found` — booking not found on this floor (or already cancelled when resolved via active-only queryset)

---

## Request / Response Shapes

### Create Request Body

```json
{
  "desk": 123,
  "booking_date": "2026-06-01"
}
```

### Full Response Object

```json
{
  "id": 1,
  "organization": 1,
  "office": 2,
  "floor": 3,
  "desk": 4,
  "desk_name": "Desk A1",
  "desk_code": "A1",
  "layout_object": 10,
  "user": 99,
  "user_name": "Mansoor Tariq",
  "is_mine": true,
  "booking_date": "2026-06-01",
  "status": "active",
  "status_display": "Active",
  "cancelled_at": null,
  "cancelled_by": null,
  "created_at": "...",
  "updated_at": "..."
}
```

### Response for Member Viewing Another User's Booking

```json
{
  "id": 1,
  "organization": 1,
  "office": 2,
  "floor": 3,
  "desk": 4,
  "desk_name": "Desk A1",
  "desk_code": "A1",
  "layout_object": 10,
  "user": null,
  "user_name": "Reserved",
  "is_mine": false,
  "booking_date": "2026-06-01",
  "status": "active",
  "status_display": "Active",
  "cancelled_at": null,
  "cancelled_by": null,
  "created_at": "...",
  "updated_at": "..."
}
```

`user` and `cancelled_by` IDs are omitted (set to `null`) for privacy.
Email is never exposed in any API response.

---

## Permission Rules

| Role | List | Create | Detail | Cancel Own | Cancel Any |
|---|---|---|---|---|---|
| Unauthenticated | 401 | 401 | 401 | 401 | 401 |
| Active member | 200 (masked) | 201 | 200 (masked) | 200 | 403 |
| Admin / Owner | 200 (full) | 201 | 200 (full) | 200 | 200 |

- Membership must be active; inactive memberships are treated as unauthenticated.
- "Admin" and "Owner" roles see full user identity in all booking responses.
- Regular members see their own bookings in full; other members' bookings are
  masked (`user_name="Reserved"`, `user=null`).

---

## Tenant Isolation

- All endpoints resolve the organisation through the requesting user's active membership.
- The office is resolved with `get_office_for_membership()`, which ensures the office belongs to the resolved org.
- The floor must belong to the resolved office.
- On create, the desk must belong to the resolved floor, office, and organisation (all three checked).
- On detail and cancel, the booking must belong to the resolved floor.
- URL-derived values (`organization`, `office`, `floor`) cannot be overridden via the request body.
- `user` is always set to `request.user`; any `user` field in the request body is ignored.
- **Known limitation**: `get_first_active_membership()` resolves the alphabetically-first
  active organisation for users who hold memberships in multiple organisations.
  This is a pre-existing limitation shared with other endpoints and is not
  introduced by this PR.

---

## Validation Rules

### Create

| Condition | HTTP Code |
|---|---|
| `desk` field missing | 400 |
| `booking_date` field missing | 400 |
| `booking_date` not in `YYYY-MM-DD` format | 400 |
| `booking_date` is in the past | 400 |
| `booking_date` is more than 365 days in the future | 400 |
| Desk does not exist on the URL floor (or is inactive) | 404 |
| Desk `status` is not `available` | 400 |
| Duplicate active booking for same desk + date | 409 |
| Duplicate active booking for same user + org + date | 409 |
| Race condition: `IntegrityError` on insert | 409 (caught and re-raised) |

### Cancel

| Condition | HTTP Code |
|---|---|
| Booking not found on URL floor | 404 |
| Booking `status` is already `cancelled` | 400 |
| Member attempting to cancel another user's booking | 403 |

---

## Database Constraints

Two partial unique constraints prevent double-booking at the database level,
providing a safety net independent of application-layer validation:

1. **`unique_active_booking_per_desk_date`**
   `UNIQUE (desk_id, booking_date) WHERE status = 'active'`
   Prevents two active bookings for the same desk on the same date.

2. **`unique_active_booking_per_user_org_date`**
   `UNIQUE (organization_id, user_id, booking_date) WHERE status = 'active'`
   Prevents a user from holding two active bookings within the same organisation
   on the same date.

Cancelled bookings are excluded from both constraints, so rebooking after a
cancellation is always permitted.

---

## Database Indexes (5 Composite)

All indexes follow the pattern `(scope_field, booking_date, status)` to
optimise the most common query: "give me all active bookings for X on date Y".

1. `(organization, booking_date, status)`
2. `(office, booking_date, status)`
3. `(floor, booking_date, status)`
4. `(desk, booking_date, status)`
5. `(user, booking_date, status)`

---

## Privacy Decision

- `user_name` is shown in full to the booking owner and to org admins/owners.
- For regular members viewing another user's booking: `user_name="Reserved"`,
  `user=null`, `cancelled_by=null`.
- Email addresses are never included in any API response field.
- `is_mine` (boolean) is always present so client code can render "My booking"
  vs "Reserved" without needing to compare user IDs.
- `cancelled_by` is stored in the model and visible to admins/owners, but
  its ID is hidden from regular members.

---

## Frontend API Foundation

All files live under `frontend/src/features/bookings/`.

### Types — `booking.types.ts`

```typescript
export type DeskBookingStatus = "active" | "cancelled";

export interface DeskBooking {
  id: number;
  organization: number;
  office: number;
  floor: number;
  desk: number;
  desk_name: string;
  desk_code: string;
  layout_object: number | null;
  user: number | null;
  user_name: string;
  is_mine: boolean;
  booking_date: string;        // "YYYY-MM-DD"
  status: DeskBookingStatus;
  status_display: string;
  cancelled_at: string | null;
  cancelled_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeskBookingPayload {
  desk: number;
  booking_date: string;        // "YYYY-MM-DD"
}

export type CancelDeskBookingResponse = DeskBooking;
```

### API Functions — `api/bookingApi.ts`

| Function | Signature | Returns |
|---|---|---|
| `listFloorBookings` | `(officeId, floorId, date)` | `Promise<DeskBooking[]>` |
| `createDeskBooking` | `(officeId, floorId, payload)` | `Promise<DeskBooking>` |
| `getDeskBooking` | `(officeId, floorId, bookingId)` | `Promise<DeskBooking>` |
| `cancelDeskBooking` | `(officeId, floorId, bookingId)` | `Promise<CancelDeskBookingResponse>` |

All functions derive the base URL as
`/api/offices/{officeId}/floors/{floorId}/bookings/`.

### Hook — `hooks/useDeskBookings.ts`

```typescript
useDeskBookings(officeId: number, floorId: number, date: string)
// Returns: { bookings: DeskBooking[], loading: boolean, error: string | null, refresh: () => void }
```

- Cancellable effect using `AbortController` / cancellation flag.
- Tick-based refresh counter (`refresh()` increments tick → effect re-runs).
- Follows the same pattern as `useDesks`.

### Validation Utilities — `utils/bookingValidation.ts`

| Function | Description |
|---|---|
| `isValidBookingDate(dateStr)` | Returns `true` if `dateStr` is a valid `YYYY-MM-DD` string with a real calendar date |
| `todayLocalDate()` | Returns the local machine date as `YYYY-MM-DD` |
| `isPastBookingDate(dateStr)` | Returns `true` if `dateStr` is strictly before today (local) |
| `formatBookingDate(dateStr)` | Returns a human-readable locale string (e.g. "Monday, 1 June 2026") |

---

## Tests

### Backend

| File | Scenarios |
|---|---|
| `test_desk_booking_list.py` | 13 (happy path, missing/invalid date, cross-org, floor mismatch, unauthenticated, member privacy masking, admin full identity, …) |
| `test_desk_booking_create.py` | 22 (happy path, past date, future date limit, duplicate desk+date, duplicate user+org+date, race condition mock, inactive desk, unavailable desk, cross-org desk, wrong floor desk, …) |
| `test_desk_booking_cancel.py` | 16 (happy path own, admin cancels other, member refuses other, already cancelled, not found, booking on wrong floor, …) |

### Frontend

| File | Coverage |
|---|---|
| `__tests__/bookingApi.test.ts` | URL construction, payload serialisation, response parsing for all four API functions |
| `__tests__/bookingValidation.test.ts` | All four utility functions including edge cases (leap year, end of year, invalid strings) |

---

## CI Checks

| Check | Result |
|---|---|
| Ruff | Pass |
| Django check | Pass |
| Migration check | Pass |
| pytest (booking) | Pass |
| vitest (bookings) | Pass |
| TypeScript | Pass |
| ESLint | Pass |
| Build | Pass |

---

## Manual API Checklist

1. Create booking for tomorrow → `201 Created`
2. Create same desk + date again → `409 Conflict`
3. Create different desk, same user + date → `409 Conflict`
4. Create with past date → `400 Bad Request`
5. Create on desk with `status='unavailable'` → `400 Bad Request`
6. Create on desk with `status='maintenance'` → `400 Bad Request`
7. List floor bookings for date → `200 OK`, array of booking objects
8. Cancel own booking → `200 OK`, `status='cancelled'`
9. List again for same date → cancelled booking absent from results
10. Rebook same desk + date after cancel → `201 Created`
11. Member attempts to cancel another user's booking → `403 Forbidden`
12. Admin cancels another user's booking → `200 OK`
13. Cross-org desk booking attempt → `404 Not Found`
14. Desk on wrong floor → `404 Not Found`
15. Unauthenticated request → `401 Unauthorized`

---

## What This PR Does NOT Include

- Booking calendar UI (date picker, calendar grid)
- Map-based booking (click a desk on the canvas to book it)
- Availability colour-coding on the canvas
- Upcoming bookings dashboard / My Bookings page
- Recurring bookings
- Half-day bookings
- Booking approval workflow
- Email or push notifications
- Check-in / QR code scanning
- Meeting room booking
- Admin booking management UI
- Waitlist / queue for fully-booked dates

---

## Deferred Items

| Item | Reason for deferral |
|---|---|
| Booking calendar UI | Needs canvas integration design decision first |
| Map-based booking | Requires canvas click-event → booking flow design |
| Availability colour-coding | Depends on canvas layer architecture (PR 04x) |
| Upcoming bookings dashboard | Separate UI feature, not part of API foundation |
| Recurring bookings | Product scope decision required; increases constraint complexity |
| Half-day bookings | Requires time-range model change; out of scope for this release |
| Approval workflow | Requires notification infrastructure not yet present |
| Email / push notifications | Notification service not yet implemented |
| Check-in / QR code | Hardware / mobile integration; separate workstream |
| Meeting room booking | Different resource type; separate model needed |
| Admin booking management UI | Admin panel work; separate PR |
| Waitlist | Product design for waitlist UX not yet specified |

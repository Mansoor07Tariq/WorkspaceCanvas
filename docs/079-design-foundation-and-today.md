# 079 — Design Foundation, the Today screen, and the booking-identity rule

This PR introduces the pine/porcelain design system (tokens + MUI theme + self-hosted
Fraunces/Manrope), a renamed app shell, the **Today** home screen, and one backend rule
change. This note records the backend rule; the frontend is documented inline + in the
review file.

## Booking-identity masking rule (changed in this PR)

Single source of truth: `offices/serializers.py` → `_IdentityMaskingMixin._can_see_identity`.

**New rule:** the identity on a booking (the occupant's `user`, `user_name`, and
`cancelled_by`) is visible to **any active member of the booking's organization**.
Colleagues in the same org see each other's names/avatars on the floor map and lists.

The `"Reserved"` mask now applies **only** to a viewer who is *not* an active member of
the booking's organization. Two adjacent cases are unchanged: the Django **admin shell**
(no request in context) sees identity, and a **deleted** occupant renders as
`"Former user"`.

**Old rule (before this PR):** identity was visible only to the booking's owner, a
manager/admin, or the admin shell; every other viewer — including same-org colleagues —
saw `"Reserved"`.

### Why this is safe

Every HTTP endpoint that returns *other* people's bookings already resolves the office
only within the caller's own active organizations (`get_office_for_user`), so a
non-member is turned away with a `404` **before** the serializer runs. The mask is
therefore a defensive backstop for any future endpoint that might hand a booking to a
non-member — pinned directly at the serializer by
`test_non_member_identity_still_masked_at_serializer`.

### Performance

`_can_see_identity` uses the viewer's membership already resolved by the list/detail
views (`context["membership"]`) as a zero-query fast path; the fallback membership lookup
is memoised per organization on the shared serializer context, so a floor list of N
bookings never becomes an N+1 (pinned by the query-count tests in
`test_desk_booking_list.py`).

### The Teams bot

The chat bot is **not** affected: `ServiceGlue._handle_read` reads only the linked user's
**own** bookings (`list_my_desk_bookings(user=…)`) and formats them as plain text — it
never goes through the masking serializers and never shows another person's identity. If a
future bot command ever reads colleagues' bookings through the shared services/serializers,
it inherits this rule automatically.

### Tests updated (deliberately)

- `test_desk_booking_detail.py::test_member_retrieves_other_booking_anonymized` →
  `test_member_sees_other_booking_identity` (same-org member now sees name + `user`).
- `test_desk_booking_detail.py::test_cancelled_by_not_exposed_to_non_owner_member` →
  `test_cancelled_by_exposed_to_same_org_member`.
- `test_desk_booking_list.py::test_member_sees_anonymized_user_for_others` →
  `test_member_sees_identity_for_others`.
- `test_desk_booking_list.py::test_member_cannot_see_cancelled_by_for_others` →
  `test_member_sees_cancelled_by_for_others`.
- `test_meeting_rooms.py::test_member_sees_reserved_for_others` →
  `test_member_sees_identity_for_others`.
- **Added** `test_desk_booking_detail.py::test_non_member_identity_still_masked_at_serializer`
  (the backstop). Owner/admin/`Former user`/cross-org-404 tests are unchanged.

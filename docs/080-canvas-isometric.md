# 080 — Isometric Canvas (asset pipeline, manifest, and the booking-identity rule)

This PR replaces the plain styled boxes on the floor map with the owner's isometric
artwork, everywhere the map is *viewed*. It ships in slices (B1 pipeline/manifest → B1.5
backend masking → B2 desks live → B3 rooms → B4 the rest). This note records the backend
rule that B1.5 brings in; the frontend is documented inline + in the review files.

## Booking-identity masking rule (B1.5 — lifted from PR 079)

Single source of truth: `offices/serializers.py` → `_IdentityMaskingMixin._can_see_identity`.

**Rule:** the identity on a booking (the occupant's `user`, `user_name`, and
`cancelled_by`) is visible to **any active member of the booking's organization**.
Colleagues in the same org see each other's names/avatars — the canvas needs this to draw
faces on booked desks. The `"Reserved"` mask now applies **only** to a viewer who is *not*
an active member of the booking's org. Unchanged: the Django **admin shell** (no request)
sees identity, and a **deleted** occupant renders as `"Former user"`.

**Old rule (before this change):** identity was visible only to the owner, a manager/admin,
or the admin shell; every other viewer — including same-org colleagues — saw `"Reserved"`.

### Why this is safe

Every HTTP endpoint that returns *other* people's bookings resolves the office only within
the caller's own active organizations (`get_office_for_user`), so a non-member is turned
away with a `404` **before** the serializer runs. The mask is therefore a defensive
backstop — pinned directly at the serializer by
`test_non_member_identity_still_masked_at_serializer`.

### Performance

`_can_see_identity` uses the viewer's membership already resolved by the list/detail views
(`context["membership"]`) as a zero-query fast path; the fallback membership lookup is
memoised per organization on the shared serializer context, so a floor list of N bookings
never becomes an N+1 (pinned by the query-count tests in `test_desk_booking_list.py`).

### The Teams bot

Unaffected: the bot reads only the linked user's **own** bookings and formats plain text —
it never goes through the masking serializers. If a future bot command reads colleagues'
bookings through the shared services, it inherits this rule automatically.

### Tests updated (deliberately, lifted from PR 079)

- `test_desk_booking_detail.py::test_member_retrieves_other_booking_anonymized` →
  `test_member_sees_other_booking_identity`; `…::test_cancelled_by_not_exposed_to_non_owner_member`
  → `…::test_cancelled_by_exposed_to_same_org_member`; **added**
  `…::test_non_member_identity_still_masked_at_serializer` (the backstop).
- `test_desk_booking_list.py::test_member_sees_anonymized_user_for_others` →
  `…::test_member_sees_identity_for_others`; `…::test_member_cannot_see_cancelled_by_for_others`
  → `…::test_member_sees_cancelled_by_for_others`.
- `test_meeting_rooms.py::test_member_sees_reserved_for_others` →
  `…::test_member_sees_identity_for_others`.

Owner/admin/`Former user`/cross-org-404 tests are unchanged. Serializer-level change — **no
migration**.

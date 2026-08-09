from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone as tz

from offices.models import Desk, DeskBooking, Floor


class BookingDeskNotAvailableError(Exception):
    """Raised when the target desk exists but is not available for booking."""


class BookingFloorNotPublishedError(Exception):
    """Raised when the desk's floor is still in draft (not published for booking)."""


class DuplicateBookingError(Exception):
    """
    Raised when a duplicate booking constraint would be violated.

    ``constraint`` is either ``"desk_date"`` or ``"user_org_date"`` so callers
    can map to the correct error message without inspecting exception text.
    """

    def __init__(self, constraint: str) -> None:
        self.constraint = constraint
        super().__init__(constraint)


class DeskBookingAlreadyCancelledError(Exception):
    """Raised when cancelling a desk booking that is already cancelled."""


def cancel_active_bookings_for_desk(desk: Desk, *, cancelled_by=None) -> int:
    """
    Cancel all active bookings for *desk*.

    Returns the number of rows updated.  Pass ``cancelled_by`` when the
    cancellation is driven by a user action (API path); omit it (``None``) for
    system-driven cancellations such as a signal or management command.

    Safe to call with no active bookings — returns 0 and is a no-op.
    """
    now = tz.now()
    return DeskBooking.objects.filter(
        desk=desk,
        status=DeskBooking.Status.ACTIVE,
    ).update(
        status=DeskBooking.Status.CANCELLED,
        cancelled_at=now,
        cancelled_by=cancelled_by,
        updated_at=now,
    )


def create_booking_for_user(
    *,
    organization,
    office,
    floor,
    desk_id: int,
    user,
    booking_date,
) -> DeskBooking:
    """
    Create a DeskBooking with row-level locking for concurrency safety (TD-006).

    Validation order inside the transaction:
    1. Lock the Desk row with select_for_update — serialises concurrent attempts.
    2. Assert desk is active and available (TD-003).
    3. Check for pre-existing duplicate bookings (desk+date, user+org+date).
    4. Build the DeskBooking and call clean() — validates desk state and FK
       consistency (TD-003, TD-005).
    5. Save, catching IntegrityError as a last-resort race guard.

    Raises:
        Desk.DoesNotExist          — desk not found, inactive, or out of scope.
        BookingFloorNotPublishedError — floor.status != PUBLISHED.
        BookingDeskNotAvailableError — desk.status != AVAILABLE.
        DuplicateBookingError      — duplicate active booking detected.
        IntegrityError             — concurrent race that bypassed pre-checks.
        ValidationError            — clean() found an inconsistency.
    """
    with transaction.atomic():
        # Only published floors are bookable (PR 064). A floor still being built
        # or edited in the setup wizard is draft and must not accept bookings.
        if floor.status != Floor.Status.PUBLISHED:
            raise BookingFloorNotPublishedError()

        desk = Desk.objects.select_for_update().get(
            id=desk_id,
            floor=floor,
            office=office,
            organization=organization,
            is_active=True,
        )

        if desk.status != Desk.Status.AVAILABLE:
            raise BookingDeskNotAvailableError()

        # Duplicate pre-checks run inside the lock to narrow the race window.
        if DeskBooking.objects.filter(
            desk=desk,
            booking_date=booking_date,
            status=DeskBooking.Status.ACTIVE,
        ).exists():
            raise DuplicateBookingError("desk_date")

        if DeskBooking.objects.filter(
            organization=organization,
            user=user,
            booking_date=booking_date,
            status=DeskBooking.Status.ACTIVE,
        ).exists():
            raise DuplicateBookingError("user_org_date")

        booking = DeskBooking(
            organization=organization,
            office=office,
            floor=floor,
            desk=desk,
            user=user,
            booking_date=booking_date,
            status=DeskBooking.Status.ACTIVE,
        )
        # Model-level clean: verifies desk state and FK consistency (TD-003, TD-005).
        booking.clean()

        try:
            booking.save()
        except IntegrityError:
            raise

        return booking


# ─── Read + cancel helpers (extracted for the bot glue, PR 077) ────────────────


def get_my_desk_booking(user, booking_id: int) -> DeskBooking | None:
    """Fetch the user's own desk booking by id (any status), or None.

    Same scoping + select_related as ``MyBookingCancelView`` — a booking that
    exists but belongs to someone else returns None (no cross-user leak).
    """
    try:
        return DeskBooking.objects.select_related(
            "desk", "desk__layout_object", "office", "floor", "cancelled_by"
        ).get(id=booking_id, user=user)
    except DeskBooking.DoesNotExist:
        return None


def cancel_desk_booking(booking: DeskBooking, *, cancelled_by) -> DeskBooking:
    """Cancel an active desk booking (the mutation shared by the desk cancel
    views and the bot). Raises ``DeskBookingAlreadyCancelledError`` if not active.
    Callers map the exception to their own message/status."""
    if booking.status == DeskBooking.Status.CANCELLED:
        raise DeskBookingAlreadyCancelledError()
    booking.status = DeskBooking.Status.CANCELLED
    booking.cancelled_at = tz.now()
    booking.cancelled_by = cancelled_by
    booking.save(update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"])
    return booking


def list_my_desk_bookings(
    user, *, status: str = "active", date_from=None, date_to=None
):
    """The user's desk bookings across their ACTIVE organizations (extracted from
    ``MyBookingsView`` verbatim — same filters, ordering, select_related).

    ``status`` is normalized: "cancelled"/"all" as given, anything else → "active"
    (never leak cancelled on an unknown value). ``date_from``/``date_to`` are
    ``date`` objects or None (the view still owns query-param parsing + its 400s).
    The default active window starts at "today" in the configured booking timezone.
    """
    from accounts.models import Membership
    from offices.serializers import resolve_office_zone

    active_org_ids = Membership.objects.filter(user=user, status="active").values_list(
        "organization_id", flat=True
    )

    qs = DeskBooking.objects.filter(
        user=user, organization__in=active_org_ids
    ).select_related("desk", "desk__layout_object", "office", "floor", "cancelled_by")

    if status == "cancelled":
        qs = qs.filter(status=DeskBooking.Status.CANCELLED)
        normalized = "cancelled"
    elif status == "all":
        normalized = "all"
    else:
        normalized = "active"
        qs = qs.filter(status=DeskBooking.Status.ACTIVE)

    today = tz.now().astimezone(resolve_office_zone(None)).date()

    if date_from is not None:
        qs = qs.filter(booking_date__gte=date_from)
    elif normalized == "active":
        qs = qs.filter(booking_date__gte=today)

    if date_to is not None:
        qs = qs.filter(booking_date__lte=date_to)

    if normalized == "active":
        return qs.order_by("booking_date")
    return qs.order_by("-booking_date")


def resolve_usual_desk(user, *, organization) -> Desk | None:
    """The user's "usual" desk = the desk of their most-recently-created booking in
    ``organization`` whose desk resource is still active (PR 077). None if they have
    never booked. Pure query, no schema change; a saved favourite can supersede this
    later. The returned Desk carries its office/floor for the bot to book against.
    """
    booking = (
        DeskBooking.objects.filter(
            user=user, organization=organization, desk__is_active=True
        )
        .select_related("desk", "desk__floor", "desk__office")
        .order_by("-created_at")
        .first()
    )
    return booking.desk if booking else None

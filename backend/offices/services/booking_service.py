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

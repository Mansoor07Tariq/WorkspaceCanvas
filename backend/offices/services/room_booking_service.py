"""Service layer for meeting-room slot bookings (PR 073, Slice 1).

Request-free by design (the 072 pattern): a future bot integration can book or
cancel a room through this service with no DRF request object. Authorization and
serializer validation are the caller's responsibility; this module owns the
concurrency-safe create (row lock + DB-backed overlap guarantee), the cancel
transition, and the domain exceptions callers map to HTTP status codes.

Contract
--------
``RoomBookingService().create_booking(...)`` creates one active RoomBooking for a
time slot, or raises a domain error:
  * ``RoomFloorNotPublishedError`` — the floor is still draft (not bookable).
  * ``RoomNotAvailableError``      — the room is inactive or not AVAILABLE.
  * ``RoomSlotConflictError``      — the slot overlaps an existing active booking.
``cancel_booking(booking, *, cancelled_by)`` cancels an active booking, or raises
``RoomBookingAlreadyCancelledError``.

Overlap guarantee: the RoomBooking ``room_booking_no_overlap`` GiST
ExclusionConstraint makes two overlapping active bookings for a room impossible at
the DB level. The service adds a ``select_for_update`` pre-check inside the
transaction so the common case returns a friendly conflict rather than an
IntegrityError; a lost concurrent race that slips past the pre-check is caught
from the constraint and re-raised as ``RoomSlotConflictError`` (mirrors the desk
booking service's pattern — business rule backed by a DB constraint, PR 065).
"""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone as tz

from offices.models import Floor, MeetingRoom, RoomBooking

_OVERLAP_CONSTRAINT = "room_booking_no_overlap"


class RoomFloorNotPublishedError(Exception):
    """Raised when the room's floor is still draft (not published for booking)."""


class RoomNotAvailableError(Exception):
    """Raised when the target room exists but is not available for booking."""


class RoomSlotConflictError(Exception):
    """Raised when the requested slot overlaps an existing active booking."""


class RoomBookingAlreadyCancelledError(Exception):
    """Raised when cancelling a booking that is already cancelled."""


class RoomBookingService:
    """Create/cancel meeting-room slot bookings. Stateless — construct per call.

    See the module docstring for the full contract and the overlap guarantee.
    """

    def create_booking(
        self,
        *,
        organization,
        office,
        floor,
        room_id: int,
        user,
        booking_date,
        start_at,
        end_at,
    ) -> RoomBooking:
        """Create one active RoomBooking with row-level locking for concurrency
        safety, backed by the DB overlap ExclusionConstraint.

        ``start_at``/``end_at`` are timezone-aware UTC instants; ``booking_date``
        is the office-local calendar day. Slot-bound validation (duration, past,
        horizon, intra-day) is the caller's job — this method enforces only the
        invariants a DB write path must never violate.

        Raises:
            MeetingRoom.DoesNotExist       — room not found / inactive / out of scope.
            RoomFloorNotPublishedError     — floor.status != PUBLISHED.
            RoomNotAvailableError          — room.status != AVAILABLE.
            RoomSlotConflictError          — overlapping active booking.
            ValidationError                — clean() found an inconsistency.
        """
        with transaction.atomic():
            # Only published floors are bookable (mirrors the desk path).
            if floor.status != Floor.Status.PUBLISHED:
                raise RoomFloorNotPublishedError()

            # Lock the room row to serialise concurrent attempts and narrow the
            # overlap race window before the constraint has the final say.
            room = MeetingRoom.objects.select_for_update().get(
                id=room_id,
                floor=floor,
                office=office,
                organization=organization,
                is_active=True,
            )

            if room.status != MeetingRoom.Status.AVAILABLE:
                raise RoomNotAvailableError()

            # Overlap pre-check inside the lock: two half-open [start, end) ranges
            # overlap iff start_a < end_b AND end_a > start_b.
            if RoomBooking.objects.filter(
                room=room,
                status=RoomBooking.Status.ACTIVE,
                start_at__lt=end_at,
                end_at__gt=start_at,
            ).exists():
                raise RoomSlotConflictError()

            booking = RoomBooking(
                organization=organization,
                office=office,
                floor=floor,
                room=room,
                user=user,
                booking_date=booking_date,
                start_at=start_at,
                end_at=end_at,
                status=RoomBooking.Status.ACTIVE,
            )
            # Model-level guard: room state + FK consistency + end>start.
            booking.clean()

            try:
                booking.save()
            except IntegrityError as exc:
                # A concurrent booking won the exclusion constraint after our
                # pre-check — treat as a slot conflict. Any other integrity error
                # (e.g. the end>start check) is a real bug and must surface.
                if _OVERLAP_CONSTRAINT in str(exc):
                    raise RoomSlotConflictError() from exc
                raise

            return booking

    def cancel_booking(self, booking: RoomBooking, *, cancelled_by) -> RoomBooking:
        """Cancel an active RoomBooking. Pass ``cancelled_by`` for the audit trail
        (the acting user), or ``None`` for a system-driven cancellation.

        Raises ``RoomBookingAlreadyCancelledError`` if the booking is not active.
        """
        if booking.status == RoomBooking.Status.CANCELLED:
            raise RoomBookingAlreadyCancelledError()

        booking.status = RoomBooking.Status.CANCELLED
        booking.cancelled_at = tz.now()
        booking.cancelled_by = cancelled_by
        booking.save(
            update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"]
        )
        return booking

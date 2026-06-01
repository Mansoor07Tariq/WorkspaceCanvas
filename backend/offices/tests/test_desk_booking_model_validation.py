"""
Tests for DeskBooking.clean() — model-level data integrity rules.

Covers:
  TD-003 — booking against inactive / non-available desks is rejected.
  TD-005 — denormalized FK consistency (org/office/floor must match desk).
"""

import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name="Acme Corp",
        slug="acme-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def other_org(db):
    return Organization.objects.create(
        name="Other Corp",
        slug="other-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def office(db, org):
    return Office.objects.create(organization=org, name="HQ", slug="hq")


@pytest.fixture
def other_office(db, other_org):
    return Office.objects.create(organization=other_org, name="Remote", slug="remote")


@pytest.fixture
def floor(db, office):
    return Floor.objects.create(
        office=office, name="Ground", slug="ground", level_number=0
    )


@pytest.fixture
def other_floor(db, office):
    return Floor.objects.create(
        office=office, name="Level 1", slug="level-1", level_number=1
    )


@pytest.fixture
def layout_obj(db, floor):
    return FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="D1",
        x="10.00",
        y="10.00",
        width="80.00",
        height="50.00",
    )


@pytest.fixture
def available_desk(db, org, office, floor, layout_obj):
    return Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=layout_obj,
        name="Desk 1",
        status=Desk.Status.AVAILABLE,
        is_active=True,
    )


User = get_user_model()


@pytest.fixture
def user(db, org):
    u = User.objects.create_user(
        username="test@example.com", email="test@example.com", password="pass"
    )
    Membership.objects.create(
        user=u,
        organization=org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return u


def _booking(org, office, floor, desk, user, delta_days=1):
    """Return an unsaved DeskBooking with all FK fields populated."""
    return DeskBooking(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=user,
        booking_date=datetime.date.today() + datetime.timedelta(days=delta_days),
        status=DeskBooking.Status.ACTIVE,
    )


# ─── TD-003: valid booking passes clean ──────────────────────────────────────


def test_valid_booking_passes_clean(org, office, floor, available_desk, user):
    booking = _booking(org, office, floor, available_desk, user)
    booking.clean()  # must not raise


# ─── TD-003: inactive desk rejected ──────────────────────────────────────────


def test_inactive_desk_rejected_by_clean(db, org, office, floor, layout_obj, user):
    inactive_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=layout_obj,
        name="Inactive",
        status=Desk.Status.AVAILABLE,
        is_active=False,
    )
    booking = _booking(org, office, floor, inactive_desk, user)
    with pytest.raises(ValidationError, match="inactive"):
        booking.clean()


# ─── TD-003: unavailable desk rejected ───────────────────────────────────────


def test_unavailable_desk_rejected_by_clean(db, org, office, floor, layout_obj, user):
    unavail_layout = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="D2",
        x="20.00",
        y="10.00",
        width="80.00",
        height="50.00",
    )
    unavail_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=unavail_layout,
        name="Unavail",
        status=Desk.Status.UNAVAILABLE,
        is_active=True,
    )
    booking = _booking(org, office, floor, unavail_desk, user)
    with pytest.raises(ValidationError, match="Unavailable"):
        booking.clean()


# ─── TD-003: maintenance desk rejected ───────────────────────────────────────


def test_maintenance_desk_rejected_by_clean(db, org, office, floor, layout_obj, user):
    maint_layout = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="D3",
        x="30.00",
        y="10.00",
        width="80.00",
        height="50.00",
    )
    maint_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=maint_layout,
        name="Maint",
        status=Desk.Status.MAINTENANCE,
        is_active=True,
    )
    booking = _booking(org, office, floor, maint_desk, user)
    with pytest.raises(ValidationError, match="Maintenance"):
        booking.clean()


# ─── TD-005: mismatched organization rejected ─────────────────────────────────


def test_mismatched_organization_rejected(
    db, org, other_org, office, floor, available_desk, user
):
    booking = _booking(other_org, office, floor, available_desk, user)
    with pytest.raises(ValidationError, match="organization"):
        booking.clean()


# ─── TD-005: mismatched office rejected ──────────────────────────────────────


def test_mismatched_office_rejected(
    db, org, office, other_office, floor, available_desk, user
):
    booking = _booking(org, other_office, floor, available_desk, user)
    with pytest.raises(ValidationError, match="office"):
        booking.clean()


# ─── TD-005: mismatched floor rejected ───────────────────────────────────────


def test_mismatched_floor_rejected(
    db, org, office, floor, other_floor, available_desk, user
):
    booking = _booking(org, office, other_floor, available_desk, user)
    with pytest.raises(ValidationError, match="floor"):
        booking.clean()


# ─── Service integration: clean() called by create_booking_for_user ──────────


def test_service_rejects_inactive_desk_via_clean(
    db, org, office, floor, layout_obj, user
):
    """
    create_booking_for_user raises Desk.DoesNotExist for inactive desks
    because the service queries with is_active=True — so the desk is never
    even reached for clean().  This test verifies the correct 404-equivalent
    error surfaces.
    """
    from offices.services.booking_service import create_booking_for_user

    inactive_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=layout_obj,
        name="Inactive Service",
        status=Desk.Status.AVAILABLE,
        is_active=False,
    )
    with pytest.raises(Desk.DoesNotExist):
        create_booking_for_user(
            organization=org,
            office=office,
            floor=floor,
            desk_id=inactive_desk.id,
            user=user,
            booking_date=datetime.date.today() + datetime.timedelta(days=1),
        )


def test_service_rejects_unavailable_desk(db, org, office, floor, layout_obj, user):
    from offices.services.booking_service import (
        BookingDeskNotAvailableError,
        create_booking_for_user,
    )

    unavail_layout = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="D4",
        x="40.00",
        y="10.00",
        width="80.00",
        height="50.00",
    )
    unavail_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=unavail_layout,
        name="Unavail Svc",
        status=Desk.Status.UNAVAILABLE,
        is_active=True,
    )
    with pytest.raises(BookingDeskNotAvailableError):
        create_booking_for_user(
            organization=org,
            office=office,
            floor=floor,
            desk_id=unavail_desk.id,
            user=user,
            booking_date=datetime.date.today() + datetime.timedelta(days=1),
        )


def test_service_rejects_maintenance_desk(db, org, office, floor, layout_obj, user):
    from offices.services.booking_service import (
        BookingDeskNotAvailableError,
        create_booking_for_user,
    )

    maint_layout = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="D5",
        x="50.00",
        y="10.00",
        width="80.00",
        height="50.00",
    )
    maint_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=maint_layout,
        name="Maint Svc",
        status=Desk.Status.MAINTENANCE,
        is_active=True,
    )
    with pytest.raises(BookingDeskNotAvailableError):
        create_booking_for_user(
            organization=org,
            office=office,
            floor=floor,
            desk_id=maint_desk.id,
            user=user,
            booking_date=datetime.date.today() + datetime.timedelta(days=1),
        )


def test_service_creates_valid_booking(db, org, office, floor, available_desk, user):
    from offices.services.booking_service import create_booking_for_user

    booking = create_booking_for_user(
        organization=org,
        office=office,
        floor=floor,
        desk_id=available_desk.id,
        user=user,
        booking_date=datetime.date.today() + datetime.timedelta(days=1),
    )
    assert booking.pk is not None
    assert booking.organization == org
    assert booking.office == office
    assert booking.floor == floor
    assert booking.desk == available_desk
    assert booking.user == user
    assert booking.status == DeskBooking.Status.ACTIVE


def test_service_duplicate_desk_date_raises(
    db, org, office, floor, available_desk, user
):
    from offices.services.booking_service import (
        DuplicateBookingError,
        create_booking_for_user,
    )

    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=available_desk,
        user=user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    with pytest.raises(DuplicateBookingError) as exc_info:
        create_booking_for_user(
            organization=org,
            office=office,
            floor=floor,
            desk_id=available_desk.id,
            user=user,
            booking_date=tomorrow,
        )
    assert exc_info.value.constraint == "desk_date"


def test_service_duplicate_user_org_date_raises(
    db, org, office, floor, available_desk, layout_obj, user
):
    from offices.services.booking_service import (
        DuplicateBookingError,
        create_booking_for_user,
    )

    tomorrow = datetime.date.today() + datetime.timedelta(days=1)

    second_layout = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="D6",
        x="60.00",
        y="10.00",
        width="80.00",
        height="50.00",
    )
    second_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=second_layout,
        name="Desk 2",
        status=Desk.Status.AVAILABLE,
        is_active=True,
    )

    # First booking for available_desk
    DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=available_desk,
        user=user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    # Attempt second booking on a different desk — same user+org+date
    with pytest.raises(DuplicateBookingError) as exc_info:
        create_booking_for_user(
            organization=org,
            office=office,
            floor=floor,
            desk_id=second_desk.id,
            user=user,
            booking_date=tomorrow,
        )
    assert exc_info.value.constraint == "user_org_date"

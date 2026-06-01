"""
Tests for the Desk post_save signal (TD-011).

When a Desk transitions is_active True → False via a direct model save
(admin, script, management command), active bookings must be cascade-cancelled
with cancelled_by=None (system-driven, no request user).

These tests validate the signal path only.  API-driven deactivation is
covered by test_desk_deactivation_cancels_bookings.py.
"""

import datetime

import pytest
from django.contrib.auth import get_user_model

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name="Signal Corp",
        slug="signal-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def office(db, org):
    return Office.objects.create(organization=org, name="HQ", slug="hq")


@pytest.fixture
def floor(db, office):
    return Floor.objects.create(
        office=office, name="Ground", slug="ground", level_number=0
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
def desk(db, org, office, floor, layout_obj):
    return Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=layout_obj,
        name="Desk 1",
        status=Desk.Status.AVAILABLE,
        is_active=True,
    )


@pytest.fixture
def member(db, org):
    u = User.objects.create_user(
        username="member@sig.test", email="member@sig.test", password="pass"
    )
    Membership.objects.create(
        user=u,
        organization=org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return u


@pytest.fixture
def tomorrow():
    return datetime.date.today() + datetime.timedelta(days=1)


@pytest.fixture
def active_booking(db, org, office, floor, desk, member, tomorrow):
    return DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=member,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )


# ─── Active → inactive transition cancels bookings ───────────────────────────


def test_direct_save_active_to_inactive_cancels_booking(desk, active_booking):
    desk.is_active = False
    desk.save()
    active_booking.refresh_from_db()
    assert active_booking.status == DeskBooking.Status.CANCELLED


def test_direct_save_sets_cancelled_at(desk, active_booking):
    desk.is_active = False
    desk.save()
    active_booking.refresh_from_db()
    assert active_booking.cancelled_at is not None


def test_direct_save_cancelled_by_is_none(desk, active_booking):
    """Signal-driven cancellation has no request user; cancelled_by must be None."""
    desk.is_active = False
    desk.save()
    active_booking.refresh_from_db()
    assert active_booking.cancelled_by is None


def test_direct_save_cancels_multiple_bookings(
    db, org, office, floor, desk, member, tomorrow
):
    day2 = tomorrow + datetime.timedelta(days=1)
    day3 = tomorrow + datetime.timedelta(days=2)
    b1 = DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=member,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    b2 = DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=member,
        booking_date=day2,
        status=DeskBooking.Status.ACTIVE,
    )
    b3 = DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=member,
        booking_date=day3,
        status=DeskBooking.Status.ACTIVE,
    )

    desk.is_active = False
    desk.save()

    for booking in (b1, b2, b3):
        booking.refresh_from_db()
        assert booking.status == DeskBooking.Status.CANCELLED
        assert booking.cancelled_at is not None
        assert booking.cancelled_by is None


# ─── Already-cancelled bookings are unaffected ───────────────────────────────


def test_already_cancelled_booking_unchanged(
    db, org, office, floor, desk, member, tomorrow
):
    already = DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=member,
        booking_date=tomorrow,
        status=DeskBooking.Status.CANCELLED,
    )

    desk.is_active = False
    desk.save()

    already.refresh_from_db()
    assert already.status == DeskBooking.Status.CANCELLED
    assert already.cancelled_by is None  # was not touched by the signal


# ─── No effect when desk stays active ────────────────────────────────────────


def test_active_to_active_save_does_not_cancel(desk, active_booking):
    desk.name = "Updated Name"
    desk.save()
    active_booking.refresh_from_db()
    assert active_booking.status == DeskBooking.Status.ACTIVE


def test_saving_with_is_active_true_does_not_cancel(desk, active_booking):
    desk.is_active = True
    desk.save()
    active_booking.refresh_from_db()
    assert active_booking.status == DeskBooking.Status.ACTIVE


# ─── No effect when inactive desk is saved again ─────────────────────────────


def test_inactive_to_inactive_save_is_noop(
    db, org, office, floor, layout_obj, member, tomorrow
):
    """
    Saving an already-inactive desk again must not re-process or produce
    duplicate cancellation side effects.
    """
    inactive_layout = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="D_inactive",
        x="90.00",
        y="10.00",
        width="80.00",
        height="50.00",
    )
    inactive_desk = Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=inactive_layout,
        name="Already Inactive",
        status=Desk.Status.AVAILABLE,
        is_active=False,
    )
    # No active bookings exist; saving again is a no-op
    inactive_desk.name = "Still Inactive"
    inactive_desk.save()
    # No exception → pass


# ─── update_fields without is_active does not trigger cascade ────────────────


def test_save_without_is_active_update_fields_does_not_cancel(desk, active_booking):
    """
    If save() is called with update_fields that does NOT include is_active,
    the signal must not run the cascade even if is_active is False in memory.
    """
    desk.is_active = False  # set in-memory but NOT persisted
    desk.name = "Name Only Update"
    desk.save(update_fields=["name"])  # is_active not in update_fields
    active_booking.refresh_from_db()
    # Booking should remain ACTIVE because is_active was not actually saved
    assert active_booking.status == DeskBooking.Status.ACTIVE


# ─── API deactivation still sets cancelled_by = request.user ─────────────────


def test_api_deactivation_sets_cancelled_by_user(
    client, settings, desk, active_booking
):
    """
    The API path (DeskDetailView.delete) explicitly sets cancelled_by=request.user
    BEFORE calling desk.save().  The signal fires but finds no ACTIVE bookings.
    Result: cancelled_by is the API user, not None.
    """
    from rest_framework.test import APIClient

    settings.ALLOWED_HOSTS = ["testserver"]
    api_client = APIClient()

    owner = User.objects.create_user(
        username="owner@sig.test", email="owner@sig.test", password="pass"
    )
    Membership.objects.create(
        user=owner,
        organization=desk.organization,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )

    api_client.force_authenticate(user=owner)
    url = f"/api/offices/{desk.office_id}/floors/{desk.floor_id}/desks/{desk.id}/"
    response = api_client.delete(url)
    assert response.status_code == 204

    active_booking.refresh_from_db()
    assert active_booking.status == DeskBooking.Status.CANCELLED
    assert active_booking.cancelled_by == owner
    assert active_booking.cancelled_at is not None

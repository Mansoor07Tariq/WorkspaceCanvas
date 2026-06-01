"""Tests for MyBookingsView and MyBookingCancelView (GET /api/bookings/my/ and
POST /api/bookings/my/<id>/cancel/)."""

from __future__ import annotations

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office
from offices.serializers import DeskBookingResponseSerializer

User = get_user_model()

MY_BOOKINGS_URL = "/api/bookings/my/"


def my_cancel_url(booking_id: int) -> str:
    return f"/api/bookings/my/{booking_id}/cancel/"


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def active_org(db):
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
def active_office(db, active_org):
    return Office.objects.create(
        organization=active_org, name="Dublin Office", slug="dublin-office"
    )


@pytest.fixture
def other_office(db, other_org):
    return Office.objects.create(
        organization=other_org, name="London Office", slug="london-office"
    )


@pytest.fixture
def active_floor(db, active_office):
    return Floor.objects.create(
        office=active_office, name="Ground Floor", slug="ground-floor", level_number=0
    )


@pytest.fixture
def other_floor(db, other_office):
    return Floor.objects.create(
        office=other_office, name="Level 1", slug="level-1", level_number=1
    )


@pytest.fixture
def desk_layout_object(db, active_floor):
    return FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk A1",
        x="100.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )


@pytest.fixture
def desk(db, active_org, active_office, active_floor, desk_layout_object):
    return Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Desk A1",
        code="A1",
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def other_desk_layout_object(db, other_floor):
    return FloorLayoutObject.objects.create(
        floor=other_floor,
        object_type="desk",
        label="Desk B1",
        x="100.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )


@pytest.fixture
def other_desk(db, other_org, other_office, other_floor, other_desk_layout_object):
    return Desk.objects.create(
        organization=other_org,
        office=other_office,
        floor=other_floor,
        layout_object=other_desk_layout_object,
        name="Desk B1",
        code="B1",
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def member_user(db, active_org):
    user = User.objects.create_user(
        username="member@example.com", email="member@example.com", password="pass123"
    )
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def owner_user(db, active_org):
    user = User.objects.create_user(
        username="owner@example.com", email="owner@example.com", password="pass123"
    )
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def other_user(db, active_org):
    """A second member in the same org."""
    user = User.objects.create_user(
        username="other@example.com", email="other@example.com", password="pass123"
    )
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def today():
    return datetime.date.today()


@pytest.fixture
def tomorrow():
    return datetime.date.today() + datetime.timedelta(days=1)


@pytest.fixture
def active_booking(
    db, active_org, active_office, active_floor, desk, member_user, tomorrow
):
    return DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )


# ─── Auth tests ───────────────────────────────────────────────────────────────


def test_unauthenticated_cannot_access(client):
    response = client.get(MY_BOOKINGS_URL)
    assert response.status_code == 401


# ─── Visibility / ownership tests ────────────────────────────────────────────


def test_returns_only_own_bookings(
    db,
    client,
    member_user,
    other_user,
    active_org,
    active_office,
    active_floor,
    desk,
    tomorrow,
):
    """user1's bookings must not be visible to user2."""
    # user1 booking
    booking1 = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )

    # Create a second desk for other_user's booking
    lo2 = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk A2",
        x="200.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )
    desk2 = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo2,
        name="Desk A2",
        code="A2",
        status=Desk.Status.AVAILABLE,
    )
    booking2 = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk2,
        user=other_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )

    client.force_authenticate(user=other_user)
    response = client.get(MY_BOOKINGS_URL)
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert booking2.id in ids
    assert booking1.id not in ids


def test_default_returns_active_upcoming(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    today,
    tomorrow,
):
    """Default (no params): active bookings from today onward."""
    past = today - datetime.timedelta(days=1)

    lo_past = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Past",
        x="0.00",
        y="0.00",
        width="10.00",
        height="10.00",
    )
    desk_past = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo_past,
        name="Past Desk",
        code="P1",
        status=Desk.Status.AVAILABLE,
    )
    past_booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk_past,
        user=member_user,
        booking_date=past,
        status=DeskBooking.Status.ACTIVE,
    )
    upcoming_booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )

    client.force_authenticate(user=member_user)
    response = client.get(MY_BOOKINGS_URL)
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert upcoming_booking.id in ids
    assert past_booking.id not in ids


def test_status_all_returns_active_and_cancelled(
    db, client, member_user, active_org, active_office, active_floor, desk, tomorrow
):
    """?status=all returns both active and cancelled bookings."""
    lo2 = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk C1",
        x="300.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )
    desk2 = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo2,
        name="Desk C1",
        code="C1",
        status=Desk.Status.AVAILABLE,
    )
    active_b = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    cancelled_b = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk2,
        user=member_user,
        booking_date=tomorrow - datetime.timedelta(days=1),
        status=DeskBooking.Status.CANCELLED,
    )

    client.force_authenticate(user=member_user)
    response = client.get(MY_BOOKINGS_URL + "?status=all")
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert active_b.id in ids
    assert cancelled_b.id in ids


def test_status_cancelled_returns_only_cancelled(
    db, client, member_user, active_org, active_office, active_floor, desk, tomorrow
):
    """?status=cancelled returns only cancelled bookings."""
    lo2 = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk D1",
        x="400.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )
    desk2 = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo2,
        name="Desk D1",
        code="D1",
        status=Desk.Status.AVAILABLE,
    )
    active_b = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    cancelled_b = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk2,
        user=member_user,
        booking_date=tomorrow - datetime.timedelta(days=1),
        status=DeskBooking.Status.CANCELLED,
    )

    client.force_authenticate(user=member_user)
    response = client.get(MY_BOOKINGS_URL + "?status=cancelled")
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert cancelled_b.id in ids
    assert active_b.id not in ids


def test_from_date_filter(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    today,
    tomorrow,
):
    """?from=YYYY-MM-DD filters to bookings on or after that date."""
    lo2 = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk E1",
        x="500.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )
    desk2 = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo2,
        name="Desk E1",
        code="E1",
        status=Desk.Status.AVAILABLE,
    )
    booking_today = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    booking_tomorrow = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk2,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )

    client.force_authenticate(user=member_user)
    response = client.get(MY_BOOKINGS_URL + f"?from={tomorrow.isoformat()}")
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert booking_tomorrow.id in ids
    assert booking_today.id not in ids


def test_to_date_filter(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    today,
    tomorrow,
):
    """?to=YYYY-MM-DD filters to bookings on or before that date."""
    lo2 = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk F1",
        x="600.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )
    desk2 = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo2,
        name="Desk F1",
        code="F1",
        status=Desk.Status.AVAILABLE,
    )
    booking_today = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    booking_tomorrow = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk2,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )

    client.force_authenticate(user=member_user)
    response = client.get(MY_BOOKINGS_URL + f"?to={today.isoformat()}&status=all")
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert booking_today.id in ids
    assert booking_tomorrow.id not in ids


def test_no_membership_org_bookings_excluded(
    db, client, member_user, other_org, other_office, other_floor, other_desk, tomorrow
):
    """Bookings in an org where user has no active membership are excluded."""
    booking_no_membership = DeskBooking.objects.create(
        organization=other_org,
        office=other_office,
        floor=other_floor,
        desk=other_desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )

    client.force_authenticate(user=member_user)
    response = client.get(MY_BOOKINGS_URL + "?status=all")
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert booking_no_membership.id not in ids


# ─── Cancel tests ─────────────────────────────────────────────────────────────


def test_cancel_own_booking(client, member_user, active_booking):
    client.force_authenticate(user=member_user)
    response = client.post(my_cancel_url(active_booking.id))
    assert response.status_code == 200
    assert response.data["status"] == DeskBooking.Status.CANCELLED
    active_booking.refresh_from_db()
    assert active_booking.status == DeskBooking.Status.CANCELLED
    assert active_booking.cancelled_by == member_user
    assert active_booking.cancelled_at is not None


def test_cancel_another_users_booking_rejected(db, client, other_user, active_booking):
    """Other user cannot cancel a booking they don't own — returns 404."""
    client.force_authenticate(user=other_user)
    response = client.post(my_cancel_url(active_booking.id))
    assert response.status_code == 404


def test_cancel_already_cancelled_booking_rejected(
    db, client, member_user, active_org, active_office, active_floor, desk, tomorrow
):
    """Cancelling an already-cancelled booking returns 400."""
    cancelled_booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.CANCELLED,
    )
    client.force_authenticate(user=member_user)
    response = client.post(my_cancel_url(cancelled_booking.id))
    assert response.status_code == 400
    assert "already cancelled" in response.data["detail"].lower()


# ─── Null user serializer test ────────────────────────────────────────────────


def test_null_user_booking_serializes_without_crash(
    db, active_org, active_office, active_floor, desk, member_user, tomorrow
):
    """
    Simulate a deleted-user booking by setting user=None on the booking.
    The GET /api/bookings/my/ endpoint naturally excludes it (filter user=request.user),
    but the serializer must handle null user without raising AttributeError.
    """
    booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    # Simulate deleted user by clearing the FK via update (bypasses SET_NULL signal)
    DeskBooking.objects.filter(pk=booking.pk).update(user=None)
    booking.refresh_from_db()
    assert booking.user is None

    # Verify the serializer handles null user without crashing
    data = DeskBookingResponseSerializer(booking, context={}).data
    assert data["user_name"] == "Former user"
    assert data["is_mine"] is False

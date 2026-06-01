"""
Tests for desk deactivation auto-cancellation of active bookings (Task 9).

When an owner/admin soft-deletes a desk:
- All active bookings for that desk are cancelled
- cancelled_at and cancelled_by are set correctly
- The booking no longer appears in the list endpoint
- A new booking can be made on another desk for the same date
- Already-cancelled bookings are unaffected
"""

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def desk_detail_url(office_id: int, floor_id: int, desk_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/desks/{desk_id}/"


def booking_list_url(office_id: int, floor_id: int, date: str) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/?date={date}"


def booking_create_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/"


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
def active_office(db, active_org):
    return Office.objects.create(
        organization=active_org, name="Dublin Office", slug="dublin-office"
    )


@pytest.fixture
def active_floor(db, active_office):
    return Floor.objects.create(
        office=active_office, name="Ground Floor", slug="ground-floor", level_number=0
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
def second_desk_layout_object(db, active_floor):
    return FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk B1",
        x="200.00",
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
def second_desk(db, active_org, active_office, active_floor, second_desk_layout_object):
    return Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=second_desk_layout_object,
        name="Desk B1",
        code="B1",
        status=Desk.Status.AVAILABLE,
    )


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


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_desk_deactivation_makes_desk_inactive(
    client, owner_user, active_office, active_floor, desk, active_booking
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 204
    desk.refresh_from_db()
    assert desk.is_active is False


def test_desk_deactivation_cancels_active_bookings(
    client, owner_user, active_office, active_floor, desk, active_booking
):
    client.force_authenticate(user=owner_user)
    client.delete(desk_detail_url(active_office.id, active_floor.id, desk.id))
    active_booking.refresh_from_db()
    assert active_booking.status == DeskBooking.Status.CANCELLED


def test_desk_deactivation_sets_cancelled_at(
    client, owner_user, active_office, active_floor, desk, active_booking
):
    client.force_authenticate(user=owner_user)
    client.delete(desk_detail_url(active_office.id, active_floor.id, desk.id))
    active_booking.refresh_from_db()
    assert active_booking.cancelled_at is not None


def test_desk_deactivation_sets_cancelled_by_to_requester(
    client, owner_user, active_office, active_floor, desk, active_booking
):
    client.force_authenticate(user=owner_user)
    client.delete(desk_detail_url(active_office.id, active_floor.id, desk.id))
    active_booking.refresh_from_db()
    assert active_booking.cancelled_by == owner_user


def test_desk_deactivation_cancelled_booking_excluded_from_list(
    client, owner_user, member_user, active_office, active_floor, desk, active_booking
):
    booking_date = active_booking.booking_date

    date_str = booking_date.isoformat()
    # Confirm booking appears before deactivation
    client.force_authenticate(user=member_user)
    pre = client.get(booking_list_url(active_office.id, active_floor.id, date_str))
    assert pre.status_code == 200
    assert active_booking.id in [b["id"] for b in pre.data]

    # Owner deactivates the desk
    client.force_authenticate(user=owner_user)
    client.delete(desk_detail_url(active_office.id, active_floor.id, desk.id))

    # Booking must not appear in list anymore
    client.force_authenticate(user=member_user)
    post = client.get(booking_list_url(active_office.id, active_floor.id, date_str))
    assert post.status_code == 200
    assert active_booking.id not in [b["id"] for b in post.data]


def test_desk_deactivation_allows_rebook_on_another_desk_same_date(
    db,
    client,
    owner_user,
    member_user,
    active_office,
    active_floor,
    desk,
    second_desk,
    active_booking,
    tomorrow,
):
    """After desk deactivation frees the user's per-org-date slot,
    the user can book a different desk on the same date."""
    # Owner deactivates the desk (and cancels active_booking)
    client.force_authenticate(user=owner_user)
    client.delete(desk_detail_url(active_office.id, active_floor.id, desk.id))

    # Member books the second desk on the same date
    client.force_authenticate(user=member_user)
    response = client.post(
        booking_create_url(active_office.id, active_floor.id),
        data={"desk": second_desk.id, "booking_date": tomorrow.isoformat()},
        format="json",
    )
    assert response.status_code == 201


def test_desk_deactivation_does_not_affect_already_cancelled_bookings(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    active_floor,
    desk,
    member_user,
    tomorrow,
):
    """A booking that was already cancelled before desk deactivation is unchanged."""
    already_cancelled = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.CANCELLED,
    )

    client.force_authenticate(user=owner_user)
    client.delete(desk_detail_url(active_office.id, active_floor.id, desk.id))

    already_cancelled.refresh_from_db()
    # Still cancelled, not double-updated
    assert already_cancelled.status == DeskBooking.Status.CANCELLED
    # cancelled_by stays None (was cancelled before deactivation)
    assert already_cancelled.cancelled_by is None


def test_desk_deactivation_with_no_bookings_succeeds(
    client, owner_user, active_office, active_floor, desk
):
    """Deactivating a desk with no bookings completes normally."""
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 204
    desk.refresh_from_db()
    assert desk.is_active is False


def test_deactivating_desk_cancels_multiple_bookings(
    db,
    client,
    owner_user,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    tomorrow,
):
    """Deactivating a desk with multiple active bookings cancels all of them."""
    day_after_tomorrow = tomorrow + datetime.timedelta(days=1)
    three_days_out = tomorrow + datetime.timedelta(days=2)

    booking1 = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    booking2 = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=day_after_tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    booking3 = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=three_days_out,
        status=DeskBooking.Status.ACTIVE,
    )

    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 204

    desk.refresh_from_db()
    assert desk.is_active is False

    for booking in (booking1, booking2, booking3):
        booking.refresh_from_db()
        assert booking.status == DeskBooking.Status.CANCELLED
        assert booking.cancelled_at is not None
        assert booking.cancelled_by == owner_user

"""
Tests for DeskBookingDetailView (GET /api/offices/<o>/floors/<f>/bookings/<b>/)

Covers:
- Auth guards (TD-012)
- Identity visibility for own vs other vs owner/admin bookings (TD-013, TD-014)
- cancelled booking returns 404 (TD-012)
- Cross-org isolation
"""

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def booking_detail_url(office_id: int, floor_id: int, booking_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/{booking_id}/"


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
def sibling_floor(db, active_office):
    return Floor.objects.create(
        office=active_office, name="First Floor", slug="first-floor", level_number=1
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
def other_member_user(db, active_org):
    user = User.objects.create_user(
        username="othermember@example.com",
        email="othermember@example.com",
        password="pass123",
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
def admin_user(db, active_org):
    user = User.objects.create_user(
        username="admin@example.com", email="admin@example.com", password="pass123"
    )
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.ADMIN,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def other_org_user(db, other_org):
    user = User.objects.create_user(
        username="other@example.com", email="other@example.com", password="pass123"
    )
    Membership.objects.create(
        user=user,
        organization=other_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def inactive_member_user(db, active_org):
    user = User.objects.create_user(
        username="inactive@example.com",
        email="inactive@example.com",
        password="pass123",
    )
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    return user


@pytest.fixture
def no_membership_user(db):
    return User.objects.create_user(
        username="nomember@example.com",
        email="nomember@example.com",
        password="pass123",
    )


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


# ─── Auth guard tests ─────────────────────────────────────────────────────────


def test_unauthenticated_returns_401(
    client, active_office, active_floor, active_booking
):
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 401


def test_no_membership_returns_403(
    client, no_membership_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=no_membership_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 403


def test_inactive_membership_returns_403(
    client, inactive_member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=inactive_member_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 403


# ─── Successful retrieval tests ───────────────────────────────────────────────


def test_member_retrieves_own_active_booking(
    client, member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=member_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data["id"] == active_booking.id


def test_member_retrieves_own_booking_full_identity(
    client, member_user, active_office, active_floor, active_booking
):
    """Owner of a booking should see their own user ID and is_mine=True."""
    client.force_authenticate(user=member_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data["is_mine"] is True
    assert response.data["user"] == member_user.id
    # user_name should be the real name (not "Reserved")
    assert response.data["user_name"] != "Reserved"


def test_member_retrieves_other_booking_anonymized(
    client,
    other_member_user,
    active_office,
    active_floor,
    active_booking,
):
    """A member viewing another user's booking sees 'Reserved' and is_mine=False."""
    client.force_authenticate(user=other_member_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data["user_name"] == "Reserved"
    assert response.data["is_mine"] is False
    # user field should not be exposed for non-owners viewing others' bookings
    assert response.data.get("user") is None or "user" not in response.data


def test_owner_retrieves_any_booking_full_identity(
    client, owner_user, active_office, active_floor, active_booking, member_user
):
    """Owner can view any booking and sees full identity."""
    client.force_authenticate(user=owner_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data["user"] == member_user.id
    assert response.data["user_name"] != "Reserved"


def test_admin_retrieves_any_booking_full_identity(
    client, admin_user, active_office, active_floor, active_booking, member_user
):
    """Admin can view any booking and sees full identity."""
    client.force_authenticate(user=admin_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data["user"] == member_user.id
    assert response.data["user_name"] != "Reserved"


# ─── Identity masking / cancelled_by field ────────────────────────────────────


def test_cancelled_by_not_exposed_to_non_owner_member(
    db,
    client,
    other_member_user,
    owner_user,
    active_org,
    active_office,
    active_floor,
    desk,
    member_user,
    tomorrow,
):
    """A non-owner member must not see cancelled_by when viewing another's booking."""
    # Create a booking owned by member_user, cancelled by owner_user.
    booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    # We need to view it as active so detail returns 200 — peek at the field
    # after simulating a cancel (update directly without changing status).
    from django.utils import timezone

    DeskBooking.objects.filter(pk=booking.pk).update(
        cancelled_by=owner_user,
        cancelled_at=timezone.now(),
        # keep status ACTIVE so detail endpoint still returns it
    )

    client.force_authenticate(user=other_member_user)
    url = booking_detail_url(active_office.id, active_floor.id, booking.id)
    response = client.get(url)
    assert response.status_code == 200
    # cancelled_by should NOT be exposed to non-owner members viewing others' bookings
    cancelled_by_val = response.data.get("cancelled_by")
    assert "cancelled_by" not in response.data or cancelled_by_val is None


def test_no_email_in_detail_response(
    client, owner_user, active_office, active_floor, active_booking
):
    """Email must never appear in booking detail response."""
    client.force_authenticate(user=owner_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 200
    assert "email" not in response.data


# ─── Cross-org isolation tests ────────────────────────────────────────────────


def test_cross_org_returns_404(
    client, other_org_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=other_org_user)
    url = booking_detail_url(active_office.id, active_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 404


# ─── Cancelled booking returns 404 ───────────────────────────────────────────


def test_cancelled_booking_returns_404(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    tomorrow,
):
    cancelled = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.CANCELLED,
    )
    client.force_authenticate(user=member_user)
    url = booking_detail_url(active_office.id, active_floor.id, cancelled.id)
    response = client.get(url)
    assert response.status_code == 404


def test_nonexistent_booking_returns_404(
    client, member_user, active_office, active_floor
):
    client.force_authenticate(user=member_user)
    url = booking_detail_url(active_office.id, active_floor.id, 99999)
    response = client.get(url)
    assert response.status_code == 404


# ─── Wrong-floor routing test ─────────────────────────────────────────────────


def test_member_cannot_access_booking_via_wrong_floor(
    client,
    member_user,
    active_office,
    active_floor,
    sibling_floor,
    active_booking,
):
    """Accessing a booking via a sibling floor's URL returns 404."""
    # active_booking lives on active_floor; sibling_floor is a different floor
    # on the same office — the booking should not be reachable via sibling_floor.
    client.force_authenticate(user=member_user)
    url = booking_detail_url(active_office.id, sibling_floor.id, active_booking.id)
    response = client.get(url)
    assert response.status_code == 404

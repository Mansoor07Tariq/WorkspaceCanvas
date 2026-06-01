import datetime
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def booking_list_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/"


def valid_payload(desk_id: int, booking_date: str | None = None, **kwargs):
    if booking_date is None:
        booking_date = str(datetime.date.today() + datetime.timedelta(days=1))
    base = {"desk": desk_id, "booking_date": booking_date}
    base.update(kwargs)
    return base


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
    """A second floor in the SAME office/org as active_floor."""
    return Floor.objects.create(
        office=active_office, name="Level 1", slug="level-1", level_number=1
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
def other_floor_layout_object(db, other_floor):
    return FloorLayoutObject.objects.create(
        floor=other_floor,
        object_type="desk",
        label="Desk B1",
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
    )


@pytest.fixture
def sibling_floor_layout_object(db, sibling_floor):
    return FloorLayoutObject.objects.create(
        floor=sibling_floor,
        object_type="desk",
        label="Desk C1",
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
    )


@pytest.fixture
def sibling_floor_desk(
    db, active_org, active_office, sibling_floor, sibling_floor_layout_object
):
    """A desk on sibling_floor — same org/office as active_floor but different floor."""
    return Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=sibling_floor,
        layout_object=sibling_floor_layout_object,
        name="Desk C1",
        code="C1",
        status=Desk.Status.AVAILABLE,
        is_active=True,
    )


@pytest.fixture
def active_desk(db, active_org, active_office, active_floor, desk_layout_object):
    return Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Desk A1",
        code="A1",
        status=Desk.Status.AVAILABLE,
        is_active=True,
    )


@pytest.fixture
def other_floor_desk(
    db, other_org, other_office, other_floor, other_floor_layout_object
):
    return Desk.objects.create(
        organization=other_org,
        office=other_office,
        floor=other_floor,
        layout_object=other_floor_layout_object,
        name="Desk B1",
        code="B1",
        status=Desk.Status.AVAILABLE,
        is_active=True,
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
        username="nomembership@example.com",
        email="nomembership@example.com",
        password="pass123",
    )


# ─── Auth / permission tests ─────────────────────────────────────────────────


def test_unauthenticated_rejected(client, active_office, active_floor, active_desk):
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 401


def test_no_membership_rejected(
    client, no_membership_user, active_office, active_floor, active_desk
):
    client.force_authenticate(user=no_membership_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 403


def test_inactive_membership_rejected(
    client, inactive_member_user, active_office, active_floor, active_desk
):
    client.force_authenticate(user=inactive_member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 403


def test_member_can_book_desk(
    client, member_user, active_office, active_floor, active_desk
):
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 201


def test_owner_can_book_desk(
    client, owner_user, active_office, active_floor, active_desk
):
    client.force_authenticate(user=owner_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 201


def test_admin_can_book_desk(
    client, admin_user, active_office, active_floor, active_desk
):
    client.force_authenticate(user=admin_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 201


# ─── Field validation ────────────────────────────────────────────────────────


def test_desk_field_required(client, member_user, active_office, active_floor):
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    response = client.post(url, {"booking_date": tomorrow}, format="json")
    assert response.status_code == 400


def test_booking_date_field_required(
    client, member_user, active_office, active_floor, active_desk
):
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, {"desk": active_desk.id}, format="json")
    assert response.status_code == 400


def test_invalid_date_format_rejected(
    client, member_user, active_office, active_floor, active_desk
):
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(active_desk.id, booking_date="31/12/2099"), format="json"
    )
    assert response.status_code == 400


# ─── Date validation ─────────────────────────────────────────────────────────


def test_past_date_rejected(
    client, member_user, active_office, active_floor, active_desk
):
    yesterday = str(datetime.date.today() - datetime.timedelta(days=1))
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(active_desk.id, booking_date=yesterday), format="json"
    )
    assert response.status_code == 400


def test_today_allowed(client, member_user, active_office, active_floor, active_desk):
    today = str(datetime.date.today())
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(active_desk.id, booking_date=today), format="json"
    )
    assert response.status_code == 201


def test_future_date_allowed(
    client, member_user, active_office, active_floor, active_desk
):
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(active_desk.id, booking_date=tomorrow), format="json"
    )
    assert response.status_code == 201


# ─── Desk lookup / scope ─────────────────────────────────────────────────────


def test_desk_not_found(client, member_user, active_office, active_floor):
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(99999), format="json")
    assert response.status_code == 404


def test_inactive_desk_rejected(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk_layout_object,
):
    inactive_desk = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Inactive Desk",
        status=Desk.Status.AVAILABLE,
        is_active=False,
    )
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(inactive_desk.id), format="json")
    assert response.status_code == 404


def test_desk_status_unavailable_rejected(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk_layout_object,
):
    unavailable_desk = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Unavailable Desk",
        status=Desk.Status.UNAVAILABLE,
        is_active=True,
    )
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(unavailable_desk.id), format="json")
    assert response.status_code == 400


def test_desk_status_maintenance_rejected(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk_layout_object,
):
    maintenance_desk = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Maintenance Desk",
        status=Desk.Status.MAINTENANCE,
        is_active=True,
    )
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(maintenance_desk.id), format="json")
    assert response.status_code == 400


def test_desk_from_sibling_floor_rejected(
    client, member_user, active_office, active_floor, sibling_floor_desk
):
    """A desk on a sibling floor (same org and office, different floor) must not be
    bookable via the original floor's endpoint — proving floor-level scoping."""
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(sibling_floor_desk.id), format="json")
    assert response.status_code == 404


def test_desk_from_other_org_floor_rejected(
    client, member_user, active_office, active_floor, other_floor_desk
):
    """A desk from a completely different org/office/floor must not be bookable
    via this floor's endpoint."""
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(other_floor_desk.id), format="json")
    assert response.status_code == 404


# ─── Duplicate booking constraints ───────────────────────────────────────────


def test_duplicate_desk_date_rejected(
    db,
    client,
    member_user,
    admin_user,
    active_org,
    active_office,
    active_floor,
    active_desk,
):
    """Two active bookings for the same desk on the same date must be rejected."""
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    # First booking by admin
    DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=active_desk,
        user=admin_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    # Second booking attempt by member for the same desk+date
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(active_desk.id, booking_date=tomorrow), format="json"
    )
    assert response.status_code == 409


def test_duplicate_user_org_date_rejected(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    active_desk,
    desk_layout_object,
):
    """A user may not have two active bookings in the same org on the same date."""
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    # Create a second desk on the same floor so the duplicate is user+org+date
    second_layout_object = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk A2",
        x="200.00",
        y="200.00",
        width="80.00",
        height="50.00",
    )
    second_desk = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=second_layout_object,
        name="Desk A2",
        code="A2",
        status=Desk.Status.AVAILABLE,
        is_active=True,
    )
    # First booking for active_desk
    DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=active_desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    )
    # Second booking attempt by the same user for a different desk on the same date
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(second_desk.id, booking_date=tomorrow), format="json"
    )
    assert response.status_code == 409


def test_cancelled_booking_allows_rebook(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    active_desk,
):
    """After cancelling a booking the same desk+date combination can be rebooked."""
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    # Pre-create a cancelled booking
    DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=active_desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.CANCELLED,
    )
    # New booking for the same desk+date should succeed
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(active_desk.id, booking_date=tomorrow), format="json"
    )
    assert response.status_code == 201


# ─── Response integrity ───────────────────────────────────────────────────────


def test_body_user_field_ignored(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    active_desk,
):
    """Even if the request body contains a 'user' field it must be ignored;
    the booking must be assigned to the authenticated user."""
    other_user = User.objects.create_user(
        username="other@example.com", email="other@example.com", password="pass123"
    )
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    payload = valid_payload(active_desk.id, user=other_user.id)
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    booking = DeskBooking.objects.get(id=response.data["id"])
    assert booking.user == member_user


def test_created_booking_has_correct_fields(
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    active_desk,
):
    """The response must contain the expected set of fields with correct values."""
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(active_desk.id, booking_date=tomorrow), format="json"
    )
    assert response.status_code == 201
    data = response.data
    assert data["organization"] == active_org.id
    assert data["office"] == active_office.id
    assert data["floor"] == active_floor.id
    assert data["desk"] == active_desk.id
    assert data["user"] == member_user.id
    assert data["booking_date"] == tomorrow


# ─── Race condition / IntegrityError paths ────────────────────────────────────


def test_integrity_error_desk_date_returns_409(
    client,
    member_user,
    active_office,
    active_floor,
    active_desk,
):
    """When a concurrent insert triggers the unique_active_booking_per_desk_date
    constraint, the view must catch the IntegrityError and return 409 with a
    human-readable 'already booked' detail message.

    Booking creation now uses booking.save() inside the service, so the mock
    targets DeskBooking.save rather than DeskBooking.objects.create.
    """
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    with patch(
        "offices.models.DeskBooking.save",
        side_effect=IntegrityError("unique_active_booking_per_desk_date"),
    ):
        response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 409
    assert "already booked" in response.data["detail"]


def test_integrity_error_user_org_date_returns_409(
    client,
    member_user,
    active_office,
    active_floor,
    active_desk,
):
    """When a concurrent insert triggers the unique_active_booking_per_user_org_date
    constraint, the view must catch the IntegrityError and return 409 with a
    human-readable 'already have an active booking' detail message.

    Booking creation now uses booking.save() inside the service, so the mock
    targets DeskBooking.save rather than DeskBooking.objects.create.
    """
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id)
    with patch(
        "offices.models.DeskBooking.save",
        side_effect=IntegrityError("unique_active_booking_per_user_org_date"),
    ):
        response = client.post(url, valid_payload(active_desk.id), format="json")
    assert response.status_code == 409
    assert "already have an active booking" in response.data["detail"]

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def booking_cancel_url(office_id: int, floor_id: int, booking_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/{booking_id}/cancel/"


def booking_list_url(office_id: int, floor_id: int) -> str:
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


# ─── Auth / membership guard tests ──────────────────────────────────────────


def test_unauthenticated_rejected(client, active_office, active_floor, active_booking):
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 401


def test_no_membership_rejected(
    client, no_membership_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=no_membership_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 403


def test_inactive_membership_rejected(
    client, inactive_member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=inactive_member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 403


# ─── Permission tests ────────────────────────────────────────────────────────


def test_user_can_cancel_own_booking(
    client, member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 200
    assert response.data["status"] == DeskBooking.Status.CANCELLED


def test_owner_can_cancel_any_booking(
    client, owner_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=owner_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 200


def test_admin_can_cancel_any_booking(
    client, admin_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=admin_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 200


def test_member_cannot_cancel_others_booking(
    client,
    other_member_user,
    active_office,
    active_floor,
    active_booking,
):
    # active_booking belongs to member_user; other_member_user should be denied
    client.force_authenticate(user=other_member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 403


# ─── Routing / scoping tests ─────────────────────────────────────────────────


def test_cross_org_cancel_rejected(
    db,
    client,
    other_org_user,
    other_org,
    other_office,
    other_floor,
    active_office,
    active_floor,
    active_booking,
):
    # active_booking lives under active_office/active_floor (different org).
    # Requesting via that org's URL while authenticated as other_org_user should
    # return 404 because the office does not belong to the requester's org.
    client.force_authenticate(user=other_org_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 404


def test_booking_from_other_floor_rejected(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    active_floor,
    active_booking,
):
    # Create a sibling floor; try to cancel the booking via that floor's URL.
    sibling_floor = Floor.objects.create(
        office=active_office,
        name="First Floor",
        slug="first-floor",
        level_number=1,
    )
    client.force_authenticate(user=owner_user)
    url = booking_cancel_url(active_office.id, sibling_floor.id, active_booking.id)
    response = client.post(url)
    assert response.status_code == 404


# ─── Business-logic tests ────────────────────────────────────────────────────


def test_already_cancelled_rejected(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    tomorrow,
):
    already_cancelled = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=tomorrow,
        status=DeskBooking.Status.CANCELLED,
    )
    client.force_authenticate(user=member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, already_cancelled.id)
    response = client.post(url)
    assert response.status_code == 400


def test_cancellation_sets_cancelled_status(
    client, member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    client.post(url)
    active_booking.refresh_from_db()
    assert active_booking.status == DeskBooking.Status.CANCELLED


def test_cancellation_sets_cancelled_at(
    client, member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    client.post(url)
    active_booking.refresh_from_db()
    assert active_booking.cancelled_at is not None


def test_cancellation_sets_cancelled_by(
    client, member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    client.post(url)
    active_booking.refresh_from_db()
    assert active_booking.cancelled_by == member_user


# ─── Side-effect / list tests ────────────────────────────────────────────────


def test_cancelled_excluded_from_list(
    client, member_user, active_office, active_floor, active_booking
):
    booking_date = active_booking.booking_date
    client.force_authenticate(user=member_user)

    # Verify the booking appears in the list before cancellation.
    pre_response = client.get(
        booking_list_url(active_office.id, active_floor.id)
        + f"?date={booking_date.isoformat()}"
    )
    assert pre_response.status_code == 200
    assert isinstance(pre_response.data, list)
    pre_ids = [b["id"] for b in pre_response.data]
    assert active_booking.id in pre_ids

    # Cancel the booking.
    client.post(
        booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    )

    # The cancelled booking must no longer appear in the list.
    list_response = client.get(
        booking_list_url(active_office.id, active_floor.id)
        + f"?date={booking_date.isoformat()}"
    )
    assert list_response.status_code == 200
    assert isinstance(list_response.data, list)
    ids = [b["id"] for b in list_response.data]
    assert active_booking.id not in ids


def test_cancelled_allows_rebook_same_desk_date(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    tomorrow,
    active_booking,
):
    # Cancel the existing booking for (desk, tomorrow)
    client.force_authenticate(user=member_user)
    client.post(
        booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    )

    # A new booking for the same desk on the same date should now be accepted.
    payload = {"desk": desk.id, "booking_date": tomorrow.isoformat()}
    response = client.post(
        booking_list_url(active_office.id, active_floor.id),
        data=payload,
        format="json",
    )
    assert response.status_code == 201


def test_cancelled_allows_user_new_booking(
    db,
    client,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk,
    second_desk,
    tomorrow,
    active_booking,
):
    # Cancel the booking so the user's per-org-date slot is freed.
    client.force_authenticate(user=member_user)
    client.post(
        booking_cancel_url(active_office.id, active_floor.id, active_booking.id)
    )

    # User should now be able to book a different desk on the same date.
    payload = {"desk": second_desk.id, "booking_date": tomorrow.isoformat()}
    response = client.post(
        booking_list_url(active_office.id, active_floor.id),
        data=payload,
        format="json",
    )
    assert response.status_code == 201

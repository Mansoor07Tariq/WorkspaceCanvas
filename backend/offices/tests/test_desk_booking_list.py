import datetime

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def booking_list_url(office_id: int, floor_id: int, date: str) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/?date={date}"


def booking_list_url_no_date(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/"


def make_layout_object(floor, label="Desk A1"):
    return FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label=label,
        x="100.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )


def make_desk(org, office, floor, layout_object, name="Desk A1", code="A1"):
    return Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=layout_object,
        name=name,
        code=code,
        status=Desk.Status.AVAILABLE,
    )


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
def other_floor(db, active_office):
    return Floor.objects.create(
        office=active_office, name="Level 2", slug="level-2", level_number=2
    )


@pytest.fixture
def cross_org_floor(db, other_office):
    return Floor.objects.create(
        office=other_office, name="Level 1", slug="level-1", level_number=1
    )


@pytest.fixture
def desk_layout_object(db, active_floor):
    return make_layout_object(active_floor)


@pytest.fixture
def desk_resource(db, active_org, active_office, active_floor, desk_layout_object):
    return make_desk(active_org, active_office, active_floor, desk_layout_object)


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
def active_booking(
    db, active_org, active_office, active_floor, desk_resource, member_user
):
    return DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk_resource,
        user=member_user,
        booking_date=datetime.date.today(),
        status=DeskBooking.Status.ACTIVE,
    )


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_unauthenticated_rejected(client, active_office, active_floor):
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 401


def test_no_membership_rejected(db, client, active_office, active_floor):
    user = User.objects.create_user(
        username="nomember@example.com",
        email="nomember@example.com",
        password="pass123",
    )
    client.force_authenticate(user=user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 403


def test_inactive_membership_rejected(
    client, inactive_member_user, active_office, active_floor
):
    client.force_authenticate(user=inactive_member_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 403


def test_member_can_list_floor_bookings(
    client, member_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=member_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert active_booking.id in ids


def test_owner_can_list_bookings(
    client, owner_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=owner_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 200


def test_admin_can_list_bookings(
    client, admin_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=admin_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 200


def test_cross_org_user_cannot_list(
    client, other_org_user, active_office, active_floor
):
    client.force_authenticate(user=other_org_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 404


def test_date_query_required(client, member_user, active_office, active_floor):
    client.force_authenticate(user=member_user)
    url = booking_list_url_no_date(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 400


def test_invalid_date_rejected(client, member_user, active_office, active_floor):
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id, "not-a-date")
    response = client.get(url)
    assert response.status_code == 400


def test_only_active_bookings_returned(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    active_floor,
    desk_resource,
    member_user,
):
    today = datetime.date.today()
    active_booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk_resource,
        user=member_user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    # Create a second desk so we can make a cancelled booking on the same date
    second_layout_obj = make_layout_object(active_floor, label="Desk C1")
    second_desk = make_desk(
        active_org,
        active_office,
        active_floor,
        second_layout_obj,
        name="Desk C1",
        code="C1",
    )
    cancelled_booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=second_desk,
        user=owner_user,
        booking_date=today,
        status=DeskBooking.Status.CANCELLED,
    )
    client.force_authenticate(user=owner_user)
    url = booking_list_url(active_office.id, active_floor.id, today.isoformat())
    response = client.get(url)
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert active_booking.id in ids
    assert cancelled_booking.id not in ids


def test_only_floor_bookings_returned(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    active_floor,
    other_floor,
    desk_resource,
    member_user,
    active_booking,
):
    # Create a desk and booking on a different floor within the same office
    other_layout_obj = make_layout_object(other_floor, label="Desk B1")
    other_desk = make_desk(
        active_org,
        active_office,
        other_floor,
        other_layout_obj,
        name="Desk B1",
        code="B1",
    )
    other_booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=other_floor,
        desk=other_desk,
        user=member_user,
        booking_date=datetime.date.today() + datetime.timedelta(days=1),
        status=DeskBooking.Status.ACTIVE,
    )
    client.force_authenticate(user=owner_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 200
    ids = [b["id"] for b in response.data]
    assert active_booking.id in ids
    assert other_booking.id not in ids


def test_response_fields_present(
    client, owner_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=owner_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 200
    assert len(response.data) >= 1
    booking_data = response.data[0]
    expected_fields = {
        "id",
        "desk",
        "user",
        "booking_date",
        "status",
        "desk_name",
        "user_name",
    }
    assert expected_fields.issubset(booking_data.keys())


def test_no_email_in_response(
    client, owner_user, active_office, active_floor, active_booking
):
    client.force_authenticate(user=owner_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)
    response = client.get(url)
    assert response.status_code == 200
    assert len(response.data) >= 1
    booking_data = response.data[0]
    assert "email" not in booking_data


def test_member_sees_anonymized_user_for_others(
    db,
    client,
    member_user,
    owner_user,
    active_org,
    active_office,
    active_floor,
    desk_resource,
):
    """A member viewing another user's booking should see 'Reserved' as user_name,
    no email field, and is_mine == False."""
    today = datetime.date.today()
    # Booking owned by owner_user
    booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk_resource,
        user=owner_user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    # Request list as member_user (a different person)
    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id, today.isoformat())
    response = client.get(url)
    assert response.status_code == 200
    matching = [b for b in response.data if b["id"] == booking.id]
    assert len(matching) == 1
    booking_data = matching[0]
    assert booking_data["user_name"] == "Reserved"
    assert "email" not in booking_data
    assert booking_data["is_mine"] is False


def test_member_cannot_see_cancelled_by_for_others(
    db,
    client,
    member_user,
    owner_user,
    active_org,
    active_office,
    active_floor,
    desk_resource,
):
    """A regular member must not see cancelled_by for another user's booking."""

    today = datetime.date.today()
    booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk_resource,
        user=owner_user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    # Set cancelled_by without flipping status so the booking still appears in the list.
    DeskBooking.objects.filter(pk=booking.pk).update(
        cancelled_by=owner_user,
        cancelled_at=timezone.now(),
    )

    client.force_authenticate(user=member_user)
    url = booking_list_url(active_office.id, active_floor.id, today.isoformat())
    response = client.get(url)
    assert response.status_code == 200
    matching = [b for b in response.data if b["id"] == booking.id]
    assert len(matching) == 1
    booking_data = matching[0]
    cancelled_by_val = booking_data.get("cancelled_by")
    assert "cancelled_by" not in booking_data or cancelled_by_val is None


def test_admin_sees_full_identity_for_others(
    db,
    client,
    admin_user,
    member_user,
    active_org,
    active_office,
    active_floor,
    desk_resource,
):
    """Admin viewing another user's booking sees real user_name, not 'Reserved'."""
    today = datetime.date.today()
    booking = DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk_resource,
        user=member_user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    client.force_authenticate(user=admin_user)
    url = booking_list_url(active_office.id, active_floor.id, today.isoformat())
    response = client.get(url)
    assert response.status_code == 200
    matching = [b for b in response.data if b["id"] == booking.id]
    assert len(matching) == 1
    booking_data = matching[0]
    # Admin must see real identity, not the anonymized placeholder
    assert booking_data["user_name"] != "Reserved"
    assert booking_data.get("user") == member_user.id


# ─── BE-7: the floor bookings list must not N+1 on office / floor ────────────
# The serializer renders office_name and floor_name via SerializerMethodFields.
# Without select_related("office", "floor") each row costs two extra queries.


def _make_booking(org, office, floor, day, *, code):
    """A booking on its own desk AND its own user. Each same-day booking needs a
    distinct user because of the unique-active-booking-per-user-per-org-per-date
    constraint; a distinct desk keeps the desk-per-date constraint happy too. So N
    bookings = N distinct desks + N distinct users — the shape that exposes an N+1
    on either the desk join or the office/floor render."""
    user = User.objects.create_user(
        username=f"booker-{code}@example.com",
        email=f"booker-{code}@example.com",
        password="pass123",
    )
    Membership.objects.create(
        user=user,
        organization=org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    layout_object = make_layout_object(floor, label=f"Desk {code}")
    desk = make_desk(org, office, floor, layout_object, name=f"Desk {code}", code=code)
    return DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=user,
        booking_date=day,
        status=DeskBooking.Status.ACTIVE,
    )


def test_bookings_list_query_count_is_constant(
    django_assert_num_queries,
    client,
    admin_user,
    active_org,
    active_office,
    active_floor,
):
    """Pins the exact query count for the floor bookings list (measured: 5).

    membership pre-check + office + that office's org-membership + floor + the
    bookings SELECT (which joins desk/user/cancelled_by/office/floor). Dropping
    `office`/`floor` from the view's select_related makes the serializer
    dereference obj.office and obj.floor per row, which would push this to 5 + 2N —
    hence the companion invariance test below, which does not hard-code the number.
    """
    today = timezone.now().date()
    for i in range(3):
        _make_booking(active_org, active_office, active_floor, today, code=f"Q{i}")
    client.force_authenticate(user=admin_user)
    url = booking_list_url(active_office.id, active_floor.id, today.isoformat())

    with django_assert_num_queries(5):
        response = client.get(url)

    assert response.status_code == 200
    assert len(response.data) == 3


def test_bookings_list_query_count_does_not_grow_with_bookings(
    client,
    admin_user,
    active_org,
    active_office,
    active_floor,
):
    """The N+1 guard proper: the same request must cost the SAME number of queries
    with 1 booking as with 4.

    Deliberately measures the baseline instead of hard-coding it, so it keeps
    guarding the N+1 even if an unrelated change shifts the absolute count (unlike
    the exact-count test above, which would then need a new number).
    """
    today = timezone.now().date()
    client.force_authenticate(user=admin_user)
    url = booking_list_url(active_office.id, active_floor.id, today.isoformat())

    _make_booking(active_org, active_office, active_floor, today, code="N0")
    with CaptureQueriesContext(connection) as one_booking:
        assert client.get(url).status_code == 200
    baseline = len(one_booking.captured_queries)

    for i in range(1, 4):
        _make_booking(active_org, active_office, active_floor, today, code=f"N{i}")
    with CaptureQueriesContext(connection) as four_bookings:
        response = client.get(url)

    # Without select_related("office","floor") this would be baseline + 2*3.
    assert len(four_bookings.captured_queries) == baseline
    assert response.status_code == 200
    assert len(response.data) == 4

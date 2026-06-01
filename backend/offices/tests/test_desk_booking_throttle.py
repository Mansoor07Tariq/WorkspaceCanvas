"""Throttle tests for DeskBooking endpoints (TD-015).

Strategy: monkeypatch SimpleRateThrottle.THROTTLE_RATES directly.
override_settings does not fire DRF's setting_changed signal, so
it has no effect on the class attribute that ScopedRateThrottle
reads at runtime. This is the same approach used in users/tests/test_throttling.py.

The autouse clear_cache fixture in conftest.py ensures counters start clean.
"""

from __future__ import annotations

import datetime

import pytest
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = None  # populated in fixtures via get_user_model()


# ─── Throttle helper ─────────────────────────────────────────────────────────


def _tight_throttle(monkeypatch, scope: str, rate: str = "1/min") -> None:
    """Patch SimpleRateThrottle.THROTTLE_RATES to saturate quota after one request."""
    rates = {**SimpleRateThrottle.THROTTLE_RATES, scope: rate}
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)


# ─── URL helpers ─────────────────────────────────────────────────────────────


def booking_list_url(office_id: int, floor_id: int, date: str) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/?date={date}"


def booking_create_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/"


def booking_cancel_url(office_id: int, floor_id: int, booking_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/{booking_id}/cancel/"


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
        name="Throttle Corp",
        slug="throttle-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def active_office(db, active_org):
    return Office.objects.create(
        organization=active_org, name="Throttle Office", slug="throttle-office"
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
        label="Desk T1",
        x="100.00",
        y="100.00",
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
        name="Desk T1",
        code="T1",
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def member_user(db, active_org):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(
        username="throttle_member@example.com",
        email="throttle_member@example.com",
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


@pytest.mark.django_db
def test_booking_list_throttled(
    client, member_user, active_office, active_floor, active_booking, monkeypatch
):
    """Exceed desk_booking_read limit on the floor booking list endpoint."""
    _tight_throttle(monkeypatch, "desk_booking_read")
    client.force_authenticate(user=member_user)
    today = datetime.date.today().isoformat()
    url = booking_list_url(active_office.id, active_floor.id, today)

    r1 = client.get(url)
    assert r1.status_code != 429, "First request should not be throttled"

    r2 = client.get(url)
    assert r2.status_code == 429, f"Expected 429 on second read, got {r2.status_code}"


@pytest.mark.django_db
def test_booking_create_throttled(
    db,
    client,
    member_user,
    active_office,
    active_floor,
    desk,
    tomorrow,
    monkeypatch,
):
    """Exceed desk_booking_write limit on booking create endpoint."""
    _tight_throttle(monkeypatch, "desk_booking_write")
    client.force_authenticate(user=member_user)
    url = booking_create_url(active_office.id, active_floor.id)
    payload = {"desk": desk.id, "booking_date": tomorrow.isoformat()}

    r1 = client.post(url, data=payload, format="json")
    assert r1.status_code != 429, "First request should not be throttled"

    # Second request is throttled before business logic runs.
    r2 = client.post(url, data=payload, format="json")
    assert r2.status_code == 429, (
        f"Expected 429 on second write request, got {r2.status_code}"
    )


@pytest.mark.django_db
def test_booking_cancel_throttled(
    client, member_user, active_office, active_floor, active_booking, monkeypatch
):
    """Exceed desk_booking_write limit on the floor-scoped cancel endpoint."""
    _tight_throttle(monkeypatch, "desk_booking_write")
    client.force_authenticate(user=member_user)
    url = booking_cancel_url(active_office.id, active_floor.id, active_booking.id)

    r1 = client.post(url)
    assert r1.status_code != 429, "First request should not be throttled"

    # Second request is throttled before the view checks booking state.
    r2 = client.post(url)
    assert r2.status_code == 429, (
        f"Expected 429 on second cancel request, got {r2.status_code}"
    )


@pytest.mark.django_db
def test_my_bookings_list_throttled(client, member_user, active_booking, monkeypatch):
    """Exceed desk_booking_read limit on /api/bookings/my/."""
    _tight_throttle(monkeypatch, "desk_booking_read")
    client.force_authenticate(user=member_user)

    r1 = client.get(MY_BOOKINGS_URL)
    assert r1.status_code != 429, "First request should not be throttled"

    r2 = client.get(MY_BOOKINGS_URL)
    assert r2.status_code == 429, (
        f"Expected 429 on second my-bookings read, got {r2.status_code}"
    )


@pytest.mark.django_db
def test_my_booking_cancel_throttled(client, member_user, active_booking, monkeypatch):
    """Exceed desk_booking_write limit on /api/bookings/my/<id>/cancel/."""
    _tight_throttle(monkeypatch, "desk_booking_write")
    client.force_authenticate(user=member_user)
    url = my_cancel_url(active_booking.id)

    r1 = client.post(url)
    assert r1.status_code != 429, "First request should not be throttled"

    # Second request is throttled before the view checks booking state.
    r2 = client.post(url)
    assert r2.status_code == 429, (
        f"Expected 429 on second my-cancel request, got {r2.status_code}"
    )

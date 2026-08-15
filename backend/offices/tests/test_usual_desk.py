"""Tests for UsualDeskView (GET /api/bookings/my/usual-desk/) — PR 079.

Thin read-only endpoint over the existing ``resolve_usual_desk`` service: it returns the
caller's most-recently-booked active desk in the selected org, or null.
"""

from __future__ import annotations

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()

USUAL_DESK_URL = "/api/bookings/my/usual-desk/"


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name="Acme",
        slug="acme",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def office(db, org):
    return Office.objects.create(organization=org, name="Dublin", slug="dublin")


@pytest.fixture
def floor(db, office):
    return Floor.objects.create(
        office=office, name="Ground", slug="ground", level_number=0
    )


@pytest.fixture
def desk(db, org, office, floor):
    lo = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="Desk A1",
        x="10",
        y="20",
        width="80",
        height="50",
    )
    return Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=lo,
        name="Desk A1",
        code="A1",
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def member(db, org):
    user = User.objects.create_user(
        username="m@example.com", email="m@example.com", password="pass123"
    )
    Membership.objects.create(
        user=user,
        organization=org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def no_membership_user(db):
    return User.objects.create_user(
        username="nobody@example.com", email="nobody@example.com", password="pass123"
    )


def test_unauthenticated_returns_401(client):
    assert client.get(USUAL_DESK_URL).status_code == 401


def test_no_membership_returns_403(client, no_membership_user):
    client.force_authenticate(user=no_membership_user)
    assert client.get(USUAL_DESK_URL).status_code == 403


def test_no_usual_desk_returns_null(client, member):
    client.force_authenticate(user=member)
    res = client.get(USUAL_DESK_URL)
    assert res.status_code == 200
    assert res.data == {"usual_desk": None}


def test_returns_most_recent_booked_desk(client, member, org, office, floor, desk):
    DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=member,
        booking_date=datetime.date(2000, 1, 1),
        status=DeskBooking.Status.ACTIVE,
    )
    client.force_authenticate(user=member)
    res = client.get(USUAL_DESK_URL)
    assert res.status_code == 200
    payload = res.data["usual_desk"]
    assert payload["id"] == desk.id
    assert payload["office"] == office.id
    assert payload["floor"] == floor.id
    assert payload["layout_object"] == desk.layout_object_id
    assert payload["name"] == "Desk A1"
    assert payload["code"] == "A1"
    assert payload["floor_name"] == "Ground"
    assert payload["office_name"] == "Dublin"


def test_usual_desk_is_scoped_to_the_selected_org(
    client, member, org, office, floor, desk
):
    """resolve_usual_desk is scoped to the caller's org; a booking in another org the
    user isn't a member of never surfaces here."""
    DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=member,
        booking_date=datetime.date(2000, 1, 1),
        status=DeskBooking.Status.ACTIVE,
    )
    client.force_authenticate(user=member)
    # Explicit selected-org param that the user IS a member of → resolves.
    res = client.get(USUAL_DESK_URL + f"?organization={org.id}")
    assert res.status_code == 200
    assert res.data["usual_desk"]["id"] == desk.id
    # A selected-org param the user is NOT a member of → no membership → 403.
    res = client.get(USUAL_DESK_URL + "?organization=999999")
    assert res.status_code == 403

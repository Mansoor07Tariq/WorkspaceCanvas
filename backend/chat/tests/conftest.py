import datetime

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from chat.models import ChatLink
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()


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
    # Floors default to PUBLISHED → bookable.
    return Floor.objects.create(
        office=office, name="Ground", slug="ground", level_number=0
    )


@pytest.fixture
def user(db, org):
    u = User.objects.create_user(
        username="member@example.com", email="member@example.com", password="pass123"
    )
    Membership.objects.create(
        user=u,
        organization=org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return u


@pytest.fixture
def other_user(db, org):
    u = User.objects.create_user(
        username="other@example.com", email="other@example.com", password="pass123"
    )
    Membership.objects.create(
        user=u,
        organization=org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return u


@pytest.fixture
def desk(db, org, office, floor):
    lo = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="Desk A1",
        x="1",
        y="1",
        width="10",
        height="10",
        rotation="0",
    )
    return Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=lo,
        name="Desk A1",
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def usual_booking(db, org, office, floor, user, desk):
    """A past active booking → establishes the user's 'usual desk' without blocking
    a booking for today."""
    return DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=user,
        booking_date=datetime.date(2000, 1, 1),
        status=DeskBooking.Status.ACTIVE,
    )


@pytest.fixture
def linked(db, user):
    return ChatLink.objects.create(
        platform="slack",
        external_user_id="U123",
        external_team_id="T1",
        user=user,
        status=ChatLink.Status.LINKED,
        used_at=timezone.now(),
        linked_at=timezone.now(),
        expires_at=timezone.now() + datetime.timedelta(days=1),
    )


@pytest.fixture
def api_client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()

"""Floor setup lifecycle (PR 064): draft/published status + booking gating."""

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, Floor, FloorLayoutObject, Office

User = get_user_model()


def floor_detail_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/"


def booking_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/"


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name="Acme Corp",
        slug="acme-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def office(db, org):
    return Office.objects.create(organization=org, name="Dublin", slug="dublin")


@pytest.fixture
def floor(db, office):
    return Floor.objects.create(office=office, name="Ground", slug="ground")


def _member(org, role, email):
    user = User.objects.create_user(
        username=email, email=email, password="Strongpass1!"
    )
    Membership.objects.create(
        user=user, organization=org, role=role, status=Membership.Status.ACTIVE
    )
    return user


@pytest.fixture
def owner_client(client, org):
    client.force_authenticate(user=_member(org, MemberRole.OWNER, "owner@example.com"))
    return client


@pytest.fixture
def member_client(client, org):
    client.force_authenticate(
        user=_member(org, MemberRole.MEMBER, "member@example.com")
    )
    return client


@pytest.fixture
def desk(db, org, office, floor):
    obj = FloorLayoutObject.objects.create(
        floor=floor,
        object_type="desk",
        label="A1",
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
    )
    return Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=obj,
        name="A1",
        code="A1",
        status=Desk.Status.AVAILABLE,
        is_active=True,
    )


# ─── Status field & defaults ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_new_floor_defaults_to_published(floor):
    assert floor.status == Floor.Status.PUBLISHED


@pytest.mark.django_db
def test_patch_response_includes_status(owner_client, office, floor):
    res = owner_client.patch(
        floor_detail_url(office.id, floor.id),
        {"boundary_width": "1000.00"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["status"] == "published"


# ─── Publish / unpublish transitions ──────────────────────────────────────────


@pytest.mark.django_db
def test_owner_can_unpublish_then_publish(owner_client, office, floor):
    res = owner_client.patch(
        floor_detail_url(office.id, floor.id), {"status": "draft"}, format="json"
    )
    assert res.status_code == 200
    floor.refresh_from_db()
    assert floor.status == Floor.Status.DRAFT

    res = owner_client.patch(
        floor_detail_url(office.id, floor.id), {"status": "published"}, format="json"
    )
    assert res.status_code == 200
    floor.refresh_from_db()
    assert floor.status == Floor.Status.PUBLISHED


@pytest.mark.django_db
def test_member_cannot_change_status(member_client, office, floor):
    res = member_client.patch(
        floor_detail_url(office.id, floor.id), {"status": "draft"}, format="json"
    )
    assert res.status_code == 403
    floor.refresh_from_db()
    assert floor.status == Floor.Status.PUBLISHED


@pytest.mark.django_db
def test_invalid_status_rejected(owner_client, office, floor):
    res = owner_client.patch(
        floor_detail_url(office.id, floor.id), {"status": "bogus"}, format="json"
    )
    assert res.status_code == 400


# ─── Booking gating ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_cannot_book_a_draft_floor(member_client, office, floor, desk):
    floor.status = Floor.Status.DRAFT
    floor.save(update_fields=["status"])
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    res = member_client.post(
        booking_url(office.id, floor.id),
        {"desk": desk.id, "booking_date": tomorrow},
        format="json",
    )
    assert res.status_code == 409
    assert "not published" in res.data["detail"].lower()


@pytest.mark.django_db
def test_can_book_a_published_floor(member_client, office, floor, desk):
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    res = member_client.post(
        booking_url(office.id, floor.id),
        {"desk": desk.id, "booking_date": tomorrow},
        format="json",
    )
    assert res.status_code == 201

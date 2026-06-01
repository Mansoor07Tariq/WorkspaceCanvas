"""
Tests for Desk.code DB-level partial uniqueness constraint (Task 10 / TD-004).

The constraint: unique_active_desk_code_per_office
  fields=["office", "code"]
  condition=Q(is_active=True) & ~Q(code="")

Covers:
- Duplicate code in same office rejected (400)
- Same code in different office allowed (201)
- Blank code allowed multiple times in same office (201)
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def desk_list_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/desks/"


def desk_detail_url(office_id: int, floor_id: int, desk_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/desks/{desk_id}/"


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
def layout_object_a(db, active_floor):
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
def layout_object_b(db, active_floor):
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
def layout_object_c(db, active_floor):
    return FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk C1",
        x="300.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )


@pytest.fixture
def other_layout_object(db, other_floor):
    return FloorLayoutObject.objects.create(
        floor=other_floor,
        object_type="desk",
        label="Desk X1",
        x="100.00",
        y="150.00",
        width="80.00",
        height="50.00",
    )


@pytest.fixture
def desk_a(db, active_org, active_office, active_floor, layout_object_a):
    return Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=layout_object_a,
        name="Desk A1",
        code="A1",
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def desk_b(db, active_org, active_office, active_floor, layout_object_b):
    return Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=layout_object_b,
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
def other_owner_user(db, other_org):
    user = User.objects.create_user(
        username="other_owner@example.com",
        email="other_owner@example.com",
        password="pass123",
    )
    Membership.objects.create(
        user=user,
        organization=other_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_duplicate_code_in_same_office_rejected(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    active_floor,
    layout_object_b,
    desk_a,
):
    """Creating a second desk with the same code in the same office returns 400."""
    client.force_authenticate(user=owner_user)
    response = client.post(
        desk_list_url(active_office.id, active_floor.id),
        data={
            "layout_object": layout_object_b.id,
            "name": "Desk B1",
            "code": "A1",  # same as desk_a
        },
        format="json",
    )
    assert response.status_code == 400
    assert "code" in response.data


def test_same_code_in_different_office_allowed(
    db,
    client,
    other_owner_user,
    other_org,
    other_office,
    other_floor,
    other_layout_object,
    desk_a,
):
    """Same code is allowed in a different office."""
    client.force_authenticate(user=other_owner_user)
    response = client.post(
        desk_list_url(other_office.id, other_floor.id),
        data={
            "layout_object": other_layout_object.id,
            "name": "Desk X1",
            "code": "A1",  # same code as desk_a but different office
        },
        format="json",
    )
    assert response.status_code == 201


def test_blank_code_allowed_multiple_times_same_office(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    active_floor,
    layout_object_b,
    layout_object_c,
):
    """Multiple desks with blank code in the same office are allowed."""
    client.force_authenticate(user=owner_user)
    response1 = client.post(
        desk_list_url(active_office.id, active_floor.id),
        data={
            "layout_object": layout_object_b.id,
            "name": "Desk B1",
            "code": "",
        },
        format="json",
    )
    assert response1.status_code == 201

    response2 = client.post(
        desk_list_url(active_office.id, active_floor.id),
        data={
            "layout_object": layout_object_c.id,
            "name": "Desk C1",
            "code": "",
        },
        format="json",
    )
    assert response2.status_code == 201


def test_code_allowed_after_soft_delete(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    active_floor,
    layout_object_b,
    desk_a,
):
    """After soft-deleting a desk, its code can be reused in the same office."""
    # Soft-delete desk_a (which has code A1)
    desk_a.is_active = False
    desk_a.save()

    client.force_authenticate(user=owner_user)
    response = client.post(
        desk_list_url(active_office.id, active_floor.id),
        data={
            "layout_object": layout_object_b.id,
            "name": "New Desk A1",
            "code": "A1",  # reuse the same code after soft-delete
        },
        format="json",
    )
    assert response.status_code == 201


def test_patch_code_to_existing_code_rejected(
    db,
    client,
    owner_user,
    active_office,
    active_floor,
    desk_a,
    desk_b,
):
    """PATCHing a desk's code to one already used by another active desk returns 400."""
    client.force_authenticate(user=owner_user)
    # desk_a has code "A1"; try to patch desk_b to also use "A1"
    response = client.patch(
        desk_detail_url(active_office.id, active_floor.id, desk_b.id),
        data={"code": "A1"},
        format="json",
    )
    assert response.status_code == 400
    assert "code" in response.data

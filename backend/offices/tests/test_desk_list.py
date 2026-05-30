import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def desk_list_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/desks/"


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
def desk_resource(db, active_org, active_office, active_floor, desk_layout_object):
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


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_list_unauthenticated_returns_401(client, active_office, active_floor):
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 401


def test_list_no_membership_returns_403(client, active_office, active_floor):
    user = User.objects.create_user(
        username="nomember@example.com",
        email="nomember@example.com",
        password="pass123",
    )
    client.force_authenticate(user=user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 403


def test_list_inactive_membership_returns_403(
    client, inactive_member_user, active_office, active_floor
):
    client.force_authenticate(user=inactive_member_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 403


def test_list_member_can_list(
    client, member_user, active_office, active_floor, desk_resource
):
    client.force_authenticate(user=member_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200


def test_list_owner_can_list(
    client, owner_user, active_office, active_floor, desk_resource
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200


def test_list_cross_org_office_returns_404(
    client, other_org_user, active_office, active_floor
):
    client.force_authenticate(user=other_org_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 404


def test_list_returns_desks_for_requested_floor_only(
    db, client, owner_user, active_org, active_office, active_floor, desk_resource
):
    # Create another floor and desk in the same office
    other_floor = Floor.objects.create(
        office=active_office, name="Level 2", slug="level-2", level_number=2
    )
    obj2 = FloorLayoutObject.objects.create(
        floor=other_floor,
        object_type="desk",
        label="Desk B1",
        x="200.00",
        y="200.00",
        width="80.00",
        height="50.00",
    )
    Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=other_floor,
        layout_object=obj2,
        name="Desk B1",
    )
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["id"] == desk_resource.id


def test_list_excludes_inactive_desks(
    db, client, owner_user, active_org, active_office, active_floor, desk_resource
):
    desk_resource.is_active = False
    desk_resource.save()
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data == []


def test_list_empty_floor_returns_empty_list(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data == []


def test_list_response_has_required_fields(
    client, owner_user, active_office, active_floor, desk_resource
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200
    assert len(response.data) == 1
    desk_data = response.data[0]
    expected_fields = {
        "id",
        "organization",
        "office",
        "floor",
        "layout_object",
        "layout_object_type",
        "layout_object_label",
        "name",
        "code",
        "status",
        "status_display",
        "amenities",
        "notes",
        "is_active",
        "created_at",
        "updated_at",
    }
    assert expected_fields.issubset(desk_data.keys())


def test_list_response_includes_layout_object_info(
    client, owner_user, active_office, active_floor, desk_resource, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200
    desk_data = response.data[0]
    assert desk_data["layout_object"] == desk_layout_object.id
    assert desk_data["layout_object_type"] == "desk"
    assert desk_data["layout_object_label"] == "Desk A1"


def test_list_response_includes_status_display(
    client, owner_user, active_office, active_floor, desk_resource
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.data[0]["status"] == "available"
    assert response.data[0]["status_display"] == "Available"

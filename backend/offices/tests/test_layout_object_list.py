import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def layout_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/layout-objects/"


def make_obj(floor, **kwargs):
    defaults = dict(
        object_type=FloorLayoutObject.ObjectType.DESK,
        label="Desk A1",
        x=100,
        y=100,
        width=80,
        height=50,
    )
    defaults.update(kwargs)
    return FloorLayoutObject.objects.create(floor=floor, **defaults)


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
        organization=active_org,
        name="Dublin Office",
        slug="dublin-office",
    )


@pytest.fixture
def other_office(db, other_org):
    return Office.objects.create(
        organization=other_org,
        name="London Office",
        slug="london-office",
    )


@pytest.fixture
def active_floor(db, active_office):
    return Floor.objects.create(
        office=active_office,
        name="Ground Floor",
        slug="ground-floor",
        level_number=0,
    )


@pytest.fixture
def other_floor(db, other_office):
    return Floor.objects.create(
        office=other_office,
        name="Level 1",
        slug="level-1",
        level_number=1,
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


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_list_unauthenticated(client, active_office, active_floor):
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 401


def test_list_no_membership(client, active_office, active_floor):
    user = User.objects.create_user(
        username="none@example.com", email="none@example.com", password="pass"
    )
    client.force_authenticate(user=user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 403


def test_list_inactive_membership_returns_403(
    client, inactive_member_user, active_office, active_floor
):
    client.force_authenticate(user=inactive_member_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 403


def test_list_cross_org_office_returns_404(
    client, owner_user, other_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(other_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 404


def test_list_floor_from_another_office_returns_404(
    client, owner_user, active_office, other_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, other_floor.id)
    response = client.get(url)
    assert response.status_code == 404


def test_list_member_can_list(client, member_user, active_office, active_floor):
    client.force_authenticate(user=member_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200


def test_list_owner_can_list(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200


def test_list_empty_returns_empty_list(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data == []


def test_list_returns_objects_for_floor(
    client, owner_user, active_office, active_floor
):
    obj = make_obj(active_floor, label="Desk 1")
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["id"] == obj.id


def test_list_excludes_objects_from_other_floor(
    client, owner_user, active_office, active_floor, other_floor
):
    make_obj(other_floor, label="Other Desk")
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.data == []


def test_list_excludes_inactive_objects(
    client, owner_user, active_office, active_floor
):
    make_obj(active_floor, label="Active Desk")
    make_obj(active_floor, label="Inactive Desk", is_active=False)
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert len(response.data) == 1
    assert response.data[0]["label"] == "Active Desk"


def test_list_response_fields_present(client, owner_user, active_office, active_floor):
    make_obj(active_floor)
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    obj = response.data[0]
    expected = {
        "id",
        "floor",
        "object_type",
        "object_type_display",
        "label",
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "is_bookable",
        "metadata",
        "is_active",
        "created_at",
        "updated_at",
    }
    assert expected.issubset(obj.keys())


def test_list_object_type_display_present(
    client, owner_user, active_office, active_floor
):
    make_obj(active_floor, object_type=FloorLayoutObject.ObjectType.DESK)
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.get(url)
    assert response.data[0]["object_type_display"] == "Desk"

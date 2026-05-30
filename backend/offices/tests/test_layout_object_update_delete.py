import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def detail_url(office_id: int, floor_id: int, object_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/layout-objects/{object_id}/"


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
    user = User.objects.create_user(email="owner@example.com", password="pass123")
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def admin_user(db, active_org):
    user = User.objects.create_user(email="admin@example.com", password="pass123")
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.ADMIN,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def member_user(db, active_org):
    user = User.objects.create_user(email="member@example.com", password="pass123")
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def layout_obj(db, active_floor):
    return make_obj(active_floor)


# ─── PATCH tests ─────────────────────────────────────────────────────────────


def test_patch_member_cannot_update(
    client, member_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=member_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"label": "Updated"}, format="json")
    assert response.status_code == 403


def test_patch_owner_can_update(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"label": "New Label"}, format="json")
    assert response.status_code == 200
    assert response.data["label"] == "New Label"


def test_patch_admin_can_update(
    client, admin_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=admin_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"label": "Admin Label"}, format="json")
    assert response.status_code == 200


def test_patch_updates_position(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"x": "200.00", "y": "300.00"}, format="json")
    assert response.status_code == 200
    assert response.data["x"] == "200.00"
    assert response.data["y"] == "300.00"


def test_patch_updates_size(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"width": "120.00", "height": "70.00"}, format="json")
    assert response.status_code == 200
    assert response.data["width"] == "120.00"
    assert response.data["height"] == "70.00"


def test_patch_updates_rotation(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"rotation": "45.00"}, format="json")
    assert response.status_code == 200
    assert response.data["rotation"] == "45.00"


def test_patch_updates_metadata(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"metadata": {"color": "#FF0000"}}, format="json")
    assert response.status_code == 200
    assert response.data["metadata"] == {"color": "#FF0000"}


def test_patch_updates_object_type(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"object_type": "chair"}, format="json")
    assert response.status_code == 200
    assert response.data["object_type"] == "chair"


def test_patch_invalid_width_rejected(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"width": "0"}, format="json")
    assert response.status_code == 400


def test_patch_invalid_height_rejected(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"height": "-5"}, format="json")
    assert response.status_code == 400


def test_patch_invalid_object_type_rejected(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(url, {"object_type": "rocket"}, format="json")
    assert response.status_code == 400


def test_patch_cross_org_object_rejected(client, owner_user, other_office, other_floor):
    other_obj = make_obj(other_floor)
    client.force_authenticate(user=owner_user)
    url = detail_url(other_office.id, other_floor.id, other_obj.id)
    response = client.patch(url, {"label": "Hacked"}, format="json")
    assert response.status_code == 404


def test_patch_floor_field_ignored(
    client, owner_user, active_office, active_floor, layout_obj, other_floor
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.patch(
        url, {"floor": other_floor.id, "label": "Safe"}, format="json"
    )
    assert response.status_code == 200
    layout_obj.refresh_from_db()
    assert layout_obj.floor_id == active_floor.id


# ─── DELETE tests ────────────────────────────────────────────────────────────


def test_delete_member_cannot_delete(
    client, member_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=member_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.delete(url)
    assert response.status_code == 403


def test_delete_owner_can_delete(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    response = client.delete(url)
    assert response.status_code == 204


def test_delete_soft_deletes_object(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    url = detail_url(active_office.id, active_floor.id, layout_obj.id)
    client.delete(url)
    layout_obj.refresh_from_db()
    assert layout_obj.is_active is False


def test_delete_object_not_returned_by_list(
    client, owner_user, active_office, active_floor, layout_obj
):
    client.force_authenticate(user=owner_user)
    detail = detail_url(active_office.id, active_floor.id, layout_obj.id)
    client.delete(detail)
    list_url = (
        f"/api/offices/{active_office.id}/floors/{active_floor.id}/layout-objects/"
    )
    response = client.get(list_url)
    assert response.status_code == 200
    assert response.data == []


def test_delete_cross_org_object_rejected(
    client, owner_user, other_office, other_floor
):
    other_obj = make_obj(other_floor)
    client.force_authenticate(user=owner_user)
    url = detail_url(other_office.id, other_floor.id, other_obj.id)
    response = client.delete(url)
    assert response.status_code == 404

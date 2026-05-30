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
        amenities={"monitor": True},
        notes="Window seat",
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


# ─── GET detail tests ────────────────────────────────────────────────────────


def test_get_unauthenticated_returns_401(client, active_office, active_floor, desk):
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 401


def test_get_no_membership_returns_403(
    client, no_membership_user, active_office, active_floor, desk
):
    client.force_authenticate(user=no_membership_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 403


def test_get_inactive_membership_returns_403(
    client, inactive_member_user, active_office, active_floor, desk
):
    client.force_authenticate(user=inactive_member_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 403


def test_get_member_can_retrieve(
    client, member_user, active_office, active_floor, desk
):
    client.force_authenticate(user=member_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 200


def test_get_owner_can_retrieve(client, owner_user, active_office, active_floor, desk):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 200


def test_get_admin_can_retrieve(client, admin_user, active_office, active_floor, desk):
    client.force_authenticate(user=admin_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 200


def test_get_cross_org_returns_404(
    client, other_org_user, active_office, active_floor, desk
):
    client.force_authenticate(user=other_org_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 404


def test_get_inactive_desk_returns_404(
    client, owner_user, active_org, active_office, active_floor, desk_layout_object
):
    inactive_desk = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Old Desk",
        is_active=False,
    )
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, inactive_desk.id)
    response = client.get(url)
    assert response.status_code == 404


def test_get_nonexistent_desk_returns_404(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, 99999)
    response = client.get(url)
    assert response.status_code == 404


def test_get_response_has_all_fields(
    client, owner_user, active_office, active_floor, desk
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 200
    expected = {
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
    assert expected.issubset(response.data.keys())


def test_get_includes_layout_object_info(
    client, owner_user, active_office, active_floor, desk
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 200
    assert response.data["layout_object_type"] == "desk"
    assert response.data["layout_object_label"] == "Desk A1"


def test_get_desk_from_other_floor_returns_404(
    db, client, owner_user, active_office, active_floor, desk
):
    # desk belongs to active_floor; request via a sibling floor in the same office
    second_floor = Floor.objects.create(
        office=active_office,
        name="First Floor",
        slug="first-floor",
        level_number=1,
    )
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, second_floor.id, desk.id)
    response = client.get(url)
    assert response.status_code == 404


# ─── PATCH tests ──────────────────────────────────────────────────────────────


def test_update_unauthenticated_returns_401(client, active_office, active_floor, desk):
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"name": "New Name"}, format="json")
    assert response.status_code == 401


def test_update_member_cannot_update(
    client, member_user, active_office, active_floor, desk
):
    client.force_authenticate(user=member_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"name": "New Name"}, format="json")
    assert response.status_code == 403


def test_update_owner_can_update(client, owner_user, active_office, active_floor, desk):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"name": "New Name"}, format="json")
    assert response.status_code == 200
    assert response.data["name"] == "New Name"


def test_update_admin_can_update(client, admin_user, active_office, active_floor, desk):
    client.force_authenticate(user=admin_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"name": "Updated"}, format="json")
    assert response.status_code == 200


def test_update_cross_org_returns_404(
    client, other_org_user, active_office, active_floor, desk
):
    client.force_authenticate(user=other_org_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"name": "Hacked"}, format="json")
    assert response.status_code == 404


def test_update_can_update_name(client, owner_user, active_office, active_floor, desk):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"name": "Updated Name"}, format="json")
    assert response.status_code == 200
    assert response.data["name"] == "Updated Name"


def test_update_can_update_code(client, owner_user, active_office, active_floor, desk):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"code": "B1"}, format="json")
    assert response.status_code == 200
    assert response.data["code"] == "B1"


def test_update_can_update_status(
    client, owner_user, active_office, active_floor, desk
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"status": "maintenance"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == "maintenance"


def test_update_invalid_status_rejected(
    client, owner_user, active_office, active_floor, desk
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"status": "broken"}, format="json")
    assert response.status_code == 400


def test_update_can_update_amenities(
    client, owner_user, active_office, active_floor, desk
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    new_amenities = {"monitor": True, "docking_station": True}
    response = client.patch(url, {"amenities": new_amenities}, format="json")
    assert response.status_code == 200
    assert response.data["amenities"] == new_amenities


def test_update_amenities_list_rejected(
    client, owner_user, active_office, active_floor, desk
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"amenities": [1, 2]}, format="json")
    assert response.status_code == 400


def test_update_can_update_notes(client, owner_user, active_office, active_floor, desk):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"notes": "Near the window"}, format="json")
    assert response.status_code == 200
    assert response.data["notes"] == "Near the window"


def test_update_duplicate_code_in_same_office_rejected(
    db, client, owner_user, active_org, active_office, active_floor, desk
):
    # Create a second desk with code B1
    obj2 = FloorLayoutObject.objects.create(
        floor=active_floor,
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
        floor=active_floor,
        layout_object=obj2,
        name="Desk B1",
        code="B1",
    )
    # Try to update desk to have code B1 — should fail
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"code": "B1"}, format="json")
    assert response.status_code == 400


def test_update_same_code_no_conflict_with_self(
    client, owner_user, active_office, active_floor, desk
):
    # Updating a desk with its own existing code must not trigger uniqueness error.
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"code": desk.code}, format="json")
    assert response.status_code == 200


def test_update_cannot_change_layout_object(
    client, owner_user, active_office, active_floor, desk
):
    """layout_object field in PATCH body is silently ignored."""
    original_lo_id = desk.layout_object.id
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.patch(url, {"layout_object": 9999, "name": "OK"}, format="json")
    # Should succeed (layout_object is not in UpdateDeskSerializer)
    assert response.status_code == 200
    desk.refresh_from_db()
    assert desk.layout_object.id == original_lo_id


# ─── DELETE (soft-delete) tests ───────────────────────────────────────────────


def test_delete_unauthenticated_returns_401(client, active_office, active_floor, desk):
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 401


def test_delete_member_cannot_delete(
    client, member_user, active_office, active_floor, desk
):
    client.force_authenticate(user=member_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 403


def test_delete_owner_can_delete(client, owner_user, active_office, active_floor, desk):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 204


def test_delete_admin_can_delete(client, admin_user, active_office, active_floor, desk):
    client.force_authenticate(user=admin_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 204


def test_delete_is_soft_delete(client, owner_user, active_office, active_floor, desk):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    client.delete(url)
    desk.refresh_from_db()
    assert desk.is_active is False


def test_delete_removed_from_list(
    client, owner_user, active_office, active_floor, desk
):
    client.force_authenticate(user=owner_user)
    client.delete(desk_detail_url(active_office.id, active_floor.id, desk.id))
    list_response = client.get(desk_list_url(active_office.id, active_floor.id))
    assert list_response.status_code == 200
    assert list_response.data == []


def test_delete_cross_org_returns_404(
    client, other_org_user, active_office, active_floor, desk
):
    client.force_authenticate(user=other_org_user)
    url = desk_detail_url(active_office.id, active_floor.id, desk.id)
    response = client.delete(url)
    assert response.status_code == 404


def test_delete_nonexistent_desk_returns_404(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = desk_detail_url(active_office.id, active_floor.id, 99999)
    response = client.delete(url)
    assert response.status_code == 404

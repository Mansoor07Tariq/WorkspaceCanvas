import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, Floor, FloorLayoutObject, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def desk_list_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/desks/"


def valid_payload(layout_object_id: int, **kwargs):
    base = {"layout_object": layout_object_id, "name": "Desk A1", "code": "A1"}
    base.update(kwargs)
    return base


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
def second_office(db, active_org):
    return Office.objects.create(
        organization=active_org, name="Cork Office", slug="cork-office"
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
def second_floor(db, second_office):
    return Floor.objects.create(
        office=second_office, name="Ground Floor", slug="ground-floor-2", level_number=0
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
def non_desk_layout_object(db, active_floor):
    return FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="plant",
        label="Plant",
        x="200.00",
        y="200.00",
        width="40.00",
        height="40.00",
    )


@pytest.fixture
def other_org_layout_object(db, other_floor):
    return FloorLayoutObject.objects.create(
        floor=other_floor,
        object_type="desk",
        label="Desk X1",
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
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


# ─── Auth / permission tests ─────────────────────────────────────────────────


def test_create_unauthenticated_returns_401(
    client, active_office, active_floor, desk_layout_object
):
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 401


def test_create_inactive_membership_returns_403(
    client, inactive_member_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=inactive_member_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 403


def test_create_member_cannot_create(
    client, member_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=member_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 403


def test_create_owner_can_create(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 201


def test_create_admin_can_create(
    client, admin_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=admin_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 201


# ─── Scope validation ────────────────────────────────────────────────────────


def test_create_cross_org_office_returns_404(
    client, owner_user, other_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(other_office.id, active_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 404


def test_create_floor_not_in_office_returns_404(
    client, owner_user, active_office, other_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, other_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 404


def test_create_layout_object_nonexistent_returns_400(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(99999), format="json")
    assert response.status_code == 400


def test_create_layout_object_from_other_floor_returns_400(
    client, owner_user, active_office, active_floor, other_org_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(other_org_layout_object.id), format="json"
    )
    assert response.status_code == 400


# ─── Object type validation ───────────────────────────────────────────────────


def test_create_inactive_layout_object_rejected(
    client, owner_user, active_office, active_floor
):
    inactive_obj = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Inactive Desk",
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
        is_active=False,
    )
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(inactive_obj.id), format="json")
    assert response.status_code == 400
    assert not Desk.objects.filter(layout_object=inactive_obj).exists()


def test_create_non_desk_type_rejected(
    client, owner_user, active_office, active_floor, non_desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(non_desk_layout_object.id), format="json")
    assert response.status_code == 400


@pytest.mark.parametrize(
    "object_type",
    ["desk", "standing_desk", "hot_desk", "private_desk"],
)
def test_create_desk_capable_types_accepted(
    db, client, owner_user, active_office, active_floor, object_type
):
    obj = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type=object_type,
        label=object_type,
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
    )
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(obj.id, code=""), format="json")
    assert response.status_code == 201


@pytest.mark.parametrize(
    "object_type",
    ["table", "sofa", "chair", "wall", "door", "plant", "toilet", "tv", "whiteboard"],
)
def test_create_non_desk_capable_types_rejected(
    db, client, owner_user, active_office, active_floor, object_type
):
    obj = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type=object_type,
        label=object_type,
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
    )
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(obj.id), format="json")
    assert response.status_code == 400


# ─── Duplicate desk validation ────────────────────────────────────────────────


def test_create_duplicate_active_desk_rejected(
    db, client, owner_user, active_org, active_office, active_floor, desk_layout_object
):
    # Create first desk
    Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Desk A1",
    )
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(desk_layout_object.id, code="A2"), format="json"
    )
    assert response.status_code == 409


def test_create_after_soft_delete_allowed(
    db, client, owner_user, active_org, active_office, active_floor, desk_layout_object
):
    # Soft-delete existing desk
    Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Old Desk",
        is_active=False,
    )
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(desk_layout_object.id, code=""), format="json"
    )
    assert response.status_code == 201


# ─── Field validation ────────────────────────────────────────────────────────


def test_create_name_required(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    payload = {"layout_object": desk_layout_object.id}
    response = client.post(url, payload, format="json")
    assert response.status_code == 400


def test_create_name_blank_rejected(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(desk_layout_object.id, name="   "), format="json"
    )
    assert response.status_code == 400


def test_create_name_trimmed(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url,
        valid_payload(desk_layout_object.id, name="  Desk A1  ", code=""),
        format="json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "Desk A1"


def test_create_code_optional(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    payload = {"layout_object": desk_layout_object.id, "name": "Desk A1"}
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["code"] == ""


def test_create_code_unique_per_office(
    db, client, owner_user, active_org, active_office, active_floor, desk_layout_object
):
    obj2 = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="Desk A2",
        x="200.00",
        y="200.00",
        width="80.00",
        height="50.00",
    )
    # First desk with code A1
    Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=desk_layout_object,
        name="Desk A1",
        code="A1",
    )
    # Second desk same code same office — should be rejected
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(obj2.id, code="A1"), format="json")
    assert response.status_code == 400


def test_create_same_code_different_office_allowed(
    db,
    client,
    owner_user,
    active_org,
    active_office,
    second_office,
    active_floor,
    second_floor,
):
    # Desk with code A1 in active_office/active_floor
    lo1 = FloorLayoutObject.objects.create(
        floor=active_floor,
        object_type="desk",
        label="D1",
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
    )
    Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo1,
        name="Desk A1",
        code="A1",
    )
    # Desk with same code A1 in second_office/second_floor — should be allowed
    lo2 = FloorLayoutObject.objects.create(
        floor=second_floor,
        object_type="desk",
        label="D2",
        x="100.00",
        y="100.00",
        width="80.00",
        height="50.00",
    )
    client.force_authenticate(user=owner_user)
    url = desk_list_url(second_office.id, second_floor.id)
    response = client.post(url, valid_payload(lo2.id, code="A1"), format="json")
    assert response.status_code == 201


def test_create_status_defaults_to_available(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    payload = {"layout_object": desk_layout_object.id, "name": "Desk A1"}
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["status"] == "available"


def test_create_invalid_status_rejected(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(desk_layout_object.id, status="booked"), format="json"
    )
    assert response.status_code == 400


def test_create_amenities_default_empty_dict(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    payload = {"layout_object": desk_layout_object.id, "name": "Desk A1"}
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["amenities"] == {}


def test_create_amenities_list_rejected(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url,
        valid_payload(desk_layout_object.id, amenities=[1, 2, 3]),
        format="json",
    )
    assert response.status_code == 400


def test_create_amenities_stored(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    amenities = {"monitor": True, "docking_station": False}
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(
        url, valid_payload(desk_layout_object.id, amenities=amenities), format="json"
    )
    assert response.status_code == 201
    assert response.data["amenities"] == amenities


def test_create_organization_from_url_not_body(
    client, owner_user, active_org, active_office, active_floor, desk_layout_object
):
    """org/office/floor in the request body must be ignored."""
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    payload = valid_payload(
        desk_layout_object.id,
        organization=9999,
        office=9999,
        floor=9999,
    )
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["organization"] == active_org.id
    assert response.data["office"] == active_office.id
    assert response.data["floor"] == active_floor.id


def test_create_response_has_all_fields(
    client, owner_user, active_office, active_floor, desk_layout_object
):
    client.force_authenticate(user=owner_user)
    url = desk_list_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(desk_layout_object.id), format="json")
    assert response.status_code == 201
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

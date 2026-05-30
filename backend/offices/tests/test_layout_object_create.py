import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Floor, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def layout_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/layout-objects/"


def valid_payload(**kwargs):
    base = {
        "object_type": "desk",
        "label": "Desk A1",
        "x": "100.00",
        "y": "150.00",
        "width": "80.00",
        "height": "50.00",
    }
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
def inactive_member_user(db, active_org):
    user = User.objects.create_user(email="inactive@example.com", password="pass123")
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    return user


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_create_unauthenticated(client, active_office, active_floor):
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 401


def test_create_inactive_membership_returns_403(
    client, inactive_member_user, active_office, active_floor
):
    client.force_authenticate(user=inactive_member_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 403


def test_create_member_cannot_create(client, member_user, active_office, active_floor):
    client.force_authenticate(user=member_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 403


def test_create_owner_can_create(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 201


def test_create_admin_can_create(client, admin_user, active_office, active_floor):
    client.force_authenticate(user=admin_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 201


def test_create_cross_org_office_returns_404(
    client, owner_user, other_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(other_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 404


def test_create_floor_not_in_office_returns_404(
    client, owner_user, active_office, other_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, other_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 404


def test_create_missing_object_type(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    del payload["object_type"]
    response = client.post(url, payload, format="json")
    assert response.status_code == 400


def test_create_invalid_object_type(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(object_type="spaceship"), format="json")
    assert response.status_code == 400


@pytest.mark.parametrize(
    "object_type",
    [
        "desk",
        "lunch_table",
        "sofa",
        "tv",
        "door",
        "window",
        "toilet",
        "kitchen_sink",
        "cabinet",
        "plant",
        "meeting_pod",
        "boardroom_table",
    ],
)
def test_create_valid_object_types(
    client, owner_user, active_office, active_floor, object_type
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(object_type=object_type), format="json")
    assert response.status_code == 201
    assert response.data["object_type"] == object_type


def test_create_label_optional(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    del payload["label"]
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["label"] == ""


def test_create_label_trimmed(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(label="  Desk A1  "), format="json")
    assert response.status_code == 201
    assert response.data["label"] == "Desk A1"


def test_create_label_max_length(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(label="x" * 121), format="json")
    assert response.status_code == 400


def test_create_missing_x(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    del payload["x"]
    response = client.post(url, payload, format="json")
    assert response.status_code == 400


def test_create_missing_y(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    del payload["y"]
    response = client.post(url, payload, format="json")
    assert response.status_code == 400


def test_create_missing_width(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    del payload["width"]
    response = client.post(url, payload, format="json")
    assert response.status_code == 400


def test_create_missing_height(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    del payload["height"]
    response = client.post(url, payload, format="json")
    assert response.status_code == 400


def test_create_zero_width_rejected(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(width="0"), format="json")
    assert response.status_code == 400


def test_create_negative_width_rejected(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(width="-10"), format="json")
    assert response.status_code == 400


def test_create_zero_height_rejected(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(height="0"), format="json")
    assert response.status_code == 400


def test_create_negative_height_rejected(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(height="-10"), format="json")
    assert response.status_code == 400


def test_create_rotation_defaults_to_zero(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    payload.pop("rotation", None)
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["rotation"] == "0.00"


def test_create_metadata_defaults_to_empty_dict(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    payload.pop("metadata", None)
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["metadata"] == {}


def test_create_metadata_list_rejected(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(metadata=[1, 2, 3]), format="json")
    assert response.status_code == 400


def test_create_is_bookable_defaults_false(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    payload = valid_payload()
    payload.pop("is_bookable", None)
    response = client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["is_bookable"] is False


def test_create_floor_linked_to_url_floor(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 201
    assert response.data["floor"] == active_floor.id


def test_create_response_has_all_fields(
    client, owner_user, active_office, active_floor
):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(url, valid_payload(), format="json")
    assert response.status_code == 201
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
    assert expected.issubset(response.data.keys())


def test_create_metadata_stored(client, owner_user, active_office, active_floor):
    client.force_authenticate(user=owner_user)
    url = layout_url(active_office.id, active_floor.id)
    response = client.post(
        url,
        valid_payload(metadata={"color": "#2563EB"}),
        format="json",
    )
    assert response.status_code == 201
    assert response.data["metadata"] == {"color": "#2563EB"}

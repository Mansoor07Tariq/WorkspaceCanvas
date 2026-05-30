import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Floor, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def floor_url(office_id: int) -> str:
    return f"/api/offices/{office_id}/floors/"


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
def owner_user(db, active_org):
    user = User.objects.create_user(
        username="owner@example.com",
        email="owner@example.com",
        password="Strongpass1!",
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
        username="admin@example.com",
        email="admin@example.com",
        password="Strongpass1!",
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
        username="member@example.com",
        email="member@example.com",
        password="Strongpass1!",
    )
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def no_membership_user(db):
    return User.objects.create_user(
        username="nobody@example.com",
        email="nobody@example.com",
        password="Strongpass1!",
    )


@pytest.fixture
def inactive_member_user(db, active_org):
    user = User.objects.create_user(
        username="inactive@example.com",
        email="inactive@example.com",
        password="Strongpass1!",
    )
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.DISABLED,
    )
    return user


@pytest.fixture
def owner_client(client, owner_user):
    client.force_authenticate(user=owner_user)
    return client


@pytest.fixture
def admin_client(client, admin_user):
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def member_client(client, member_user):
    client.force_authenticate(user=member_user)
    return client


# ─── Auth ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_unauthenticated_returns_401(client, active_office):
    url = floor_url(active_office.id)
    response = client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 401


# ─── Membership guards ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_no_active_membership_returns_403(client, no_membership_user, active_office):
    client.force_authenticate(user=no_membership_user)
    url = floor_url(active_office.id)
    response = client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_inactive_membership_returns_403(client, inactive_member_user, active_office):
    client.force_authenticate(user=inactive_member_user)
    url = floor_url(active_office.id)
    response = client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_member_role_cannot_create_floor(member_client, active_office):
    url = floor_url(active_office.id)
    response = member_client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 403


# ─── Office access ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_nonexistent_office_returns_404(owner_client):
    url = floor_url(99999)
    response = owner_client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 404


@pytest.mark.django_db
def test_office_from_other_org_returns_404(owner_client, other_office):
    url = floor_url(other_office.id)
    response = owner_client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 404


# ─── Successful creation ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_owner_can_create_floor(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 201
    assert response.data["name"] == "Ground Floor"
    assert response.data["slug"] == "ground-floor"
    assert response.data["is_active"] is True
    assert response.data["office"] == active_office.id


@pytest.mark.django_db
def test_admin_can_create_floor(admin_client, active_office):
    url = floor_url(active_office.id)
    response = admin_client.post(url, {"name": "First Floor"}, format="json")
    assert response.status_code == 201
    assert response.data["name"] == "First Floor"


@pytest.mark.django_db
def test_level_number_defaults_to_zero(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 201
    assert response.data["level_number"] == 0


@pytest.mark.django_db
def test_negative_level_number_accepted(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(
        url, {"name": "Basement", "level_number": -1}, format="json"
    )
    assert response.status_code == 201
    assert response.data["level_number"] == -1


@pytest.mark.django_db
def test_name_trimmed(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(url, {"name": "  Ground Floor  "}, format="json")
    assert response.status_code == 201
    assert response.data["name"] == "Ground Floor"


@pytest.mark.django_db
def test_response_contains_timestamps(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 201
    assert "created_at" in response.data
    assert "updated_at" in response.data


# ─── Slug generation ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_slug_generated_from_name(owner_client, active_office):
    url = floor_url(active_office.id)
    payload = {"name": "Ground Floor", "level_number": 0}
    response = owner_client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["slug"] == "ground-floor"


@pytest.mark.django_db
def test_duplicate_name_in_same_office_gets_suffix(owner_client, active_office):
    Floor.objects.create(
        office=active_office,
        name="Ground Floor",
        slug="ground-floor",
        level_number=0,
    )
    url = floor_url(active_office.id)
    payload = {"name": "Ground Floor", "level_number": 1}
    response = owner_client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["slug"] == "ground-floor-1"


@pytest.mark.django_db
def test_same_name_in_different_office_allowed(
    owner_client, active_office, other_office
):
    Floor.objects.create(
        office=other_office,
        name="Ground Floor",
        slug="ground-floor",
        level_number=0,
    )
    url = floor_url(active_office.id)
    payload = {"name": "Ground Floor", "level_number": 0}
    response = owner_client.post(url, payload, format="json")
    assert response.status_code == 201
    assert response.data["slug"] == "ground-floor"


# ─── Level number uniqueness ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_duplicate_level_number_in_same_office_returns_400(owner_client, active_office):
    Floor.objects.create(
        office=active_office,
        name="Ground Floor",
        slug="ground-floor",
        level_number=0,
    )
    url = floor_url(active_office.id)
    response = owner_client.post(
        url, {"name": "Lobby", "level_number": 0}, format="json"
    )
    assert response.status_code == 400
    assert "level_number" in response.data


@pytest.mark.django_db
def test_same_level_number_in_different_offices_allowed(
    owner_client, active_office, other_office
):
    Floor.objects.create(
        office=other_office,
        name="Ground Floor",
        slug="ground-floor",
        level_number=0,
    )
    url = floor_url(active_office.id)
    payload = {"name": "Ground Floor", "level_number": 0}
    response = owner_client.post(url, payload, format="json")
    assert response.status_code == 201


# ─── Validation ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_missing_name_returns_400(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(url, {}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_blank_name_returns_400(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(url, {"name": "   "}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_non_integer_level_number_returns_400(owner_client, active_office):
    url = floor_url(active_office.id)
    payload = {"name": "Ground Floor", "level_number": "not-a-number"}
    response = owner_client.post(url, payload, format="json")
    assert response.status_code == 400


# ─── Floor scoped to URL office_id ────────────────────────────────────────────


@pytest.mark.django_db
def test_floor_linked_to_url_office(owner_client, active_office):
    url = floor_url(active_office.id)
    response = owner_client.post(url, {"name": "Ground Floor"}, format="json")
    assert response.status_code == 201
    floor = Floor.objects.get(pk=response.data["id"])
    assert floor.office == active_office

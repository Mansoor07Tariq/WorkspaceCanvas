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
def member_client(client, member_user):
    client.force_authenticate(user=member_user)
    return client


@pytest.fixture
def owner_client(client, owner_user):
    client.force_authenticate(user=owner_user)
    return client


# ─── Auth ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_unauthenticated_returns_401(client, active_office):
    response = client.get(floor_url(active_office.id))
    assert response.status_code == 401


# ─── Membership guards ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_no_active_membership_returns_403(client, no_membership_user, active_office):
    client.force_authenticate(user=no_membership_user)
    response = client.get(floor_url(active_office.id))
    assert response.status_code == 403


@pytest.mark.django_db
def test_inactive_membership_returns_403(client, inactive_member_user, active_office):
    client.force_authenticate(user=inactive_member_user)
    response = client.get(floor_url(active_office.id))
    assert response.status_code == 403


# ─── Office access ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_nonexistent_office_returns_404(owner_client):
    response = owner_client.get(floor_url(99999))
    assert response.status_code == 404


@pytest.mark.django_db
def test_office_from_other_org_returns_404(owner_client, other_office):
    response = owner_client.get(floor_url(other_office.id))
    assert response.status_code == 404


# ─── Successful listing ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_active_member_can_list_floors(member_client, active_office):
    response = member_client.get(floor_url(active_office.id))
    assert response.status_code == 200


@pytest.mark.django_db
def test_owner_can_list_floors(owner_client, active_office):
    response = owner_client.get(floor_url(active_office.id))
    assert response.status_code == 200


@pytest.mark.django_db
def test_empty_list_returned_when_no_floors(owner_client, active_office):
    response = owner_client.get(floor_url(active_office.id))
    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_multiple_floors_returned(owner_client, active_office):
    Floor.objects.create(
        office=active_office, name="Basement", slug="basement", level_number=-1
    )
    Floor.objects.create(
        office=active_office, name="Ground Floor", slug="ground-floor", level_number=0
    )
    Floor.objects.create(
        office=active_office, name="First Floor", slug="first-floor", level_number=1
    )
    response = owner_client.get(floor_url(active_office.id))
    assert response.status_code == 200
    assert len(response.data) == 3


@pytest.mark.django_db
def test_floors_ordered_by_level_number(owner_client, active_office):
    Floor.objects.create(
        office=active_office, name="First Floor", slug="first-floor", level_number=1
    )
    Floor.objects.create(
        office=active_office, name="Basement", slug="basement", level_number=-1
    )
    Floor.objects.create(
        office=active_office, name="Ground Floor", slug="ground-floor", level_number=0
    )
    response = owner_client.get(floor_url(active_office.id))
    assert response.status_code == 200
    levels = [f["level_number"] for f in response.data]
    assert levels == [-1, 0, 1]


@pytest.mark.django_db
def test_inactive_floors_excluded(owner_client, active_office):
    Floor.objects.create(
        office=active_office,
        name="Ground Floor",
        slug="ground-floor",
        level_number=0,
        is_active=True,
    )
    Floor.objects.create(
        office=active_office,
        name="Old Floor",
        slug="old-floor",
        level_number=2,
        is_active=False,
    )
    response = owner_client.get(floor_url(active_office.id))
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Ground Floor"


@pytest.mark.django_db
def test_floors_from_other_office_not_returned(
    owner_client, active_office, other_office
):
    Floor.objects.create(
        office=active_office, name="Ground Floor", slug="ground-floor", level_number=0
    )
    Floor.objects.create(
        office=other_office, name="Ground Floor", slug="ground-floor", level_number=0
    )
    response = owner_client.get(floor_url(active_office.id))
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["office"] == active_office.id


@pytest.mark.django_db
def test_response_fields_present(owner_client, active_office):
    Floor.objects.create(
        office=active_office, name="Ground Floor", slug="ground-floor", level_number=0
    )
    response = owner_client.get(floor_url(active_office.id))
    assert response.status_code == 200
    floor = response.data[0]
    expected_fields = (
        "id",
        "office",
        "name",
        "slug",
        "level_number",
        "is_active",
        "created_at",
        "updated_at",
    )
    for field in expected_fields:
        assert field in floor

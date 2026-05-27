import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Office

User = get_user_model()

URL = "/api/offices/"


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
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    return user


@pytest.fixture
def member_client(client, member_user):
    client.force_authenticate(user=member_user)
    return client


@pytest.fixture
def office_in_active_org(db, active_org):
    return Office.objects.create(
        organization=active_org,
        name="Dublin Office",
        slug="dublin-office",
        city="Dublin",
        country="Ireland",
    )


@pytest.fixture
def second_office_in_active_org(db, active_org):
    return Office.objects.create(
        organization=active_org,
        name="London Office",
        slug="london-office",
        city="London",
        country="UK",
    )


@pytest.fixture
def office_in_other_org(db, other_org):
    return Office.objects.create(
        organization=other_org,
        name="Berlin Office",
        slug="berlin-office",
        city="Berlin",
        country="Germany",
    )


@pytest.fixture
def inactive_office_in_active_org(db, active_org):
    return Office.objects.create(
        organization=active_org,
        name="Archived Office",
        slug="archived-office",
        is_active=False,
    )


# ─── Auth ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_unauthenticated_returns_401(client):
    response = client.get(URL)
    assert response.status_code == 401


# ─── Membership guards ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_no_active_membership_returns_403(client, no_membership_user):
    client.force_authenticate(user=no_membership_user)
    response = client.get(URL)
    assert response.status_code == 403


@pytest.mark.django_db
def test_inactive_membership_returns_403(client, inactive_member_user):
    client.force_authenticate(user=inactive_member_user)
    response = client.get(URL)
    assert response.status_code == 403


# ─── List behaviour ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_active_member_can_list_offices(member_client, office_in_active_org):
    response = member_client.get(URL)
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Dublin Office"


@pytest.mark.django_db
def test_empty_list_when_no_offices(member_client):
    response = member_client.get(URL)
    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_returns_multiple_offices(  # noqa: E501
    member_client, office_in_active_org, second_office_in_active_org
):
    response = member_client.get(URL)
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_does_not_return_offices_from_other_org(
    member_client, office_in_active_org, office_in_other_org
):
    response = member_client.get(URL)
    assert response.status_code == 200
    names = [o["name"] for o in response.data]
    assert "Dublin Office" in names
    assert "Berlin Office" not in names


@pytest.mark.django_db
def test_inactive_offices_excluded(
    member_client, office_in_active_org, inactive_office_in_active_org
):
    response = member_client.get(URL)
    assert response.status_code == 200
    names = [o["name"] for o in response.data]
    assert "Dublin Office" in names
    assert "Archived Office" not in names


@pytest.mark.django_db
def test_response_fields(member_client, office_in_active_org):
    response = member_client.get(URL)
    assert response.status_code == 200
    office = response.data[0]
    expected_fields = {
        "id",
        "name",
        "slug",
        "address_line_1",
        "address_line_2",
        "city",
        "county_or_state",
        "country",
        "timezone",
        "is_active",
        "created_at",
        "updated_at",
    }
    assert expected_fields.issubset(set(office.keys()))

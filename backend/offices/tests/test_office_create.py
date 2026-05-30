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
def test_unauthenticated_returns_401(client):
    response = client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 401


# ─── Membership guards ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_no_active_membership_returns_403(client, no_membership_user):
    client.force_authenticate(user=no_membership_user)
    response = client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_inactive_membership_returns_403(client, inactive_member_user):
    client.force_authenticate(user=inactive_member_user)
    response = client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_member_role_cannot_create_office(member_client):
    response = member_client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 403


# ─── Successful creation ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_owner_can_create_office(owner_client, active_org):
    response = owner_client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 201
    assert response.data["name"] == "Dublin Office"
    assert response.data["slug"] == "dublin-office"
    assert response.data["is_active"] is True


@pytest.mark.django_db
def test_admin_can_create_office(admin_client, active_org):
    response = admin_client.post(URL, {"name": "London HQ"}, format="json")
    assert response.status_code == 201
    assert response.data["name"] == "London HQ"


@pytest.mark.django_db
def test_optional_fields_saved(owner_client):
    payload = {
        "name": "Dublin Office",
        "address_line_1": "1 Main Street",
        "address_line_2": "Suite 200",
        "city": "Dublin",
        "county_or_state": "County Dublin",
        "country": "Ireland",
        "timezone": "Europe/Dublin",
    }
    response = owner_client.post(URL, payload, format="json")
    assert response.status_code == 201
    assert response.data["address_line_1"] == "1 Main Street"
    assert response.data["address_line_2"] == "Suite 200"
    assert response.data["city"] == "Dublin"
    assert response.data["county_or_state"] == "County Dublin"
    assert response.data["country"] == "Ireland"
    assert response.data["timezone"] == "Europe/Dublin"


@pytest.mark.django_db
def test_optional_fields_trimmed(owner_client):
    payload = {
        "name": "Dublin Office",
        "city": "  Dublin  ",
        "country": "  Ireland  ",
    }
    response = owner_client.post(URL, payload, format="json")
    assert response.status_code == 201
    assert response.data["city"] == "Dublin"
    assert response.data["country"] == "Ireland"


@pytest.mark.django_db
def test_name_trimmed(owner_client):
    response = owner_client.post(URL, {"name": "  Dublin Office  "}, format="json")
    assert response.status_code == 201
    assert response.data["name"] == "Dublin Office"


@pytest.mark.django_db
def test_response_contains_timestamps(owner_client):
    response = owner_client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 201
    assert "created_at" in response.data
    assert "updated_at" in response.data


# ─── Organization scoping ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_office_linked_to_users_active_org(owner_client, owner_user, active_org):
    owner_client.post(URL, {"name": "Dublin Office"}, format="json")
    office = Office.objects.get(name="Dublin Office")
    assert office.organization == active_org


@pytest.mark.django_db
def test_organization_id_in_payload_ignored(
    owner_client, other_org, owner_user, active_org
):
    response = owner_client.post(
        URL,
        {"name": "Dublin Office", "organization": other_org.id},
        format="json",
    )
    assert response.status_code == 201
    office = Office.objects.get(name="Dublin Office")
    assert office.organization == active_org


# ─── Slug generation ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_slug_generated_from_name(owner_client):
    response = owner_client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 201
    assert response.data["slug"] == "dublin-office"


@pytest.mark.django_db
def test_duplicate_name_in_same_org_gets_suffix(owner_client, active_org):
    Office.objects.create(
        organization=active_org,
        name="Dublin Office",
        slug="dublin-office",
    )
    response = owner_client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 201
    assert response.data["slug"] == "dublin-office-1"


@pytest.mark.django_db
def test_same_name_in_different_org_allowed(owner_client, other_org):
    Office.objects.create(
        organization=other_org,
        name="Dublin Office",
        slug="dublin-office",
    )
    response = owner_client.post(URL, {"name": "Dublin Office"}, format="json")
    assert response.status_code == 201
    assert response.data["slug"] == "dublin-office"


# ─── Validation ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_missing_name_returns_400(owner_client):
    response = owner_client.post(URL, {}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_blank_name_returns_400(owner_client):
    response = owner_client.post(URL, {"name": "   "}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_timezone_returns_400(owner_client):
    response = owner_client.post(
        URL, {"name": "Dublin Office", "timezone": "Not/ATimezone"}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_valid_timezone_accepted(owner_client):
    response = owner_client.post(
        URL, {"name": "Dublin Office", "timezone": "Europe/Dublin"}, format="json"
    )
    assert response.status_code == 201
    assert response.data["timezone"] == "Europe/Dublin"


@pytest.mark.django_db
def test_utc_timezone_accepted(owner_client):
    response = owner_client.post(
        URL, {"name": "Remote HQ", "timezone": "UTC"}, format="json"
    )
    assert response.status_code == 201
    assert response.data["timezone"] == "UTC"


@pytest.mark.django_db
def test_empty_timezone_accepted(owner_client):
    response = owner_client.post(
        URL, {"name": "Dublin Office", "timezone": ""}, format="json"
    )
    assert response.status_code == 201
    assert response.data["timezone"] == ""

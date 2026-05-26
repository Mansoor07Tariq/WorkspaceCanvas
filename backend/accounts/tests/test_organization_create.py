import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization

User = get_user_model()

CREATE_URL = "/api/accounts/organizations/"


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def completed_user(db):
    user = User.objects.create_user(
        username="owner@example.com",
        email="owner@example.com",
        password="Strongpass1!",
        full_name="Jane Owner",
        is_profile_completed=True,
    )
    return user


@pytest.fixture
def incomplete_user(db):
    return User.objects.create_user(
        username="incomplete@example.com",
        email="incomplete@example.com",
        password="Strongpass1!",
    )


@pytest.fixture
def auth_client(client, completed_user):
    client.force_authenticate(user=completed_user)
    return client


# --- Authentication ---


@pytest.mark.django_db
def test_unauthenticated_request_returns_401(client):
    response = client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_incomplete_profile_returns_403(client, incomplete_user):
    client.force_authenticate(user=incomplete_user)
    response = client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 403


# --- Successful creation ---


@pytest.mark.django_db
def test_creates_organization_with_company_type(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "Acme Corp"
    assert response.data["organization_type"] == "company"
    assert response.data["status"] == "active"


@pytest.mark.django_db
def test_creates_organization_with_coworking_type(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "The Hub", "organization_type": "coworking_space"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["organization_type"] == "coworking_space"


@pytest.mark.django_db
def test_creates_organization_with_other_type(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "Mystery Inc", "organization_type": "other"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["organization_type"] == "other"


@pytest.mark.django_db
def test_response_contains_slug(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["slug"] == "acme-corp"


@pytest.mark.django_db
def test_response_status_is_active(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == "active"


@pytest.mark.django_db
def test_creates_owner_membership(auth_client, completed_user):
    auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    membership = Membership.objects.get(user=completed_user)
    assert membership.role == MemberRole.OWNER
    assert membership.status == Membership.Status.ACTIVE


@pytest.mark.django_db
def test_org_and_membership_created_atomically(auth_client, completed_user):
    auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert Organization.objects.count() == 1
    assert Membership.objects.filter(user=completed_user).count() == 1


# --- Optional domain ---


@pytest.mark.django_db
def test_creates_org_with_allowed_email_domain(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {
            "name": "Acme Corp",
            "organization_type": "company",
            "allowed_email_domain": "acme.com",
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["allowed_email_domain"] == "acme.com"


@pytest.mark.django_db
def test_creates_org_without_domain(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["allowed_email_domain"] == ""


# --- Slug generation ---


@pytest.mark.django_db
def test_slug_collision_generates_unique_suffix(db, auth_client):
    Organization.objects.create(
        name="Acme Corp",
        slug="acme-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )
    response = auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["slug"] == "acme-corp-1"


@pytest.mark.django_db
def test_name_is_trimmed(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "  Acme Corp  ", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "Acme Corp"


# --- Validation ---


@pytest.mark.django_db
def test_missing_name_returns_400(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"organization_type": "company"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_blank_name_returns_400(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "   ", "organization_type": "company"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_org_type_returns_400(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {"name": "Acme Corp", "organization_type": "invalid_type"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_domain_with_at_sign_returns_400(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {
            "name": "Acme Corp",
            "organization_type": "company",
            "allowed_email_domain": "user@acme.com",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_domain_with_http_prefix_returns_400(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {
            "name": "Acme Corp",
            "organization_type": "company",
            "allowed_email_domain": "https://acme.com",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_domain_with_path_returns_400(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {
            "name": "Acme Corp",
            "organization_type": "company",
            "allowed_email_domain": "acme.com/team",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_domain_format_returns_400(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {
            "name": "Acme Corp",
            "organization_type": "company",
            "allowed_email_domain": "notadomain",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_domain_is_lowercased(auth_client):
    response = auth_client.post(
        CREATE_URL,
        {
            "name": "Acme Corp",
            "organization_type": "company",
            "allowed_email_domain": "ACME.COM",
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["allowed_email_domain"] == "acme.com"

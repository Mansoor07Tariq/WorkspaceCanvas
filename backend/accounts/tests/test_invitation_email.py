"""Invitation email delivery tests (PR 053).

Django's test environment swaps the email backend for the in-memory locmem
backend, so ``mailoutbox`` (pytest-django fixture) captures sent mail without
any real SMTP traffic. No secrets are ever printed.
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import Invitation, MemberRole, Membership, Organization

User = get_user_model()


def list_create_url(org_id: int) -> str:
    return f"/api/accounts/organizations/{org_id}/invitations/"


@pytest.fixture
def api_client():
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
def owner_user(db):
    return User.objects.create_user(
        username="owner@example.com",
        email="owner@example.com",
        password="pass123",
        full_name="Alice Owner",
        is_profile_completed=True,
    )


@pytest.fixture
def owner_membership(db, owner_user, active_org):
    return Membership.objects.create(
        user=owner_user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def member_user(db):
    return User.objects.create_user(
        username="member@example.com",
        email="member@example.com",
        password="pass123",
        full_name="Carol Member",
        is_profile_completed=True,
    )


@pytest.fixture
def member_membership(db, member_user, active_org):
    return Membership.objects.create(
        user=member_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )


@pytest.mark.django_db
def test_create_sends_one_email(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 201
    assert len(mailoutbox) == 1


@pytest.mark.django_db
def test_email_sent_to_normalized_recipient(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    api_client.post(
        list_create_url(active_org.id),
        {"email": "Guest@Example.com", "role": "member"},
        format="json",
    )
    assert mailoutbox[0].to == ["guest@example.com"]


@pytest.mark.django_db
def test_email_subject_contains_org_name(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "member"},
        format="json",
    )
    subject = mailoutbox[0].subject
    assert "Acme Corp" in subject
    assert "WorkspaceCanvas" in subject


@pytest.mark.django_db
def test_email_body_contains_invite_url_org_role_and_expiry(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "admin"},
        format="json",
    )
    token = response.data["token"]
    body = mailoutbox[0].body
    assert f"/invite/{token}" in body
    assert "Acme Corp" in body
    assert "Admin" in body
    assert "expires on" in body.lower()


@pytest.mark.django_db
def test_invite_url_uses_configured_frontend_url(
    settings, api_client, owner_user, active_org, owner_membership, mailoutbox
):
    settings.FRONTEND_URL = "https://app.example.test"
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "member"},
        format="json",
    )
    token = response.data["token"]
    assert f"https://app.example.test/invite/{token}" in mailoutbox[0].body


@pytest.mark.django_db
def test_no_email_on_invalid_role(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "owner"},
        format="json",
    )
    assert response.status_code == 400
    assert len(mailoutbox) == 0


@pytest.mark.django_db
def test_no_email_when_lacking_permission(
    api_client, member_user, active_org, owner_membership, member_membership, mailoutbox
):
    api_client.force_authenticate(user=member_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 403
    assert len(mailoutbox) == 0


@pytest.mark.django_db
def test_no_email_on_duplicate_active_member(
    api_client, owner_user, active_org, owner_membership, member_membership, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "member@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 400
    assert len(mailoutbox) == 0


@pytest.mark.django_db
def test_email_failure_returns_503_and_does_not_persist(
    monkeypatch, api_client, owner_user, active_org, owner_membership
):
    import smtplib

    from accounts import views

    def boom(_invitation):
        raise smtplib.SMTPException("smtp down")

    monkeypatch.setattr(views, "send_invitation_email", boom)
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 503
    # Transaction rolled back: no pending invitation persisted.
    assert not Invitation.objects.filter(email="guest@example.com").exists()
    # No SMTP internals leaked.
    assert "smtp down" not in str(response.data)


@pytest.mark.django_db
def test_create_still_returns_invitation_payload(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "guest@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["email"] == "guest@example.com"
    assert response.data["status"] == "pending"
    assert response.data["token"] is not None
    assert response.data["expires_at"] is not None

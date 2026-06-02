"""Invitation resend tests (PR 053, TD-040).

Resend refreshes the token and expiry (Option B) and re-sends the email. The
old token is invalidated. Manager-only; cross-org and non-pending invitations
are rejected.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Invitation, MemberRole, Membership, Organization

User = get_user_model()


def resend_url(org_id: int, inv_id: int) -> str:
    return f"/api/accounts/organizations/{org_id}/invitations/{inv_id}/resend/"


def detail_url(token) -> str:
    return f"/api/accounts/invitations/{token}/"


def accept_url(token) -> str:
    return f"/api/accounts/invitations/{token}/accept/"


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
def other_org(db):
    return Organization.objects.create(
        name="Other Corp",
        slug="other-corp",
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
def admin_user(db):
    return User.objects.create_user(
        username="admin@example.com",
        email="admin@example.com",
        password="pass123",
        full_name="Bob Admin",
        is_profile_completed=True,
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
def invited_user(db):
    return User.objects.create_user(
        username="invited@example.com",
        email="invited@example.com",
        password="pass123",
        full_name="Dave Invited",
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
def admin_membership(db, admin_user, active_org):
    return Membership.objects.create(
        user=admin_user,
        organization=active_org,
        role=MemberRole.ADMIN,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def member_membership(db, member_user, active_org):
    return Membership.objects.create(
        user=member_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def pending_invitation(db, active_org, owner_user):
    return Invitation.objects.create(
        organization=active_org,
        email="invited@example.com",
        role=MemberRole.MEMBER,
        invited_by=owner_user,
        expires_at=timezone.now() + timedelta(days=7),
    )


# --- Permissions ---


@pytest.mark.django_db
def test_resend_unauthenticated_returns_401(api_client, active_org, pending_invitation):
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 401


@pytest.mark.django_db
def test_owner_can_resend(
    api_client, owner_user, active_org, owner_membership, pending_invitation, mailoutbox
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 200
    assert response.data["status"] == "pending"
    assert len(mailoutbox) == 1


@pytest.mark.django_db
def test_admin_can_resend(
    api_client,
    admin_user,
    active_org,
    owner_membership,
    admin_membership,
    pending_invitation,
    mailoutbox,
):
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 200


@pytest.mark.django_db
def test_member_cannot_resend(
    api_client,
    member_user,
    active_org,
    owner_membership,
    member_membership,
    pending_invitation,
    mailoutbox,
):
    api_client.force_authenticate(user=member_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 403
    assert len(mailoutbox) == 0


@pytest.mark.django_db
def test_disabled_membership_cannot_resend(
    api_client, owner_user, active_org, pending_invitation, mailoutbox
):
    Membership.objects.create(
        user=owner_user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.DISABLED,
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 403
    assert len(mailoutbox) == 0


@pytest.mark.django_db
def test_cross_org_resend_returns_404(
    api_client, owner_user, active_org, other_org, owner_membership, mailoutbox
):
    other_inv = Invitation.objects.create(
        organization=other_org,
        email="x@example.com",
        role=MemberRole.MEMBER,
        expires_at=timezone.now() + timedelta(days=7),
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, other_inv.id))
    assert response.status_code == 404
    assert len(mailoutbox) == 0


# --- Token / expiry refresh ---


@pytest.mark.django_db
def test_resend_refreshes_token(
    api_client, owner_user, active_org, owner_membership, pending_invitation, mailoutbox
):
    old_token = str(pending_invitation.token)
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 200
    assert str(response.data["token"]) != old_token
    pending_invitation.refresh_from_db()
    assert str(pending_invitation.token) != old_token


@pytest.mark.django_db
def test_resend_refreshes_expiry_forward(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    soon = timezone.now() + timedelta(hours=1)
    inv = Invitation.objects.create(
        organization=active_org,
        email="invited@example.com",
        role=MemberRole.MEMBER,
        invited_by=owner_user,
        expires_at=soon,
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, inv.id))
    assert response.status_code == 200
    inv.refresh_from_db()
    assert inv.expires_at > soon


@pytest.mark.django_db
def test_old_token_invalid_after_resend(
    api_client, owner_user, active_org, owner_membership, pending_invitation, mailoutbox
):
    old_token = str(pending_invitation.token)
    api_client.force_authenticate(user=owner_user)
    api_client.post(resend_url(active_org.id, pending_invitation.id))
    # Public detail lookup by the old token now 404s.
    response = api_client.get(detail_url(old_token))
    assert response.status_code == 404


@pytest.mark.django_db
def test_expired_pending_can_be_resent_and_expiry_moves_forward(
    api_client, owner_user, active_org, owner_membership, mailoutbox
):
    expired = Invitation.objects.create(
        organization=active_org,
        email="invited@example.com",
        role=MemberRole.MEMBER,
        invited_by=owner_user,
        expires_at=timezone.now() - timedelta(days=1),
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, expired.id))
    assert response.status_code == 200
    expired.refresh_from_db()
    assert expired.expires_at > timezone.now()
    assert len(mailoutbox) == 1


# --- Status guards ---


@pytest.mark.django_db
def test_accepted_invitation_cannot_be_resent(
    api_client, owner_user, active_org, owner_membership, pending_invitation, mailoutbox
):
    pending_invitation.status = Invitation.Status.ACCEPTED
    pending_invitation.save()
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 400
    assert len(mailoutbox) == 0


@pytest.mark.django_db
def test_cancelled_invitation_cannot_be_resent(
    api_client, owner_user, active_org, owner_membership, pending_invitation, mailoutbox
):
    pending_invitation.status = Invitation.Status.CANCELLED
    pending_invitation.save()
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 400
    assert len(mailoutbox) == 0


# --- Accept compatibility after resend ---


@pytest.mark.django_db
def test_new_token_can_be_accepted_after_resend(
    api_client,
    owner_user,
    invited_user,
    active_org,
    owner_membership,
    pending_invitation,
    mailoutbox,
):
    owner_client = APIClient()
    owner_client.force_authenticate(user=owner_user)
    resp = owner_client.post(resend_url(active_org.id, pending_invitation.id))
    new_token = resp.data["token"]

    api_client.force_authenticate(user=invited_user)
    accept = api_client.post(accept_url(new_token))
    assert accept.status_code == 200
    assert Membership.objects.filter(
        user=invited_user,
        organization=active_org,
        status=Membership.Status.ACTIVE,
    ).exists()


# --- Email failure safety ---


@pytest.mark.django_db
def test_resend_email_failure_rolls_back_token(
    monkeypatch,
    api_client,
    owner_user,
    active_org,
    owner_membership,
    pending_invitation,
):
    import smtplib

    from accounts import views

    old_token = str(pending_invitation.token)
    old_expiry = pending_invitation.expires_at

    def boom(_invitation):
        raise smtplib.SMTPException("smtp down")

    monkeypatch.setattr(views, "send_invitation_email", boom)
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(resend_url(active_org.id, pending_invitation.id))
    assert response.status_code == 503

    pending_invitation.refresh_from_db()
    # Old token and expiry preserved — the old link still works.
    assert str(pending_invitation.token) == old_token
    assert pending_invitation.expires_at == old_expiry
    assert "smtp down" not in str(response.data)

"""Throttle tests for invitation endpoints (PR 052 security pass).

Strategy mirrors offices/tests/test_desk_booking_throttle.py: monkeypatch
SimpleRateThrottle.THROTTLE_RATES directly, because override_settings does
not fire DRF's setting_changed signal and so has no effect on the class
attribute that ScopedRateThrottle/SimpleRateThrottle reads at runtime.

The autouse clear_cache fixture in the root conftest.py ensures throttle
counters start clean for every test.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import Invitation, MemberRole, Membership, Organization

User = get_user_model()


def _tight_throttle(monkeypatch, scope: str, rate: str = "1/min") -> None:
    """Patch THROTTLE_RATES so the scope saturates after a single request."""
    rates = {**SimpleRateThrottle.THROTTLE_RATES, scope: rate}
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)


def list_create_url(org_id: int) -> str:
    return f"/api/accounts/organizations/{org_id}/invitations/"


def detail_url(token) -> str:
    return f"/api/accounts/invitations/{token}/"


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name="Throttle Corp",
        slug="throttle-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(
        username="owner@throttle.test",
        email="owner@throttle.test",
        password="pass123",
        full_name="Owner",
        is_profile_completed=True,
    )
    Membership.objects.create(
        user=user,
        organization=org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def pending_invitation(db, org, owner):
    return Invitation.objects.create(
        organization=org,
        email="guest@throttle.test",
        role=MemberRole.MEMBER,
        invited_by=owner,
        expires_at=timezone.now() + timedelta(days=7),
    )


def test_invite_create_is_throttled(monkeypatch, org, owner):
    """A second invitation POST within the window returns 429."""
    _tight_throttle(monkeypatch, "invite_write", "1/min")
    client = APIClient()
    client.force_authenticate(user=owner)

    first = client.post(
        list_create_url(org.id),
        {"email": "a@throttle.test", "role": MemberRole.MEMBER},
        format="json",
    )
    assert first.status_code == 201

    second = client.post(
        list_create_url(org.id),
        {"email": "b@throttle.test", "role": MemberRole.MEMBER},
        format="json",
    )
    assert second.status_code == 429


def test_invite_list_get_is_not_throttled_by_write_scope(monkeypatch, org, owner):
    """GET (list) is exempt from the write throttle even at 1/min."""
    _tight_throttle(monkeypatch, "invite_write", "1/min")
    client = APIClient()
    client.force_authenticate(user=owner)

    for _ in range(3):
        resp = client.get(list_create_url(org.id))
        assert resp.status_code == 200


def test_public_invitation_detail_is_throttled(monkeypatch, pending_invitation):
    """The unauthenticated public detail lookup is rate-limited by IP."""
    _tight_throttle(monkeypatch, "invite_read", "1/min")
    client = APIClient()

    first = client.get(detail_url(pending_invitation.token))
    assert first.status_code == 200

    second = client.get(detail_url(pending_invitation.token))
    assert second.status_code == 429

import datetime

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from chat.models import ChatLink
from chat.services import linking

CONFIRM_URL = "/api/chat/links/confirm/"
REVOKE_URL = "/api/chat/links/revoke/"


# ─── linking service ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_pending_link_issues_a_token():
    link = linking.create_pending_link(platform="slack", external_user_id="U1")
    assert link.status == ChatLink.Status.PENDING
    assert link.user_id is None
    assert link.used_at is None
    assert link.expires_at > timezone.now()


@pytest.mark.django_db
def test_re_link_rotates_the_token_in_place():
    first = linking.create_pending_link(platform="slack", external_user_id="U1")
    old_token = first.token
    second = linking.create_pending_link(platform="slack", external_user_id="U1")
    # Same identity → same row, rotated token (one row per identity).
    assert ChatLink.objects.filter(platform="slack", external_user_id="U1").count() == 1
    assert second.token != old_token


@pytest.mark.django_db
def test_confirm_link_binds_the_user(user):
    link = linking.create_pending_link(platform="slack", external_user_id="U1")
    confirmed = linking.confirm_link(token=link.token, user=user)
    assert confirmed.status == ChatLink.Status.LINKED
    assert confirmed.user_id == user.id
    assert confirmed.used_at is not None
    assert linking.get_linked("slack", "U1").user_id == user.id


@pytest.mark.django_db
def test_confirm_link_rejects_used_token(user, other_user):
    link = linking.create_pending_link(platform="slack", external_user_id="U1")
    linking.confirm_link(token=link.token, user=user)
    with pytest.raises(linking.LinkTokenUsed):
        linking.confirm_link(token=link.token, user=other_user)


@pytest.mark.django_db
def test_confirm_link_rejects_expired_token(user):
    link = linking.create_pending_link(platform="slack", external_user_id="U1")
    link.expires_at = timezone.now() - datetime.timedelta(minutes=1)
    link.save(update_fields=["expires_at"])
    with pytest.raises(linking.LinkTokenExpired):
        linking.confirm_link(token=link.token, user=user)


@pytest.mark.django_db
def test_confirm_link_rejects_unknown_token(user):
    import uuid

    with pytest.raises(linking.LinkTokenInvalid):
        linking.confirm_link(token=uuid.uuid4(), user=user)


@pytest.mark.django_db
def test_confirm_link_rejects_malformed_token(user):
    with pytest.raises(linking.LinkTokenInvalid):
        linking.confirm_link(token="not-a-uuid", user=user)


@pytest.mark.django_db
def test_revoke_own_links(linked, user):
    assert linking.get_linked("slack", "U123") is not None
    count = linking.revoke_own_links(user)
    assert count == 1
    assert linking.get_linked("slack", "U123") is None


@pytest.mark.django_db
def test_one_row_per_identity_constraint(user):
    ChatLink.objects.create(
        platform="slack",
        external_user_id="U1",
        status=ChatLink.Status.LINKED,
        user=user,
        expires_at=timezone.now(),
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ChatLink.objects.create(
                platform="slack",
                external_user_id="U1",
                status=ChatLink.Status.LINKED,
                user=user,
                expires_at=timezone.now(),
            )


# ─── confirm endpoint (web) ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_confirm_endpoint_links(api_client, user):
    link = linking.create_pending_link(platform="slack", external_user_id="U9")
    api_client.force_authenticate(user=user)
    res = api_client.post(CONFIRM_URL, {"token": str(link.token)}, format="json")
    assert res.status_code == 200
    assert res.data["status"] == "linked"
    assert res.data["linked_email"] == user.email
    assert linking.get_linked("slack", "U9").user_id == user.id


@pytest.mark.django_db
def test_confirm_endpoint_requires_auth(api_client):
    link = linking.create_pending_link(platform="slack", external_user_id="U9")
    res = api_client.post(CONFIRM_URL, {"token": str(link.token)}, format="json")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "mutate,code",
    [
        ("used", "used"),
        ("expired", "expired"),
        ("invalid", "invalid"),
    ],
)
def test_confirm_endpoint_error_codes(api_client, user, other_user, mutate, code):
    link = linking.create_pending_link(platform="slack", external_user_id="U9")
    token = str(link.token)
    if mutate == "used":
        linking.confirm_link(token=link.token, user=other_user)
    elif mutate == "expired":
        link.expires_at = timezone.now() - datetime.timedelta(minutes=1)
        link.save(update_fields=["expires_at"])
    elif mutate == "invalid":
        token = "00000000-0000-0000-0000-000000000000"
    api_client.force_authenticate(user=user)
    res = api_client.post(CONFIRM_URL, {"token": token}, format="json")
    assert res.status_code == 400
    assert res.data["code"] == code


@pytest.mark.django_db
def test_revoke_endpoint(api_client, linked, user):
    api_client.force_authenticate(user=user)
    res = api_client.post(REVOKE_URL, {}, format="json")
    assert res.status_code == 200
    assert res.data["revoked"] == 1
    assert linking.get_linked("slack", "U123") is None

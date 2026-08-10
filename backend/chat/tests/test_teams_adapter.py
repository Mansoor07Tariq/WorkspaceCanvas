"""Offline tests for the Microsoft Teams adapter (PR 078).

No network: the Bot Framework JWKS is replaced by an in-process fake holding a test RSA
public key, and the Connector API is replaced by a recording fake transport. What these
pin (the non-negotiables from review/26 + the reviewer's ratification):

- **Fail-closed config guard** — unset MICROSOFT_APP_ID/PASSWORD → 503, nothing touched.
- **Reject-before-anything** — a bad JWT → 401 with NO ProcessedChatEvent, NO
  BotActionAudit, NO Connector call.
- **JWT validation** — accepts a well-formed token; rejects bad aud / iss / exp /
  signature / missing bearer.
- **Dedupe** — the same activity id twice is handled once.
- **One-shot confirm** — two confirm taps carrying the same token (distinct activity
  ids) book exactly once; the second says "already handled".
- **Connector** — app token is cached; reply POST hits the right URL with the card body.
"""

from __future__ import annotations

import logging
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.utils import timezone

from chat.adapters.teams import auth as teams_auth
from chat.adapters.teams.connector import ConnectorClient
from chat.models import BotActionAudit, ChatLink, ProcessedChatEvent
from offices.models import DeskBooking

TEAMS_URL = "/api/chat/teams/messages/"
APP_ID = "00000000-teams-app-id"
APP_PASSWORD = "s3cret-app-password"
APP_TENANT_ID = "app-tenant-guid-9999"  # the bot's single-tenant home tenant
AAD_OBJECT_ID = "aad-user-object-id-1"
TENANT_ID = "tenant-guid-1"  # the user's channelData tenant (external_team_id)
SERVICE_URL = "https://smba.trafficmanager.net/emea/"
# Inbound channel tokens come from the Bot Framework service (review/30, live-checked).
BF_ISSUER = teams_auth.BF_ISSUER  # "https://api.botframework.com"
# AAD tenant issuers — the outbound tenant, NOT accepted for inbound anymore.
TENANT_V2_ISSUER = f"https://login.microsoftonline.com/{APP_TENANT_ID}/v2.0"
TENANT_V1_ISSUER = f"https://sts.windows.net/{APP_TENANT_ID}/"

pytestmark = pytest.mark.django_db


# ─── test RSA keys (one trusted pair; one rogue key for bad-signature) ──────────
def _gen_key():
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv_pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    return priv, priv_pem


_TRUSTED_PRIV, _TRUSTED_PRIV_PEM = _gen_key()
_TRUSTED_PUB = _TRUSTED_PRIV.public_key()
_ROGUE_PRIV, _ROGUE_PRIV_PEM = _gen_key()


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJWKSClient:
    """Stands in for PyJWKClient — returns the trusted public key regardless of kid."""

    def __init__(self, public_key):
        self._pub = public_key

    def get_signing_key_from_jwt(self, token):  # noqa: ARG002 - kid ignored in tests
        return _FakeSigningKey(self._pub)


class _FailingJWKSClient:
    """Reproduces the live failure: no signing key matches the token's kid."""

    def __init__(self, message):
        self._message = message

    def get_signing_key_from_jwt(self, token):  # noqa: ARG002 - raises before use
        raise jwt.exceptions.PyJWKClientError(self._message)


def _make_token(
    *,
    aud=APP_ID,
    iss=BF_ISSUER,
    exp_delta=3600,
    service_url=SERVICE_URL,
    signing_pem=_TRUSTED_PRIV_PEM,
    kid=None,
):
    now = int(time.time())
    claims = {
        "aud": aud,
        "iss": iss,
        "iat": now - 10,
        "nbf": now - 10,
        "exp": now + exp_delta,
        "serviceurl": service_url,
    }
    headers = {"kid": kid} if kid else None
    return jwt.encode(claims, signing_pem, algorithm="RS256", headers=headers)


def _text_activity(text, *, activity_id="act-1"):
    return {
        "type": "message",
        "id": activity_id,
        "text": text,
        "serviceUrl": SERVICE_URL,
        "conversation": {"id": "conv-1"},
        "from": {"id": "29:teamsuserid", "aadObjectId": AAD_OBJECT_ID},
        "channelData": {"tenant": {"id": TENANT_ID}},
    }


def _submit_activity(action, token, *, activity_id, reply_to_id="card-1"):
    return {
        "type": "message",
        "id": activity_id,
        "replyToId": reply_to_id,
        "serviceUrl": SERVICE_URL,
        "conversation": {"id": "conv-1"},
        "value": {"action": action, "token": token},
        "from": {"id": "29:teamsuserid", "aadObjectId": AAD_OBJECT_ID},
        "channelData": {"tenant": {"id": TENANT_ID}},
    }


# ─── fixtures ───────────────────────────────────────────────────────────────────
@pytest.fixture
def teams_configured(settings):
    settings.MICROSOFT_APP_ID = APP_ID
    settings.MICROSOFT_APP_PASSWORD = APP_PASSWORD
    settings.MICROSOFT_APP_TENANT_ID = APP_TENANT_ID
    settings.ALLOWED_HOSTS = ["testserver"]


@pytest.fixture
def trusted_jwks(monkeypatch):
    """Replace the Bot Framework JWKS fetch with a fake holding the test key."""
    fake = _FakeJWKSClient(_TRUSTED_PUB)
    monkeypatch.setattr(teams_auth, "_default_jwks_client", lambda: fake)


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _RecordingTransport:
    """Records Connector calls; hands back a fresh app token on the OAuth POST."""

    def __init__(self):
        self.token_posts = 0
        self.last_token_url = None
        self.calls = []  # (method, url, json)

    def post(self, url, **kwargs):
        if url.endswith("/oauth2/v2.0/token"):
            self.token_posts += 1
            self.last_token_url = url
            return _FakeResponse({"access_token": "app-token-xyz", "expires_in": 3600})
        self.calls.append(("POST", url, kwargs.get("json")))
        return _FakeResponse({})

    def put(self, url, **kwargs):
        self.calls.append(("PUT", url, kwargs.get("json")))
        return _FakeResponse({})


@pytest.fixture
def fake_connector(monkeypatch):
    """Patch the view's ConnectorClient so no network happens; return the transport that
    records the reply/update calls."""
    ConnectorClient._reset_token_cache()
    transport = _RecordingTransport()

    def _factory(*, app_id, app_password, tenant_id):
        return ConnectorClient(
            app_id=app_id,
            app_password=app_password,
            tenant_id=tenant_id,
            transport=transport,
        )

    monkeypatch.setattr("chat.adapters.teams.views.ConnectorClient", _factory)
    return transport


@pytest.fixture
def teams_linked(db, user):
    return ChatLink.objects.create(
        platform="teams",
        external_user_id=AAD_OBJECT_ID,
        external_team_id=TENANT_ID,
        user=user,
        status=ChatLink.Status.LINKED,
        used_at=timezone.now(),
        linked_at=timezone.now(),
        expires_at=timezone.now() + __import__("datetime").timedelta(days=1),
    )


# ─── 1. fail-closed config guard (reviewer's added condition) ───────────────────
def test_unconfigured_endpoint_fails_closed(api_client, settings, trusted_jwks):
    settings.MICROSOFT_APP_ID = ""
    settings.MICROSOFT_APP_PASSWORD = ""
    settings.MICROSOFT_APP_TENANT_ID = ""
    settings.ALLOWED_HOSTS = ["testserver"]

    resp = api_client.post(
        TEAMS_URL,
        data=_text_activity("today"),
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
    )

    assert resp.status_code == 503
    assert ProcessedChatEvent.objects.count() == 0
    assert BotActionAudit.objects.count() == 0


def test_unset_tenant_id_fails_closed(api_client, settings, trusted_jwks):
    """Single-tenant fix-up: app id/password present but tenant id unset → still 503
    (no single-tenant validation without a tenant to scope the issuer/JWKS to)."""
    settings.MICROSOFT_APP_ID = APP_ID
    settings.MICROSOFT_APP_PASSWORD = APP_PASSWORD
    settings.MICROSOFT_APP_TENANT_ID = ""
    settings.ALLOWED_HOSTS = ["testserver"]

    resp = api_client.post(
        TEAMS_URL,
        data=_text_activity("today"),
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
    )

    assert resp.status_code == 503
    assert ProcessedChatEvent.objects.count() == 0
    assert BotActionAudit.objects.count() == 0


# ─── 2. reject-before-anything ──────────────────────────────────────────────────
@pytest.mark.parametrize(
    "auth_header",
    [
        None,
        "Bearer ",
        "Basic abc",
        lambda: f"Bearer {_make_token(aud='wrong-audience')}",
        lambda: f"Bearer {_make_token(iss='https://evil.example.com')}",
        # AAD tenant issuers (v2 + v1) are NOT accepted for inbound — that's the
        # outbound tenant, not the channel that signs inbound tokens (review/30).
        lambda: f"Bearer {_make_token(iss=TENANT_V2_ISSUER)}",
        lambda: f"Bearer {_make_token(iss=TENANT_V1_ISSUER)}",
        lambda: f"Bearer {_make_token(exp_delta=-3600)}",
        lambda: f"Bearer {_make_token(signing_pem=_ROGUE_PRIV_PEM)}",
    ],
)
def test_bad_jwt_rejects_before_anything(
    api_client, teams_configured, trusted_jwks, fake_connector, auth_header
):
    header = auth_header() if callable(auth_header) else auth_header
    kwargs = {"format": "json"}
    if header is not None:
        kwargs["HTTP_AUTHORIZATION"] = header

    resp = api_client.post(TEAMS_URL, data=_text_activity("today"), **kwargs)

    assert resp.status_code == 401
    # Nothing downstream ran.
    assert ProcessedChatEvent.objects.count() == 0
    assert BotActionAudit.objects.count() == 0
    assert fake_connector.calls == []


# ─── 2b. rejection diagnostics (review/29): structured WARNING, never the token ──
def test_rejection_logs_diagnostic_without_token(
    api_client, teams_configured, fake_connector, monkeypatch, caplog
):
    """The live failure (`PyJWKClientError`) must log the exception class/message, the
    unverified header kid, and the attempted metadata URL — and must NEVER log the raw
    token. Behaviour is unchanged (still 401, no side effects)."""
    failing = _FailingJWKSClient(
        "Unable to find a signing key that matches: 'live-kid'"
    )
    monkeypatch.setattr(teams_auth, "_default_jwks_client", lambda: failing)
    token = _make_token(kid="live-kid")

    with caplog.at_level(logging.WARNING, logger="chat.adapters.teams.auth"):
        resp = api_client.post(
            TEAMS_URL,
            data=_text_activity("help"),
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    # Behaviour byte-identical: still 401, reject-before-anything intact.
    assert resp.status_code == 401
    assert ProcessedChatEvent.objects.count() == 0
    assert BotActionAudit.objects.count() == 0
    assert fake_connector.calls == []

    # Exactly one WARNING from OUR logger (django.request also logs the 401 separately).
    warnings = [
        r
        for r in caplog.records
        if r.name == "chat.adapters.teams.auth" and r.levelno == logging.WARNING
    ]
    assert len(warnings) == 1
    text = warnings[0].getMessage()
    # The diagnostic detail an operator needs.
    assert "invalid_token" in text
    assert "PyJWKClientError" in text
    assert "Unable to find a signing key that matches" in text
    assert "live-kid" in text  # unverified header kid
    assert "login.botframework.com" in text  # attempted BF metadata URL
    # ...and NEVER the raw token or its signature.
    assert token not in text
    assert token.rsplit(".", 1)[-1] not in text  # signature segment


# ─── 3. happy path: valid token → routed → text reply via connector ─────────────
def test_valid_token_help_routes_and_replies(
    api_client, teams_configured, trusted_jwks, fake_connector, teams_linked
):
    resp = api_client.post(
        TEAMS_URL,
        data=_text_activity("help"),
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
    )

    assert resp.status_code == 200
    assert ProcessedChatEvent.objects.count() == 1
    assert BotActionAudit.objects.count() == 1
    # A single reply POST to the conversation activities endpoint, carrying text.
    posts = [c for c in fake_connector.calls if c[0] == "POST"]
    assert len(posts) == 1
    _, url, body = posts[0]
    assert url == f"{SERVICE_URL.rstrip('/')}/v3/conversations/conv-1/activities"
    assert body["type"] == "message"
    assert body["text"]  # help text present
    # The outbound app token was fetched from the tenant-scoped endpoint.
    assert fake_connector.last_token_url == (
        f"https://login.microsoftonline.com/{APP_TENANT_ID}/oauth2/v2.0/token"
    )


def test_bot_framework_issuer_is_accepted(
    api_client, teams_configured, trusted_jwks, fake_connector, teams_linked
):
    """The Bot Framework channel issuer is the ONLY accepted inbound issuer (review/30,
    live-verified). A well-formed BF-issued token routes and replies."""
    resp = api_client.post(
        TEAMS_URL,
        data=_text_activity("help"),
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {_make_token(iss=BF_ISSUER)}",
    )

    assert resp.status_code == 200
    posts = [c for c in fake_connector.calls if c[0] == "POST"]
    assert len(posts) == 1


# ─── 4. dedupe: same activity id handled once ───────────────────────────────────
def test_duplicate_activity_id_is_handled_once(
    api_client, teams_configured, trusted_jwks, fake_connector, teams_linked
):
    def _post():
        return api_client.post(
            TEAMS_URL,
            data=_text_activity("help", activity_id="dup-1"),
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
        )

    assert _post().status_code == 200
    assert _post().status_code == 200

    assert ProcessedChatEvent.objects.count() == 1
    assert BotActionAudit.objects.count() == 1
    posts = [c for c in fake_connector.calls if c[0] == "POST"]
    assert len(posts) == 1  # the redelivery produced no second reply


# ─── 5. one-shot confirm: two taps, exactly one booking ─────────────────────────
def test_redelivered_confirm_books_once(
    api_client,
    teams_configured,
    trusted_jwks,
    fake_connector,
    teams_linked,
    usual_booking,
):
    # Ask to book → glue returns a CONFIRM reply; grab the token from the card body.
    resp = api_client.post(
        TEAMS_URL,
        data=_text_activity("book", activity_id="book-req"),
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
    )
    assert resp.status_code == 200
    card_post = next(c for c in fake_connector.calls if c[0] == "POST")
    card = card_post[2]["attachments"][0]["content"]
    token = card["actions"][0]["data"]["token"]

    # Two confirm taps carrying the SAME token but DISTINCT activity ids (a double tap,
    # not a redelivery — so dedupe does not catch it; the one-shot token must).
    r1 = api_client.post(
        TEAMS_URL,
        data=_submit_activity("confirm", token, activity_id="tap-1"),
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
    )
    r2 = api_client.post(
        TEAMS_URL,
        data=_submit_activity("confirm", token, activity_id="tap-2"),
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {_make_token()}",
    )
    assert r1.status_code == 200
    assert r2.status_code == 200

    # Exactly one NEW booking from the two taps (excluding the seed 'usual' booking).
    assert (
        DeskBooking.objects.filter(status=DeskBooking.Status.ACTIVE)
        .exclude(pk=usual_booking.pk)
        .count()
        == 1
    )

    # Both confirms updated the card (buttons gone); the second says "already handled".
    puts = [c for c in fake_connector.calls if c[0] == "PUT"]
    assert len(puts) == 2
    second_text = puts[1][2]["attachments"][0]["content"]["body"][0]["text"]
    assert "already handled" in second_text.lower()


# ─── 6. connector: app token cached across replies ──────────────────────────────
def test_connector_caches_app_token():
    ConnectorClient._reset_token_cache()
    transport = _RecordingTransport()
    client = ConnectorClient(
        app_id=APP_ID,
        app_password=APP_PASSWORD,
        tenant_id=APP_TENANT_ID,
        transport=transport,
    )

    client.send_activity(
        service_url=SERVICE_URL, conversation_id="c1", activity={"type": "message"}
    )
    client.send_activity(
        service_url=SERVICE_URL, conversation_id="c1", activity={"type": "message"}
    )

    assert transport.token_posts == 1  # token fetched once, reused
    # ...and from the tenant-scoped token endpoint (single-tenant fix-up).
    assert transport.last_token_url == (
        f"https://login.microsoftonline.com/{APP_TENANT_ID}/oauth2/v2.0/token"
    )
    reply_posts = [c for c in transport.calls if c[0] == "POST"]
    assert len(reply_posts) == 2
    base = SERVICE_URL.rstrip("/")
    assert reply_posts[0][1] == f"{base}/v3/conversations/c1/activities"

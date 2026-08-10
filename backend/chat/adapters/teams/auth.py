"""Bot Framework inbound JWT validation (PR 078; corrected in review/30).

**Inbound (channel → bot) is Bot Framework, not tenant AAD.** Live traffic proved it: a
real Teams activity to a *single-tenant* bot carries a token with
``iss = https://api.botframework.com``, signed by the Bot Framework service (key by
``kid`` from the Bot Framework OpenID metadata), with ``aud = MICROSOFT_APP_ID``. The
single-tenant registration governs the **outbound** (bot → channel) token acquisition
only — that stays tenant-scoped in ``connector.py``. review/28's inbound switch to the
tenant AAD issuer was an over-correction; this module restores the channel semantics.

Accepted inbound token:
- issuer ``https://api.botframework.com`` (Bot Framework channel);
- signing keys from the Bot Framework OpenID metadata (``BF_OPENID_CONFIG``), following
  its ``jwks_uri``;
- ``aud == MICROSOFT_APP_ID``, RS256 only, ``exp``/``nbf`` with ±300s leeway, and the
  ``serviceurl`` claim (when present) matching the activity's serviceUrl.

We deliberately do **not** accept AAD-tenant-issuer inbound tokens (the Bot Framework
Emulator's single-tenant path) — real channel traffic never uses them here.

Fail-closed still requires **all three** env vars (app id / password / tenant): the
tenant is needed for the outbound token, so an unconfigured tenant means we could accept
an inbound activity we could never reply to — reject up front instead.

Minimal-raw: PyJWT (present) + ``PyJWKClient`` for JWKS fetch/cache/rotation; no
botbuilder SDK. Validation runs BEFORE anything else — a failure raises
``TeamsAuthError`` and the caller returns 401 with no dedupe/audit/glue
(reject-before-anything).

**Diagnostics (review/29, kept permanently):** every rejection path emits ONE structured
WARNING carrying the exception class + message (a ``PyJWKClientError`` distinguishes "no
signing key matches kid X" from a JWKS fetch/connection failure), the token's
*unverified* header (kid/alg/typ) and a short set of *unverified* claims
(iss/aud/tid/appid/serviceurl/exp), and the JWKS metadata URL attempted. The raw token,
signature bytes, and secrets are NEVER logged; values length-capped. Diagnostics only.
"""

from __future__ import annotations

import logging
from typing import NoReturn

import jwt
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Bot Framework channel issuer + its OpenID metadata (the inbound signing keys). Single-
# tenant bots still receive channel tokens issued/signed by this service.
BF_ISSUER = "https://api.botframework.com"
BF_OPENID_CONFIG = "https://login.botframework.com/v1/.well-known/openidconfiguration"

_CLOCK_SKEW_LEEWAY_SECONDS = 300

# Module-cached PyJWKClient for the Bot Framework metadata (fixed URL; effectively a
# singleton). The injectable ``jwks_client`` arg bypasses it in tests.
_jwks_client: jwt.PyJWKClient | None = None


class TeamsConfigError(Exception):
    """Teams adapter not configured (missing app id/password/tenant) → fail closed."""


class TeamsAuthError(Exception):
    """Inbound token failed validation → 401. ``category`` is a token-free label."""

    def __init__(self, category: str):
        self.category = category
        super().__init__(category)


def require_teams_config() -> tuple[str, str, str]:
    """Return ``(app_id, app_password, tenant_id)`` or raise ``TeamsConfigError`` if any
    is unset.

    Fails closed when unconfigured: impossible to validate a token against an empty
    audience, and impossible to accept an inbound activity we couldn't reply to (the
    outbound token needs the tenant). All three are required.
    """
    app_id = (settings.MICROSOFT_APP_ID or "").strip()
    app_password = (settings.MICROSOFT_APP_PASSWORD or "").strip()
    tenant_id = (settings.MICROSOFT_APP_TENANT_ID or "").strip()
    if not app_id or not app_password or not tenant_id:
        raise TeamsConfigError("teams_not_configured")
    return app_id, app_password, tenant_id


def _default_jwks_client() -> jwt.PyJWKClient:
    """Lazily build (and cache) a PyJWKClient from the Bot Framework OpenID metadata.
    The client caches keys and re-fetches on an unknown ``kid`` (rotation)."""
    global _jwks_client
    if _jwks_client is None:
        resp = requests.get(BF_OPENID_CONFIG, timeout=10)
        resp.raise_for_status()
        jwks_uri = resp.json()["jwks_uri"]
        _jwks_client = jwt.PyJWKClient(jwks_uri)
    return _jwks_client


# ─── rejection diagnostics (review/29) ──────────────────────────────────────────
_MAX_LOG_VALUE = 256

# Read claims WITHOUT verifying anything (so an expired / wrong-aud token still yields
# its claims for the log instead of raising). Diagnostics only; never trusted.
_UNVERIFIED_OPTIONS = {
    "verify_signature": False,
    "verify_exp": False,
    "verify_nbf": False,
    "verify_iat": False,
    "verify_aud": False,
    "verify_iss": False,
}


def _cap(value) -> str | None:
    """Stringify + length-cap a value for logging (None stays None)."""
    if value is None:
        return None
    text = str(value)
    return text if len(text) <= _MAX_LOG_VALUE else text[:_MAX_LOG_VALUE] + "…"


def _diagnostic_fields(token: str | None, *, exc: Exception | None) -> dict:
    """Build the (token-free) structured detail for a rejection WARNING. Best-effort:
    any introspection failure is recorded as a field, never raised."""
    fields: dict = {"attempted_metadata_url": BF_OPENID_CONFIG}
    if exc is not None:
        fields["exc_class"] = type(exc).__name__
        fields["exc_message"] = _cap(str(exc))
    if not token:
        fields["token"] = "absent"
        return fields
    try:
        header = jwt.get_unverified_header(token)
        fields["header"] = {
            "kid": _cap(header.get("kid")),
            "alg": _cap(header.get("alg")),
            "typ": _cap(header.get("typ")),
        }
    except Exception as hexc:  # noqa: BLE001 - diagnostics must not raise
        fields["header_error"] = type(hexc).__name__
    try:
        claims = jwt.decode(token, options=_UNVERIFIED_OPTIONS)
        fields["claims"] = {
            "iss": _cap(claims.get("iss")),
            "aud": _cap(claims.get("aud")),
            "tid": _cap(claims.get("tid")),
            "appid": _cap(claims.get("appid") or claims.get("azp")),
            "serviceurl": _cap(claims.get("serviceurl") or claims.get("serviceUrl")),
            "exp": claims.get("exp"),
        }
    except Exception as cexc:  # noqa: BLE001 - diagnostics must not raise
        fields["claims_error"] = type(cexc).__name__
    return fields


def _reject(
    category: str, *, token: str | None = None, exc: Exception | None = None
) -> NoReturn:
    """Log ONE structured WARNING for this rejection, then raise ``TeamsAuthError``.

    Behaviour is byte-identical to raising directly (same category, same 401, no side
    effects) — this only adds the operator-facing diagnostic. Never logs the raw token,
    signature bytes, or secrets.
    """
    detail = _diagnostic_fields(token, exc=exc)
    logger.warning("Teams inbound JWT rejected (%s): %s", category, detail)
    raise TeamsAuthError(category)


def validate_activity_jwt(
    auth_header: str | None,
    *,
    app_id: str,
    service_url: str | None = None,
    jwks_client=None,
) -> dict:
    """Validate ``Authorization: Bearer <jwt>`` on an inbound activity.

    Checks: RS256 signature (key by kid via the Bot Framework JWKS, with rotation),
    ``aud == app_id``, ``iss == BF_ISSUER``, ``exp``/``nbf`` (±300s leeway), and — when
    present — the ``serviceurl`` claim matches the activity's serviceUrl. Returns the
    claims dict, or raises ``TeamsAuthError`` (never leaking the token). ``jwks_client``
    is injectable for tests.
    """
    if not auth_header or not auth_header.startswith("Bearer "):
        _reject("missing_bearer")
    token = auth_header[len("Bearer ") :].strip()
    if not token:
        _reject("missing_bearer")

    client = jwks_client or _default_jwks_client()
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        # Issuer is validated manually below (for a clean diagnostic on mismatch); aud
        # and exp/nbf are enforced here by PyJWT.
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=app_id,
            leeway=_CLOCK_SKEW_LEEWAY_SECONDS,
        )
    except TeamsAuthError:
        raise
    except Exception as exc:  # noqa: BLE001 - never surface/log the token itself
        # The PyJWKClientError message here is the crux of review/29: it distinguishes a
        # kid-not-found from a JWKS fetch/connection failure.
        _reject("invalid_token", token=token, exc=exc)

    # Bot Framework channel issuer only. AAD-tenant-issuer tokens (the Emulator's
    # single-tenant path) are NOT accepted — real channel traffic never uses them here.
    if claims.get("iss") != BF_ISSUER:
        _reject("invalid_issuer", token=token)

    # serviceUrl trust: only honour the activity's serviceUrl if it matches the token
    # claim (prevents reply-redirection). Missing claim → skip.
    claim_su = claims.get("serviceurl") or claims.get("serviceUrl")
    if service_url and claim_su and claim_su.rstrip("/") != service_url.rstrip("/"):
        _reject("serviceurl_mismatch", token=token)

    return claims

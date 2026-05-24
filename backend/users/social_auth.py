"""
Provider token verification for Google and Microsoft social login.

Each public function makes network calls to the provider's API.
Tests should mock _get_json, _get_microsoft_oidc_metadata, and
_get_microsoft_jwks rather than calling real endpoints.
"""

import json
import urllib.request
from urllib.error import HTTPError, URLError

import jwt
from django.conf import settings
from django.core.cache import cache
from jwt.algorithms import RSAAlgorithm

_CACHE_TTL = 3600  # 1 hour
_AVATAR_MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024  # 5 MB hard cap on what we'll download


class SocialAuthError(Exception):
    """Raised when a social provider token cannot be verified."""

    def __init__(self, message: str, code: str = "social_auth_failed") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


# ---------------------------------------------------------------------------
# Internal HTTP helpers
# ---------------------------------------------------------------------------


def _fetch_avatar_bytes(url: str, *, headers: dict | None = None) -> bytes | None:
    """
    Download an avatar image from a provider URL.

    Returns the raw bytes on success, or None if the download fails, the
    response exceeds _AVATAR_MAX_DOWNLOAD_BYTES, or the URL is empty.
    Caller is responsible for format/size validation before saving.
    """
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
            # Read one byte beyond the limit so we can detect oversized images.
            data = resp.read(_AVATAR_MAX_DOWNLOAD_BYTES + 1)
            if len(data) > _AVATAR_MAX_DOWNLOAD_BYTES:
                return None
            return data or None
    except Exception:
        return None


def _get_json(url: str, *, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
            return json.loads(resp.read())
    except (HTTPError, URLError) as exc:
        raise SocialAuthError(
            "Could not reach identity provider.",
            code="provider_unavailable",
        ) from exc


# ---------------------------------------------------------------------------
# Settings helpers
# ---------------------------------------------------------------------------


def _google_client_id() -> str:
    return getattr(settings, "GOOGLE_CLIENT_ID", "")


def _microsoft_client_id() -> str:
    return getattr(settings, "MICROSOFT_CLIENT_ID", "")


def _microsoft_tenant() -> str:
    return getattr(settings, "MICROSOFT_TENANT_ID", "common")


# ---------------------------------------------------------------------------
# Google
# ---------------------------------------------------------------------------


def verify_google_token(
    *, access_token: str | None = None, id_token: str | None = None
) -> dict:
    """
    Verify a Google token via Google's tokeninfo endpoint.

    Validates:
    - Token integrity (Google verifies server-side)
    - Email presence
    - Email verified by Google
    - Audience matches GOOGLE_CLIENT_ID (when configured)

    Returns normalized identity dict.
    Raises SocialAuthError on any failure.
    """
    if id_token:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    elif access_token:
        url = f"https://oauth2.googleapis.com/tokeninfo?access_token={access_token}"
    else:
        raise SocialAuthError(
            "Either access_token or id_token is required.",
            code="missing_token",
        )

    data = _get_json(url)

    if "error" in data or "error_description" in data:
        raise SocialAuthError("Google token is invalid.", code="invalid_token")

    email = data.get("email")
    if not email:
        raise SocialAuthError(
            "Google did not return an email address.", code="missing_email"
        )

    if data.get("email_verified") not in (True, "true"):
        raise SocialAuthError(
            "Google email address is not verified.", code="unverified_email"
        )

    client_id = _google_client_id()
    if client_id:
        aud = data.get("aud", "")
        audiences = aud if isinstance(aud, list) else [aud]
        if client_id not in audiences:
            raise SocialAuthError(
                "Google token audience is invalid.", code="invalid_audience"
            )

    picture_url = data.get("picture", "")
    return {
        "provider": "google",
        "provider_user_id": data.get("sub"),
        "email": email.lower(),
        "email_verified": True,
        "full_name": data.get("name", ""),
        "first_name": data.get("given_name", ""),
        "last_name": data.get("family_name", ""),
        "locale": data.get("locale", ""),
        "job_title": "",  # not available from Google tokeninfo
        "avatar_bytes": _fetch_avatar_bytes(picture_url),
        "tenant_id": None,
    }


# ---------------------------------------------------------------------------
# Microsoft
# ---------------------------------------------------------------------------


def verify_microsoft_token(
    *, access_token: str | None = None, id_token: str | None = None
) -> dict:
    """
    Verify a Microsoft token and return normalized identity claims.

    Access tokens: verified server-side by Microsoft Graph /v1.0/me.
    ID tokens: verified locally using Microsoft OIDC JWKS (signature,
               audience, issuer, expiry).
    """
    if access_token:
        return _verify_microsoft_access_token(access_token)
    if id_token:
        return _verify_microsoft_id_token(id_token)
    raise SocialAuthError(
        "Either access_token or id_token is required.", code="missing_token"
    )


def _verify_microsoft_access_token(access_token: str) -> dict:
    data = _get_json(
        "https://graph.microsoft.com/v1.0/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    email = data.get("mail") or data.get("userPrincipalName")
    if not email:
        raise SocialAuthError(
            "Microsoft did not return an email address.", code="missing_email"
        )
    avatar_bytes = _fetch_avatar_bytes(
        "https://graph.microsoft.com/v1.0/me/photo/$value",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    return {
        "provider": "microsoft",
        "provider_user_id": data.get("id"),
        "email": email.lower(),
        "email_verified": True,
        "full_name": data.get("displayName", ""),
        "first_name": data.get("givenName", ""),
        "last_name": data.get("surname", ""),
        "locale": data.get("preferredLanguage", ""),
        "job_title": data.get("jobTitle", ""),
        "avatar_bytes": avatar_bytes,
        "tenant_id": None,
    }


def _get_microsoft_oidc_metadata(tenant: str) -> dict:
    cache_key = f"ms_oidc_meta_{tenant}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    url = (
        f"https://login.microsoftonline.com/{tenant}"
        "/v2.0/.well-known/openid-configuration"
    )
    metadata = _get_json(url)
    cache.set(cache_key, metadata, _CACHE_TTL)
    return metadata


def _get_microsoft_jwks(jwks_uri: str) -> dict:
    cache_key = f"ms_jwks_{jwks_uri}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    jwks = _get_json(jwks_uri)
    cache.set(cache_key, jwks, _CACHE_TTL)
    return jwks


def _verify_microsoft_id_token(id_token: str) -> dict:
    # Step 1: Peek at the JWT header to get the key ID
    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.exceptions.DecodeError as exc:
        raise SocialAuthError(
            "Microsoft ID token is malformed.", code="invalid_token"
        ) from exc

    kid = header.get("kid")
    if not kid:
        raise SocialAuthError(
            "Microsoft ID token header is missing key ID.", code="invalid_token"
        )

    # Step 2: Fetch OIDC metadata and JWKS (both cached)
    tenant = _microsoft_tenant()
    metadata = _get_microsoft_oidc_metadata(tenant)
    jwks_uri = metadata.get("jwks_uri")
    if not jwks_uri:
        raise SocialAuthError(
            "Could not fetch Microsoft signing keys.", code="provider_unavailable"
        )
    jwks = _get_microsoft_jwks(jwks_uri)

    # Step 3: Find the signing key matching the token's kid
    signing_key = None
    for jwk in jwks.get("keys", []):
        if jwk.get("kid") == kid:
            try:
                signing_key = RSAAlgorithm.from_jwk(jwk)
            except Exception as exc:
                raise SocialAuthError(
                    "Microsoft signing key is malformed.", code="invalid_token"
                ) from exc
            break

    if signing_key is None:
        raise SocialAuthError(
            "No matching Microsoft signing key found for this token.",
            code="invalid_token",
        )

    # Step 4: Verify signature + audience + expiry (issuer handled manually below)
    client_id = _microsoft_client_id()
    try:
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256"],
            audience=client_id if client_id else None,
            options={
                "verify_exp": True,
                "verify_aud": bool(client_id),
                "verify_iss": False,  # validated manually after tid substitution
            },
        )
    except jwt.exceptions.ExpiredSignatureError as exc:
        raise SocialAuthError(
            "Microsoft ID token has expired.", code="expired_token"
        ) from exc
    except jwt.exceptions.InvalidAudienceError as exc:
        raise SocialAuthError(
            "Microsoft token audience is invalid.", code="invalid_audience"
        ) from exc
    except jwt.exceptions.DecodeError as exc:
        raise SocialAuthError(
            "Microsoft ID token signature is invalid.", code="invalid_token"
        ) from exc
    except jwt.exceptions.InvalidTokenError as exc:
        raise SocialAuthError(
            "Microsoft ID token is invalid.", code="invalid_token"
        ) from exc

    # Step 5: Validate issuer.
    # For the common/multi-tenant endpoint, the metadata issuer contains
    # "{tenantid}" as a placeholder that must be substituted with the token's tid.
    tid = claims.get("tid", "")
    expected_issuer = metadata.get("issuer", "")
    if "{tenantid}" in expected_issuer:
        expected_issuer = expected_issuer.replace("{tenantid}", tid)
    actual_issuer = claims.get("iss", "")
    if expected_issuer and actual_issuer != expected_issuer:
        raise SocialAuthError(
            "Microsoft token issuer is invalid.", code="invalid_issuer"
        )

    # Step 6: Extract identity
    email = claims.get("email") or claims.get("preferred_username")
    if not email:
        raise SocialAuthError(
            "Microsoft ID token does not contain an email address.",
            code="missing_email",
        )

    return {
        "provider": "microsoft",
        "provider_user_id": claims.get("oid") or claims.get("sub"),
        "email": email.lower(),
        "email_verified": True,
        "full_name": claims.get("name", ""),
        # given_name/family_name are non-standard MS ID token claims;
        # jobTitle and preferredLanguage are not included in ID tokens.
        "first_name": claims.get("given_name", ""),
        "last_name": claims.get("family_name", ""),
        "locale": "",
        "job_title": "",
        "avatar_bytes": None,  # no access token available in ID token path
        "tenant_id": tid or None,
    }

"""Bot Framework Connector REST client (PR 078, review/26 §2).

Minimal-raw over ``requests`` (injectable transport for tests). Fetches a cached
client-credentials app token and posts/updates activities on the (validated) serviceUrl.
The app password is never logged; only HTTP status is surfaced.
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


# Single-tenant token endpoint (review/28). Azure no longer offers multi-tenant bots, so
# the client-credentials request goes to the bot's own tenant, not the botframework.com
# common endpoint.
def token_url(tenant_id: str) -> str:
    return f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


SCOPE = "https://api.botframework.com/.default"
_TOKEN_REFRESH_MARGIN_SECONDS = 60


class ConnectorClient:
    """Reply to Teams activities via the Connector API. Construct per request (cheap);
    the app-token cache lives on the class so it survives across instances."""

    # Class-level token cache (shared across instances of the same process/app+tenant).
    _cached_token: str | None = None
    _cached_expiry: float = 0.0
    _cached_key: tuple[str, str] | None = None  # (app_id, tenant_id)

    def __init__(
        self, *, app_id: str, app_password: str, tenant_id: str, transport=None
    ):
        self._app_id = app_id
        self._app_password = app_password
        self._tenant_id = tenant_id
        self._token_url = token_url(tenant_id)
        if transport is None:
            import requests

            transport = requests
        self._transport = transport

    def _get_app_token(self) -> str:
        now = time.time()
        key = (self._app_id, self._tenant_id)
        if (
            ConnectorClient._cached_token
            and ConnectorClient._cached_key == key
            and now < ConnectorClient._cached_expiry - _TOKEN_REFRESH_MARGIN_SECONDS
        ):
            return ConnectorClient._cached_token
        resp = self._transport.post(
            self._token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self._app_id,
                "client_secret": self._app_password,
                "scope": SCOPE,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        ConnectorClient._cached_token = data["access_token"]
        ConnectorClient._cached_expiry = now + int(data.get("expires_in", 3600))
        ConnectorClient._cached_key = key
        return ConnectorClient._cached_token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_app_token()}"}

    def send_activity(self, *, service_url: str, conversation_id: str, activity: dict):
        url = f"{service_url.rstrip('/')}/v3/conversations/{conversation_id}/activities"
        resp = self._transport.post(
            url, json=activity, headers=self._headers(), timeout=10
        )
        resp.raise_for_status()
        return resp

    def update_activity(
        self,
        *,
        service_url: str,
        conversation_id: str,
        activity_id: str,
        activity: dict,
    ):
        url = (
            f"{service_url.rstrip('/')}/v3/conversations/{conversation_id}"
            f"/activities/{activity_id}"
        )
        resp = self._transport.put(
            url, json=activity, headers=self._headers(), timeout=10
        )
        resp.raise_for_status()
        return resp

    @classmethod
    def _reset_token_cache(cls) -> None:
        """Test-only: clear the shared app-token cache."""
        cls._cached_token = None
        cls._cached_expiry = 0.0
        cls._cached_key = None

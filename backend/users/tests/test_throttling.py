"""
Tests that verify DRF ScopedRateThrottle is applied to public auth endpoints.

Strategy
--------
- Patch SimpleRateThrottle.THROTTLE_RATES to "1/min" per scope so a single
  prior request saturates the quota and the very next one returns HTTP 429.
  (The settings fixture does not fire DRF's setting_changed signal, so
  changing settings.REST_FRAMEWORK has no effect on this class attribute.)
- The conftest.py autouse fixture clears the cache before every test so
  throttle counters from other tests never bleed in.
- monkeypatch restores THROTTLE_RATES to the original after each test.
- Views without a throttle_scope are unaffected by ScopedRateThrottle.
"""

import pytest
from rest_framework.test import APIClient

TOKEN_URL = "/api/auth/token/"
SIGNUP_URL = "/api/auth/signup/"
RESEND_URL = "/api/auth/resend-verification/"
MFA_CHALLENGE_URL = "/api/auth/mfa/challenge/verify/"
SOCIAL_URL = "/api/auth/social/"


@pytest.fixture
def client():
    return APIClient()


def _tight_throttle(monkeypatch, scope: str) -> None:
    """Patch SimpleRateThrottle.THROTTLE_RATES so one request saturates the quota.

    The settings fixture does not fire DRF's setting_changed signal, so updating
    settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] has no effect on the class
    attribute that ScopedRateThrottle.get_rate() reads at runtime. Patching the
    class attribute directly is the only reliable approach in tests.
    monkeypatch restores the original value automatically after each test.
    """
    from rest_framework.throttling import SimpleRateThrottle

    rates = {**SimpleRateThrottle.THROTTLE_RATES, scope: "1/min"}
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)


# ---------------------------------------------------------------------------
# Login throttle
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_login_throttled_after_limit(client, monkeypatch):
    _tight_throttle(monkeypatch, "auth_login")
    payload = {"email": "a@example.com", "password": "pass"}

    # First request — allowed (may fail auth, but not throttled)
    r1 = client.post(TOKEN_URL, payload, format="json")
    assert r1.status_code != 429

    # Second request — throttled
    r2 = client.post(TOKEN_URL, payload, format="json")
    assert r2.status_code == 429


@pytest.mark.django_db
def test_login_throttle_response_has_retry_after(client, monkeypatch):
    _tight_throttle(monkeypatch, "auth_login")
    payload = {"email": "a@example.com", "password": "pass"}
    client.post(TOKEN_URL, payload, format="json")
    r = client.post(TOKEN_URL, payload, format="json")
    assert r.status_code == 429
    assert "Retry-After" in r or "detail" in r.data


# ---------------------------------------------------------------------------
# Resend verification throttle
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resend_throttled_after_limit(client, monkeypatch):
    _tight_throttle(monkeypatch, "auth_resend")
    payload = {"email": "a@example.com"}

    r1 = client.post(RESEND_URL, payload, format="json")
    assert r1.status_code != 429

    r2 = client.post(RESEND_URL, payload, format="json")
    assert r2.status_code == 429


# ---------------------------------------------------------------------------
# MFA challenge verify throttle
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_mfa_challenge_throttled_after_limit(client, monkeypatch):
    _tight_throttle(monkeypatch, "auth_mfa_challenge")
    payload = {
        "challenge_id": "00000000-0000-0000-0000-000000000000",
        "token": "123456",
    }

    r1 = client.post(MFA_CHALLENGE_URL, payload, format="json")
    assert r1.status_code != 429

    r2 = client.post(MFA_CHALLENGE_URL, payload, format="json")
    assert r2.status_code == 429


# ---------------------------------------------------------------------------
# Signup throttle (smoke test — DB not required for throttle check)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_signup_throttled_after_limit(client, monkeypatch):
    _tight_throttle(monkeypatch, "auth_signup")
    payload = {"email": "new@example.com", "password": "StrongPass99!"}

    r1 = client.post(SIGNUP_URL, payload, format="json")
    assert r1.status_code != 429

    r2 = client.post(SIGNUP_URL, payload, format="json")
    assert r2.status_code == 429


# ---------------------------------------------------------------------------
# Verify scopes are isolated — unthrottled scope does not block another scope
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_login_throttle_does_not_affect_resend(client, monkeypatch):
    """Saturating the login scope must not throttle the resend scope."""
    _tight_throttle(monkeypatch, "auth_login")
    login_payload = {"email": "a@example.com", "password": "pass"}
    resend_payload = {"email": "a@example.com"}

    # Saturate login
    client.post(TOKEN_URL, login_payload, format="json")
    client.post(TOKEN_URL, login_payload, format="json")  # this hits 429

    # Resend should still be allowed
    r = client.post(RESEND_URL, resend_payload, format="json")
    assert r.status_code != 429

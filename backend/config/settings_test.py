"""Test settings: production config with transport hardening disabled.

The test client speaks plain HTTP, so the BE-18 production transport-security
posture (`if not DEBUG` in `settings.py`) would 301-redirect every request to
HTTPS and mark cookies secure — neither of which a test can satisfy. CI runs with
`DJANGO_DEBUG=False` (production-like), which is what we want *except* for that
transport layer, so we inherit the full production settings and switch off only
the three settings that assume real TLS.
"""

from .settings import *  # noqa: F401,F403

# Tests run over HTTP; SecurityMiddleware must not 301-redirect them to HTTPS.
SECURE_SSL_REDIRECT = False
# Secure cookies are only sent over HTTPS; the HTTP test client would never see
# the refresh-token / session / CSRF cookies back.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

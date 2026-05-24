import pytest


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear Django cache before every test.

    DRF's ScopedRateThrottle stores counters in the cache. Without this fixture,
    throttle counters from one test bleed into subsequent tests in the same session,
    causing unrelated tests to receive 429 responses after the limit is reached.
    """
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()

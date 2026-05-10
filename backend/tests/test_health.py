from django.conf import settings as django_settings


def test_settings_configured():
    expected_engine = "django.db.backends.postgresql"
    assert django_settings.DATABASES["default"]["ENGINE"] == expected_engine
    assert "accounts" in django_settings.INSTALLED_APPS
    assert "django.contrib.admin" in django_settings.INSTALLED_APPS

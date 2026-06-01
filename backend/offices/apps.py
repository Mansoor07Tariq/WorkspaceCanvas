from django.apps import AppConfig


class OfficesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "offices"

    def ready(self) -> None:
        import offices.signals  # noqa: F401  — registers signal handlers

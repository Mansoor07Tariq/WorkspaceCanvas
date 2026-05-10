from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class AuthProvider(models.TextChoices):
        EMAIL = "email", "Email"
        GOOGLE = "google", "Google"
        MICROSOFT = "microsoft", "Microsoft"

    # Profile fields
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    avatar = models.ImageField(
        upload_to="users/avatars/",
        blank=True,
        null=True,
    )
    phone_number = models.CharField(max_length=30, blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    locale = models.CharField(max_length=20, default="en")
    is_profile_completed = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    # Authentication / identity fields
    email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    preferred_auth_provider = models.CharField(
        max_length=50,
        blank=True,
        choices=AuthProvider.choices,
    )
    mfa_enabled = models.BooleanField(default=False)
    mfa_verified_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self) -> str:
        return self.email or self.username

    @property
    def has_verified_identity(self) -> bool:
        return self.email_verified

    @property
    def requires_mfa(self) -> bool:
        return self.mfa_enabled

    def mark_email_verified(self) -> None:
        self.email_verified = True
        self.email_verified_at = timezone.now()
        self.save(update_fields=["email_verified", "email_verified_at"])

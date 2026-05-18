import secrets
import uuid
from datetime import timedelta

import pyotp
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
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


EMAIL_VERIFICATION_TOKEN_LIFETIME = timedelta(hours=24)


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
    )
    token = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Email verification for {self.user.email}"

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired

    def mark_used(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])

    @classmethod
    def create_for_user(cls, user: "User") -> "EmailVerificationToken":
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + EMAIL_VERIFICATION_TOKEN_LIFETIME,
        )


class UserMFADevice(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mfa_device",
    )
    secret = models.CharField(max_length=255)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        status = "confirmed" if self.is_confirmed else "unconfirmed"
        return f"MFA device for {self.user.email} ({status})"

    @property
    def is_confirmed(self) -> bool:
        return self.confirmed_at is not None

    def get_totp(self) -> pyotp.TOTP:
        return pyotp.TOTP(
            self.secret,
            interval=settings.MFA_TOTP_INTERVAL,
            digits=settings.MFA_TOTP_DIGITS,
        )

    def provisioning_uri(self) -> str:
        return self.get_totp().provisioning_uri(
            name=self.user.email,
            issuer_name=settings.MFA_ISSUER_NAME,
        )

    def verify_token(self, token: str) -> bool:
        return self.get_totp().verify(token, valid_window=1)

    def confirm(self) -> None:
        now = timezone.now()
        self.confirmed_at = now
        self.save(update_fields=["confirmed_at", "updated_at"])
        self.user.mfa_enabled = True
        self.user.mfa_verified_at = now
        self.user.save(update_fields=["mfa_enabled", "mfa_verified_at"])


class RecoveryCode(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mfa_recovery_codes",
    )
    code_hash = models.CharField(max_length=255)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"Recovery code for {self.user.email}"

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    def mark_used(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])

    def check_code(self, raw_code: str) -> bool:
        return check_password(raw_code, self.code_hash)

    @classmethod
    def generate_codes_for_user(cls, user: "User", count: int) -> list[str]:
        cls.objects.filter(user=user).delete()
        raw_codes = []
        for _ in range(count):
            raw = secrets.token_hex(10)
            raw_codes.append(raw)
            cls.objects.create(user=user, code_hash=make_password(raw))
        return raw_codes


class MFALoginChallenge(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mfa_login_challenges",
    )
    challenge_id = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"MFA challenge for {self.user.email}"

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired

    def mark_used(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])

    @classmethod
    def create_for_user(cls, user: "User", *, request=None) -> "MFALoginChallenge":
        ip = None
        user_agent = ""
        if request:
            forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
            if forwarded:
                ip = forwarded.split(",")[0].strip()
            else:
                ip = request.META.get("REMOTE_ADDR")
            user_agent = request.META.get("HTTP_USER_AGENT", "")
        lifetime = timedelta(minutes=settings.MFA_CHALLENGE_LIFETIME_MINUTES)
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + lifetime,
            ip_address=ip or None,
            user_agent=user_agent,
        )

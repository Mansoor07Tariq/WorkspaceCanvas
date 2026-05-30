from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import models
from django.utils.text import slugify

if TYPE_CHECKING:
    from accounts.models import Organization


class Office(models.Model):
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="offices",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=120, blank=True)
    county_or_state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    timezone = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"],
                name="unique_office_slug_per_organization",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.organization.name})"

    @classmethod
    def generate_slug(cls, name: str, organization: Organization) -> str:
        base = slugify(name) or "office"
        slug = base
        suffix = 1
        while cls.objects.filter(organization=organization, slug=slug).exists():
            slug = f"{base}-{suffix}"
            suffix += 1
        return slug


class Floor(models.Model):
    office = models.ForeignKey(
        Office,
        on_delete=models.CASCADE,
        related_name="floors",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    level_number = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["level_number", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["office", "slug"],
                name="unique_floor_slug_per_office",
            ),
            models.UniqueConstraint(
                fields=["office", "level_number"],
                name="unique_floor_level_per_office",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} (Level {self.level_number}, {self.office.name})"

    @classmethod
    def generate_slug(cls, name: str, office: Office) -> str:
        base = slugify(name) or "floor"
        slug = base
        suffix = 1
        while cls.objects.filter(office=office, slug=slug).exists():
            slug = f"{base}-{suffix}"
            suffix += 1
        return slug

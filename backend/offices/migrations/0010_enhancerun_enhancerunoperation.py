import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("offices", "0009_alter_floorlayoutobject_object_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="EnhanceRun",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("apply", "Apply"),
                            ("undo", "Undo"),
                            ("retry", "Retry"),
                        ],
                        max_length=10,
                    ),
                ),
                ("plan_id", models.CharField(max_length=64)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("success", "Success"),
                            ("partial_success", "Partial success"),
                            ("failed", "Failed"),
                        ],
                        max_length=20,
                    ),
                ),
                ("total_operations", models.PositiveIntegerField(default=0)),
                ("applied_count", models.PositiveIntegerField(default=0)),
                ("failed_count", models.PositiveIntegerField(default=0)),
                ("skipped_count", models.PositiveIntegerField(default=0)),
                ("diagnostics", models.JSONField(blank=True, default=list)),
                ("summary", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "floor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="enhance_runs",
                        to="offices.floor",
                    ),
                ),
                (
                    "parent_run",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="children",
                        to="offices.enhancerun",
                    ),
                ),
                (
                    "triggered_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="EnhanceRunOperation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("object_id", models.IntegerField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("applied", "Applied"),
                            ("failed", "Failed"),
                            ("skipped", "Skipped"),
                        ],
                        max_length=10,
                    ),
                ),
                ("before_geometry", models.JSONField(default=dict)),
                ("after_geometry", models.JSONField(blank=True, default=dict)),
                ("patch", models.JSONField(blank=True, default=dict)),
                ("reason_codes", models.JSONField(blank=True, default=list)),
                (
                    "error_code",
                    models.CharField(blank=True, default="", max_length=64),
                ),
                ("error_message", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "enhance_run",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="operations",
                        to="offices.enhancerun",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.AddIndex(
            model_name="enhancerun",
            index=models.Index(
                fields=["floor", "created_at"],
                name="enhance_run_floor_created_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="enhancerun",
            constraint=models.UniqueConstraint(
                fields=["floor", "plan_id"], name="uniq_floor_plan_id"
            ),
        ),
    ]

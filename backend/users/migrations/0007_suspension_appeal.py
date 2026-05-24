from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("users", "0006_alter_user_designation"),
    ]

    operations = [
        migrations.CreateModel(
            name="SuspensionAppeal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message", models.TextField(help_text="User's defense/appeal message")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed", models.BooleanField(default=False)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("review_notes", models.TextField(blank=True, help_text="Admin notes on the appeal review")),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviewed_appeals",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="suspension_appeals",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="suspensionappeal",
            index=models.Index(fields=["user", "created_at"], name="users_suspen_user_id_8e1dc5_idx"),
        ),
        migrations.AddIndex(
            model_name="suspensionappeal",
            index=models.Index(fields=["reviewed"], name="users_suspen_review_4fa135_idx"),
        ),
    ]

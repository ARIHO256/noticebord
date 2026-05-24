from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_user_academic_year_user_course_user_school"),
    ]

    operations = [
        migrations.CreateModel(
            name="Friendship",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user_a",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="friendships_as_a", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "user_b",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="friendships_as_b", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={"ordering": ("-created_at",), "unique_together": {("user_a", "user_b")}},
        ),
        migrations.CreateModel(
            name="FriendRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("pending", "Pending"), ("accepted", "Accepted"), ("declined", "Declined")], default="pending", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("responded_at", models.DateTimeField(blank=True, null=True)),
                (
                    "receiver",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_friend_requests", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "sender",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sent_friend_requests", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={"ordering": ("-created_at",), "unique_together": {("sender", "receiver")}},
        ),
    ]

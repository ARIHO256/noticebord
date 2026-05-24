from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_rename_users_suspen_user_id_8e1dc5_idx_users_suspe_user_id_92e9a7_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("blocked", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="blocks_received", to=settings.AUTH_USER_MODEL)),
                ("blocker", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="blocks_initiated", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-created_at",),
                "unique_together": {("blocker", "blocked")},
            },
        ),
        migrations.CreateModel(
            name="UserMute",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("muted", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mutes_received", to=settings.AUTH_USER_MODEL)),
                ("muter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mutes_initiated", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-created_at",),
                "unique_together": {("muter", "muted")},
            },
        ),
        migrations.AddIndex(
            model_name="userblock",
            index=models.Index(fields=["blocker", "blocked"], name="users_userb_blocker_e5ecda_idx"),
        ),
        migrations.AddIndex(
            model_name="userblock",
            index=models.Index(fields=["blocked"], name="users_userb_blocked_49cac4_idx"),
        ),
        migrations.AddIndex(
            model_name="usermute",
            index=models.Index(fields=["muter", "muted"], name="users_userm_muter_i_26ae3f_idx"),
        ),
        migrations.AddIndex(
            model_name="usermute",
            index=models.Index(fields=["muted"], name="users_userm_muted_i_83cb35_idx"),
        ),
    ]

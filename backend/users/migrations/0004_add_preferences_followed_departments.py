# Generated migration for user preferences and followed departments

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_friendship_friendrequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='followed_departments',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='user',
            name='notification_preferences',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]


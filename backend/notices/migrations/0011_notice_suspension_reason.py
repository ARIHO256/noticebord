# Generated migration for adding suspension_reason to Notice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notices', '0010_merge_20251201_1917'),
    ]

    operations = [
        migrations.AddField(
            model_name='notice',
            name='suspension_reason',
            field=models.TextField(blank=True, null=True, help_text='Reason why this notice was suspended'),
        ),
    ]




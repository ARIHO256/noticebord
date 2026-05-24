from django.db import migrations, models

import notices.models


class Migration(migrations.Migration):

    dependencies = [
        ("notices", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notice",
            name="category",
            field=models.CharField(
                choices=[
                    ("campus_life", "Campus Life"),
                    ("business", "Business"),
                    ("education", "Education"),
                    ("general", "General"),
                ],
                default=notices.models.NoticeCategory.CAMPUS_LIFE,
                max_length=32,
            ),
        ),
        migrations.AddIndex(
            model_name="notice",
            index=models.Index(fields=["category"], name="notices_not_category_idx"),
        ),
    ]


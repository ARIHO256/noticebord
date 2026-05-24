from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("notices", "0004_commentlike"),
    ]

    operations = [
        migrations.RenameField(
            model_name="attachment",
            old_name="image",
            new_name="file",
        ),
    ]

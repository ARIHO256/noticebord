from django.db import migrations, models


def set_default_file_type(apps, schema_editor):
    Attachment = apps.get_model('notices', 'Attachment')
    for attachment in Attachment.objects.all():
        name = attachment.file.name if attachment.file else ''
        lower = (name or '').lower()
        if lower.endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic', '.heif')):
            attachment.file_type = 'image'
        else:
            attachment.file_type = attachment.file_type or 'document'
        if not attachment.original_name:
            attachment.original_name = name.split('/')[-1] if name else ''
        attachment.save(update_fields=['file_type', 'original_name'])


class Migration(migrations.Migration):

    dependencies = [
        ("notices", "0005_rename_image_file"),
    ]

    operations = [
        migrations.AlterField(
            model_name="attachment",
            name="file",
            field=models.FileField(upload_to="attachments/"),
        ),
        migrations.AddField(
            model_name="attachment",
            name="file_type",
            field=models.CharField(default="document", max_length=20),
        ),
        migrations.AddField(
            model_name="attachment",
            name="original_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RunPython(set_default_file_type, migrations.RunPython.noop),
    ]

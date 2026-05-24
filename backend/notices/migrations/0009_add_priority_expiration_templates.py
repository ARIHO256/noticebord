from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('notices', '0008_rename_notices_not_category_idx_notices_not_categor_30f710_idx'),
    ]

    operations = [
        # This migration duplicated the schema changes introduced in
        # 0009_noticereminder_noticetemplate_notice_expires_at_and_more.
        # It is intentionally left as a no-op so both branches can merge cleanly.
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]

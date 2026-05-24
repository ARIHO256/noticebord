# Generated manually to support message replies and media attachments

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0002_conversationmessage_attachment"),
    ]

    operations = [
        migrations.AlterField(
            model_name="conversationmessage",
            name="content",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="conversationmessage",
            name="attachment",
            field=models.FileField(blank=True, null=True, upload_to="message_attachments/"),
        ),
        migrations.AddField(
            model_name="conversationmessage",
            name="attachment_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="conversationmessage",
            name="attachment_type",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="conversationmessage",
            name="reply_to",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="replies",
                to="messaging.conversationmessage",
            ),
        ),
    ]


# Generated migration for adding attachment field to ConversationMessage

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='conversationmessage',
            name='attachment',
            field=models.ImageField(blank=True, null=True, upload_to='message_attachments/'),
        ),
    ]







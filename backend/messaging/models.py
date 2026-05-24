from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Conversation(models.Model):
    user_a = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="conversations_as_a",
        on_delete=models.CASCADE,
    )
    user_b = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="conversations_as_b",
        on_delete=models.CASCADE,
    )
    notice = models.ForeignKey(
        "notices.Notice",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="conversations",
    )
    last_message_preview = models.TextField(blank=True, default="")
    last_message_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="conversation_last_messages",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user_a", "user_b", "notice")
        ordering = ("-last_message_at", "-updated_at")

    def clean(self):
        super().clean()
        if self.user_a_id and self.user_b_id and self.user_a_id == self.user_b_id:
            raise ValidationError("Cannot create a conversation with yourself")

    def save(self, *args, **kwargs):
        if self.user_a_id and self.user_b_id and self.user_a_id > self.user_b_id:
            self.user_a_id, self.user_b_id = self.user_b_id, self.user_a_id
        super().save(*args, **kwargs)

    def participants(self):
        return [self.user_a, self.user_b]

    def other_user(self, user):
        if not user:
            return None
        if self.user_a_id == user.id:
            return self.user_b
        if self.user_b_id == user.id:
            return self.user_a
        return None


class ConversationMessage(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        related_name="messages",
        on_delete=models.CASCADE,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sent_messages",
        on_delete=models.CASCADE,
    )
    content = models.TextField(blank=True)
    attachment = models.FileField(upload_to="message_attachments/", null=True, blank=True)
    attachment_type = models.CharField(max_length=20, blank=True, default="")
    attachment_name = models.CharField(max_length=255, blank=True)
    reply_to = models.ForeignKey(
        "self",
        related_name="replies",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def mark_read(self):
        if not self.read_at:
            self.read_at = timezone.now()
            self.save(update_fields=["read_at"])

    @property
    def is_read(self):
        return self.read_at is not None

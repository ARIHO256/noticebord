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
    attachment_size = models.PositiveIntegerField(default=0)
    attachment_thumbnail = models.ImageField(upload_to="message_attachments/thumbs/", null=True, blank=True)

    # Enhanced media support
    media_url = models.URLField(blank=True)  # For CDN-hosted media
    media_duration = models.PositiveIntegerField(default=0)  # seconds for audio/video
    media_width = models.PositiveIntegerField(default=0)
    media_height = models.PositiveIntegerField(default=0)

    reply_to = models.ForeignKey(
        "self",
        related_name="replies",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    # Reactions on messages
    is_forwarded = models.BooleanField(default=False)
    forwarded_from = models.ForeignKey(
        "self",
        related_name="forwards",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["conversation", "-created_at"]),
            models.Index(fields=["sender"]),
            models.Index(fields=["read_at"]),
        ]

    def mark_read(self):
        if not self.read_at:
            self.read_at = timezone.now()
            self.save(update_fields=["read_at"])

    @property
    def is_read(self):
        return self.read_at is not None

    def mark_edited(self):
        self.edited_at = timezone.now()
        self.save(update_fields=["edited_at"])


class MessageReaction(models.Model):
    class ReactionEmoji(models.TextChoices):
        LIKE = "like", "Like"
        LOVE = "love", "Love"
        LAUGH = "laugh", "Laugh"
        WOW = "wow", "Wow"
        SAD = "sad", "Sad"
        ANGRY = "angry", "Angry"
        THUMBS_UP = "thumbs_up", "Thumbs Up"
        THUMBS_DOWN = "thumbs_down", "Thumbs Down"
        PRAY = "pray", "Pray"
        FIRE = "fire", "Fire"

    message = models.ForeignKey(ConversationMessage, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reaction = models.CharField(max_length=20, choices=ReactionEmoji.choices, default=ReactionEmoji.LIKE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user")


class ConversationMute(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="muted_by")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="muted_conversations")
    muted_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("conversation", "user")

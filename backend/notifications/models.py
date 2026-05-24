from django.db import models
from django.conf import settings
from common.models import TimestampModel


class Notification(TimestampModel):
    """Unified in-app notification system."""

    NOTIFICATION_TYPES = [
        ("notice", "New Notice"),
        ("official_notice", "Official Notice"),
        ("message", "New Message"),
        ("friend_request", "Friend Request"),
        ("friend_accepted", "Friend Request Accepted"),
        ("comment", "New Comment"),
        ("comment_reply", "Comment Reply"),
        ("like", "Like on Notice"),
        ("mention", "Mention"),
        ("report", "Report Update"),
        ("suspension", "Account Suspension"),
        ("appeal", "Appeal Update"),
        ("reminder", "Notice Reminder"),
        ("system", "System"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # Deep link data
    data = models.JSONField(default=dict, blank=True)
    
    # Related objects (optional)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )
    
    # Read status
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Push notification status
    push_sent = models.BooleanField(default=False)
    push_sent_at = models.DateTimeField(null=True, blank=True)
    push_error = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
            models.Index(fields=["user", "notification_type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.notification_type}: {self.title[:50]}"

    def mark_as_read(self):
        from django.utils import timezone
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def mark_push_sent(self):
        from django.utils import timezone
        self.push_sent = True
        self.push_sent_at = timezone.now()
        self.save(update_fields=["push_sent", "push_sent_at"])


class NotificationPreference(models.Model):
    """Per-user notification preferences."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_settings",
    )
    
    # In-app notifications
    notify_new_notices = models.BooleanField(default=True)
    notify_official_notices = models.BooleanField(default=True)
    notify_messages = models.BooleanField(default=True)
    notify_friend_requests = models.BooleanField(default=True)
    notify_comments = models.BooleanField(default=True)
    notify_likes = models.BooleanField(default=True)
    notify_mentions = models.BooleanField(default=True)
    notify_reminders = models.BooleanField(default=True)
    
    # Push notifications
    push_new_notices = models.BooleanField(default=True)
    push_official_notices = models.BooleanField(default=True)
    push_messages = models.BooleanField(default=True)
    push_friend_requests = models.BooleanField(default=True)
    push_comments = models.BooleanField(default=False)
    push_likes = models.BooleanField(default=False)
    push_mentions = models.BooleanField(default=True)
    push_reminders = models.BooleanField(default=True)
    
    # Email notifications
    email_official_notices = models.BooleanField(default=True)
    email_suspension = models.BooleanField(default=True)
    email_reminders = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Preferences for {self.user.username}"

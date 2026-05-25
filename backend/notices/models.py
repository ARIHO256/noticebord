from django.conf import settings
from django.db import models


NON_ACADEMIC_DEPARTMENTS = [
    "Library",
    "Office",
    "Sports",
]


class NoticeCategory(models.TextChoices):
    CAMPUS_LIFE = "campus_life", "Campus Life"
    BUSINESS = "business", "Business"
    EDUCATION = "education", "Education"
    GENERAL = "general", "General"


class NoticePriority(models.TextChoices):
    URGENT = "urgent", "Urgent"
    IMPORTANT = "important", "Important"
    NORMAL = "normal", "Normal"


class Notice(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notices"
    )
    department = models.CharField(max_length=100, blank=True)
    category = models.CharField(
        max_length=32,
        choices=NoticeCategory.choices,
        default=NoticeCategory.CAMPUS_LIFE,
    )
    is_pinned = models.BooleanField(default=False)
    priority = models.CharField(
        max_length=20,
        choices=NoticePriority.choices,
        default=NoticePriority.NORMAL,
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    suspension_reason = models.TextField(blank=True, null=True, help_text='Reason why this notice was suspended')
    views_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["department"]),
            models.Index(fields=["category"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_pinned"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.title


class Like(models.Model):
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notice_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["notice", "user"], name="unique_notice_like"),
        ]


class Favorite(models.Model):
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="favorites")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_notices")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["notice", "user"], name="unique_notice_favorite"),
        ]


class Comment(models.Model):
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notice_comments")
    text = models.TextField()
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="replies",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)


class NoticeView(models.Model):
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="views")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Report(models.Model):
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="reports")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reason = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)


class Attachment(models.Model):
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="attachments/")
    file_type = models.CharField(max_length=20, default="document")
    original_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class CommentLike(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comment_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["comment", "user"], name="unique_comment_like"),
        ]


class NoticeTemplate(models.Model):
    name = models.CharField(max_length=100)
    title_template = models.CharField(max_length=200, blank=True)
    description_template = models.TextField()
    category = models.CharField(
        max_length=32,
        choices=NoticeCategory.choices,
        default=NoticeCategory.GENERAL,
    )
    priority = models.CharField(
        max_length=20,
        choices=NoticePriority.choices,
        default=NoticePriority.NORMAL,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notice_templates",
        null=True,
        blank=True,
    )
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class NoticeReminder(models.Model):
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="reminders")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notice_reminders")
    remind_at = models.DateTimeField()
    is_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("notice", "user", "remind_at")
        ordering = ["remind_at"]


class ReactionType(models.TextChoices):
    LIKE = "like", "Like"
    LOVE = "love", "Love"
    WOW = "wow", "Wow"
    HAHA = "haha", "Haha"
    ANGRY = "angry", "Angry"


class Reaction(models.Model):
    """Facebook-style reactions on notices (replaces Like)."""
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notice_reactions")
    reaction_type = models.CharField(max_length=10, choices=ReactionType.choices, default=ReactionType.LIKE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["notice", "user"], name="unique_notice_reaction"),
        ]


class NoticeAcknowledgment(models.Model):
    """Students acknowledge official notices (compliance tracking)."""
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="acknowledgments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notice_acknowledgments")
    acknowledged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["notice", "user"], name="unique_notice_acknowledgment"),
        ]
        ordering = ["-acknowledged_at"]


class NoticeShare(models.Model):
    """Track when users share notices internally or externally."""
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="shares")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notice_shares")
    share_method = models.CharField(max_length=20, default="copy_link")  # copy_link, messenger, external
    created_at = models.DateTimeField(auto_now_add=True)


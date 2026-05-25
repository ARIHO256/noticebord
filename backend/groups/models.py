from django.conf import settings
from django.db import models
from django.utils import timezone


class Group(models.Model):
    class GroupType(models.TextChoices):
        COURSE = "course", "Course"
        DEPARTMENT = "department", "Department"
        YEAR = "year", "Year Group"
        SECTION = "section", "Section"
        CLUB = "club", "Club/Society"
        GENERAL = "general", "General"

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    group_type = models.CharField(max_length=20, choices=GroupType.choices, default=GroupType.GENERAL)
    avatar = models.ImageField(upload_to="groups/avatars/", blank=True, null=True)
    cover_image = models.ImageField(upload_to="groups/covers/", blank=True, null=True)

    # For academic groups
    course = models.CharField(max_length=150, blank=True)
    department = models.CharField(max_length=100, blank=True)
    school = models.CharField(max_length=150, blank=True)
    academic_year = models.CharField(max_length=20, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups",
    )

    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False)
    only_admin_can_post = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["group_type"]),
            models.Index(fields=["department"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.name

    @property
    def member_count(self):
        return self.memberships.filter(is_active=True).count()


class GroupMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MODERATOR = "moderator", "Moderator"
        MEMBER = "member", "Member"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="group_memberships")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("group", "user")
        ordering = ["-joined_at"]


class GroupMessage(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_group_messages",
    )
    content = models.TextField(blank=True)
    attachment = models.FileField(upload_to="group_messages/", null=True, blank=True)
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
    edited_at = models.DateTimeField(null=True, blank=True)
    is_pinned = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["group", "-created_at"]),
            models.Index(fields=["sender"]),
        ]

    def mark_edited(self):
        self.edited_at = timezone.now()
        self.save(update_fields=["edited_at"])


class GroupMessageRead(models.Model):
    message = models.ForeignKey(GroupMessage, on_delete=models.CASCADE, related_name="reads")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user")

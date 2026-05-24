from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.conf import settings


class UserDesignation(models.TextChoices):
    VICE_CHANCELLOR = "vice_chancellor", "Vice Chancellor"
    REGISTRAR = "registrar", "Registrar"
    BUSINESS_OFFICE = "business_office", "Business Office"
    SECURITY = "security", "Head of Security"
    LECTURER = "lecturer", "Lecturer"
    DEAN = "dean", "Dean"
    HOD = "hod", "Head of Department"
    STUDENT = "student", "Student"
    OTHER = "other", "Other"


class User(AbstractUser):
    is_faculty = models.BooleanField(default=False)
    designation = models.CharField(
        max_length=100,
        choices=UserDesignation.choices,
        blank=True,
        default=UserDesignation.STUDENT,
    )
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    push_enabled = models.BooleanField(default=True)
    school = models.CharField(max_length=150, blank=True)
    course = models.CharField(max_length=150, blank=True)
    academic_year = models.CharField(max_length=20, blank=True)
    followed_departments = models.JSONField(default=list, blank=True)
    notification_preferences = models.JSONField(default=dict, blank=True)


class DeviceToken(models.Model):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='device_tokens')
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Friendship(models.Model):
    user_a = models.ForeignKey(User, related_name="friendships_as_a", on_delete=models.CASCADE)
    user_b = models.ForeignKey(User, related_name="friendships_as_b", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user_a", "user_b")
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if self.user_a_id and self.user_b_id and self.user_a_id > self.user_b_id:
            self.user_a_id, self.user_b_id = self.user_b_id, self.user_a_id
        super().save(*args, **kwargs)

    @classmethod
    def friends_of(cls, user):
        if not user or not getattr(user, "id", None):
            return User.objects.none()
        qs = cls.objects.filter(models.Q(user_a=user) | models.Q(user_b=user)).values("user_a_id", "user_b_id")
        friend_ids = []
        user_id = user.id
        for row in qs:
            friend_ids.append(row["user_b_id"] if row["user_a_id"] == user_id else row["user_a_id"])
        return User.objects.filter(id__in=friend_ids)

    @classmethod
    def are_friends(cls, user_one, user_two) -> bool:
        if not user_one or not user_two:
            return False
        if getattr(user_one, "id", None) is None or getattr(user_two, "id", None) is None:
            return False
        if user_one.id == user_two.id:
            return True
        a, b = sorted([user_one.id, user_two.id])
        return cls.objects.filter(user_a_id=a, user_b_id=b).exists()

    @classmethod
    def get_or_create_pair(cls, user_one, user_two):
        if not user_one or not user_two:
            raise ValueError("Both users are required.")
        if user_one.id == user_two.id:
            raise ValueError("Cannot create friendship with yourself.")
        a, b = sorted([user_one.id, user_two.id])
        friendship, _ = cls.objects.get_or_create(user_a_id=a, user_b_id=b)
        return friendship

    @classmethod
    def remove_between(cls, user_one, user_two):
        if not user_one or not user_two or user_one.id == user_two.id:
            return 0
        a, b = sorted([user_one.id, user_two.id])
        return cls.objects.filter(user_a_id=a, user_b_id=b).delete()

    @classmethod
    def mutual_friend_ids(cls, user_one, user_two):
        if not user_one or not user_two:
            return []
        if getattr(user_one, "id", None) is None or getattr(user_two, "id", None) is None:
            return []
        one_qs = cls.objects.filter(models.Q(user_a=user_one) | models.Q(user_b=user_one)).values("user_a_id", "user_b_id")
        two_qs = cls.objects.filter(models.Q(user_a=user_two) | models.Q(user_b=user_two)).values("user_a_id", "user_b_id")
        user_one_id = user_one.id
        user_two_id = user_two.id
        friends_one = set()
        friends_two = set()
        for row in one_qs:
            friends_one.add(row["user_b_id"] if row["user_a_id"] == user_one_id else row["user_a_id"])
        for row in two_qs:
            friends_two.add(row["user_b_id"] if row["user_a_id"] == user_two_id else row["user_a_id"])
        return list(friends_one.intersection(friends_two))


class FriendRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
    ]

    sender = models.ForeignKey(User, related_name="sent_friend_requests", on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name="received_friend_requests", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("sender", "receiver")
        ordering = ("-created_at",)

    def clean(self):
        if self.sender_id and self.receiver_id and self.sender_id == self.receiver_id:
            raise ValidationError("Cannot send a friend request to yourself.")

    def accept(self):
        if self.status == self.STATUS_ACCEPTED:
            return
        Friendship.get_or_create_pair(self.sender, self.receiver)
        self.status = self.STATUS_ACCEPTED
        self.responded_at = timezone.now()
        self.save(update_fields=["status", "responded_at"])

    def decline(self):
        if self.status == self.STATUS_DECLINED:
            return
        self.status = self.STATUS_DECLINED
        self.responded_at = timezone.now()
        self.save(update_fields=["status", "responded_at"])

    @classmethod
    def pending_between(cls, user_one, user_two):
        if not user_one or not user_two:
            return None
        return cls.objects.filter(
            sender=user_one,
            receiver=user_two,
            status=cls.STATUS_PENDING,
        ).first()


class SuspensionAppeal(models.Model):
    """Store appeals from suspended users"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='suspension_appeals')
    message = models.TextField(help_text='User\'s defense/appeal message')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_appeals'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, help_text='Admin notes on the appeal review')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['reviewed']),
        ]
    
    def __str__(self):
        return f"Appeal from {self.user.username} - {self.created_at}"


def get_friend_status(viewer, other):
    if not viewer or not getattr(viewer, "is_authenticated", False) or not getattr(other, "id", None):
        return "unknown"
    if viewer.id == other.id:
        return "self"
    if Friendship.are_friends(viewer, other):
        return "friends"
    pending_outgoing = FriendRequest.pending_between(viewer, other)
    if pending_outgoing:
        return "outgoing"
    pending_incoming = FriendRequest.pending_between(other, viewer)
    if pending_incoming:
        return "incoming"
    return "none"

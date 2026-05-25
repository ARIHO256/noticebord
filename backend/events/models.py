import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Event(models.Model):
    class EventType(models.TextChoices):
        ACADEMIC = "academic", "Academic"
        SOCIAL = "social", "Social"
        SPORTS = "sports", "Sports"
        RELIGIOUS = "religious", "Religious"
        CAREER = "career", "Career"
        OTHER = "other", "Other"

    class EventStatus(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        ONGOING = "ongoing", "Ongoing"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    title = models.CharField(max_length=200)
    description = models.TextField()
    event_type = models.CharField(max_length=20, choices=EventType.choices, default=EventType.OTHER)
    status = models.CharField(max_length=20, choices=EventStatus.choices, default=EventStatus.UPCOMING)

    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True)
    location_map_url = models.URLField(blank=True)

    cover_image = models.ImageField(upload_to="events/covers/", blank=True, null=True)
    max_attendees = models.PositiveIntegerField(null=True, blank=True)
    requires_rsvp = models.BooleanField(default=False)
    is_recurring = models.BooleanField(default=False)
    recurring_rule = models.JSONField(default=dict, blank=True)  # {"frequency": "weekly", "interval": 1}

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="events")
    department = models.CharField(max_length=100, blank=True)
    school = models.CharField(max_length=150, blank=True)

    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_time"]
        indexes = [
            models.Index(fields=["start_time"]),
            models.Index(fields=["event_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["department"]),
            models.Index(fields=["is_featured"]),
        ]

    def __str__(self):
        return self.title

    @property
    def attendees_count(self):
        return self.rsvps.filter(status=RSVP.STATUS_GOING).count()

    @property
    def is_full(self):
        if self.max_attendees:
            return self.attendees_count >= self.max_attendees
        return False

    @property
    def check_in_code(self):
        """Generate a QR check-in code if not exists."""
        check_in, _ = EventCheckIn.objects.get_or_create(event=self)
        return check_in.code


class RSVP(models.Model):
    STATUS_GOING = "going"
    STATUS_MAYBE = "maybe"
    STATUS_DECLINED = "declined"
    STATUS_CHOICES = [
        (STATUS_GOING, "Going"),
        (STATUS_MAYBE, "Maybe"),
        (STATUS_DECLINED, "Declined"),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="rsvps")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rsvps")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_GOING)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("event", "user")
        ordering = ["-created_at"]


class EventCheckIn(models.Model):
    event = models.OneToOneField(Event, on_delete=models.CASCADE, related_name="check_in")
    code = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Attendance(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="attendances")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="event_attendances")
    checked_in_at = models.DateTimeField(auto_now_add=True)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checked_in_attendances",
    )
    method = models.CharField(max_length=20, default="qr")  # qr, manual, self

    class Meta:
        unique_together = ("event", "user")
        ordering = ["-checked_in_at"]


class EventAnnouncement(models.Model):
    """Announcements sent to event attendees."""
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="announcements")
    title = models.CharField(max_length=200)
    message = models.TextField()
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    sent_at = models.DateTimeField(auto_now_add=True)

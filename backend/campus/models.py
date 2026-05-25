from django.conf import settings
from django.db import models
from django.utils import timezone


class StaffDirectory(models.Model):
    class StaffType(models.TextChoices):
        FACULTY = "faculty", "Faculty"
        ADMIN = "admin", "Administration"
        SUPPORT = "support", "Support Staff"
        SECURITY = "security", "Security"
        HEALTH = "health", "Health Staff"
        OTHER = "other", "Other"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_directory",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    staff_type = models.CharField(max_length=20, choices=StaffType.choices, default=StaffType.OTHER)
    title = models.CharField(max_length=200, blank=True)  # e.g., "Senior Lecturer"
    department = models.CharField(max_length=100, blank=True)
    school = models.CharField(max_length=150, blank=True)
    office_location = models.CharField(max_length=255, blank=True)
    office_hours = models.CharField(max_length=255, blank=True)  # e.g., "Mon-Wed 2-4PM"
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to="staff/photos/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "name"]
        verbose_name_plural = "Staff Directories"

    def __str__(self):
        return self.name


class LostFound(models.Model):
    class ItemStatus(models.TextChoices):
        LOST = "lost", "Lost"
        FOUND = "found", "Found"
        CLAIMED = "claimed", "Claimed"
        RETURNED = "returned", "Returned"

    class ItemCategory(models.TextChoices):
        ELECTRONICS = "electronics", "Electronics"
        DOCUMENTS = "documents", "Documents/ID"
        CLOTHING = "clothing", "Clothing"
        ACCESSORIES = "accessories", "Accessories"
        KEYS = "keys", "Keys"
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    description = models.TextField()
    item_type = models.CharField(max_length=20, choices=ItemStatus.choices, default=ItemStatus.LOST)
    category = models.CharField(max_length=20, choices=ItemCategory.choices, default=ItemCategory.OTHER)
    image = models.ImageField(upload_to="lostfound/", blank=True, null=True)
    location_lost_found = models.CharField(max_length=255, blank=True)
    date_lost_found = models.DateField(null=True, blank=True)

    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lost_found_reports",
    )
    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lost_found_claims",
    )
    claim_notes = models.TextField(blank=True)
    claim_verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_claims",
    )

    status = models.CharField(max_length=20, choices=ItemStatus.choices, default=ItemStatus.LOST)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["item_type"]),
            models.Index(fields=["category"]),
            models.Index(fields=["status"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.get_item_type_display()}: {self.title}"


class Venue(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    amenities = models.JSONField(default=list, blank=True)  # ["projector", "AC", "wifi"]
    image = models.ImageField(upload_to="venues/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class VenueBooking(models.Model):
    class BookingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="bookings")
    booked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="venue_bookings",
    )
    event_title = models.CharField(max_length=200)
    purpose = models.TextField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    expected_attendees = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=BookingStatus.choices, default=BookingStatus.PENDING)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_bookings",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["venue", "start_time", "end_time"]),
            models.Index(fields=["status"]),
            models.Index(fields=["booked_by"]),
        ]

    def __str__(self):
        return f"{self.venue.name} - {self.event_title}"


class EmergencyContact(models.Model):
    class ContactType(models.TextChoices):
        SECURITY = "security", "Campus Security"
        HEALTH = "health", "Health Center"
        FIRE = "fire", "Fire Department"
        ADMIN = "admin", "Administration"
        COUNSELING = "counseling", "Counseling"
        OTHER = "other", "Other"

    name = models.CharField(max_length=200)
    contact_type = models.CharField(max_length=20, choices=ContactType.choices, default=ContactType.OTHER)
    phone = models.CharField(max_length=20)
    alt_phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    is_available_24_7 = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["display_order", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_contact_type_display()})"


class EmergencyAlert(models.Model):
    """Critical emergency broadcast that overrides all settings."""
    class AlertLevel(models.TextChoices):
        CRITICAL = "critical", "Critical"
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    title = models.CharField(max_length=200)
    message = models.TextField()
    alert_level = models.CharField(max_length=20, choices=AlertLevel.choices, default=AlertLevel.HIGH)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_emergency_alerts",
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    acknowledged_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"[{self.get_alert_level_display()}] {self.title}"


class EmergencyAlertAcknowledgment(models.Model):
    alert = models.ForeignKey(EmergencyAlert, on_delete=models.CASCADE, related_name="acknowledgments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    acknowledged_at = models.DateTimeField(auto_now_add=True)
    location_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        unique_together = ("alert", "user")

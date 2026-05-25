from django.contrib import admin
from .models import (
    StaffDirectory,
    LostFound,
    Venue,
    VenueBooking,
    EmergencyContact,
    EmergencyAlert,
)


@admin.register(StaffDirectory)
class StaffDirectoryAdmin(admin.ModelAdmin):
    list_display = ["name", "staff_type", "title", "department", "is_active", "display_order"]
    list_filter = ["staff_type", "is_active", "department"]
    search_fields = ["name", "title", "bio"]


@admin.register(LostFound)
class LostFoundAdmin(admin.ModelAdmin):
    list_display = ["title", "item_type", "category", "status", "reported_by", "created_at"]
    list_filter = ["item_type", "category", "status"]
    search_fields = ["title", "description"]


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ["name", "location", "capacity", "is_active"]
    search_fields = ["name", "location"]


@admin.register(VenueBooking)
class VenueBookingAdmin(admin.ModelAdmin):
    list_display = ["venue", "event_title", "booked_by", "start_time", "status"]
    list_filter = ["status"]
    date_hierarchy = "start_time"


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ["name", "contact_type", "phone", "is_available_24_7", "display_order"]
    list_filter = ["contact_type", "is_available_24_7"]


@admin.register(EmergencyAlert)
class EmergencyAlertAdmin(admin.ModelAdmin):
    list_display = ["title", "alert_level", "sent_by", "sent_at", "is_active"]
    list_filter = ["alert_level", "is_active"]

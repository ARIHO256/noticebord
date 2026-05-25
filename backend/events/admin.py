from django.contrib import admin
from .models import Event, RSVP, EventCheckIn, Attendance, EventAnnouncement


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "status", "start_time", "location", "created_by", "is_active"]
    list_filter = ["event_type", "status", "is_active", "is_featured"]
    search_fields = ["title", "description", "location"]
    date_hierarchy = "start_time"


@admin.register(RSVP)
class RSVPAdmin(admin.ModelAdmin):
    list_display = ["event", "user", "status", "created_at"]
    list_filter = ["status"]


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ["event", "user", "checked_in_at", "method"]
    list_filter = ["method"]


@admin.register(EventAnnouncement)
class EventAnnouncementAdmin(admin.ModelAdmin):
    list_display = ["event", "title", "sent_by", "sent_at"]

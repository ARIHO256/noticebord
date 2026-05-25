from rest_framework import serializers
from django.utils import timezone
from users.serializers import MiniUserSerializer
from .models import Event, RSVP, Attendance, EventAnnouncement


class EventListSerializer(serializers.ModelSerializer):
    attendees_count = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    user_rsvp = serializers.SerializerMethodField()
    created_by = MiniUserSerializer(read_only=True)
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "title", "description", "event_type", "status",
            "start_time", "end_time", "location", "location_map_url",
            "cover_image_url", "max_attendees", "requires_rsvp",
            "is_recurring", "attendees_count", "is_full", "user_rsvp",
            "created_by", "department", "school", "is_featured",
            "is_active", "created_at", "updated_at",
        ]

    def get_cover_image_url(self, obj):
        request = self.context.get("request")
        if obj.cover_image:
            url = obj.cover_image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_user_rsvp(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return None
        rsvp = obj.rsvps.filter(user=user).first()
        if rsvp:
            return {"status": rsvp.status, "notes": rsvp.notes}
        return None


class EventDetailSerializer(EventListSerializer):
    class Meta(EventListSerializer.Meta):
        fields = EventListSerializer.Meta.fields + ["recurring_rule"]


class RSVPSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)

    class Meta:
        model = RSVP
        fields = ["id", "event", "event_title", "user", "status", "notes", "created_at", "updated_at"]
        read_only_fields = ["id", "user", "event_title", "created_at", "updated_at"]


class AttendanceSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)

    class Meta:
        model = Attendance
        fields = ["id", "event", "event_title", "user", "checked_in_at", "checked_in_by", "method"]
        read_only_fields = ["id", "checked_in_at", "checked_in_by"]


class EventAnnouncementSerializer(serializers.ModelSerializer):
    sent_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = EventAnnouncement
        fields = ["id", "event", "title", "message", "sent_by", "sent_at"]
        read_only_fields = ["id", "sent_by", "sent_at"]

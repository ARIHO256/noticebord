from rest_framework import serializers
from users.serializers import MiniUserSerializer
from .models import (
    StaffDirectory,
    LostFound,
    Venue,
    VenueBooking,
    EmergencyContact,
    EmergencyAlert,
    EmergencyAlertAcknowledgment,
)


class StaffDirectorySerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = StaffDirectory
        fields = [
            "id", "user", "name", "staff_type", "title", "department", "school",
            "office_location", "office_hours", "phone", "email", "bio",
            "photo_url", "is_active", "display_order", "created_at", "updated_at",
        ]

    def get_photo_url(self, obj):
        request = self.context.get("request")
        if obj.photo:
            url = obj.photo.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


class LostFoundSerializer(serializers.ModelSerializer):
    reported_by = MiniUserSerializer(read_only=True)
    claimed_by = MiniUserSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = LostFound
        fields = [
            "id", "title", "description", "item_type", "category", "image_url",
            "location_lost_found", "date_lost_found", "reported_by", "claimed_by",
            "claim_notes", "status", "is_active", "expires_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "reported_by", "claimed_by", "created_at", "updated_at"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image:
            url = obj.image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


class VenueSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Venue
        fields = ["id", "name", "description", "location", "capacity", "amenities", "image_url", "is_active", "created_at"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image:
            url = obj.image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


class VenueBookingSerializer(serializers.ModelSerializer):
    venue = VenueSerializer(read_only=True)
    venue_id = serializers.PrimaryKeyRelatedField(queryset=Venue.objects.all(), source="venue", write_only=True)
    booked_by = MiniUserSerializer(read_only=True)
    approved_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = VenueBooking
        fields = [
            "id", "venue", "venue_id", "booked_by", "event_title", "purpose",
            "start_time", "end_time", "expected_attendees", "status",
            "approved_by", "approved_at", "rejection_reason",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "booked_by", "approved_by", "approved_at", "created_at", "updated_at"]


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = ["id", "name", "contact_type", "phone", "alt_phone", "email", "location", "is_available_24_7", "display_order", "is_active"]


class EmergencyAlertSerializer(serializers.ModelSerializer):
    sent_by = MiniUserSerializer(read_only=True)
    is_acknowledged = serializers.SerializerMethodField()

    class Meta:
        model = EmergencyAlert
        fields = [
            "id", "title", "message", "alert_level", "sent_by", "sent_at",
            "expires_at", "is_active", "acknowledged_count", "is_acknowledged",
        ]

    def get_is_acknowledged(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return obj.acknowledgments.filter(user=user).exists()


class EmergencyAlertAcknowledgmentSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)

    class Meta:
        model = EmergencyAlertAcknowledgment
        fields = ["id", "alert", "user", "acknowledged_at", "location_lat", "location_lng"]
        read_only_fields = ["id", "user", "acknowledged_at"]

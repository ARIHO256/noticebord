from rest_framework import serializers
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.get_full_name", read_only=True)
    sender_avatar = serializers.CharField(source="sender.avatar", read_only=True)
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "data",
            "sender",
            "sender_name",
            "sender_avatar",
            "is_read",
            "read_at",
            "push_sent",
            "created_at",
            "time_ago",
        ]
        read_only_fields = fields

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.created_at)


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "notify_new_notices",
            "notify_official_notices",
            "notify_messages",
            "notify_friend_requests",
            "notify_comments",
            "notify_likes",
            "notify_mentions",
            "notify_reminders",
            "push_new_notices",
            "push_official_notices",
            "push_messages",
            "push_friend_requests",
            "push_comments",
            "push_likes",
            "push_mentions",
            "push_reminders",
            "email_official_notices",
            "email_suspension",
            "email_reminders",
        ]


class UnreadCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()
    total_count = serializers.IntegerField()

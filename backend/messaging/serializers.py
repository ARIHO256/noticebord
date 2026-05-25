from rest_framework import serializers
from users.serializers import MiniUserSerializer
from .models import Conversation, ConversationMessage, MessageReaction, ConversationMute


class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_muted = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id", "user_a", "user_b", "notice", "last_message_preview",
            "last_message_by", "last_message_at", "other_user", "unread_count",
            "is_muted", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_other_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        other = obj.other_user(user)
        if other:
            return MiniUserSerializer(other, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user:
            return 0
        return obj.messages.filter(read_at__isnull=True).exclude(sender=user).count()

    def get_is_muted(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user:
            return False
        mute = ConversationMute.objects.filter(conversation=obj, user=user).first()
        if mute:
            if mute.muted_until and mute.muted_until > timezone.now():
                return True
            elif not mute.muted_until:
                return True
        return False


class MessageReactionSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)

    class Meta:
        model = MessageReaction
        fields = ["id", "message", "user", "reaction", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class ConversationMessageSerializer(serializers.ModelSerializer):
    sender = MiniUserSerializer(read_only=True)
    attachment_url = serializers.SerializerMethodField()
    attachment_thumbnail_url = serializers.SerializerMethodField()
    reactions = MessageReactionSerializer(many=True, read_only=True)
    reply_to_message = serializers.SerializerMethodField()
    is_forwarded = serializers.BooleanField(read_only=True)

    class Meta:
        model = ConversationMessage
        fields = [
            "id", "conversation", "sender", "content", "attachment", "attachment_url",
            "attachment_type", "attachment_name", "attachment_size",
            "attachment_thumbnail_url", "media_url", "media_duration",
            "media_width", "media_height", "reply_to", "reply_to_message",
            "created_at", "edited_at", "read_at", "is_read", "reactions",
            "is_forwarded", "forwarded_from",
        ]
        read_only_fields = ["id", "sender", "created_at", "edited_at", "read_at", "reactions"]

    def get_attachment_url(self, obj):
        request = self.context.get("request")
        if obj.attachment:
            url = obj.attachment.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_attachment_thumbnail_url(self, obj):
        request = self.context.get("request")
        if obj.attachment_thumbnail:
            url = obj.attachment_thumbnail.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_reply_to_message(self, obj):
        if obj.reply_to:
            return {
                "id": obj.reply_to.id,
                "content": obj.reply_to.content[:100],
                "sender": MiniUserSerializer(obj.reply_to.sender).data,
            }
        return None


class ConversationMuteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversationMute
        fields = ["id", "conversation", "muted_until", "created_at"]
        read_only_fields = ["id", "created_at"]

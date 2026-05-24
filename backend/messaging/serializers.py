import mimetypes

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from notices.models import Notice
from users.models import Friendship, UserBlock
from users.serializers import MiniUserSerializer

from .models import Conversation, ConversationMessage

User = get_user_model()


class ConversationMessageSerializer(serializers.ModelSerializer):
    sender = MiniUserSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    attachment_type = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()

    class Meta:
        model = ConversationMessage
        fields = [
            "id",
            "conversation",
            "sender",
            "content",
            "attachment_url",
            "attachment_type",
            "attachment_name",
            "created_at",
            "read_at",
            "is_mine",
            "reply_to",
        ]
        read_only_fields = fields

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.id == obj.sender_id)

    def _build_attachment_url(self, message: ConversationMessage):
        if not message.attachment:
            return None
        request = self.context.get("request")
        url = message.attachment.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def _detect_attachment_type(self, message: ConversationMessage):
        if message.attachment_type:
            return message.attachment_type
        if not message.attachment:
            return None
        mime_type, _ = mimetypes.guess_type(message.attachment.name or "")
        if mime_type:
            if mime_type.startswith("image/"):
                return "image"
            if mime_type.startswith("video/"):
                return "video"
            if mime_type.startswith("audio/"):
                return "audio"
        return "document"

    def get_attachment_url(self, obj):
        return self._build_attachment_url(obj)

    def get_attachment_type(self, obj):
        return self._detect_attachment_type(obj)

    def get_reply_to(self, obj):
        reply = obj.reply_to
        if not reply:
            return None
        return {
            "id": reply.id,
            "content": reply.content,
            "sender": MiniUserSerializer(reply.sender, context=self.context).data,
            "attachment_url": self._build_attachment_url(reply),
            "attachment_type": self._detect_attachment_type(reply),
            "attachment_name": reply.attachment_name,
        }


class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    notice_title = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "notice",
            "notice_title",
            "other_user",
            "last_message_preview",
            "last_message_by",
            "last_message_at",
            "unread_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_other_user(self, obj):
        request = self.context.get("request")
        other = obj.other_user(getattr(request, "user", None))
        if not other:
            return None
        serializer = MiniUserSerializer(other, context=self.context)
        return serializer.data

    def get_notice_title(self, obj):
        if obj.notice:
            return obj.notice.title
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user:
            return 0
        return obj.messages.filter(read_at__isnull=True).exclude(sender=user).count()


class ConversationCreateSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField(required=False)
    notice_id = serializers.IntegerField(required=False)
    first_message = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        recipient = None
        notice = None

        notice_id = attrs.get("notice_id")
        recipient_id = attrs.get("recipient_id")

        if notice_id:
            try:
                notice = Notice.objects.select_related("created_by").get(pk=notice_id)
            except Notice.DoesNotExist as exc:
                raise serializers.ValidationError({"notice_id": "Notice not found."}) from exc
            recipient = notice.created_by
        elif recipient_id:
            try:
                recipient = User.objects.get(pk=recipient_id)
            except User.DoesNotExist as exc:
                raise serializers.ValidationError({"recipient_id": "User not found."}) from exc
        else:
            raise serializers.ValidationError("A notice_id or recipient_id is required.")

        if recipient == user:
            raise serializers.ValidationError("You cannot start a conversation with yourself.")
        if UserBlock.is_blocked_between(user, recipient):
            raise serializers.ValidationError("Messaging is unavailable due to privacy settings.")
        # Staff can message anyone; others must be friends first.
        if not getattr(user, "is_staff", False) and not Friendship.are_friends(user, recipient):
            raise serializers.ValidationError("You can only message friends once requests are accepted.")

        attrs["recipient"] = recipient
        attrs["notice"] = notice
        return attrs

    @transaction.atomic
    def save_with_status(self):
        if not self.is_valid():
            raise AssertionError("You must call is_valid before save_with_status")
        data = self.validated_data
        user = self.context["request"].user
        recipient = data["recipient"]
        notice = data.get("notice")

        user_a, user_b = sorted([user, recipient], key=lambda u: u.pk)
        conversation, created = Conversation.objects.get_or_create(
            user_a=user_a,
            user_b=user_b,
            notice=notice,
        )

        first_message = data.get("first_message")
        if first_message and first_message.strip():
            message_text = first_message.strip()
            msg = ConversationMessage.objects.create(
                conversation=conversation,
                sender=user,
                content=message_text,
            )
            conversation.last_message_preview = msg.content[:280]
            conversation.last_message_by = user
            conversation.last_message_at = msg.created_at
            conversation.save(update_fields=["last_message_preview", "last_message_by", "last_message_at", "updated_at"])
        return conversation, created


class MessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(required=False, allow_blank=True)
    attachment = serializers.FileField(required=False, allow_null=True)
    reply_to = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        conversation: Conversation = self.context["conversation"]
        content = attrs.get("content", "").strip() if attrs.get("content") else ""
        attachment = attrs.get("attachment")
        reply_to_id = attrs.get("reply_to")

        if not content and not attachment:
            raise serializers.ValidationError("Message must have either content or an attachment.")

        reply_to = None
        if reply_to_id:
            try:
                reply_to = conversation.messages.get(pk=reply_to_id)
            except ConversationMessage.DoesNotExist as exc:
                raise serializers.ValidationError({"reply_to": "Original message was not found in this conversation."}) from exc

        attachment_type = ""
        attachment_name = ""
        if attachment:
            content_type = getattr(attachment, "content_type", "") or None
            guessed_type = content_type or mimetypes.guess_type(getattr(attachment, "name", ""))[0]
            if not guessed_type:
                raise serializers.ValidationError({"attachment": "Could not determine the file type. Please upload an image or video."})

            if guessed_type.startswith("image/"):
                attachment_type = "image"
            elif guessed_type.startswith("video/"):
                attachment_type = "video"
            else:
                raise serializers.ValidationError({"attachment": "Only images or videos can be attached."})
            attachment_name = getattr(attachment, "name", "") or ""

        attrs["content"] = content
        attrs["reply_to"] = reply_to
        attrs["attachment_type"] = attachment_type
        attrs["attachment_name"] = attachment_name
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        conversation: Conversation = self.context["conversation"]
        user = request.user
        other_user = conversation.other_user(user)
        if other_user and UserBlock.is_blocked_between(user, other_user):
            raise serializers.ValidationError("Messaging is unavailable due to privacy settings.")
        # Staff can message anyone; others must be friends.
        if not getattr(user, "is_staff", False) and not Friendship.are_friends(user, other_user):
            raise serializers.ValidationError("You can only message friends.")
        content = validated_data.get("content", "")
        attachment_type = validated_data.get("attachment_type", "") or ""
        attachment_name = validated_data.get("attachment_name", "") or ""
        message = ConversationMessage.objects.create(
            conversation=conversation,
            sender=user,
            content=content,
            attachment=validated_data.get("attachment"),
            attachment_type=attachment_type,
            attachment_name=attachment_name,
            reply_to=validated_data.get("reply_to"),
        )
        if content:
            preview = content[:280]
        elif attachment_type == "video":
            preview = "[Video]"
        elif attachment_type == "image":
            preview = "[Photo]"
        else:
            preview = "[Attachment]"
        conversation.last_message_preview = preview
        conversation.last_message_by = user
        conversation.last_message_at = message.created_at
        conversation.save(update_fields=["last_message_preview", "last_message_by", "last_message_at", "updated_at"])
        return message

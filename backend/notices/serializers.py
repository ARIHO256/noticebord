from rest_framework import serializers

from users.models import FriendRequest, get_friend_status

from .models import (
    Attachment, Comment, Favorite, Like, Notice, NoticeTemplate, NoticeReminder,
    Report, Reaction, ReactionType, NoticeAcknowledgment, NoticeShare,
)


def _get_max_depth(context: dict) -> int:
    try:
        return int(context.get("max_depth", 2))
    except (TypeError, ValueError):
        return 2


class NoticeSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    created_by_full_name = serializers.SerializerMethodField()
    created_by_avatar = serializers.SerializerMethodField()
    created_by_friend_status = serializers.SerializerMethodField()
    created_by_friend_request_id = serializers.SerializerMethodField()
    created_by_is_staff = serializers.BooleanField(source="created_by.is_staff", read_only=True)
    created_by_is_faculty = serializers.BooleanField(source="created_by.is_faculty", read_only=True)
    created_by_designation = serializers.CharField(source="created_by.designation", read_only=True)
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)
    favorites_count = serializers.IntegerField(source="favorites.count", read_only=True)
    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    reactions_count = serializers.SerializerMethodField()
    reaction_breakdown = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    is_acknowledged = serializers.SerializerMethodField()
    acknowledgment_count = serializers.SerializerMethodField()

    attachments = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        fields = [
            "id",
            "title",
            "description",
            "created_by",
            "department",
            "category",
            "is_pinned",
            "priority",
            "scheduled_at",
            "expires_at",
            "created_by_username",
            "created_by_full_name",
            "created_by_avatar",
            "created_by_friend_status",
            "created_by_friend_request_id",
            "created_by_is_staff",
            "created_by_is_faculty",
            "created_by_designation",
            "created_at",
            "updated_at",
            "is_active",
            "suspension_reason",
            "views_count",
            "likes_count",
            "favorites_count",
            "comments_count",
            "reactions_count",
            "reaction_breakdown",
            "my_reaction",
            "is_liked",
            "is_favorited",
            "is_acknowledged",
            "acknowledgment_count",
            "attachments",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "created_by_username", "suspension_reason"]
    
    def to_representation(self, instance):
        """Override to handle suspension_reason field gracefully if migration hasn't been run"""
        data = super().to_representation(instance)
        # If suspension_reason field doesn't exist on the model, return None
        if 'suspension_reason' not in data:
            try:
                # Try to get the field value
                data['suspension_reason'] = getattr(instance, 'suspension_reason', None)
            except AttributeError:
                # Field doesn't exist yet (migration not run)
                data['suspension_reason'] = None
        return data

    def get_is_liked(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return False
        return obj.likes.filter(user_id=user.id).exists()

    def get_is_favorited(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return False
        return obj.favorites.filter(user_id=user.id).exists()

    def get_reactions_count(self, obj):
        return obj.reactions.count()

    def get_reaction_breakdown(self, obj):
        from django.db.models import Count
        breakdown = obj.reactions.values("reaction_type").annotate(count=Count("id"))
        return {item["reaction_type"]: item["count"] for item in breakdown}

    def get_my_reaction(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return None
        reaction = obj.reactions.filter(user_id=user.id).first()
        return reaction.reaction_type if reaction else None

    def get_is_acknowledged(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return False
        return obj.acknowledgments.filter(user_id=user.id).exists()

    def get_acknowledgment_count(self, obj):
        return obj.acknowledgments.count()

    def get_created_by_full_name(self, obj):
        fn = (obj.created_by.first_name or "").strip()
        ln = (obj.created_by.last_name or "").strip()
        full = (fn + " " + ln).strip()
        return full if full else obj.created_by.username

    def get_created_by_avatar(self, obj):
        request = self.context.get("request")
        avatar = getattr(obj.created_by, "avatar", None)
        if avatar:
            url = avatar.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_created_by_friend_status(self, obj):
        request = self.context.get("request")
        viewer = getattr(request, "user", None) if request else None
        return get_friend_status(viewer, obj.created_by)

    def get_created_by_friend_request_id(self, obj):
        request = self.context.get("request")
        viewer = getattr(request, "user", None) if request else None
        if not viewer or not getattr(viewer, "is_authenticated", False):
            return None
        status = get_friend_status(viewer, obj.created_by)
        if status == "outgoing":
            pending = FriendRequest.pending_between(viewer, obj.created_by)
            return pending.id if pending else None
        if status == "incoming":
            pending = FriendRequest.pending_between(obj.created_by, viewer)
            return pending.id if pending else None
        return None

    def get_attachments(self, obj):
        request = self.context.get("request")
        serializer = AttachmentSerializer(obj.attachments.all(), many=True, context={"request": request})
        return serializer.data


class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "notice", "url", "file_type", "original_name", "created_at"]
        read_only_fields = ["id", "notice", "created_at", "url", "file_type", "original_name"]

    def get_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        url = obj.file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "notice", "user", "reason", "created_at"]
        read_only_fields = ["id", "user", "created_at", "notice"]


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    user_full_name = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()
    parent = serializers.PrimaryKeyRelatedField(queryset=Comment.objects.all(), required=False, allow_null=True, write_only=True)
    parent_id = serializers.IntegerField(source="parent.id", read_only=True)
    replies = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "notice",
            "user",
            "username",
            "user_full_name",
            "user_avatar",
            "text",
            "created_at",
            "parent",
            "parent_id",
            "replies",
            "likes_count",
            "is_liked",
        ]
        read_only_fields = ["id", "user", "username", "user_full_name", "user_avatar", "created_at", "parent_id", "replies", "likes_count", "is_liked"]

    def get_user_full_name(self, obj):
        fn = (obj.user.first_name or "").strip()
        ln = (obj.user.last_name or "").strip()
        full = (fn + " " + ln).strip()
        return full if full else obj.user.username

    def get_user_avatar(self, obj):
        request = self.context.get("request")
        avatar = getattr(obj.user, "avatar", None)
        if avatar:
            url = avatar.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_authenticated", False):
            return False
        return obj.likes.filter(user_id=request.user.id).exists()

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_replies(self, obj):
        depth = self.context.get("depth", 0)
        max_depth = _get_max_depth(self.context)
        if depth >= max_depth:
            return []
        qs = obj.replies.order_by("created_at")
        serializer = CommentSerializer(
            qs,
            many=True,
            context={**self.context, "depth": depth + 1},
        )
        return serializer.data

    def validate_parent(self, value):
        if value is None:
            return value
        notice_id = self.initial_data.get("notice")
        if notice_id and str(value.notice_id) != str(notice_id):
            raise serializers.ValidationError("Parent comment must belong to the same notice.")
        return value


class NoticeTemplateSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = NoticeTemplate
        fields = [
            "id",
            "name",
            "title_template",
            "description_template",
            "category",
            "priority",
            "created_by",
            "created_by_username",
            "is_public",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "created_by_username"]


from rest_framework import serializers
from users.serializers import MiniUserSerializer
from .models import Group, GroupMembership, GroupMessage, GroupMessageRead


class GroupMembershipSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)

    class Meta:
        model = GroupMembership
        fields = ["id", "group", "user", "role", "is_active", "joined_at"]
        read_only_fields = ["id", "joined_at"]


class GroupListSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    is_member = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    created_by = MiniUserSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id", "name", "description", "group_type", "avatar_url", "cover_image_url",
            "course", "department", "school", "academic_year",
            "created_by", "is_active", "is_public", "only_admin_can_post",
            "member_count", "is_member", "user_role",
            "created_at", "updated_at",
        ]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar:
            url = obj.avatar.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_cover_image_url(self, obj):
        request = self.context.get("request")
        if obj.cover_image:
            url = obj.cover_image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_is_member(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return obj.memberships.filter(user=user, is_active=True).exists()

    def get_user_role(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return None
        membership = obj.memberships.filter(user=user, is_active=True).first()
        return membership.role if membership else None


class GroupDetailSerializer(GroupListSerializer):
    members = serializers.SerializerMethodField()

    class Meta(GroupListSerializer.Meta):
        fields = GroupListSerializer.Meta.fields + ["members"]

    def get_members(self, obj):
        memberships = obj.memberships.filter(is_active=True).select_related("user")[:50]
        return GroupMembershipSerializer(memberships, many=True).data


class GroupMessageSerializer(serializers.ModelSerializer):
    sender = MiniUserSerializer(read_only=True)
    reply_to = serializers.PrimaryKeyRelatedField(queryset=GroupMessage.objects.all(), required=False, allow_null=True)
    attachment_url = serializers.SerializerMethodField()
    read_count = serializers.SerializerMethodField()

    class Meta:
        model = GroupMessage
        fields = [
            "id", "group", "sender", "content", "attachment", "attachment_url",
            "attachment_type", "attachment_name", "reply_to",
            "created_at", "edited_at", "is_pinned", "read_count",
        ]
        read_only_fields = ["id", "sender", "created_at", "edited_at"]

    def get_attachment_url(self, obj):
        request = self.context.get("request")
        if obj.attachment:
            url = obj.attachment.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_read_count(self, obj):
        return obj.reads.count()

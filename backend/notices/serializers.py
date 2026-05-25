from rest_framework import serializers
from django.utils import timezone
from users.serializers import MiniUserSerializer
from .models import (
    Notice,
    Like,
    Favorite,
    Comment,
    NoticeView,
    Report,
    Attachment,
    CommentLike,
    NoticeTemplate,
    NoticeReminder,
    Reaction,
    NoticeAcknowledgment,
    NoticeShare,
    Tag,
    NoticeTag,
    Poll,
    PollOption,
    PollVote,
    NoticeDraft,
)


class AttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "file", "file_url", "file_type", "original_name", "created_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file:
            url = obj.file.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


class CommentSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)
    replies_count = serializers.IntegerField(source="replies.count", read_only=True)
    is_liked_by_user = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "notice", "user", "text", "parent", "likes_count", "replies_count", "is_liked_by_user", "created_at"]
        read_only_fields = ["id", "user", "likes_count", "replies_count", "created_at"]

    def get_is_liked_by_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return obj.likes.filter(user=user).exists()


class ReactionSerializer(serializers.ModelSerializer):
    user = MiniUserSerializer(read_only=True)

    class Meta:
        model = Reaction
        fields = ["id", "notice", "user", "reaction_type", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "display_name", "description", "is_trending", "usage_count", "created_at"]


class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.IntegerField(read_only=True)
    percentage = serializers.FloatField(read_only=True)
    is_voted_by_user = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ["id", "poll", "text", "display_order", "vote_count", "percentage", "is_voted_by_user"]
        read_only_fields = ["id", "vote_count", "percentage"]

    def get_is_voted_by_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return obj.votes.filter(user=user).exists()


class PollSerializer(serializers.ModelSerializer):
    options = PollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.IntegerField(read_only=True)
    is_ended = serializers.BooleanField(read_only=True)
    has_voted = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = ["id", "notice", "question", "is_multiple_choice", "is_anonymous", "ends_at", "options", "total_votes", "is_ended", "has_voted", "created_at"]

    def get_has_voted(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return PollVote.objects.filter(option__poll=obj, user=user).exists()


class NoticeListSerializer(serializers.ModelSerializer):
    created_by = MiniUserSerializer(read_only=True)
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)
    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    reactions_summary = serializers.SerializerMethodField()
    is_liked_by_user = serializers.SerializerMethodField()
    is_favorited_by_user = serializers.SerializerMethodField()
    is_acknowledged_by_user = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    poll = PollSerializer(read_only=True)

    class Meta:
        model = Notice
        fields = [
            "id", "title", "description", "created_by", "department", "category",
            "is_pinned", "priority", "scheduled_at", "expires_at",
            "likes_count", "comments_count", "reactions_summary",
            "is_liked_by_user", "is_favorited_by_user", "is_acknowledged_by_user",
            "views_count", "attachments", "tags", "poll",
            "is_active", "created_at", "updated_at",
        ]

    def get_reactions_summary(self, obj):
        summary = {}
        for rtype, _ in Reaction.ReactionType.choices:
            count = obj.reactions.filter(reaction_type=rtype).count()
            if count > 0:
                summary[rtype] = count
        return summary

    def get_is_liked_by_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return obj.likes.filter(user=user).exists()

    def get_is_favorited_by_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return obj.favorites.filter(user=user).exists()

    def get_is_acknowledged_by_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return obj.acknowledgments.filter(user=user).exists()


class NoticeDetailSerializer(NoticeListSerializer):
    comments = CommentSerializer(many=True, read_only=True)

    class Meta(NoticeListSerializer.Meta):
        fields = NoticeListSerializer.Meta.fields + ["comments", "suspension_reason"]


class NoticeCreateUpdateSerializer(serializers.ModelSerializer):
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    poll_question = serializers.CharField(write_only=True, required=False)
    poll_options = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    poll_is_multiple = serializers.BooleanField(write_only=True, required=False, default=False)
    poll_ends_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = Notice
        fields = [
            "id", "title", "description", "department", "category",
            "priority", "scheduled_at", "expires_at", "is_pinned",
            "tag_names", "poll_question", "poll_options", "poll_is_multiple", "poll_ends_at",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        tag_names = validated_data.pop("tag_names", [])
        poll_question = validated_data.pop("poll_question", None)
        poll_options = validated_data.pop("poll_options", [])
        poll_is_multiple = validated_data.pop("poll_is_multiple", False)
        poll_ends_at = validated_data.pop("poll_ends_at", None)

        notice = Notice.objects.create(**validated_data)

        # Handle tags
        for tag_name in tag_names:
            slug = tag_name.lower().strip().replace(" ", "-")[:50]
            tag, _ = Tag.objects.get_or_create(name=slug, defaults={"display_name": tag_name.strip()})
            NoticeTag.objects.get_or_create(notice=notice, tag=tag)
            tag.usage_count = Tag.objects.filter(notice_tags__tag=tag).count()
            tag.save()

        # Handle poll
        if poll_question and poll_options:
            poll = Poll.objects.create(
                notice=notice,
                question=poll_question,
                is_multiple_choice=poll_is_multiple,
                ends_at=poll_ends_at,
            )
            for idx, opt_text in enumerate(poll_options):
                PollOption.objects.create(poll=poll, text=opt_text, display_order=idx)

        return notice

    def update(self, instance, validated_data):
        tag_names = validated_data.pop("tag_names", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if tag_names is not None:
            instance.notice_tags.all().delete()
            for tag_name in tag_names:
                slug = tag_name.lower().strip().replace(" ", "-")[:50]
                tag, _ = Tag.objects.get_or_create(name=slug, defaults={"display_name": tag_name.strip()})
                NoticeTag.objects.get_or_create(notice=instance, tag=tag)

        return instance


class NoticeTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoticeTemplate
        fields = ["id", "name", "title_template", "description_template", "category", "priority", "created_by", "is_public", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class NoticeReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoticeReminder
        fields = ["id", "notice", "remind_at", "is_sent", "created_at"]
        read_only_fields = ["id", "is_sent", "created_at"]


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "notice", "user", "reason", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class NoticeDraftSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = NoticeDraft
        fields = [
            "id", "title", "description", "department", "category", "priority",
            "scheduled_at", "expires_at", "tags", "tag_names", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        tag_names = validated_data.pop("tag_names", [])
        draft = NoticeDraft.objects.create(**validated_data)
        for tag_name in tag_names:
            slug = tag_name.lower().strip().replace(" ", "-")[:50]
            tag, _ = Tag.objects.get_or_create(name=slug, defaults={"display_name": tag_name.strip()})
            draft.tags.add(tag)
        return draft

    def update(self, instance, validated_data):
        tag_names = validated_data.pop("tag_names", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_names is not None:
            instance.tags.clear()
            for tag_name in tag_names:
                slug = tag_name.lower().strip().replace(" ", "-")[:50]
                tag, _ = Tag.objects.get_or_create(name=slug, defaults={"display_name": tag_name.strip()})
                instance.tags.add(tag)
        return instance

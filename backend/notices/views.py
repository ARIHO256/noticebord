from django.db.models import Count, Q, Prefetch
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from moderation.services import moderate_text
from users.models import UserDesignation
from users.command_chain import get_scope_filter
from .approval_workflow import submit_for_approval, auto_approve_if_eligible
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
from .serializers import (
    NoticeListSerializer,
    NoticeDetailSerializer,
    NoticeCreateUpdateSerializer,
    CommentSerializer,
    AttachmentSerializer,
    NoticeTemplateSerializer,
    NoticeReminderSerializer,
    ReportSerializer,
    ReactionSerializer,
    TagSerializer,
    PollSerializer,
    PollOptionSerializer,
    NoticeDraftSerializer,
)
from .permissions import IsOwnerOrReadOnly, IsAdminUser


class NoticeViewSet(viewsets.ModelViewSet):
    queryset = Notice.objects.filter(is_active=True)
    serializer_class = NoticeListSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["department", "category", "priority", "is_pinned"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "views_count", "priority"]
    ordering = ["-is_pinned", "-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Exclude expired notices from default list
        now = timezone.now()
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        # Exclude suspended notices for non-staff
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(suspension_reason="")
        # Apply command chain scope filtering
        scope_filter = get_scope_filter(user, "notice")
        if scope_filter:
            qs = qs.filter(scope_filter)
        # Tag filter
        tag = self.request.query_params.get("tag")
        if tag:
            qs = qs.filter(notice_tags__tag__name__iexact=tag)
        # Annotation
        qs = qs.annotate(
            likes_count=Count("likes", distinct=True),
            comments_count=Count("comments", distinct=True),
        )
        qs = qs.prefetch_related("attachments", "notice_tags__tag", "poll__options")
        return qs

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return NoticeCreateUpdateSerializer
        if self.action == "retrieve":
            return NoticeDetailSerializer
        return NoticeListSerializer

    def perform_create(self, serializer):
        user = self.request.user
        department_value = user.department if user.department else "General"
        school_value = user.school if user.school else ""
        category_value = serializer.validated_data.get("category", "general")

        # Auto-title for students
        if user.designation == UserDesignation.STUDENT:
            title = serializer.validated_data.get("title", "")
            if not title:
                title = f"Notice from {user.get_full_name() or user.username}"
                serializer.validated_data["title"] = title

        instance = serializer.save(created_by=user, department=department_value, school=school_value, category=category_value)
        # Content moderation
        text_to_check = f"{instance.title} {instance.description}"
        moderation = moderate_text(text_to_check)
        if moderation.get("violation"):
            instance.is_active = False
            instance.suspension_reason = moderation.get("reason", "Content violation detected.")
            instance.save(update_fields=["is_active", "suspension_reason"])
            return

        # Approval workflow for official notices from staff
        if getattr(user, "designation", "") in ["lecturer", "hod", "dean"]:
            instance.is_active = False  # Hide until approved
            instance.save(update_fields=["is_active"])
            submit_for_approval(instance)
        else:
            auto_approve_if_eligible(instance)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Track view
        NoticeView.objects.get_or_create(notice=instance, user=request.user)
        instance.views_count += 1
        instance.save(update_fields=["views_count"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="like")
    def like(self, request, pk=None):
        notice = self.get_object()
        Like.objects.get_or_create(notice=notice, user=request.user)
        return Response({"detail": "Liked.", "likes_count": notice.likes.count()})

    @action(detail=True, methods=["post"], url_path="unlike")
    def unlike(self, request, pk=None):
        notice = self.get_object()
        Like.objects.filter(notice=notice, user=request.user).delete()
        return Response({"detail": "Unliked.", "likes_count": notice.likes.count()})

    @action(detail=True, methods=["post"], url_path="favorite")
    def favorite(self, request, pk=None):
        notice = self.get_object()
        Favorite.objects.get_or_create(notice=notice, user=request.user)
        return Response({"detail": "Favorited."})

    @action(detail=True, methods=["post"], url_path="unfavorite")
    def unfavorite(self, request, pk=None):
        notice = self.get_object()
        Favorite.objects.filter(notice=notice, user=request.user).delete()
        return Response({"detail": "Unfavorited."})

    @action(detail=False, methods=["get"], url_path="favorites")
    def favorites(self, request):
        qs = Notice.objects.filter(favorites__user=request.user, is_active=True)
        page = self.paginate_queryset(qs)
        serializer = NoticeListSerializer(page or qs, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data) if page else Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="comments")
    def add_comment(self, request, pk=None):
        notice = self.get_object()
        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(notice=notice, user=request.user)
        return Response(CommentSerializer(comment, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="comments")
    def list_comments(self, request, pk=None):
        notice = self.get_object()
        qs = Comment.objects.filter(notice=notice, parent__isnull=True).prefetch_related("replies")
        serializer = CommentSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="comments/(?P<comment_id>[^/.]+)/like")
    def like_comment(self, request, pk=None, comment_id=None):
        comment = Comment.objects.get(pk=comment_id, notice_id=pk)
        CommentLike.objects.get_or_create(comment=comment, user=request.user)
        return Response({"detail": "Comment liked.", "likes_count": comment.likes.count()})

    @action(detail=True, methods=["post"], url_path="comments/(?P<comment_id>[^/.]+)/unlike")
    def unlike_comment(self, request, pk=None, comment_id=None):
        comment = Comment.objects.get(pk=comment_id, notice_id=pk)
        CommentLike.objects.filter(comment=comment, user=request.user).delete()
        return Response({"detail": "Comment unliked.", "likes_count": comment.likes.count()})

    @action(detail=True, methods=["post"], url_path="attachments")
    def add_attachment(self, request, pk=None):
        notice = self.get_object()
        serializer = AttachmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment = serializer.save(notice=notice)
        return Response(AttachmentSerializer(attachment, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="report")
    def report(self, request, pk=None):
        notice = self.get_object()
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(notice=notice, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        notice = self.get_object()
        if not request.user.is_staff:
            return Response({"detail": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        notice.is_pinned = True
        notice.save(update_fields=["is_pinned"])
        return Response({"detail": "Pinned."})

    @action(detail=True, methods=["post"], url_path="unpin")
    def unpin(self, request, pk=None):
        notice = self.get_object()
        if not request.user.is_staff:
            return Response({"detail": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        notice.is_pinned = False
        notice.save(update_fields=["is_pinned"])
        return Response({"detail": "Unpinned."})

    @action(detail=True, methods=["post"], url_path="remind")
    def remind(self, request, pk=None):
        notice = self.get_object()
        remind_at = request.data.get("remind_at")
        if not remind_at:
            return Response({"detail": "remind_at required."}, status=status.HTTP_400_BAD_REQUEST)
        reminder, created = NoticeReminder.objects.get_or_create(
            notice=notice, user=request.user, remind_at=remind_at
        )
        return Response(NoticeReminderSerializer(reminder).data)

    @action(detail=True, methods=["post"], url_path="react")
    def react(self, request, pk=None):
        notice = self.get_object()
        reaction_type = request.data.get("reaction_type", "like")
        Reaction.objects.update_or_create(
            notice=notice, user=request.user, defaults={"reaction_type": reaction_type}
        )
        return Response({"detail": "Reaction added."})

    @action(detail=True, methods=["post"], url_path="unreact")
    def unreact(self, request, pk=None):
        notice = self.get_object()
        Reaction.objects.filter(notice=notice, user=request.user).delete()
        return Response({"detail": "Reaction removed."})

    @action(detail=True, methods=["post"], url_path="acknowledge")
    def acknowledge(self, request, pk=None):
        notice = self.get_object()
        NoticeAcknowledgment.objects.get_or_create(notice=notice, user=request.user)
        return Response({"detail": "Acknowledged."})

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, pk=None):
        notice = self.get_object()
        method = request.data.get("method", "copy_link")
        NoticeShare.objects.create(notice=notice, user=request.user, share_method=method)
        return Response({"detail": "Shared."})

    @action(detail=False, methods=["get"], url_path="trending")
    def trending(self, request):
        qs = self.get_queryset().order_by("-views_count")[:20]
        serializer = NoticeListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="official")
    def official(self, request):
        qs = self.get_queryset().filter(created_by__is_staff=True)
        serializer = NoticeListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="for-you")
    def for_you(self, request):
        user = request.user
        followed = user.followed_departments or []
        qs = self.get_queryset().filter(
            Q(department__in=followed) | Q(created_by__department=user.department)
        ).distinct()
        serializer = NoticeListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="most-liked")
    def most_liked(self, request):
        qs = self.get_queryset().annotate(like_count=Count("likes")).order_by("-like_count")[:20]
        serializer = NoticeListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="suggested")
    def suggested(self, request):
        qs = self.get_queryset().annotate(
            engagement=Count("likes") + Count("comments")
        ).order_by("-engagement")[:20]
        serializer = NoticeListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "")
        if not q:
            return Response({"detail": "Query parameter 'q' required."}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.get_queryset().filter(Q(title__icontains=q) | Q(description__icontains=q))
        page = self.paginate_queryset(qs)
        serializer = NoticeListSerializer(page or qs, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data) if page else Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="tags")
    def list_tags(self, request):
        tags = Tag.objects.all().order_by("-usage_count")[:100]
        serializer = TagSerializer(tags, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="polls/vote")
    def vote_poll(self, request, pk=None):
        notice = self.get_object()
        try:
            poll = notice.poll
        except Poll.DoesNotExist:
            return Response({"detail": "No poll on this notice."}, status=status.HTTP_404_NOT_FOUND)
        if poll.is_ended:
            return Response({"detail": "Poll has ended."}, status=status.HTTP_400_BAD_REQUEST)
        option_id = request.data.get("option_id")
        if not option_id:
            return Response({"detail": "option_id required."}, status=status.HTTP_400_BAD_REQUEST)
        option = PollOption.objects.get(pk=option_id, poll=poll)
        if not poll.is_multiple_choice:
            PollVote.objects.filter(option__poll=poll, user=request.user).delete()
        PollVote.objects.get_or_create(option=option, user=request.user)
        return Response({"detail": "Voted."})


class NoticeTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = NoticeTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return NoticeTemplate.objects.filter(Q(is_public=True) | Q(created_by=self.request.user))

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class NoticeDraftViewSet(viewsets.ModelViewSet):
    serializer_class = NoticeDraftSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return NoticeDraft.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        draft = self.get_object()
        # Create notice from draft
        notice = Notice.objects.create(
            title=draft.title,
            description=draft.description,
            department=draft.department,
            category=draft.category,
            priority=draft.priority,
            scheduled_at=draft.scheduled_at,
            expires_at=draft.expires_at,
            created_by=request.user,
        )
        for tag in draft.tags.all():
            NoticeTag.objects.get_or_create(notice=notice, tag=tag)
        draft.delete()
        return Response({"detail": "Published.", "notice_id": notice.id}, status=status.HTTP_201_CREATED)

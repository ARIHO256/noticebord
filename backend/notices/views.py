from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as filters

from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
import requests
import mimetypes

from .models import (
    Attachment,
    Comment,
    CommentLike,
    Favorite,
    Like,
    Notice,
    NoticeCategory,
    NoticeTemplate,
    NoticeReminder,
    NON_ACADEMIC_DEPARTMENTS,
    NoticeView,
    Report,
)
from .serializers import AttachmentSerializer, CommentSerializer, NoticeSerializer, NoticeTemplateSerializer, ReportSerializer
from users.throttling import CommentRateThrottle, ReportRateThrottle


LEADERSHIP_KEYWORDS = ["registrar", "administrator", "admin", "hod", "head of department"]

# Cross-cutting official departments that send notices to all students
CROSS_CUTTING_OFFICIAL_DEPARTMENTS = [
    "Registrar",
    "Vice Chancellor",
    "Business Office",
    "Head of Security",
    "Chaplain",
]

# Official designations from User model
OFFICIAL_DESIGNATIONS = [
    "vice_chancellor",
    "registrar",
    "business_office",
    "security",
    "lecturer",
    "dean",
    "hod",
]

OFFICIAL_ROLES_KEYWORDS = [
    "admin", "administrator", "registrar",
    "hod", "head of department",
    "lecturer", "lecture",
    "guild president", "guild",
    "coordinator", "class coordinator",
    "dean", "director",
    "vice chancellor", "vc",
    "business office",
    "security",
]


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if getattr(request.user, "is_staff", False):
            return True
        return getattr(obj, "created_by_id", None) == getattr(request.user, "id", None)


class NoticeFilter(filters.FilterSet):
    created_by = filters.NumberFilter(field_name="created_by_id")
    priority = filters.ChoiceFilter(choices=[("urgent", "Urgent"), ("important", "Important"), ("normal", "Normal")])
    expired = filters.BooleanFilter(method="filter_expired")
    department_list = filters.CharFilter(method="filter_department_list")

    class Meta:
        model = Notice
        fields = {
            "department": ["exact"],
            "is_active": ["exact"],
            "created_by": ["exact"],
            "category": ["exact"],
            "priority": ["exact"],
        }

    def filter_expired(self, queryset, name, value):
        now = timezone.now()
        if value:
            return queryset.filter(expires_at__lte=now)
        return queryset.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))

    def filter_department_list(self, queryset, name, value):
        departments = [d.strip() for d in value.split(",") if d.strip()]
        if departments:
            return queryset.filter(department__in=departments)
        return queryset


class NoticeViewSet(viewsets.ModelViewSet):
    queryset = Notice.objects.all()
    serializer_class = NoticeSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "description", "department", "created_by__username"]
    ordering_fields = ["created_at", "views_count"]
    filterset_class = NoticeFilter

    def get_permissions(self):
        unrestricted_actions = {
            "list",
            "retrieve",
            "like",
            "unlike",
            "favorite",
            "unfavorite",
            "favorites",
            "comments",
            "like_comment",
            "unlike_comment",
            "trending",
            "most_liked",
            "suggested",
            "report",
        }
        if getattr(self, "action", None) in unrestricted_actions:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def _can_view_suspended_notice(self, user, notice):
        """Check if user can view a suspended notice"""
        # Superuser can always see suspended notices
        if getattr(user, "is_superuser", False):
            return True
        
        # HOD can see suspended notices from their department
        user_designation = (getattr(user, "designation", "") or "").lower()
        user_department = getattr(user, "department", "") or ""
        notice_department = notice.department or ""
        notice_creator_department = getattr(notice.created_by, "department", "") or ""
        
        if user_designation == "hod" or "hod" in user_designation or "head of department" in user_designation:
            # Check if notice is from HOD's department
            if (notice_department and notice_department == user_department) or \
               (notice_creator_department and notice_creator_department == user_department):
                return True
        
        # Dean can see suspended notices from their school
        user_school = getattr(user, "school", "") or ""
        notice_creator_school = getattr(notice.created_by, "school", "") or ""
        
        if user_designation == "dean" or "dean" in user_designation:
            # Check if notice creator is from Dean's school
            if notice_creator_school and notice_creator_school == user_school:
                return True
        
        # Staff can see all suspended notices
        if getattr(user, "is_staff", False):
            return True
        
        return False

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        from users.models import UserBlock, UserMute

        # Respect social safety/privacy controls.
        blocked_by_me = UserBlock.objects.filter(blocker=user).values_list("blocked_id", flat=True)
        blocked_me = UserBlock.objects.filter(blocked=user).values_list("blocker_id", flat=True)
        muted_by_me = UserMute.objects.filter(muter=user).values_list("muted_id", flat=True)
        qs = qs.exclude(created_by_id__in=blocked_by_me)
        qs = qs.exclude(created_by_id__in=blocked_me)
        qs = qs.exclude(created_by_id__in=muted_by_me)

        # Check if this is a retrieve action (accessing a specific post by ID)
        # For retrieve, admin/staff should be able to access suspended posts
        is_retrieve_action = getattr(self, "action", None) == "retrieve"
        
        # Check if user is explicitly requesting suspended posts (for notifications)
        is_active_param = self.request.query_params.get('is_active')
        is_requesting_suspended = is_active_param is not None and is_active_param.lower() in ('false', '0', 'no')
        
        # Superuser and staff can access all notices regardless of schedule window or active flag
        # BUT exclude suspended posts from regular list - they should appear as notifications instead
        # However, if explicitly requesting suspended posts (is_active=false) OR retrieving a specific post, allow them
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            if is_requesting_suspended or is_retrieve_action:
                # Allow suspended posts when explicitly requested (for notifications) or when retrieving a specific post
                # Don't filter by schedule/expiration for suspended posts
                # For retrieve, return all posts (including suspended) so admin/staff can access them
                if is_retrieve_action:
                    # For retrieve, don't filter by is_active - allow access to all posts
                    return qs.order_by("-updated_at", "-created_at")
                else:
                    # For list with is_active=false, only show suspended posts
                    qs = qs.filter(is_active=False)
                    return qs.order_by("-updated_at", "-created_at")
            else:
                # Filter out suspended posts from regular list view
                # Suspended posts will be shown as notifications instead
                qs = qs.filter(is_active=True)
                # Still respect schedule and expiration for active posts
                now = timezone.now()
                qs = qs.filter(Q(scheduled_at__isnull=True) | Q(scheduled_at__lte=now))
                qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
                from django.db.models import Case, When, IntegerField
                priority_order = Case(
                    When(priority="urgent", then=1),
                    When(priority="important", then=2),
                    When(priority="normal", then=3),
                    default=3,
                    output_field=IntegerField(),
                )
                return qs.order_by(priority_order, "-is_pinned", "-created_at")

        now = timezone.now()
        
        # For suspended notices: only show if user has permission (HOD, Dean, superuser)
        # Owners CANNOT see their suspended posts in list views
        # They can only see them when accessed directly via notification (handled in retrieve)
        suspended_notices_q = None
        
        # Check if user is HOD or Dean
        user_designation = (getattr(user, "designation", "") or "").lower()
        user_department = getattr(user, "department", "") or ""
        user_school = getattr(user, "school", "") or ""
        
        is_hod = user_designation == "hod" or "hod" in user_designation or "head of department" in user_designation
        is_dean = user_designation == "dean" or "dean" in user_designation
        
        if is_hod and user_department:
            # HOD can see suspended notices from their department
            suspended_notices_q = Q(
                is_active=False,
                department=user_department
            ) | Q(
                is_active=False,
                created_by__department=user_department
            )
        
        if is_dean and user_school:
            # Dean can see suspended notices from their school
            if suspended_notices_q:
                suspended_notices_q |= Q(
                    is_active=False,
                    created_by__school=user_school
                )
            else:
                suspended_notices_q = Q(
                    is_active=False,
                    created_by__school=user_school
                )
        
        # Check if user is querying their own notices (for suspended notifications)
        # Allow owners to see their own suspended notices when filtering by created_by
        created_by_filter = self.request.query_params.get('created_by') or self.request.query_params.get('created_by_id')
        is_own_notices_query = created_by_filter and str(created_by_filter) == str(user.id)
        
        # Active notices OR suspended notices that user has permission to view
        # OR user's own suspended notices (when querying own notices)
        if suspended_notices_q:
            if is_own_notices_query:
                # Allow owners to see their own suspended notices
                qs = qs.filter(
                    Q(is_active=True) | 
                    suspended_notices_q | 
                    Q(is_active=False, created_by=user)
                )
            else:
                qs = qs.filter(
                    Q(is_active=True) | suspended_notices_q
                )
        else:
            if is_own_notices_query:
                # Allow owners to see their own suspended notices
                qs = qs.filter(
                    Q(is_active=True) | Q(is_active=False, created_by=user)
                )
            else:
                # Only show active notices if user has no special permissions
                qs = qs.filter(is_active=True)
        
        # Filter by schedule and expiration
        qs = qs.filter(Q(scheduled_at__isnull=True) | Q(scheduled_at__lte=now))
        # Filter out expired notices
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))

        # For students, filter official notices by department/school rules
        if not getattr(user, "is_staff", False):
            user_department = getattr(user, "department", "") or ""
            user_school = getattr(user, "school", "") or ""
            
            # Identify official notices (from staff/faculty/leadership roles)
            designation_filter = Q()
            for keyword in OFFICIAL_ROLES_KEYWORDS:
                designation_filter |= Q(created_by__designation__icontains=keyword)
            
            # Check for official designations
            official_designation_filter = Q()
            for desig in OFFICIAL_DESIGNATIONS:
                official_designation_filter |= Q(created_by__designation=desig)
            
            official_notices_filter = Q(
                created_by__is_staff=True
            ) | Q(
                created_by__is_superuser=True
            ) | Q(
                created_by__is_faculty=True
            ) | designation_filter | official_designation_filter
            
            # Cross-cutting departments (all students receive)
            cross_cutting_filter = Q()
            for dept in CROSS_CUTTING_OFFICIAL_DEPARTMENTS:
                cross_cutting_filter |= Q(department__icontains=dept) | Q(created_by__designation__icontains=dept.lower())
            # Also check for official designations that are cross-cutting
            cross_cutting_filter |= Q(created_by__designation__in=["vice_chancellor", "registrar", "business_office", "security"])
            
            # Department filter for HOD notices
            department_filter = Q()
            if user_department:
                department_filter = Q(department=user_department) | Q(created_by__department=user_department)
            
            # School filter for Dean notices
            school_filter = Q()
            if user_school:
                school_filter = Q(created_by__school=user_school)
            
            # Filter: Show non-official notices to all, OR official notices that match rules
            # Official notices must be: cross-cutting OR match department OR match school
            official_visibility_filter = cross_cutting_filter | department_filter | school_filter
            
            # Combine: (NOT official) OR (official AND visible to user)
            qs = qs.filter(
                ~official_notices_filter | (official_notices_filter & official_visibility_filter)
            )

        global_actions = {"trending", "most_liked", "favorites", "suggested", "official"}
        if getattr(self, "action", None) in global_actions:
            from django.db.models import Case, When, IntegerField
            priority_order = Case(
                When(priority="urgent", then=1),
                When(priority="important", then=2),
                When(priority="normal", then=3),
                default=3,
                output_field=IntegerField(),
            )
            return qs.order_by(priority_order, "-is_pinned", "-created_at")

        from django.db.models import Case, When, IntegerField
        priority_order = Case(
            When(priority="urgent", then=1),
            When(priority="important", then=2),
            When(priority="normal", then=3),
            default=3,
            output_field=IntegerField(),
        )
        return qs.order_by(priority_order, "-is_pinned", "-created_at")

    def perform_create(self, serializer):
        from moderation.views import check_text_content
        import logging
        
        logger = logging.getLogger(__name__)
        user = self.request.user
        
        # Check text content (title + description) for inappropriate content
        title = serializer.validated_data.get('title', '')
        description = serializer.validated_data.get('description', '')
        
        # Check title for violations
        title_result = check_text_content(title)
        if not title_result['is_safe']:
            logger.warning(f"Notice title rejected by moderation: {title_result['reason']}")
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'title': f"Content violates community guidelines: {title_result['reason']}"
            })
        
        # Check description for violations
        description_result = check_text_content(description)
        if not description_result['is_safe']:
            logger.warning(f"Notice description rejected by moderation: {description_result['reason']}")
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'description': f"Content violates community guidelines: {description_result['reason']}"
            })
        
        # If text passed, create the notice
        department_value, category_value = self._resolve_department_and_category(user, serializer)
        notice = serializer.save(
            created_by=user,
            department=department_value,
            category=category_value,
        )
        
        # Log moderation check for audit trail
        logger.info(f"Notice {notice.id} passed text content moderation")
        
        # Deliver notifications asynchronously if scheduled_at is now or past
        if not notice.scheduled_at or notice.scheduled_at <= timezone.now():
            from .services import deliver_notice_notifications
            deliver_notice_notifications(notice)
    
    def _analyze_attachment_and_suspend_if_needed(self, notice, attachment):
        """Image/video moderation disabled; no automatic suspension."""
        return None

    def _analyze_and_suspend_if_needed(self, notice):
        """Analyze notice attachments and suspend if harmful content is detected"""
        # This method is kept for backward compatibility
        # But we now analyze attachments individually when they're uploaded
        pass
    
    def _notify_user_of_suspension(self, notice, reason):
        """Send notification to user that their post was suspended"""
        # Create a notification record that can be retrieved by the user
        # This will be shown in their notifications feed
        try:
            from notices.models import Notice
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            # The notification will be shown when user views their notices
            # We can also send a push notification here if push notifications are set up
            # For now, the suspension_reason field will be visible when they view the notice
            
            # You can extend this to:
            # 1. Create a Notification model to store user notifications
            # 2. Send push notifications using expo-notifications
            # 3. Send email notifications
            
            print(f"Notice {notice.id} suspended for user {notice.created_by.username}. Reason: {reason}")
        except Exception as e:
            print(f"Error notifying user of suspension: {str(e)}")

    def perform_update(self, serializer):
        user = self.request.user
        department_value, category_value = self._resolve_department_and_category(user, serializer, is_update=True)
        serializer.save(department=department_value, category=category_value)

    def _resolve_department_and_category(self, user, serializer, *, is_update: bool = False):
        """
        Determine the department and category for a notice create/update while enforcing role rules.
        """
        data = serializer.validated_data
        instance = getattr(serializer, "instance", None)
        is_faculty = getattr(user, "is_faculty", False)
        user_department = getattr(user, "department", "") or ""

        # Resolve department
        if self._can_manage_department(user):
            department_value = data.get("department")
            if department_value is None and instance is not None:
                department_value = instance.department
            if department_value is None:
                department_value = user_department
        else:
            # Non-staff users default to their own department
            department_value = user_department

        # Resolve category
        category_value = data.get("category")
        if category_value is None and instance is not None:
            category_value = instance.category
        if category_value is None:
            category_value = NoticeCategory.CAMPUS_LIFE

        # Guard education category
        if category_value == NoticeCategory.EDUCATION:
            if not self._can_post_education(user):
                raise permissions.PermissionDenied(
                    "Only administrators, registrars, or department heads can post in Education."
                )

        # Students cannot post in restricted categories
        if not (self._can_manage_department(user) or is_faculty) and category_value == NoticeCategory.EDUCATION:
            raise permissions.PermissionDenied("Students cannot post in Education.")

        return department_value, category_value

    def _can_post_education(self, user) -> bool:
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        designation = (getattr(user, "designation", "") or "").lower()
        return any(keyword in designation for keyword in LEADERSHIP_KEYWORDS)

    def _can_manage_department(self, user) -> bool:
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        designation = (getattr(user, "designation", "") or "").lower()
        return any(keyword in designation for keyword in LEADERSHIP_KEYWORDS)
    def get_object(self):
        """Override get_object to allow admin/staff and owners to access suspended posts"""
        # Get the lookup value from kwargs
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs[lookup_url_kwarg]
        
        user = self.request.user
        
        # For admin/staff, bypass queryset filtering and get directly from DB
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            try:
                notice = Notice.objects.get(pk=lookup_value)
                return notice
            except Notice.DoesNotExist:
                from rest_framework.exceptions import NotFound
                raise NotFound("Notice not found.")
        
        # For owners, allow them to retrieve their own suspended notices
        try:
            notice = Notice.objects.get(pk=lookup_value)
            if notice.created_by == user:
                return notice
        except Notice.DoesNotExist:
            pass
        
        # For everyone else, use the default behavior (respects queryset filtering)
        return super().get_object()
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve a notice with special handling for suspended notices"""
        user = request.user
        
        # Use get_object() which now handles admin/staff correctly (bypasses queryset for suspended posts)
        try:
            notice = self.get_object()
        except Notice.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Notice not found.")
        
        # Check if notice is suspended and user has permission
        if not notice.is_active:
            # Check if user can view this suspended notice
            can_view = False
            
            # Superuser can always see
            if getattr(user, "is_superuser", False):
                can_view = True
            # Staff can see all
            elif getattr(user, "is_staff", False):
                can_view = True
            # HOD can see suspended notices from their department
            elif self._can_view_suspended_notice(user, notice):
                can_view = True
            # Owner can see their suspended notice ONLY when accessed directly (via notification)
            # This allows them to see the full notification but not in list views
            elif notice.created_by_id == user.id:
                can_view = True
            
            if not can_view:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to view this suspended notice.")
        
        # Serialize the notice
        serializer = self.get_serializer(notice)
        
        # Track view
        NoticeView.objects.create(notice=notice, user=request.user)
        Notice.objects.filter(pk=notice.pk).update(views_count=models.F("views_count") + 1)
        
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        notice = self.get_object()
        Like.objects.get_or_create(notice=notice, user=request.user)
        return Response({"status": "liked"})

    @action(detail=True, methods=["post"])
    def unlike(self, request, pk=None):
        notice = self.get_object()
        Like.objects.filter(notice=notice, user=request.user).delete()
        return Response({"status": "unliked"})

    @action(detail=True, methods=["post"])
    def favorite(self, request, pk=None):
        notice = self.get_object()
        Favorite.objects.get_or_create(notice=notice, user=request.user)
        return Response({"status": "favorited"})

    @action(detail=True, methods=["post"])
    def unfavorite(self, request, pk=None):
        notice = self.get_object()
        Favorite.objects.filter(notice=notice, user=request.user).delete()
        return Response({"status": "unfavorited"})

    @action(detail=False, methods=["get"])
    def favorites(self, request):
        ids = Favorite.objects.filter(user=request.user).values_list("notice_id", flat=True)
        qs = self.get_queryset().filter(id__in=list(ids))
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="comments", throttle_classes=[CommentRateThrottle])
    def comments(self, request, pk=None):
        from moderation.views import check_text_content
        import logging
        
        logger = logging.getLogger(__name__)
        notice = self.get_object()
        
        if request.method.lower() == "get":
            qs = (
                Comment.objects.filter(notice=notice, parent__isnull=True)
                .select_related("user")
                .prefetch_related(
                    "likes",
                    "replies__user",
                    "replies__likes",
                    "replies__replies__user",
                    "replies__replies__likes",
                )
                .order_by("-created_at")
            )
            context = {"request": request, "depth": 0, "max_depth": request.query_params.get("max_depth", 2)}
            return Response(CommentSerializer(qs, many=True, context=context).data)
        
        # POST request - validate comment text before saving
        payload = {**request.data, "notice": notice.id}
        
        # Check comment text for violations
        comment_text = payload.get('text', '')
        if isinstance(comment_text, list):
            comment_text = comment_text[0] if comment_text else ''
        text_result = check_text_content(comment_text)
        
        if not text_result['is_safe']:
            logger.warning(f"Comment rejected by moderation: {text_result['reason']}")
            return Response(
                {"detail": f"Comment violates community guidelines: {text_result['reason']}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CommentSerializer(data=payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(user=request.user, notice=notice)
        response_data = CommentSerializer(comment, context={"request": request}).data
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="comments/(?P<comment_id>[^/.]+)/like")
    def like_comment(self, request, pk=None, comment_id: str = ""):
        notice = self.get_object()
        try:
            comment = notice.comments.get(id=comment_id)
        except Comment.DoesNotExist:
            return Response({"detail": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        CommentLike.objects.get_or_create(comment=comment, user=request.user)
        return Response({"status": "liked"})

    @action(detail=True, methods=["post"], url_path="comments/(?P<comment_id>[^/.]+)/unlike")
    def unlike_comment(self, request, pk=None, comment_id: str = ""):
        notice = self.get_object()
        try:
            comment = notice.comments.get(id=comment_id)
        except Comment.DoesNotExist:
            return Response({"detail": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        CommentLike.objects.filter(comment=comment, user=request.user).delete()
        return Response({"status": "unliked"})

    @action(detail=True, methods=["post"], url_path="attachments", parser_classes=[MultiPartParser, FormParser])
    def attachments(self, request, pk=None):
        from .validators import validate_attachment
        notice = self.get_object()
        uploaded_file = request.FILES.get("file") or request.FILES.get("image")
        if not uploaded_file:
            return Response({"detail": "No file provided"}, status=400)
        
        # Validate file
        try:
            validate_attachment(uploaded_file)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        content_type = getattr(uploaded_file, "content_type", "") or mimetypes.guess_type(uploaded_file.name)[0] or ""
        if content_type.startswith("image/"):
            file_type = "image"
        elif content_type.startswith("video/"):
            file_type = "video"
        elif content_type.startswith("audio/"):
            file_type = "audio"
        else:
            file_type = "document"
        attachment = Attachment.objects.create(
            notice=notice,
            file=uploaded_file,
            file_type=file_type,
            original_name=getattr(uploaded_file, "name", ""),
        )
        
        serializer = AttachmentSerializer(attachment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path="attachments/(?P<attachment_id>[^/.]+)")
    def delete_attachment(self, request, pk=None, attachment_id: str = ""):
        notice = self.get_object()
        if notice.created_by_id != request.user.id and not request.user.is_staff:
            raise permissions.PermissionDenied("Cannot modify attachments for this notice")
        try:
            a = Attachment.objects.get(id=attachment_id, notice=notice)
        except Attachment.DoesNotExist:
            return Response({"detail": "Attachment not found"}, status=404)
        a.delete()
        return Response({"status": "deleted"})

    @action(detail=True, methods=["post"], url_path="report", throttle_classes=[ReportRateThrottle])
    def report(self, request, pk=None):
        notice = self.get_object()
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Report.objects.create(notice=notice, user=request.user, reason=serializer.validated_data["reason"])
        return Response({"status": "reported"})

    def _send_push_to_department(self, notice: Notice) -> None:
        """DEPRECATED: Use deliver_notice_notifications() from .services instead."""
        pass

    @action(detail=False, methods=["get"])
    def trending(self, request):
        # Simple heuristic: most views in recent window
        qs = self.get_queryset().order_by("-views_count", "-created_at")[:50]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="official")
    def official(self, request):
        """
        Get notices from official/leadership roles filtered by user's department and school.
        Rules:
        - Cross-cutting departments (Registrar, Vice Chancellor, Business Office, Head of Security, Chaplain) → all students
        - HOD notices → only students in that department
        - Dean notices → only students in that school
        - Other official notices → filtered by department/school
        """
        user = request.user
        now = timezone.now()
        qs = (
            Notice.objects.filter(is_active=True)
            .filter(Q(scheduled_at__isnull=True) | Q(scheduled_at__lte=now))
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        )
        
        # Filter by official roles
        designation_filter = Q()
        for keyword in OFFICIAL_ROLES_KEYWORDS:
            designation_filter |= Q(created_by__designation__icontains=keyword)
        
        # Check for official designations
        official_designation_filter = Q()
        for desig in OFFICIAL_DESIGNATIONS:
            official_designation_filter |= Q(created_by__designation=desig)
        
        # Base filter for official notices
        official_base_qs = qs.filter(
            Q(created_by__is_staff=True) |
            Q(created_by__is_superuser=True) |
            Q(created_by__is_faculty=True) |
            designation_filter |
            official_designation_filter
        )
        
        # If user is staff, show all official notices
        if getattr(user, "is_staff", False):
            official_qs = official_base_qs
        else:
            # For students, filter based on department/school rules
            user_department = getattr(user, "department", "") or ""
            user_school = getattr(user, "school", "") or ""
            
            # Notices from cross-cutting departments (go to everyone)
            cross_cutting_filter = Q()
            for dept in CROSS_CUTTING_OFFICIAL_DEPARTMENTS:
                cross_cutting_filter |= Q(department__icontains=dept) | Q(created_by__designation__icontains=dept.lower())
            # Also check for official designations that are cross-cutting
            cross_cutting_filter |= Q(created_by__designation__in=["vice_chancellor", "registrar", "business_office", "security"])
            
            # Notices from user's department (HOD notices)
            department_filter = Q()
            if user_department:
                department_filter = Q(department=user_department) | Q(created_by__department=user_department)
            
            # Notices from user's school (Dean notices)
            school_filter = Q()
            if user_school:
                # Match by school name in department or created_by's school
                school_filter = Q(created_by__school=user_school)
            
            # Combine: cross-cutting OR (user's department) OR (user's school)
            official_qs = official_base_qs.filter(
                cross_cutting_filter | department_filter | school_filter
            )
            # Security: Do NOT fall back to all official notices if user has no dept/school.
            # Cross-cutting notices are always visible; department/school notices require matching profile.

        # Order by priority, then pinned, then created_at
        from django.db.models import Case, When, IntegerField
        priority_order = Case(
            When(priority="urgent", then=1),
            When(priority="important", then=2),
            When(priority="normal", then=3),
            default=3,
            output_field=IntegerField(),
        )
        official_qs = official_qs.order_by(priority_order, "-is_pinned", "-created_at")[:50]
        serializer = self.get_serializer(official_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="for-you")
    def for_you(self, request):
        base_qs = self.get_queryset().filter(
            created_by__is_staff=False,
            created_by__is_faculty=False,
        )
        qs = self.filter_queryset(base_qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="category/(?P<category>[^/]+)")
    def by_category(self, request, category: str = ""):
        valid_categories = {choice[0] for choice in NoticeCategory.choices}
        if category not in valid_categories:
            return Response({"detail": "Unknown category"}, status=status.HTTP_400_BAD_REQUEST)
        base_qs = self.get_queryset().filter(category=category)
        qs = self.filter_queryset(base_qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="most-liked")
    def most_liked(self, request):
        qs = self.get_queryset().annotate(num_likes=models.Count("likes")).order_by("-num_likes", "-created_at")[:50]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="suggested")
    def suggested(self, request):
        qs = (
            self.get_queryset()
            .annotate(num_likes=models.Count("likes"), num_comments=models.Count("comments"))
            .order_by("-num_likes", "-num_comments", "-created_at")
        )
        serializer = self.get_serializer(qs[:50], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        notice = self.get_object()
        if notice.created_by_id != request.user.id and not request.user.is_staff:
            raise permissions.PermissionDenied("Cannot pin this notice")
        notice.is_pinned = True
        notice.save(update_fields=["is_pinned"])
        return Response({"status": "pinned"})

    @action(detail=True, methods=["post"], url_path="unpin")
    def unpin(self, request, pk=None):
        notice = self.get_object()
        if notice.created_by_id != request.user.id and not request.user.is_staff:
            raise permissions.PermissionDenied("Cannot unpin this notice")
        notice.is_pinned = False
        notice.save(update_fields=["is_pinned"])
        return Response({"status": "unpinned"})

    @action(detail=True, methods=["post"], url_path="remind")
    def set_reminder(self, request, pk=None):
        notice = self.get_object()
        remind_at = request.data.get("remind_at")
        if not remind_at:
            return Response({"detail": "remind_at is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from datetime import datetime
            remind_datetime = datetime.fromisoformat(remind_at.replace("Z", "+00:00"))
            NoticeReminder.objects.get_or_create(
                notice=notice,
                user=request.user,
                remind_at=remind_datetime,
            )
            return Response({"status": "reminder_set"})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        from django.db.models import Count, Avg, Q
        from datetime import timedelta
        now = timezone.now()
        last_30_days = now - timedelta(days=30)

        total_notices = Notice.objects.count()
        active_notices = Notice.objects.filter(is_active=True).count()
        expired_notices = Notice.objects.filter(expires_at__lte=now).count()
        recent_notices = Notice.objects.filter(created_at__gte=last_30_days).count()

        priority_stats = Notice.objects.values("priority").annotate(count=Count("id"))
        category_stats = Notice.objects.values("category").annotate(count=Count("id"))
        department_stats = Notice.objects.values("department").annotate(count=Count("id")).order_by("-count")[:10]

        avg_views = Notice.objects.aggregate(avg_views=Avg("views_count"))["avg_views"] or 0
        avg_likes = Notice.objects.aggregate(avg_likes=Avg("likes__id"))["avg_likes"] or 0

        return Response({
            "total_notices": total_notices,
            "active_notices": active_notices,
            "expired_notices": expired_notices,
            "recent_notices": recent_notices,
            "priority_stats": list(priority_stats),
            "category_stats": list(category_stats),
            "top_departments": list(department_stats),
            "avg_views": round(avg_views, 2),
            "avg_likes": round(avg_likes, 2),
        })

    @action(detail=False, methods=["get"], url_path="search")
    def search_notices(self, request):
        """Full-text search for notices using PostgreSQL, falling back to icontains on SQLite."""
        query = request.query_params.get("q", "").strip()
        if not query or len(query) < 2:
            return Response(
                {"detail": "Search query must be at least 2 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        from django.db import connection
        
        base_queryset = self.get_queryset()

        if connection.vendor == "postgresql":
            from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
            
            search_vector = (
                SearchVector("title", weight="A")
                + SearchVector("description", weight="B")
                + SearchVector("department", weight="C")
            )
            search_query = SearchQuery(query)
            
            results = (
                base_queryset.annotate(
                    rank=SearchRank(search_vector, search_query)
                )
                .filter(rank__gte=0.1)
                .order_by("-rank")
            )
        else:
            # Fallback for SQLite and other databases
            results = base_queryset.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(department__icontains=query)
            ).order_by("-created_at")
        
        page = self.paginate_queryset(results)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)


class NoticeTemplateViewSet(viewsets.ModelViewSet):
    queryset = NoticeTemplate.objects.all()
    serializer_class = NoticeTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Show public templates or user's own templates
        qs = qs.filter(Q(is_public=True) | Q(created_by=self.request.user))
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

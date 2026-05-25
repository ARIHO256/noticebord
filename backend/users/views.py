from django.db import models
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView

from .models import DeviceToken, FriendRequest, Friendship, User, UserBlock, UserMute
from .serializers import (
    DeviceTokenSerializer,
    EmailTokenObtainPairSerializer,
    FriendRequestSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    UserBlockSerializer,
    UserMuteSerializer,
    UserSerializer,
)
from .authentication import AllowInactiveUserJWTAuthentication
from audit.middleware import log_action
from notifications.signals import create_notification
from users.throttling import LoginRateThrottle, RegisterRateThrottle, FriendRequestRateThrottle


class IsSelfOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_staff:
            return True
        return obj.id == getattr(request.user, "id", None)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["username", "first_name", "last_name", "department", "school", "course"]

    def get_queryset(self):
        qs = User.objects.all().order_by("id")
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return qs.none()
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return qs
        blocked_by_me = UserBlock.objects.filter(blocker=user).values_list("blocked_id", flat=True)
        blocked_me = UserBlock.objects.filter(blocked=user).values_list("blocker_id", flat=True)
        return qs.exclude(id__in=blocked_by_me).exclude(id__in=blocked_me)

    def get_serializer_class(self):
        if self.action in {"list", "faculty", "students", "public"}:
            return PublicUserSerializer
        return UserSerializer

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
        authentication_classes=[AllowInactiveUserJWTAuthentication],
    )
    def me(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def faculty(self, request):
        qs = self.get_queryset().filter(is_faculty=True).order_by("id")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def students(self, request):
        qs = self.get_queryset().filter(is_faculty=False).order_by("id")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy", "retrieve"]:
            return [permissions.IsAuthenticated(), IsSelfOrAdmin()]
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        """
        Allow avatar-only PUT/PATCH requests and always target the current user
        (unless staff explicitly updates someone else). This avoids 403s caused
        by path/user mismatches when uploading avatars.
        """
        partial = True

        # Non-staff users can only update their own profile, regardless of the URL pk.
        if request.user.is_staff or request.user.is_superuser:
            instance = self.get_object()
        else:
            instance = request.user

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="public")
    def public(self, request, pk=None):
        """
        Return a read-only view of another user's profile for authenticated viewers.
        """
        user = get_object_or_404(User, pk=pk)
        serializer = PublicUserSerializer(user, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get", "put"], permission_classes=[permissions.IsAuthenticated], url_path="preferences")
    def preferences(self, request):
        """Get or update user notification preferences and followed departments."""
        user = request.user
        if request.method == "PUT":
            preferences = request.data.get("notification_preferences", {})
            departments = request.data.get("followed_departments", [])
            if isinstance(preferences, dict):
                user.notification_preferences = {**user.notification_preferences, **preferences}
            if isinstance(departments, list):
                user.followed_departments = departments
            user.save()
            
            # Sync with NotificationPreference model
            try:
                from notifications.models import NotificationPreference
                np, _ = NotificationPreference.objects.get_or_create(user=user)
                # Map legacy JSON keys to model fields if provided
                bool_map = {
                    "notify_new_notices": "notify_new_notices",
                    "notify_official_notices": "notify_official_notices",
                    "notify_messages": "notify_messages",
                    "notify_friend_requests": "notify_friend_requests",
                    "notify_comments": "notify_comments",
                    "notify_likes": "notify_likes",
                    "push_new_notices": "push_new_notices",
                    "push_official_notices": "push_official_notices",
                    "push_messages": "push_messages",
                    "email_official_notices": "email_official_notices",
                }
                for json_key, model_field in bool_map.items():
                    if json_key in preferences:
                        setattr(np, model_field, bool(preferences[json_key]))
                np.save()
            except Exception:
                pass  # Don't fail if sync fails
        
        return Response({
            "notification_preferences": user.notification_preferences or {},
            "followed_departments": user.followed_departments or [],
        })

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="follow-department")
    def follow_department(self, request):
        """Follow a department."""
        department = request.data.get("department", "").strip()
        if not department:
            return Response({"detail": "Department is required"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        if department not in user.followed_departments:
            user.followed_departments.append(department)
            user.save()
        return Response({"status": "followed", "followed_departments": user.followed_departments})

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="unfollow-department")
    def unfollow_department(self, request):
        """Unfollow a department."""
        department = request.data.get("department", "").strip()
        if not department:
            return Response({"detail": "Department is required"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        if department in user.followed_departments:
            user.followed_departments.remove(department)
            user.save()
        return Response({"status": "unfollowed", "followed_departments": user.followed_departments})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="block")
    def block_user(self, request, pk=None):
        target = get_object_or_404(User, pk=pk)
        if target.id == request.user.id:
            return Response({"detail": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)

        block, created = UserBlock.objects.get_or_create(blocker=request.user, blocked=target)
        Friendship.remove_between(request.user, target)
        FriendRequest.objects.filter(
            models.Q(sender=request.user, receiver=target)
            | models.Q(sender=target, receiver=request.user)
        ).delete()

        payload = UserBlockSerializer(block, context={"request": request}).data
        payload["status"] = "blocked" if created else "already_blocked"
        return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="unblock")
    def unblock_user(self, request, pk=None):
        target = get_object_or_404(User, pk=pk)
        deleted, _ = UserBlock.objects.filter(blocker=request.user, blocked=target).delete()
        return Response({"status": "unblocked" if deleted else "not_blocked"})

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="blocked")
    def blocked(self, request):
        blocks = UserBlock.objects.filter(blocker=request.user).select_related("blocked")
        serializer = UserBlockSerializer(blocks, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="mute")
    def mute_user(self, request, pk=None):
        target = get_object_or_404(User, pk=pk)
        if target.id == request.user.id:
            return Response({"detail": "You cannot mute yourself."}, status=status.HTTP_400_BAD_REQUEST)
        mute, created = UserMute.objects.get_or_create(muter=request.user, muted=target)
        payload = UserMuteSerializer(mute, context={"request": request}).data
        payload["status"] = "muted" if created else "already_muted"
        return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="unmute")
    def unmute_user(self, request, pk=None):
        target = get_object_or_404(User, pk=pk)
        deleted, _ = UserMute.objects.filter(muter=request.user, muted=target).delete()
        return Response({"status": "unmuted" if deleted else "not_muted"})

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="muted")
    def muted(self, request):
        mutes = UserMute.objects.filter(muter=request.user).select_related("muted")
        serializer = UserMuteSerializer(mutes, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="suspend")
    def suspend(self, request, pk=None):
        """Suspend a user (set is_active=False). Only staff/superusers can suspend."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "You do not have permission to suspend users."},
                status=status.HTTP_403_FORBIDDEN
            )
        user = self.get_object()
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "You cannot suspend superusers."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        before_data = {"is_active": user.is_active}
        user.is_active = False
        user.save()
        
        log_action(
            actor=request.user,
            action="suspend",
            target_type="users.User",
            target_id=user.id,
            target_repr=f"Suspended user {user.username}",
            before_data=before_data,
            after_data={"is_active": False},
            request=request,
        )
        
        # Notify user
        create_notification(
            user=user,
            notification_type="suspension",
            title="Account Suspended",
            message="Your account has been suspended. Please contact administration or submit an appeal.",
            sender=request.user,
            data={"appeal_url": "/api/v1/users/profiles/appeal/"},
        )
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="unsuspend")
    def unsuspend(self, request, pk=None):
        """Unsuspend a user (set is_active=True). Only staff/superusers can unsuspend."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "You do not have permission to unsuspend users."},
                status=status.HTTP_403_FORBIDDEN
            )
        user = self.get_object()
        
        before_data = {"is_active": user.is_active}
        user.is_active = True
        user.save()
        
        log_action(
            actor=request.user,
            action="unsuspend",
            target_type="users.User",
            target_id=user.id,
            target_repr=f"Unsuspended user {user.username}",
            before_data=before_data,
            after_data={"is_active": True},
            request=request,
        )
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="reported")
    def reported(self, request):
        """Get users who have notices that have been reported. Only staff/superusers can access."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "You do not have permission to view reported users."},
                status=status.HTTP_403_FORBIDDEN
            )
        from notices.models import Report
        # Get unique user IDs from reports
        reported_user_ids = Report.objects.values_list('notice__created_by_id', flat=True).distinct()
        reported_users = User.objects.filter(id__in=reported_user_ids).order_by('id')
        serializer = UserSerializer(reported_users, many=True, context={"request": request})
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        authentication_classes=[AllowInactiveUserJWTAuthentication],
        url_path="appeal",
    )
    def appeal(self, request):
        """Submit an appeal for account suspension. Only suspended users can submit appeals."""
        user = request.user
        
        # Check if user is actually suspended
        if user.is_active:
            return Response(
                {"detail": "Your account is not suspended. Appeals are only for suspended accounts."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        message = request.data.get('message', '').strip()
        if not message:
            return Response(
                {"detail": "Appeal message is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(message) < 20:
            return Response(
                {"detail": "Appeal message must be at least 20 characters long."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .models import SuspensionAppeal
        appeal = SuspensionAppeal.objects.create(
            user=user,
            message=message
        )
        
        return Response({
            "id": appeal.id,
            "message": "Appeal submitted successfully. An administrator will review it.",
            "created_at": appeal.created_at.isoformat()
        }, status=status.HTTP_201_CREATED)


class AppealView(APIView):
    authentication_classes = [AllowInactiveUserJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Alias endpoint for suspension appeals that supports inactive users."""
        user = request.user

        if user.is_active:
            return Response(
                {"detail": "Your account is not suspended. Appeals are only for suspended accounts."},
                status=status.HTTP_400_BAD_REQUEST
            )

        message = request.data.get('message', '').strip()
        if not message:
            return Response(
                {"detail": "Appeal message is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(message) < 20:
            return Response(
                {"detail": "Appeal message must be at least 20 characters long."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .models import SuspensionAppeal
        appeal = SuspensionAppeal.objects.create(
            user=user,
            message=message
        )

        return Response({
            "id": appeal.id,
            "message": "Appeal submitted successfully. An administrator will review it.",
            "created_at": appeal.created_at.isoformat()
        }, status=status.HTTP_201_CREATED)


class RegisterViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer
    throttle_classes = [RegisterRateThrottle]

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate email verification token
        user.email_verification_token = get_random_string(64)
        user.email_verified = False
        user.save(update_fields=["email_verification_token", "email_verified"])
        
        # Send verification email
        verification_url = f"{request.scheme}://{request.get_host()}/api/v1/users/verify-email/?token={user.email_verification_token}"
        send_mail(
            subject="Verify your Bugema University NoticeBoard account",
            message=f"Click this link to verify your email: {verification_url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        
        log_action(
            actor=user,
            action="create",
            target_type="users.User",
            target_id=user.id,
            target_repr=f"Registered user {user.username}",
            request=request,
        )
        
        return Response({
            **UserSerializer(user, context={"request": request}).data,
            "message": "Registration successful. Please check your email to verify your account.",
        })

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="register-staff")
    def register_staff(self, request):
        """
        Register staff accounts (VC, Registrar, Business Office, Security, Lecturer, Dean, HOD).
        Requires authentication and staff privileges.
        """
        from .serializers import StaffRegisterSerializer
        
        # Only allow staff/superusers to create staff accounts
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "You do not have permission to create staff accounts."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = StaffRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="register-device")
    def register_device(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DeviceToken.objects.update_or_create(user=request.user, token=serializer.validated_data["token"])
        return Response({"status": "registered"})

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="unregister-device")
    def unregister_device(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DeviceToken.objects.filter(user=request.user, token=serializer.validated_data["token"]).delete()
        return Response({"status": "unregistered"})


class EmailVerificationView(APIView):
    """Verify user email address."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            return Response({"error": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email_verification_token=token)
            user.email_verified = True
            user.email_verification_token = ""
            user.save(update_fields=["email_verified", "email_verification_token"])
            
            log_action(
                actor=user,
                action="update",
                target_type="users.User",
                target_id=user.id,
                target_repr=f"Email verified for {user.username}",
                request=request,
            )
            
            return Response({"message": "Email verified successfully. You can now log in."})
        except User.DoesNotExist:
            return Response({"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)


class ResendVerificationEmailView(APIView):
    """Resend email verification link."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
            if user.email_verified:
                return Response({"message": "Email is already verified."})
            
            user.email_verification_token = get_random_string(64)
            user.save(update_fields=["email_verification_token"])
            
            verification_url = f"{request.scheme}://{request.get_host()}/api/v1/users/verify-email/?token={user.email_verification_token}"
            send_mail(
                subject="Verify your Bugema University NoticeBoard account",
                message=f"Click this link to verify your email: {verification_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
            
            return Response({"message": "Verification email sent."})
        except User.DoesNotExist:
            # Don't reveal if email exists
            return Response({"message": "If an account exists, a verification email has been sent."})


class EmailTokenObtainPairView(TokenObtainPairView):
    """
    SimpleJWT token view that authenticates using email address.
    """
    throttle_classes = [LoginRateThrottle]
    serializer_class = EmailTokenObtainPairSerializer


class FriendRequestViewSet(viewsets.ModelViewSet):
    serializer_class = FriendRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [FriendRequestRateThrottle]

    def get_queryset(self):
        user = self.request.user
        box = self.request.query_params.get("box", "incoming")
        base_qs = FriendRequest.objects.select_related("sender", "receiver")
        if box == "outgoing":
            return base_qs.filter(sender=user, status=FriendRequest.STATUS_PENDING)
        if box == "all":
            return base_qs.filter(models.Q(sender=user) | models.Q(receiver=user))
        return base_qs.filter(receiver=user, status=FriendRequest.STATUS_PENDING)

    def perform_create(self, serializer):
        friend_request = serializer.save()
        create_notification(
            user=friend_request.receiver,
            notification_type="friend_request",
            title=f"{friend_request.sender.get_full_name() or friend_request.sender.username} sent you a friend request",
            message="Open Friends to accept or decline.",
            sender=friend_request.sender,
            data={
                "friend_request_id": str(friend_request.id),
                "sender_id": str(friend_request.sender_id),
            },
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if instance.sender != user and instance.receiver != user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if instance.status != FriendRequest.STATUS_PENDING:
            return Response({"detail": "This request has already been processed."}, status=status.HTTP_400_BAD_REQUEST)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        instance = self.get_object()
        if instance.receiver != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if instance.status != FriendRequest.STATUS_PENDING:
            return Response({"detail": "This request has already been processed."}, status=status.HTTP_400_BAD_REQUEST)
        instance.accept()
        create_notification(
            user=instance.sender,
            notification_type="friend_accepted",
            title=f"{instance.receiver.get_full_name() or instance.receiver.username} accepted your friend request",
            message="You are now friends.",
            sender=instance.receiver,
            data={
                "friend_request_id": str(instance.id),
                "receiver_id": str(instance.receiver_id),
            },
        )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        instance = self.get_object()
        if instance.receiver != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if instance.status != FriendRequest.STATUS_PENDING:
            return Response({"detail": "This request has already been processed."}, status=status.HTTP_400_BAD_REQUEST)
        instance.decline()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class FriendshipViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        friends = Friendship.friends_of(request.user).order_by("first_name", "last_name", "username")
        serializer = UserSerializer(friends, many=True, context={"request": request})
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        friend = get_object_or_404(User, pk=pk)
        if friend == request.user:
            return Response({"detail": "You cannot remove yourself."}, status=status.HTTP_400_BAD_REQUEST)
        Friendship.remove_between(request.user, friend)
        FriendRequest.objects.filter(sender=request.user, receiver=friend).delete()
        FriendRequest.objects.filter(sender=friend, receiver=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

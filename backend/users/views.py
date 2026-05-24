from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView

from .models import DeviceToken, FriendRequest, Friendship, User
from .serializers import (
    DeviceTokenSerializer,
    EmailTokenObtainPairSerializer,
    FriendRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .authentication import AllowInactiveUserJWTAuthentication


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
        qs = User.objects.filter(is_faculty=True).order_by("id")
        return Response(UserSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def students(self, request):
        qs = User.objects.filter(is_faculty=False).order_by("id")
        return Response(UserSerializer(qs, many=True, context={"request": request}).data)

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
        serializer = UserSerializer(user, context={"request": request})
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
        user.is_active = False
        user.save()
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
        user.is_active = True
        user.save()
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

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context={"request": request}).data)

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


class EmailTokenObtainPairView(TokenObtainPairView):
    """
    SimpleJWT token view that authenticates using email address.
    """

    serializer_class = EmailTokenObtainPairSerializer


class FriendRequestViewSet(viewsets.ModelViewSet):
    serializer_class = FriendRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

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
        serializer.save()

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

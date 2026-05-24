from django.db.models import Count, Q
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer, UnreadCountSerializer


class NotificationListView(generics.ListAPIView):
    """List notifications for the current user with filtering."""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user)
        
        # Filter by read status
        is_read = self.request.query_params.get("is_read")
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == "true")
        
        # Filter by type
        notification_type = self.request.query_params.get("type")
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        return queryset.select_related("sender")


class NotificationMarkReadView(APIView):
    """Mark notifications as read."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        notification_ids = request.data.get("ids", [])
        
        if notification_ids:
            # Mark specific notifications as read
            Notification.objects.filter(
                id__in=notification_ids,
                user=request.user,
                is_read=False,
            ).update(is_read=True, read_at=__import__("django.utils.timezone").now())
        else:
            # Mark all as read
            Notification.objects.filter(
                user=request.user,
                is_read=False,
            ).update(is_read=True, read_at=__import__("django.utils.timezone").now())
        
        return Response({"status": "marked_as_read"})


class NotificationDeleteView(APIView):
    """Delete notifications."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        notification_ids = request.data.get("ids", [])
        
        if notification_ids:
            Notification.objects.filter(
                id__in=notification_ids,
                user=request.user,
            ).delete()
        else:
            # Delete all read notifications
            Notification.objects.filter(
                user=request.user,
                is_read=True,
            ).delete()
        
        return Response({"status": "deleted"})


class UnreadCountView(APIView):
    """Get unread notification count."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        unread = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).count()
        total = Notification.objects.filter(user=request.user).count()
        
        return Response({
            "unread_count": unread,
            "total_count": total,
        })


class NotificationPreferenceView(APIView):
    """Get or update notification preferences."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        preference, _ = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(preference)
        return Response(serializer.data)

    def put(self, request):
        preference, _ = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(preference, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

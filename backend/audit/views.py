from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from common.permissions import IsAdminUser
from .models import AuditLog, DataExportRequest, DataDeletionRequest
from .serializers import AuditLogSerializer, DataExportRequestSerializer, DataDeletionRequestSerializer
from .tasks import generate_data_export, process_data_deletion
from .middleware import log_action


class AuditLogListView(generics.ListAPIView):
    """List audit logs (admin only)."""
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        queryset = AuditLog.objects.all()
        
        # Filter by action
        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by actor
        actor_id = self.request.query_params.get("actor")
        if actor_id:
            queryset = queryset.filter(actor_id=actor_id)
        
        # Filter by target
        target_type = self.request.query_params.get("target_type")
        if target_type:
            queryset = queryset.filter(target_type=target_type)
        
        # Date range
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)
        
        return queryset.select_related("actor")


class DataExportRequestView(APIView):
    """Request personal data export (GDPR)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        exports = DataExportRequest.objects.filter(user=request.user)
        serializer = DataExportRequestSerializer(exports, many=True)
        return Response(serializer.data)

    def post(self, request):
        # Check for pending exports
        if DataExportRequest.objects.filter(user=request.user, status__in=["pending", "processing"]).exists():
            return Response(
                {"error": "You already have a pending export request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        export = DataExportRequest.objects.create(user=request.user, status="pending")
        generate_data_export.delay(export.id)
        
        log_action(
            actor=request.user,
            action="data_export",
            target_type="audit.DataExportRequest",
            target_id=export.id,
            target_repr=f"Data export requested by {request.user.username}",
            request=request,
        )
        
        return Response(DataExportRequestSerializer(export).data, status=status.HTTP_201_CREATED)


class DataDeletionRequestView(APIView):
    """Request personal data deletion (GDPR)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        requests = DataDeletionRequest.objects.filter(user=request.user)
        serializer = DataDeletionRequestSerializer(requests, many=True)
        return Response(serializer.data)

    def post(self, request):
        # Check for pending deletions
        if DataDeletionRequest.objects.filter(user=request.user, status__in=["pending", "approved"]).exists():
            return Response(
                {"error": "You already have a pending deletion request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        deletion = DataDeletionRequest.objects.create(
            user=request.user,
            status="pending",
            reason=request.data.get("reason", ""),
        )
        
        log_action(
            actor=request.user,
            action="data_delete",
            target_type="audit.DataDeletionRequest",
            target_id=deletion.id,
            target_repr=f"Data deletion requested by {request.user.username}",
            request=request,
        )
        
        return Response(DataDeletionRequestSerializer(deletion).data, status=status.HTTP_201_CREATED)


class DataDeletionApproveView(APIView):
    """Approve and process a data deletion request (admin only)."""
    permission_classes = [IsAdminUser]

    def post(self, request, deletion_id):
        try:
            deletion = DataDeletionRequest.objects.get(id=deletion_id)
        except DataDeletionRequest.DoesNotExist:
            return Response({"error": "Deletion request not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if deletion.status != "pending":
            return Response(
                {"error": f"Request is already {deletion.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        deletion.status = "approved"
        deletion.reviewed_by = request.user
        deletion.reviewed_at = timezone.now()
        deletion.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        
        # Trigger async deletion
        process_data_deletion.delay(deletion.id)
        
        log_action(
            actor=request.user,
            action="data_delete",
            target_type="audit.DataDeletionRequest",
            target_id=deletion.id,
            target_repr=f"Data deletion approved for {deletion.user.username}",
            request=request,
        )
        
        return Response({"status": "approved", "message": "Data deletion is being processed."})

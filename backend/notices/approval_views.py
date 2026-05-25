from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import models
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from users.command_chain import can_command, get_subordinates
from .models import NoticeApproval
from .approval_workflow import approve_notice, reject_notice, escalate_notice
from .serializers import NoticeApprovalSerializer


class NoticeApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    """API for notice approval workflow management."""
    serializer_class = NoticeApprovalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["status"]
    ordering = ["-submitted_at"]

    def get_queryset(self):
        user = self.request.user
        qs = NoticeApproval.objects.all()

        # Filter by what the user can see
        if self.action == "my_pending":
            return qs.filter(current_reviewer=user, status=NoticeApproval.Status.PENDING)
        if self.action == "my_submissions":
            return qs.filter(submitted_by=user)
        if self.action == "subordinate_approvals":
            # Get approvals for their subordinates' notices
            subordinate_ids = get_subordinates(user).values_list("id", flat=True)
            return qs.filter(submitted_by__id__in=subordinate_ids)

        # Staff sees all
        if user.is_staff:
            return qs

        # Otherwise only their own
        return qs.filter(models.Q(submitted_by=user) | models.Q(current_reviewer=user))

    @action(detail=False, methods=["get"], url_path="my-pending")
    def my_pending(self, request):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my-submissions")
    def my_submissions(self, request):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="subordinate-approvals")
    def subordinate_approvals(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        approval = self.get_object()
        if approval.current_reviewer != request.user and not request.user.is_superuser:
            return Response({"detail": "You are not the assigned reviewer."}, status=status.HTTP_403_FORBIDDEN)
        if approval.status != NoticeApproval.Status.PENDING:
            return Response({"detail": f"Notice is already {approval.status}."}, status=status.HTTP_400_BAD_REQUEST)

        approve_notice(approval, request.user)
        # Activate the notice
        approval.notice.is_active = True
        approval.notice.suspension_reason = ""
        approval.notice.save(update_fields=["is_active", "suspension_reason"])

        return Response({"detail": "Notice approved and published."})

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        approval = self.get_object()
        if approval.current_reviewer != request.user and not request.user.is_superuser:
            return Response({"detail": "You are not the assigned reviewer."}, status=status.HTTP_403_FORBIDDEN)
        if approval.status != NoticeApproval.Status.PENDING:
            return Response({"detail": f"Notice is already {approval.status}."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get("reason", "No reason provided.")
        reject_notice(approval, request.user, reason)
        return Response({"detail": "Notice rejected."})

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        approval = self.get_object()
        if approval.current_reviewer != request.user and not request.user.is_superuser:
            return Response({"detail": "You are not the assigned reviewer."}, status=status.HTTP_403_FORBIDDEN)
        if approval.status != NoticeApproval.Status.PENDING:
            return Response({"detail": f"Notice is already {approval.status}."}, status=status.HTTP_400_BAD_REQUEST)

        escalate_notice(approval, request.user)
        return Response({"detail": "Notice escalated to next reviewer."})

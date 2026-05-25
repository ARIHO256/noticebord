from rest_framework import serializers
from users.serializers import MiniUserSerializer
from .models import NoticeApproval


class NoticeApprovalSerializer(serializers.ModelSerializer):
    notice_title = serializers.CharField(source="notice.title", read_only=True)
    notice_id = serializers.IntegerField(source="notice.id", read_only=True)
    submitted_by = MiniUserSerializer(read_only=True)
    current_reviewer = MiniUserSerializer(read_only=True)
    approved_by = MiniUserSerializer(read_only=True)
    rejected_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = NoticeApproval
        fields = [
            "id",
            "notice_id",
            "notice_title",
            "status",
            "submitted_by",
            "submitted_at",
            "current_reviewer",
            "approved_by",
            "approved_at",
            "rejected_by",
            "rejected_at",
            "rejection_reason",
            "escalation_chain",
        ]
        read_only_fields = fields

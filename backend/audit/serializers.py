from rest_framework import serializers
from .models import AuditLog, DataExportRequest, DataDeletionRequest


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.get_full_name", read_only=True)
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "actor_username",
            "action",
            "target_type",
            "target_id",
            "target_repr",
            "before_data",
            "after_data",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields


class DataExportRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataExportRequest
        fields = ["id", "status", "file", "expires_at", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "file", "expires_at", "created_at", "updated_at"]


class DataDeletionRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataDeletionRequest
        fields = ["id", "status", "reason", "reviewed_by", "reviewed_at", "completed_at", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "reviewed_by", "reviewed_at", "completed_at", "created_at", "updated_at"]

from django.contrib import admin
from .models import AuditLog, DataExportRequest, DataDeletionRequest


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["actor", "action", "target_type", "target_repr", "ip_address", "created_at"]
    list_filter = ["action", "target_type", "created_at"]
    search_fields = ["actor__username", "target_repr", "ip_address"]
    readonly_fields = ["id", "created_at"]
    ordering = ["-created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(DataExportRequest)
class DataExportRequestAdmin(admin.ModelAdmin):
    list_display = ["user", "status", "expires_at", "created_at"]
    list_filter = ["status", "created_at"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(DataDeletionRequest)
class DataDeletionRequestAdmin(admin.ModelAdmin):
    list_display = ["user", "status", "reviewed_by", "created_at"]
    list_filter = ["status", "created_at"]
    readonly_fields = ["id", "created_at", "updated_at"]

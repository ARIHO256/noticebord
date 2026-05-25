from django.contrib import admin
from .models import Group, GroupMembership, GroupMessage


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ["name", "group_type", "member_count", "created_by", "is_active", "created_at"]
    list_filter = ["group_type", "is_active", "is_public"]
    search_fields = ["name", "description"]


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ["group", "user", "role", "is_active", "joined_at"]
    list_filter = ["role", "is_active"]


@admin.register(GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
    list_display = ["group", "sender", "content_preview", "created_at", "is_pinned"]
    list_filter = ["is_pinned"]

    def content_preview(self, obj):
        return obj.content[:50] if obj.content else "[Attachment]"

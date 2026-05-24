from django.contrib import admin

from .models import DeviceToken, FriendRequest, Friendship, SuspensionAppeal, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "first_name", "last_name", "designation", "is_faculty", "is_staff", "school", "department", "course", "academic_year")
    list_filter = ("designation", "is_staff", "is_faculty", "school", "department")
    search_fields = ("username", "email", "first_name", "last_name", "department", "school", "course", "designation")
    fieldsets = (
        ("Authentication", {"fields": ("username", "email", "password")}),
        ("Personal Info", {"fields": ("first_name", "last_name", "phone", "avatar")}),
        ("Role & Designation", {"fields": ("designation", "is_staff", "is_faculty")}),
        ("Academic Info", {"fields": ("school", "department", "course", "academic_year")}),
        ("Permissions", {"fields": ("is_active", "is_superuser", "groups", "user_permissions")}),
        ("Preferences", {"fields": ("push_enabled", "followed_departments", "notification_preferences")}),
    )


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "token", "created_at")


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "receiver", "status", "created_at", "responded_at")
    list_filter = ("status",)
    search_fields = ("sender__username", "receiver__username")


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("id", "user_a", "user_b", "created_at")
    search_fields = ("user_a__username", "user_b__username")


@admin.register(SuspensionAppeal)
class SuspensionAppealAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "message", "reviewed", "reviewed_by", "created_at")
    list_filter = ("reviewed",)
    search_fields = ("user__username", "message")
    readonly_fields = ("created_at", "reviewed_at")


from django.contrib import admin

from .models import (
    Attachment,
    Comment,
    CommentLike,
    Favorite,
    Like,
    Notice,
    NoticeReminder,
    NoticeTemplate,
    NoticeView,
    Report,
)


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "created_by",
        "department",
        "category",
        "views_count",
        "created_at",
        "is_active",
    )
    search_fields = ("title", "description")


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ("id", "notice", "user", "created_at")


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("id", "notice", "user", "created_at")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "notice", "user", "created_at")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "notice", "user", "reason", "created_at")


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "notice", "file_type", "original_name", "created_at")
    list_filter = ("file_type",)


@admin.register(CommentLike)
class CommentLikeAdmin(admin.ModelAdmin):
    list_display = ("id", "comment", "user", "created_at")


@admin.register(NoticeTemplate)
class NoticeTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "priority", "is_public", "created_by", "created_at")
    list_filter = ("category", "priority", "is_public")
    search_fields = ("name", "title_template")


@admin.register(NoticeReminder)
class NoticeReminderAdmin(admin.ModelAdmin):
    list_display = ("id", "notice", "user", "remind_at", "is_sent", "created_at")
    list_filter = ("is_sent",)


@admin.register(NoticeView)
class NoticeViewAdmin(admin.ModelAdmin):
    list_display = ("id", "notice", "user", "created_at")
    readonly_fields = ("created_at",)


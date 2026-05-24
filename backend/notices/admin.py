from django.contrib import admin

from .models import Comment, Favorite, Like, Notice, Report


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


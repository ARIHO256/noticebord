from django.contrib import admin

from .models import Conversation, ConversationMessage


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "user_a", "user_b", "notice", "last_message_at")
    search_fields = ("user_a__username", "user_b__username", "notice__title")
    list_filter = ("notice",)


@admin.register(ConversationMessage)
class ConversationMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "attachment_type", "reply_to_id", "created_at", "read_at")
    search_fields = ("conversation__id", "sender__username", "content")
    list_filter = ("created_at",)

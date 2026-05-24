from django.contrib import admin
from .models import ContentViolation


@admin.register(ContentViolation)
class ContentViolationAdmin(admin.ModelAdmin):
    list_display = ['user', 'violation_type', 'category', 'created_at', 'is_resolved']
    list_filter = ['violation_type', 'category', 'is_resolved', 'created_at']
    search_fields = ['user__username', 'user__email', 'content_preview']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    actions = ['mark_resolved', 'mark_unresolved']
    
    def mark_resolved(self, request, queryset):
        queryset.update(is_resolved=True)
    mark_resolved.short_description = "Mark selected violations as resolved"
    
    def mark_unresolved(self, request, queryset):
        queryset.update(is_resolved=False)
    mark_unresolved.short_description = "Mark selected violations as unresolved"




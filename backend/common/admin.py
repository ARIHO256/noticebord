from django.contrib import admin


class BaseAdmin(admin.ModelAdmin):
    """Base admin with soft delete awareness."""

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs

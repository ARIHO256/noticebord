from django.db import models
from django.conf import settings
from django.utils import timezone


class ContentViolation(models.Model):
    """Track content violations for automatic suspension"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='violations')
    violation_type = models.CharField(max_length=50)  # 'text', 'image', 'video'
    category = models.CharField(max_length=100)  # 'profanity', 'nudity', 'spam', etc.
    content_preview = models.TextField(blank=True)  # Preview of the content (truncated)
    created_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]


def check_and_suspend_user(user):
    """
    DEPRECATED: Automatic user suspension has been disabled.
    Violations are still tracked but users are no longer automatically suspended.
    Manual admin review is required for account suspension.
    """
    return {'suspended': False}




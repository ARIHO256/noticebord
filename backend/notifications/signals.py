from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from .models import Notification, NotificationPreference
from .tasks import send_push_notification, send_email_notification


def create_notification(user, notification_type, title, message, sender=None, data=None):
    """Helper to create a notification and trigger async delivery."""
    if user is None:
        return None
    
    # Check user preferences
    try:
        prefs = user.notification_settings
    except NotificationPreference.DoesNotExist:
        prefs = None
    
    # Determine if we should create in-app notification
    should_notify = True
    type_map = {
        "notice": "notify_new_notices",
        "official_notice": "notify_official_notices",
        "message": "notify_messages",
        "friend_request": "notify_friend_requests",
        "friend_accepted": "notify_friend_requests",
        "comment": "notify_comments",
        "comment_reply": "notify_comments",
        "like": "notify_likes",
        "mention": "notify_mentions",
        "reminder": "notify_reminders",
    }
    pref_field = type_map.get(notification_type)
    if prefs and pref_field and not getattr(prefs, pref_field, True):
        should_notify = False
    
    if not should_notify:
        return None
    
    notification = Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        sender=sender,
        data=data or {},
    )
    
    # Trigger push notification async
    push_field = pref_field.replace("notify_", "push_") if pref_field else None
    if prefs is None or (push_field and getattr(prefs, push_field, True)):
        send_push_notification.delay(notification.id)
    
    # Trigger email for important notifications
    email_types = {
        "official_notice": "email_official_notices",
        "suspension": "email_suspension",
        "reminder": "email_reminders",
    }
    email_field = email_types.get(notification_type)
    if email_field and (prefs is None or getattr(prefs, email_field, False)):
        send_email_notification.delay(notification.id)
    
    return notification


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_notification_preferences(sender, instance, created, **kwargs):
    """Auto-create notification preferences for new users."""
    if created:
        NotificationPreference.objects.get_or_create(user=instance)

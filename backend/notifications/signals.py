from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
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

    # Broadcast real-time event to the user's websocket room.
    channel_layer = get_channel_layer()
    if channel_layer:
        unread_count = Notification.objects.filter(user=user, is_read=False).count()
        payload = {
            "id": str(notification.id),
            "notification_type": notification.notification_type,
            "title": notification.title,
            "message": notification.message,
            "data": notification.data or {},
            "sender": str(notification.sender_id) if notification.sender_id else None,
            "is_read": notification.is_read,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
            "push_sent": notification.push_sent,
            "created_at": notification.created_at.isoformat(),
        }
        async_to_sync(channel_layer.group_send)(
            f"user_{user.id}_notifications",
            {
                "type": "notification_message",
                "notification": payload,
            },
        )
        async_to_sync(channel_layer.group_send)(
            f"user_{user.id}_notifications",
            {
                "type": "unread_count_update",
                "count": unread_count,
            },
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

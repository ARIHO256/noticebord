from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notice, Comment, Like, Favorite, Report
from notifications.signals import create_notification
from audit.middleware import log_action


@receiver(post_save, sender=Notice)
def notify_new_notice(sender, instance, created, **kwargs):
    """Notify followers when a new notice is posted."""
    if not created:
        return
    
    from users.models import User
    
    # Determine notification type
    is_official = instance.category in ["education", "business"] or instance.priority in ["urgent", "important"]
    notif_type = "official_notice" if is_official else "notice"
    
    # Get users who follow this department
    followers = User.objects.filter(
        followed_departments__contains=[instance.department],
        is_active=True,
    ).exclude(id=instance.created_by_id)
    
    for follower in followers:
        create_notification(
            user=follower,
            notification_type=notif_type,
            title=f"New notice in {instance.department}",
            message=instance.title[:200],
            sender=instance.created_by,
            data={
                "notice_id": str(instance.id),
                "department": instance.department,
                "category": instance.category,
                "priority": instance.priority,
            },
        )


@receiver(post_save, sender=Comment)
def notify_new_comment(sender, instance, created, **kwargs):
    """Notify notice author when a new comment is posted."""
    if not created:
        return
    
    # Don't notify if author comments on their own notice
    if instance.notice.created_by == instance.user:
        return
    
    create_notification(
        user=instance.notice.created_by,
        notification_type="comment" if not instance.parent else "comment_reply",
        title=f"New comment on '{instance.notice.title[:50]}...'",
        message=instance.text[:200],
        sender=instance.user,
        data={
            "notice_id": str(instance.notice.id),
            "comment_id": str(instance.id),
        },
    )


@receiver(post_save, sender=Like)
def notify_new_like(sender, instance, created, **kwargs):
    """Notify notice author when their notice is liked."""
    if not created:
        return
    
    if instance.notice.created_by == instance.user:
        return
    
    create_notification(
        user=instance.notice.created_by,
        notification_type="like",
        title=f"{instance.user.get_full_name() or instance.user.username} liked your notice",
        message=instance.notice.title[:200],
        sender=instance.user,
        data={
            "notice_id": str(instance.notice.id),
        },
    )


@receiver(post_save, sender=Report)
def notify_report(sender, instance, created, **kwargs):
    """Notify staff when a notice is reported."""
    if not created:
        return
    
    from users.models import User
    staff = User.objects.filter(is_staff=True, is_active=True)
    
    for admin in staff:
        create_notification(
            user=admin,
            notification_type="report",
            title=f"Notice reported: {instance.notice.title[:50]}...",
            message=f"Reason: {instance.reason}",
            sender=instance.reported_by,
            data={
                "notice_id": str(instance.notice.id),
                "report_id": str(instance.id),
            },
        )


@receiver(post_save, sender=Comment)
def broadcast_comment_update(sender, instance, created, **kwargs):
    """Broadcast comment count update via WebSocket."""
    if not created:
        return
    
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"notice_{instance.notice.id}_updates",
            {
                "type": "notice_update",
                "notice_id": str(instance.notice.id),
                "update_type": "new_comment",
                "comment_count": instance.notice.comments.count(),
            }
        )

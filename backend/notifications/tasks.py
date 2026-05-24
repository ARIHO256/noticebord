import logging
from celery import shared_task
from django.conf import settings
from .models import Notification

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_push_notification(self, notification_id):
    """Send push notification via Expo."""
    try:
        notification = Notification.objects.get(id=notification_id)
        user = notification.user
        
        # Check if user has push enabled and device tokens
        if not user.push_enabled:
            logger.info(f"Push disabled for user {user.id}")
            return {"status": "push_disabled"}
        
        device_tokens = user.device_tokens.all()
        if not device_tokens.exists():
            logger.info(f"No device tokens for user {user.id}")
            return {"status": "no_tokens"}
        
        # Prepare push payload
        messages = []
        for token in device_tokens:
            messages.append({
                "to": token.token,
                "sound": "default",
                "title": notification.title,
                "body": notification.message[:100],
                "data": {
                    "notification_id": str(notification.id),
                    "type": notification.notification_type,
                    **notification.data,
                },
                "badge": user.notifications.filter(is_read=False).count(),
            })
        
        # Send to Expo
        import requests
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        
        if response.status_code == 200:
            notification.mark_push_sent()
            logger.info(f"Push sent for notification {notification_id}")
            return {"status": "sent", "count": len(messages)}
        else:
            logger.error(f"Push failed: {response.status_code} {response.text}")
            notification.push_error = f"{response.status_code}: {response.text[:500]}"
            notification.save(update_fields=["push_error"])
            raise self.retry(countdown=60)
            
    except Notification.DoesNotExist:
        logger.warning(f"Notification {notification_id} not found")
        return {"status": "not_found"}
    except Exception as e:
        logger.exception(f"Push notification error: {e}")
        raise self.retry(countdown=60)


@shared_task(bind=True, max_retries=3)
def send_email_notification(self, notification_id):
    """Send email notification."""
    try:
        from django.core.mail import send_mail
        
        notification = Notification.objects.get(id=notification_id)
        user = notification.user
        
        if not user.email:
            return {"status": "no_email"}
        
        send_mail(
            subject=notification.title,
            message=notification.message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        
        logger.info(f"Email sent to {user.email} for notification {notification_id}")
        return {"status": "sent"}
        
    except Notification.DoesNotExist:
        return {"status": "not_found"}
    except Exception as e:
        logger.exception(f"Email notification error: {e}")
        raise self.retry(countdown=300)


@shared_task
def cleanup_old_notifications():
    """Delete notifications older than retention period."""
    from django.utils import timezone
    from datetime import timedelta
    
    cutoff = timezone.now() - timedelta(days=settings.DATA_RETENTION_DAYS)
    deleted, _ = Notification.objects.filter(created_at__lt=cutoff).delete()
    logger.info(f"Cleaned up {deleted} old notifications")
    return {"deleted": deleted}

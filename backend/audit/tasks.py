import json
import logging
import zipfile
import io
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from django.core.files.base import ContentFile
from .models import DataExportRequest, DataDeletionRequest

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2)
def generate_data_export(self, export_id):
    """Generate a JSON export of user's personal data."""
    try:
        export = DataExportRequest.objects.get(id=export_id)
        export.status = "processing"
        export.save(update_fields=["status"])
        
        user = export.user
        
        # Collect user data
        data = {
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
                "designation": user.designation,
                "department": user.department,
                "school": user.school,
                "course": user.course,
                "academic_year": user.academic_year,
                "date_joined": user.date_joined.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
            "notices": [],
            "comments": [],
            "likes": [],
            "favorites": [],
            "friendships": [],
            "friend_requests": [],
            "messages": [],
            "conversations": [],
            "reports": [],
            "violations": [],
            "notifications": [],
        }
        
        # Export notices
        for notice in user.notices.all():
            data["notices"].append({
                "id": str(notice.id),
                "title": notice.title,
                "description": notice.description,
                "category": notice.category,
                "priority": notice.priority,
                "created_at": notice.created_at.isoformat(),
            })
        
        # Export comments
        for comment in user.notice_comments.all():
            data["comments"].append({
                "id": str(comment.id),
                "text": comment.text,
                "notice_id": str(comment.notice_id),
                "created_at": comment.created_at.isoformat(),
            })
        
        # Export likes
        for like in user.likes.all():
            data["likes"].append({
                "notice_id": str(like.notice_id),
                "created_at": like.created_at.isoformat(),
            })
        
        # Export friendships
        for friendship in user.friendships_as_a.all():
            data["friendships"].append({
                "friend_id": str(friendship.user_b_id),
                "created_at": friendship.created_at.isoformat(),
            })
        for friendship in user.friendships_as_b.all():
            data["friendships"].append({
                "friend_id": str(friendship.user_a_id),
                "created_at": friendship.created_at.isoformat(),
            })
        
        # Export friend requests
        for fr in user.sent_friend_requests.all():
            data["friend_requests"].append({
                "to": fr.receiver.username,
                "status": fr.status,
                "created_at": fr.created_at.isoformat(),
            })
        for fr in user.received_friend_requests.all():
            data["friend_requests"].append({
                "from": fr.sender.username,
                "status": fr.status,
                "created_at": fr.created_at.isoformat(),
            })
        
        # Export messages
        for msg in user.sent_messages.all():
            data["messages"].append({
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            })
        
        # Export notifications
        for notif in user.notifications.all():
            data["notifications"].append({
                "type": notif.notification_type,
                "title": notif.title,
                "message": notif.message,
                "created_at": notif.created_at.isoformat(),
                "is_read": notif.is_read,
            })
        
        # Create ZIP file
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("data_export.json", json.dumps(data, indent=2, default=str))
        
        zip_buffer.seek(0)
        export.file.save(f"export_{user.id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.zip", ContentFile(zip_buffer.read()))
        export.status = "ready"
        export.expires_at = timezone.now() + timedelta(days=7)
        export.save(update_fields=["status", "expires_at"])
        
        logger.info(f"Data export {export_id} completed")
        return {"status": "completed"}
        
    except DataExportRequest.DoesNotExist:
        return {"status": "not_found"}
    except Exception as e:
        logger.exception(f"Data export failed: {e}")
        export.status = "expired"
        export.save(update_fields=["status"])
        raise self.retry(countdown=300)


@shared_task
def process_data_deletion(deletion_id):
    """Process approved data deletion request."""
    try:
        deletion = DataDeletionRequest.objects.get(id=deletion_id)
        user = deletion.user
        
        # Anonymize user data instead of deleting account
        user.email = f"deleted_{user.id}@deleted.local"
        user.first_name = "Deleted"
        user.last_name = "User"
        user.phone = ""
        user.avatar = ""
        user.is_active = False
        user.save()
        
        # Delete personal content
        user.notices.all().delete()
        user.notice_comments.all().delete()
        user.notice_likes.all().delete()
        user.favorite_notices.all().delete()
        user.sent_messages.all().delete()
        user.notifications.all().delete()
        
        deletion.status = "completed"
        deletion.completed_at = timezone.now()
        deletion.save(update_fields=["status", "completed_at"])
        
        logger.info(f"Data deletion {deletion_id} completed for user {user.id}")
        return {"status": "completed"}
        
    except DataDeletionRequest.DoesNotExist:
        return {"status": "not_found"}
    except Exception as e:
        logger.exception(f"Data deletion failed: {e}")
        return {"status": "error", "message": str(e)}


@shared_task
def cleanup_expired_exports():
    """Delete expired data exports."""
    expired = DataExportRequest.objects.filter(
        status="ready",
        expires_at__lt=timezone.now(),
    )
    count = 0
    for export in expired:
        if export.file:
            export.file.delete(save=False)
        export.status = "expired"
        export.save(update_fields=["status"])
        count += 1
    
    logger.info(f"Cleaned up {count} expired exports")
    return {"cleaned": count}

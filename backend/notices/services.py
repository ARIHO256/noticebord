"""
Notice targeting and notification delivery service.
Handles role-based targeting for all university stakeholders.
"""
import logging
from django.db.models import Q
from users.models import User, UserDesignation
from notifications.signals import create_notification
from notifications.tasks import send_push_notification

logger = logging.getLogger(__name__)

# Role hierarchy for targeting
ROLE_HIERARCHY = {
    "vice_chancellor": {"level": 1, "scope": "all"},
    "registrar": {"level": 1, "scope": "all"},
    "business_office": {"level": 1, "scope": "all"},
    "security": {"level": 1, "scope": "all"},
    "dean": {"level": 2, "scope": "school"},
    "hod": {"level": 3, "scope": "department"},
    "lecturer": {"level": 4, "scope": "department"},
    "student": {"level": 5, "scope": "self"},
}

CROSS_CUTTING_ROLES = ["vice_chancellor", "registrar", "business_office", "security"]


def get_notice_target_users(notice):
    """
    Determine which users should receive a notice based on:
    - The creator's role
    - The notice's department/school
    - The notice's category and priority
    - Users' followed departments
    
    Returns a QuerySet of User objects.
    """
    creator = notice.created_by
    creator_designation = (getattr(creator, "designation", "") or "").lower()
    creator_department = (getattr(creator, "department", "") or "").strip()
    creator_school = (getattr(creator, "school", "") or "").strip()
    
    # Start with all active users
    targets = User.objects.filter(is_active=True)
    
    # Cross-cutting roles (VC, Registrar, etc.) → everyone
    if creator_designation in CROSS_CUTTING_ROLES:
        return targets
    
    # Dean → their school (students + faculty)
    if creator_designation == "dean" and creator_school:
        return targets.filter(
            Q(school=creator_school) | 
            Q(designation__in=["dean", "hod", "lecturer"], school=creator_school)
        )
    
    # HOD → their department (students + faculty)
    if creator_designation == "hod" and creator_department:
        return targets.filter(
            Q(department=creator_department) |
            Q(designation__in=["hod", "lecturer"], department=creator_department)
        )
    
    # Lecturer → their department students
    if creator_designation == "lecturer" and creator_department:
        return targets.filter(department=creator_department)
    
    # Student posts → their followers + same department
    # Also include anyone following the notice's department
    notice_department = (notice.department or "").strip()
    
    if notice_department:
        dept_filter = Q(department=notice_department)
        # Users who follow this department
        followed_filter = Q(followed_departments__contains=[notice_department])
        return targets.filter(dept_filter | followed_filter).distinct()
    
    # Fallback: same school
    if creator_school:
        return targets.filter(school=creator_school)
    
    return targets


def get_push_target_users(notice):
    """
    Get users who should receive PUSH notifications for a notice.
    Respects user preferences and global push_enabled.
    """
    targets = get_notice_target_users(notice)
    
    # Only push to users who have push enabled globally
    targets = targets.filter(push_enabled=True)
    
    # Check notification preferences
    from notifications.models import NotificationPreference
    
    # For official notices, only push to users who opted in
    is_official = notice.category in ["education", "business"] or notice.priority in ["urgent", "important"]
    
    if is_official:
        # Get users who want push for official notices
        pref_users = NotificationPreference.objects.filter(
            push_official_notices=True
        ).values_list("user_id", flat=True)
        targets = targets.filter(id__in=pref_users)
    else:
        # Get users who want push for regular notices
        pref_users = NotificationPreference.objects.filter(
            push_new_notices=True
        ).values_list("user_id", flat=True)
        targets = targets.filter(id__in=pref_users)
    
    return targets


def deliver_notice_notifications(notice):
    """
    Deliver both in-app and push notifications for a new notice.
    Creates Notification records and triggers async push delivery.
    """
    creator = notice.created_by
    is_official = notice.category in ["education", "business"] or notice.priority in ["urgent", "important"]
    notif_type = "official_notice" if is_official else "notice"
    
    # 1. In-app notifications
    target_users = get_notice_target_users(notice).exclude(id=creator.id)
    
    for user in target_users:
        create_notification(
            user=user,
            notification_type=notif_type,
            title=f"{'📢 ' if is_official else ''}{notice.department or 'General'}: {notice.title[:80]}",
            message=notice.description[:200] if notice.description else "",
            sender=creator,
            data={
                "notice_id": str(notice.id),
                "department": notice.department or "",
                "category": notice.category,
                "priority": notice.priority,
                "is_official": is_official,
            },
        )
    
    # 2. Push notifications (async)
    push_targets = get_push_target_users(notice).exclude(id=creator.id)
    
    # Batch device tokens
    from users.models import DeviceToken
    device_tokens = DeviceToken.objects.filter(
        user__in=push_targets
    ).select_related("user")
    
    if device_tokens.exists():
        # Chunk into batches of 100 (Expo limit)
        messages = []
        for token in device_tokens:
            messages.append({
                "to": token.token,
                "sound": "default",
                "title": notice.title[:100],
                "body": f"{creator.get_full_name() or creator.username}: {notice.description[:100] if notice.description else ''}",
                "data": {
                    "notice_id": str(notice.id),
                    "type": notif_type,
                    "priority": notice.priority,
                },
                "priority": "high" if notice.priority == "urgent" else "default",
            })
        
        # Send in chunks
        chunk_size = 100
        for i in range(0, len(messages), chunk_size):
            chunk = messages[i:i + chunk_size]
            _send_expo_push_chunk.delay(chunk)
    
    logger.info(f"Delivered notice {notice.id} to {target_users.count()} in-app, {push_targets.count()} push targets")


from celery import shared_task

@shared_task(bind=True, max_retries=3)
def _send_expo_push_chunk(self, messages):
    """Send a chunk of Expo push notifications."""
    import requests
    try:
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        if response.status_code != 200:
            logger.error(f"Expo push failed: {response.status_code} {response.text[:500]}")
            raise self.retry(countdown=60)
        
        result = response.json()
        errors = [item for item in result.get("data", []) if item.get("status") == "error"]
        if errors:
            logger.warning(f"Expo push partial failures: {len(errors)} errors")
        
        return {"status": "sent", "total": len(messages), "errors": len(errors)}
    except Exception as e:
        logger.exception(f"Expo push error: {e}")
        raise self.retry(countdown=60)

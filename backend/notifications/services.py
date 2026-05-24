"""
Notification delivery services for moderation, suspensions, and system events.
"""
import logging
from django.db.models import Q
from .models import Notification
from .tasks import send_push_notification, send_email_notification

logger = logging.getLogger(__name__)


def notify_suspension(notice):
    """Notify the notice owner when their notice is suspended."""
    owner = notice.created_by
    if not owner:
        return
    
    notification = Notification.objects.create(
        user=owner,
        notification_type="suspension",
        title="⚠️ Your notice has been suspended",
        message=f"Your notice '{notice.title[:80]}' was suspended. Reason: {notice.suspension_reason or 'Violation of community guidelines'}",
        data={
            "notice_id": str(notice.id),
            "reason": notice.suspension_reason or "",
            "appeal_url": "/api/v1/users/profiles/appeal/",
        },
    )
    
    # Send push if enabled
    if owner.push_enabled:
        send_push_notification.delay(notification.id)
    
    logger.info(f"Suspension notification sent to user {owner.id} for notice {notice.id}")


def notify_moderation_reviewers(violation):
    """Notify staff/HODs/Deans about new content violations."""
    from users.models import User
    
    # Find relevant reviewers based on violation context
    reviewers = User.objects.filter(
        Q(is_staff=True) | Q(is_superuser=True) | Q(designation__in=["hod", "dean"]),
        is_active=True,
    )
    
    for reviewer in reviewers:
        Notification.objects.create(
            user=reviewer,
            notification_type="report",
            title="🛡️ Content violation detected",
            message=f"{violation.get_violation_type_display()}: {violation.content_preview[:100]}",
            data={
                "violation_id": str(violation.id),
                "user_id": str(violation.user_id) if violation.user else None,
            },
        )
    
    logger.info(f"Moderation alert sent to {reviewers.count()} reviewers for violation {violation.id}")


def notify_comment_reply(parent_comment, reply):
    """Notify the parent comment author when someone replies."""
    if parent_comment.user == reply.user:
        return
    
    Notification.objects.create(
        user=parent_comment.user,
        notification_type="comment_reply",
        title=f"💬 {reply.user.get_full_name() or reply.user.username} replied to your comment",
        message=reply.text[:200],
        sender=reply.user,
        data={
            "notice_id": str(reply.notice_id),
            "comment_id": str(reply.id),
            "parent_id": str(parent_comment.id),
        },
    )


def notify_mention(user, mentioner, notice, text):
    """Notify a user when they are mentioned in a notice or comment."""
    Notification.objects.create(
        user=user,
        notification_type="mention",
        title=f"👋 {mentioner.get_full_name() or mentioner.username} mentioned you",
        message=text[:200],
        sender=mentioner,
        data={
            "notice_id": str(notice.id),
        },
    )


def notify_official_reply_to_sender(notice, comment):
    """
    Notify official notice senders (VC, Registrar, Dean, HOD) when students reply.
    This creates a feedback loop for official communications.
    """
    sender = notice.created_by
    if not sender or sender == comment.user:
        return
    
    # Only for official notices from leadership roles
    sender_designation = (getattr(sender, "designation", "") or "").lower()
    if sender_designation not in ["vice_chancellor", "registrar", "dean", "hod", "lecturer"]:
        return
    
    Notification.objects.create(
        user=sender,
        notification_type="comment",
        title=f"📢 Reply on '{notice.title[:60]}...'",
        message=f"{comment.user.get_full_name() or comment.user.username}: {comment.text[:150]}",
        sender=comment.user,
        data={
            "notice_id": str(notice.id),
            "comment_id": str(comment.id),
        },
    )

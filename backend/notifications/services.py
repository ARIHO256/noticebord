"""
Notification delivery services for ALL app features.
"""
import logging
from django.db.models import Q
from .models import Notification
from .tasks import send_push_notification, send_email_notification

logger = logging.getLogger(__name__)


def _create_notification(user, notification_type, title, message, sender=None, data=None):
    """Helper to create a notification and trigger push."""
    notification = Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        sender=sender,
        data=data or {},
    )
    if user.push_enabled:
        send_push_notification.delay(notification.id)
    return notification


def notify_suspension(notice):
    """Notify the notice owner when their notice is suspended."""
    owner = notice.created_by
    if not owner:
        return
    _create_notification(
        owner, "suspension",
        "⚠️ Your notice has been suspended",
        f"Your notice '{notice.title[:80]}' was suspended. Reason: {notice.suspension_reason or 'Violation of community guidelines'}",
        data={"notice_id": str(notice.id), "reason": notice.suspension_reason or ""},
    )


def notify_moderation_reviewers(violation):
    """Notify staff/HODs/Deans about new content violations."""
    from users.models import User
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
            data={"violation_id": str(violation.id)},
        )


def notify_comment_reply(parent_comment, reply):
    """Notify the parent comment author when someone replies."""
    if parent_comment.user == reply.user:
        return
    _create_notification(
        parent_comment.user, "comment_reply",
        f"💬 {reply.user.get_full_name() or reply.user.username} replied to your comment",
        reply.text[:200],
        sender=reply.user,
        data={"notice_id": str(reply.notice_id), "comment_id": str(reply.id)},
    )


def notify_mention(user, mentioner, notice, text):
    """Notify a user when they are mentioned."""
    _create_notification(
        user, "mention",
        f"👋 {mentioner.get_full_name() or mentioner.username} mentioned you",
        text[:200],
        sender=mentioner,
        data={"notice_id": str(notice.id)},
    )


def notify_official_reply_to_sender(notice, comment):
    """Notify official notice senders when students reply."""
    sender = notice.created_by
    if not sender or sender == comment.user:
        return
    sender_designation = (getattr(sender, "designation", "") or "").lower()
    if sender_designation not in ["vice_chancellor", "registrar", "dean", "hod", "lecturer"]:
        return
    _create_notification(
        sender, "comment",
        f"📢 Reply on '{notice.title[:60]}...'",
        f"{comment.user.get_full_name() or comment.user.username}: {comment.text[:150]}",
        sender=comment.user,
        data={"notice_id": str(notice.id), "comment_id": str(comment.id)},
    )


# ==================== NEW FEATURE NOTIFICATIONS ====================


def notify_event_rsvp(event, user):
    """Notify event creator of new RSVP."""
    _create_notification(
        event.created_by, "event_rsvp",
        f"📅 New RSVP for {event.title}",
        f"{user.get_full_name() or user.username} is going to your event.",
        sender=user,
        data={"event_id": str(event.id), "screen": "EventDetail"},
    )


def notify_event_reminder(event, user):
    """Remind user of upcoming event."""
    _create_notification(
        user, "event_reminder",
        f"⏰ Reminder: {event.title}",
        f"Starts at {event.start_time.strftime('%I:%M %p')} in {event.location or 'TBA'}",
        data={"event_id": str(event.id), "screen": "EventDetail"},
    )


def notify_group_message(group, message, sender):
    """Notify group members of new message (except sender)."""
    from groups.models import GroupMembership
    members = GroupMembership.objects.filter(
        group=group, is_active=True
    ).exclude(user=sender).select_related("user")
    for membership in members:
        _create_notification(
            membership.user, "group_message",
            f"💬 {group.name}: {sender.get_full_name() or sender.username}",
            message.content[:100] or "Sent an attachment",
            sender=sender,
            data={"group_id": str(group.id), "screen": "GroupChat"},
        )


def notify_emergency_alert(alert, user):
    """Send emergency alert notification (override DND)."""
    notification = Notification.objects.create(
        user=user,
        notification_type="emergency",
        title=f"🚨 {alert.title}",
        message=alert.message,
        data={"alert_id": str(alert.id), "screen": "EmergencyContacts"},
    )
    # Always push emergency alerts regardless of user preference
    send_push_notification.delay(notification.id)
    return notification


def notify_assignment_due(assignment, user):
    """Remind student of upcoming assignment deadline."""
    _create_notification(
        user, "assignment_reminder",
        f"📚 Assignment Due Soon: {assignment.title}",
        f"Due on {assignment.due_date.strftime('%Y-%m-%d %H:%M')}. Don't forget to submit!",
        data={"assignment_id": str(assignment.id), "screen": "AcademicHub"},
    )


def notify_exam_published(exam, user):
    """Notify student when exam timetable is published."""
    _create_notification(
        user, "exam_published",
        f"📝 Exam Scheduled: {exam.course.code}",
        f"{exam.exam_type} on {exam.date} at {exam.start_time} in {exam.venue or 'TBA'}",
        data={"exam_id": str(exam.id), "screen": "AcademicHub"},
    )


def notify_venue_booking_status(booking):
    """Notify user when venue booking is approved/rejected."""
    status_text = "approved" if booking.status == "approved" else "rejected"
    _create_notification(
        booking.booked_by, "venue_booking",
        f"🏢 Venue Booking {status_text.title()}",
        f"Your booking for {booking.venue.name} ({booking.event_title}) has been {status_text}.",
        data={"booking_id": str(booking.id), "screen": "VenueBooking"},
    )


def notify_poll_end(poll, notice):
    """Notify poll creator when poll ends."""
    _create_notification(
        notice.created_by, "poll_end",
        f"📊 Poll Ended: {poll.question}",
        f"Total votes: {poll.total_votes}. Check the results!",
        data={"notice_id": str(notice.id), "screen": "NoticeDetail"},
    )

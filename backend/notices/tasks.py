import logging

from celery import shared_task
from django.utils import timezone

from notices.models import NoticeReminder
from notifications.signals import create_notification

logger = logging.getLogger(__name__)


@shared_task
def send_due_notice_reminders():
    """
    Send due notice reminders and mark them delivered.
    """
    now = timezone.now()
    due_reminders = (
        NoticeReminder.objects.select_related("notice", "user")
        .filter(
            is_sent=False,
            remind_at__lte=now,
            notice__is_active=True,
        )
        .exclude(notice__expires_at__isnull=False, notice__expires_at__lte=now)
    )

    sent = 0
    for reminder in due_reminders:
        create_notification(
            user=reminder.user,
            notification_type="reminder",
            title=f"Reminder: {reminder.notice.title[:120]}",
            message=reminder.notice.description[:200] if reminder.notice.description else "",
            sender=reminder.notice.created_by,
            data={
                "notice_id": str(reminder.notice_id),
                "remind_at": reminder.remind_at.isoformat(),
            },
        )
        reminder.is_sent = True
        reminder.save(update_fields=["is_sent"])
        sent += 1

    if sent:
        logger.info("Sent %s due notice reminders", sent)
    return {"sent": sent}

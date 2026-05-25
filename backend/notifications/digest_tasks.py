"""
Celery tasks for email digest delivery.
"""
import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from django.template.loader import render_to_string

from notices.models import Notice
from events.models import Event
from academic.models import Assignment, ExamTimetable

User = get_user_model()
logger = logging.getLogger(__name__)


@shared_task
def send_daily_digests():
    """Send daily email digests to users who opted in."""
    users = User.objects.filter(
        digest_frequency="daily",
        email__isnull=False,
    ).exclude(email="")

    sent = 0
    for user in users:
        try:
            _send_digest(user, "daily")
            sent += 1
        except Exception as e:
            logger.exception(f"Failed to send daily digest to {user.email}: {e}")

    logger.info(f"Sent {sent} daily digests")
    return {"sent": sent}


@shared_task
def send_weekly_digests():
    """Send weekly email digests to users who opted in."""
    users = User.objects.filter(
        digest_frequency="weekly",
        email__isnull=False,
    ).exclude(email="")

    sent = 0
    for user in users:
        try:
            _send_digest(user, "weekly")
            sent += 1
        except Exception as e:
            logger.exception(f"Failed to send weekly digest to {user.email}: {e}")

    logger.info(f"Sent {sent} weekly digests")
    return {"sent": sent}


def _send_digest(user, frequency):
    """Build and send digest email."""
    now = timezone.now()
    if frequency == "daily":
        since = now - timedelta(days=1)
        subject = f"Your Daily Digest — {now.strftime('%A, %B %d')}"
    else:
        since = now - timedelta(days=7)
        subject = f"Your Weekly Digest — Week of {since.strftime('%b %d')}"

    # Gather content
    notices = Notice.objects.filter(
        is_active=True, created_at__gte=since
    ).order_by("-created_at")[:10]

    events = Event.objects.filter(
        is_active=True, start_time__gte=now
    ).order_by("start_time")[:5]

    assignments = Assignment.objects.filter(
        is_published=True, due_date__gte=now
    ).order_by("due_date")[:5]

    exams = ExamTimetable.objects.filter(
        is_published=True, date__gte=now.date()
    ).order_by("date")[:5]

    if not any([notices.exists(), events.exists(), assignments.exists(), exams.exists()]):
        return  # Skip empty digests

    html_message = render_to_string("emails/digest.html", {
        "user": user,
        "frequency": frequency,
        "notices": notices,
        "events": events,
        "assignments": assignments,
        "exams": exams,
        "site_name": "Bugema University NoticeBoard",
    })

    plain_message = f"""
Hello {user.first_name or user.username},

Here's your {frequency} summary from Bugema University NoticeBoard:

📌 Official Notices: {notices.count()} new
📅 Upcoming Events: {events.count()}
📚 Assignments Due: {assignments.count()}
📝 Upcoming Exams: {exams.count()}

View more at: https://noticeboard.bugema.ac.ug
    """.strip()

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=True,
    )

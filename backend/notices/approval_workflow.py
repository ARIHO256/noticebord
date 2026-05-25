"""
Approval workflow for official notices.

Command chain for official posting:
  Student -> auto-post (non-official)
  Lecturer -> HOD approval
  HOD -> Dean approval
  Dean -> VC/Registrar approval
  VC/Registrar -> auto-approve

Emergency notices can bypass approval.
"""

from django.utils import timezone

from users.command_chain import (
    CROSS_CUTTING_DESIGNATIONS,
    CommandLevel,
    get_command_level,
)

from .models import NoticeApproval


def get_required_approver(user):
    """
    Determine who must approve a notice from this user.
    Returns None if no approval is required.
    """
    designation = (getattr(user, "designation", "") or "").lower()
    level = get_command_level(user)

    # Cross-cutting and VC roles do not require approval.
    if designation in CROSS_CUTTING_DESIGNATIONS:
        return None

    # Dean requires VC or Registrar approval.
    if level == CommandLevel.DEAN:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.filter(
            designation__in=["vice_chancellor", "registrar"],
            is_active=True,
        ).first()

    # HOD requires Dean approval (same school).
    if level == CommandLevel.HOD:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.filter(
            designation="dean",
            school=user.school,
            is_active=True,
        ).first()

    # Lecturer requires HOD approval (same department).
    if level == CommandLevel.LECTURER:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.filter(
            designation="hod",
            department=user.department,
            is_active=True,
        ).first()

    # Students post as non-official, so no approval required.
    return None


def requires_approval(user) -> bool:
    """Check if notices from this user require approval."""
    return get_required_approver(user) is not None


def auto_approve_if_eligible(notice):
    """Auto-approve notice if sender does not require approval."""
    if not requires_approval(notice.created_by):
        approval, _ = NoticeApproval.objects.get_or_create(
            notice=notice,
            defaults={
                "submitted_by": notice.created_by,
                "status": NoticeApproval.Status.APPROVED,
                "approved_by": notice.created_by,
                "approved_at": timezone.now(),
            },
        )
        if approval.status != NoticeApproval.Status.APPROVED:
            approval.status = NoticeApproval.Status.APPROVED
            approval.approved_by = notice.created_by
            approval.approved_at = timezone.now()
            approval.save()
        return True
    return False


def submit_for_approval(notice):
    """Submit a notice for approval through the command chain."""
    approver = get_required_approver(notice.created_by)
    if not approver:
        return auto_approve_if_eligible(notice)

    approval, created = NoticeApproval.objects.get_or_create(
        notice=notice,
        defaults={
            "submitted_by": notice.created_by,
            "current_reviewer": approver,
            "status": NoticeApproval.Status.PENDING,
        },
    )
    if not created and approval.status != NoticeApproval.Status.PENDING:
        approval.status = NoticeApproval.Status.PENDING
        approval.current_reviewer = approver
        approval.save()

    from notifications.services import _create_notification

    _create_notification(
        approver,
        "approval_request",
        "Notice Approval Request",
        f"{notice.created_by.get_full_name() or notice.created_by.username} requests approval for: {notice.title[:60]}",
        sender=notice.created_by,
        data={
            "notice_id": str(notice.id),
            "approval_id": str(approval.id),
            "screen": "AdminDashboard",
        },
    )
    return False


def approve_notice(approval, user):
    """Approve a notice; may be followed by escalation logic externally."""
    from notifications.services import _create_notification

    approval.status = NoticeApproval.Status.APPROVED
    approval.approved_by = user
    approval.approved_at = timezone.now()
    approval.current_reviewer = None

    chain = list(approval.escalation_chain)
    chain.append(
        {
            "level": (getattr(user, "designation", "") or "").lower(),
            "user_id": user.id,
            "action": "approved",
            "at": timezone.now().isoformat(),
        }
    )
    approval.escalation_chain = chain
    approval.save()

    _create_notification(
        approval.submitted_by,
        "approval_approved",
        "Notice Approved",
        f"Your notice '{approval.notice.title[:60]}' has been approved by {user.get_full_name() or user.username}.",
        sender=user,
        data={"notice_id": str(approval.notice.id), "screen": "NoticeDetail"},
    )


def reject_notice(approval, user, reason=""):
    """Reject a notice."""
    from notifications.services import _create_notification

    approval.status = NoticeApproval.Status.REJECTED
    approval.rejected_by = user
    approval.rejected_at = timezone.now()
    approval.rejection_reason = reason
    approval.current_reviewer = None
    approval.save()

    notice = approval.notice
    notice.is_active = False
    notice.suspension_reason = f"Rejected by {user.get_full_name() or user.username}: {reason}"
    notice.save(update_fields=["is_active", "suspension_reason"])

    _create_notification(
        approval.submitted_by,
        "approval_rejected",
        "Notice Rejected",
        f"Your notice '{approval.notice.title[:60]}' was rejected. Reason: {reason}",
        sender=user,
        data={"notice_id": str(approval.notice.id), "screen": "NoticeDetail"},
    )


def escalate_notice(approval, user):
    """Escalate a notice to the next higher authority."""
    next_approver = get_required_approver(user)
    if not next_approver:
        approve_notice(approval, user)
        return

    approval.current_reviewer = next_approver
    chain = list(approval.escalation_chain)
    chain.append(
        {
            "level": (getattr(user, "designation", "") or "").lower(),
            "user_id": user.id,
            "action": "escalated",
            "at": timezone.now().isoformat(),
        }
    )
    approval.escalation_chain = chain
    approval.save()

    from notifications.services import _create_notification

    _create_notification(
        next_approver,
        "approval_request",
        "Escalated Notice Approval",
        f"{user.get_full_name() or user.username} escalated: {approval.notice.title[:60]}",
        sender=user,
        data={
            "notice_id": str(approval.notice.id),
            "approval_id": str(approval.id),
            "screen": "AdminDashboard",
        },
    )

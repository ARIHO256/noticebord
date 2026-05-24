import logging
from .models import AuditLog

logger = logging.getLogger("audit")


class AuditLogMiddleware:
    """Middleware to capture IP and User-Agent for audit logs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.audit_ip = self.get_client_ip(request)
        request.audit_user_agent = request.META.get("HTTP_USER_AGENT", "")
        response = self.get_response(request)
        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip


def log_action(actor, action, target_type, target_id="", target_repr="", before_data=None, after_data=None, request=None):
    """Helper to create an audit log entry."""
    try:
        AuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else "",
            target_repr=target_repr[:255],
            before_data=before_data or {},
            after_data=after_data or {},
            ip_address=getattr(request, "audit_ip", None) if request else None,
            user_agent=getattr(request, "audit_user_agent", "") if request else "",
        )
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")

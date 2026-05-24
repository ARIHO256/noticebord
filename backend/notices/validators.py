import os
from django.core.exceptions import ValidationError
from django.conf import settings
from django.utils.translation import gettext_lazy as _


def validate_file_type(file):
    """Validate uploaded file type."""
    content_type = getattr(file, "content_type", None)
    if content_type and content_type not in settings.ALLOWED_FILE_TYPES:
        raise ValidationError(
            _("File type '%(type)s' is not allowed. Allowed types: images, videos, audio, PDF, Word, Excel, and text files."),
            params={"type": content_type},
        )


def validate_file_size(file):
    """Validate uploaded file size."""
    max_size = settings.MAX_UPLOAD_SIZE
    if file.size > max_size:
        raise ValidationError(
            _("File size %(size)s exceeds maximum allowed size of %(max_size)s."),
            params={
                "size": _human_readable_size(file.size),
                "max_size": _human_readable_size(max_size),
            },
        )


def _human_readable_size(size_bytes):
    """Convert bytes to human readable format."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def validate_attachment(file):
    """Combined validation for attachments."""
    validate_file_type(file)
    validate_file_size(file)

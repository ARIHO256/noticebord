import os

DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "*"]

CORS_ALLOW_ALL_ORIGINS = True

# Console email for local development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# SQLite for quick local development (can switch to PostgreSQL via env)
DATABASES = {
    "default": {
        "ENGINE": os.environ.get("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.environ.get("DB_NAME", "db.sqlite3"),
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", ""),
        "PORT": os.environ.get("DB_PORT", ""),
    }
}

# Disable secure headers for local development
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Celery - run tasks synchronously in local dev
CELERY_TASK_ALWAYS_EAGER = True

# Disable throttling in local development to prevent 429 errors during active testing.
# REST_FRAMEWORK is imported from base.py via settings/__init__.py; we mutate it here
# instead of replacing it, to preserve pagination, auth, and other DRF settings.
from .base import REST_FRAMEWORK

REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {}

# Logging to console only in dev
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "DEBUG",
    },
}

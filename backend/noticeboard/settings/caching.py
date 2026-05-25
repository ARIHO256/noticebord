"""Caching configuration for Redis (prod) with safe local defaults."""
import os


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def configure_caching(settings):
    """
    Configure Django caching.

    Default behavior:
      - production: Redis cache
      - local/dev: in-memory cache

    Override behavior with USE_REDIS_CACHE=1 to force Redis in local/dev.
    """
    env = os.environ.get("DJANGO_ENV", "local").lower()
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    use_redis_cache = _as_bool(
        os.environ.get("USE_REDIS_CACHE"),
        default=(env == "production"),
    )

    if not use_redis_cache:
        settings["CACHES"] = {
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "noticeboard-local-cache",
                "TIMEOUT": 300,
            }
        }
        settings["CACHEOPS_ENABLED"] = False
        return

    settings["CACHES"] = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": redis_url,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "SOCKET_CONNECT_TIMEOUT": 5,
                "SOCKET_TIMEOUT": 5,
                "RETRY_ON_TIMEOUT": True,
            },
            "KEY_PREFIX": "noticeboard",
            "TIMEOUT": 300,
        }
    }

    # Cacheops for ORM query caching
    settings["CACHEOPS_REDIS"] = redis_url
    settings["CACHEOPS_DEFAULTS"] = {"timeout": 300}
    settings["CACHEOPS"] = {
        "auth.user": {"ops": "get", "timeout": 600},
        "users.user": {"ops": "get", "timeout": 600},
        "notices.notice": {"ops": "fetch", "timeout": 300},
        "notices.comment": {"ops": "fetch", "timeout": 120},
        "events.event": {"ops": "fetch", "timeout": 300},
        "groups.group": {"ops": "fetch", "timeout": 300},
        "campus.staffdirectory": {"ops": "fetch", "timeout": 600},
        "academic.cour": {"ops": "fetch", "timeout": 600},
        "academic.examtimetable": {"ops": "fetch", "timeout": 300},
    }
    settings["CACHEOPS_DEGRADE_ON_FAILURE"] = True
